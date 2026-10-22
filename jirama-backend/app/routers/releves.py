"""
Routeur de gestion des relevés de compteurs.

Ce module expose les endpoints permettant de :
  - Lister les relevés avec filtres multicritères et pagination
  - Récupérer le détail d'un relevé par son identifiant
  - Exporter les relevés filtrés en CSV

Les relevés sont en lecture seule dans cette API : ils ne sont créés
que par l'import de fichiers Excel (voir routers/imports.py).
"""

from fastapi import APIRouter, Depends, Query, Header, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import Optional
import csv
import io

from app.database import get_db
from app.models import (
    Releve, Installation, Compteur, Client, Site, Tournee, Carnet,
    Collecteur, TypeLecture, Observation, ProfilClient, Import
)

router = APIRouter(prefix="/api/releves", tags=["Relevés"])


def serialiser_releve(r: Releve) -> dict:
    """
    Convertit un objet Releve SQLAlchemy en dictionnaire JSON.
    Gère les lignes normales, les anomalies et les lignes avec erreurs.
    Récupère la description complète du type de lecture et attribue
    le collecteur d'après la tournée / carnet si non défini directement.
    """
    # Hiérarchie géographique via l'installation
    carnet = r.installation.carnet if r.installation else None
    tournee = carnet.tournee if carnet else None
    site = tournee.site if tournee else None

    # Tournée dérivée de l'installation ou des données brutes
    code_tournee = tournee.code_tournee if tournee else (
        r.code_tournee_brut or (r.numero_installation_brut[3:5] if (r.numero_installation_brut and len(r.numero_installation_brut) >= 5) else None)
    )
    code_carnet = carnet.code_carnet if carnet else (
        r.code_carnet_brut or (r.numero_installation_brut[5:7] if (r.numero_installation_brut and len(r.numero_installation_brut) >= 7) else None)
    )
    code_site = site.code_site if site else (
        r.numero_installation_brut[0:3] if (r.numero_installation_brut and len(r.numero_installation_brut) >= 3) else None
    )

    # Attribution du collecteur : direct ou déduit du carnet
    nom_collecteur = None
    email_collecteur = None
    id_coll = None
    if r.collecteur:
        nom_collecteur = r.collecteur.nom_collecteur
        email_collecteur = r.collecteur.email
        id_coll = r.collecteur.id_collecteur
    elif carnet and carnet.collecteur:
        nom_collecteur = carnet.collecteur.nom_collecteur
        email_collecteur = carnet.collecteur.email
        id_coll = carnet.collecteur.id_collecteur

    # Calcul anomalie R2
    est_anomalie_r2 = (
        r.lecture_precedente is not None
        and r.lecture_nouvelle is not None
        and r.id_observation is None
        and _est_inferieur(r.lecture_nouvelle, r.lecture_precedente)
    )
    est_anomalie = r.est_anomalie or est_anomalie_r2

    return {
        "id_releve": r.id_releve,
        "annee": r.annee,
        "periode": r.periode,
        "lecture_precedente": r.lecture_precedente,
        "lecture_nouvelle": r.lecture_nouvelle,

        # Informations installation
        "installation": r.installation.numero_installation if r.installation else r.numero_installation_brut,
        "type_installation": r.installation.type_installation if r.installation else (
            r.numero_installation_brut[11:12] if (r.numero_installation_brut and len(r.numero_installation_brut) >= 12) else None
        ),

        # Hiérarchie géographique
        "site": code_site,
        "nom_site": site.nom_site if site else "",
        "tournee": code_tournee,
        "carnet": code_carnet,

        # Informations client
        "numero_client": (r.installation.client.numero_client if (r.installation and r.installation.client) else None) or r.numero_client_brut,
        "nom_client": (r.installation.client.nom_client if (r.installation and r.installation.client) else None) or r.nom_client_brut,

        # Compteur
        "numero_compteur": (r.compteur.numero_compteur if r.compteur else None) or r.numero_compteur_brut,

        # Collecteur attribué (selon carnet / tournée)
        "collecteur": nom_collecteur or "Non attribué",
        "id_collecteur": id_coll,
        "email_collecteur": email_collecteur,

        # Type de lecture avec code ET description
        "type_lecture": r.type_lecture.code_type if r.type_lecture else None,
        "description_type_lecture": r.type_lecture.description if r.type_lecture else "",
        "type_lecture_complet": (
            f"{r.type_lecture.code_type} — {r.type_lecture.description}"
            if (r.type_lecture and r.type_lecture.description)
            else (r.type_lecture.code_type if r.type_lecture else "—")
        ),

        # Observation
        "observation": r.observation.code_observation if r.observation else None,
        "description_observation": r.observation.description if r.observation else "",

        # Profil
        "profil": r.profil.code_profil if r.profil else None,
        "description_profil": r.profil.description if r.profil else "",

        # Traçabilité
        "id_import": r.id_import,
        "date_import": r.import_obj.date_import.isoformat() if (r.import_obj and r.import_obj.date_import) else None,

        # Suivi des erreurs et anomalies
        "est_erreur": r.est_erreur,
        "message_erreur": r.message_erreur,
        "est_anomalie": est_anomalie,
        "type_anomalie": r.type_anomalie or ("R2 - Lecture régressive sans observation" if est_anomalie_r2 else None),
        "anomalie_lecture": est_anomalie_r2,
    }


def _est_inferieur(lecture_nouvelle: str, lecture_precedente: str) -> bool:
    """
    Compare deux valeurs de lecture.
    Retourne True si lecture_nouvelle < lecture_précédente.
    """
    try:
        return int(lecture_nouvelle) < int(lecture_precedente)
    except (ValueError, TypeError):
        return False


def construire_filtres(
    db: Session,
    annee: Optional[int],
    periode: Optional[int],
    site: Optional[str],
    tournee: Optional[str],
    id_collecteur: Optional[int],
    type_lecture: Optional[str],
    observation: Optional[str],
    profil: Optional[str],
    recherche: Optional[str],
    statut: Optional[str],
):
    """
    Construit les conditions de filtrage multicritères.
    Permet de filtrer par tournée d'après l'installation et par statut (anomalies / erreurs).
    """
    conditions = []

    if annee:
        conditions.append(Releve.annee == annee)

    if periode:
        conditions.append(Releve.periode == periode)

    if site:
        conditions.append(
            (
                Releve.id_installation.in_(
                    db.query(Installation.id_installation)
                    .join(Carnet, Installation.id_carnet == Carnet.id_carnet)
                    .join(Tournee, Carnet.id_tournee == Tournee.id_tournee)
                    .join(Site, Tournee.id_site == Site.id_site)
                    .filter(Site.code_site == site)
                    .scalar_subquery()
                )
            )
            | (Releve.numero_installation_brut.like(f"{site}%"))
        )

    # Filtre selon la tournée d'après l'installation (ou via carnet / données brutes)
    if tournee:
        conditions.append(
            (
                Releve.id_installation.in_(
                    db.query(Installation.id_installation)
                    .join(Carnet, Installation.id_carnet == Carnet.id_carnet)
                    .join(Tournee, Carnet.id_tournee == Tournee.id_tournee)
                    .filter(Tournee.code_tournee == tournee)
                    .scalar_subquery()
                )
            )
            | (Releve.code_tournee_brut == tournee)
            | (Releve.numero_installation_brut.like(f"___{tournee}%"))
        )

    # Filtre par collecteur (direct sur relevé ou via carnet)
    if id_collecteur:
        conditions.append(
            (Releve.id_collecteur == id_collecteur)
            | (
                Releve.id_installation.in_(
                    db.query(Installation.id_installation)
                    .join(Carnet, Installation.id_carnet == Carnet.id_carnet)
                    .filter(Carnet.id_collecteur == id_collecteur)
                    .scalar_subquery()
                )
            )
        )

    if type_lecture:
        conditions.append(
            Releve.id_type_lecture.in_(
                db.query(TypeLecture.id_type_lecture)
                .filter(TypeLecture.code_type == type_lecture)
                .scalar_subquery()
            )
        )

    if observation:
        conditions.append(
            Releve.id_observation.in_(
                db.query(Observation.id_observation)
                .filter(Observation.code_observation == observation)
                .scalar_subquery()
            )
        )

    if profil:
        conditions.append(
            Releve.id_profil.in_(
                db.query(ProfilClient.id_profil)
                .filter(ProfilClient.code_profil == profil)
                .scalar_subquery()
            )
        )

    # Filtre rapide par statut : anomalies uniquement ou erreurs uniquement
    if statut == "anomalies":
        conditions.append(Releve.est_anomalie == True)
    elif statut == "erreurs":
        conditions.append(Releve.est_erreur == True)

    # Recherche textuelle
    if recherche:
        terme = f"%{recherche}%"
        conditions.append(
            (
                Releve.id_installation.in_(
                    db.query(Installation.id_installation)
                    .join(Client, Installation.id_client == Client.id_client)
                    .filter(
                        (Installation.numero_installation.ilike(terme))
                        | (Client.numero_client.ilike(terme))
                        | (Client.nom_client.ilike(terme))
                    )
                    .scalar_subquery()
                )
            )
            | (Releve.numero_installation_brut.ilike(terme))
            | (Releve.nom_client_brut.ilike(terme))
            | (Releve.numero_client_brut.ilike(terme))
            | (Releve.numero_compteur_brut.ilike(terme))
        )

    return conditions


@router.get("/")
def lister_releves(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Numéro de page"),
    par_page: int = Query(20, ge=1, le=100, description="Taille de page"),
    annee: Optional[int] = Query(None, description="Année"),
    periode: Optional[int] = Query(None, ge=1, le=12, description="Période (mois 1-12)"),
    site: Optional[str] = Query(None, description="Code site"),
    tournee: Optional[str] = Query(None, description="Code tournée"),
    id_collecteur: Optional[int] = Query(None, description="ID collecteur"),
    type_lecture: Optional[str] = Query(None, description="Code type lecture"),
    observation: Optional[str] = Query(None, description="Code observation"),
    profil: Optional[str] = Query(None, description="Code profil client"),
    statut: Optional[str] = Query("tous", description="Statut : 'tous', 'anomalies', 'erreurs'"),
    recherche: Optional[str] = Query(None, description="Recherche textuelle"),
):
    """
    Liste tous les relevés (y compris erreurs et anomalies) avec pagination et statistiques.
    """
    conditions = construire_filtres(
        db, annee, periode, site, tournee, id_collecteur, type_lecture, observation, profil, recherche, statut
    )

    # Conditions de base pour les compteurs globaux (sans le filtre statut)
    conditions_sans_statut = construire_filtres(
        db, annee, periode, site, tournee, id_collecteur, type_lecture, observation, profil, recherche, "tous"
    )

    requete_base = db.query(Releve).filter(and_(*conditions_sans_statut))
    total_tous = requete_base.count()
    total_anomalies = requete_base.filter(Releve.est_anomalie == True).count()
    total_erreurs = requete_base.filter(Releve.est_erreur == True).count()

    # Requête avec filtre statut appliqué
    requete = (
        db.query(Releve)
        .options(
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.tournee).joinedload(Tournee.site),
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.collecteur),
            joinedload(Releve.installation).joinedload(Installation.client),
            joinedload(Releve.compteur),
            joinedload(Releve.collecteur),
            joinedload(Releve.type_lecture),
            joinedload(Releve.observation),
            joinedload(Releve.profil),
            joinedload(Releve.import_obj),
        )
        .filter(and_(*conditions))
        .order_by(Releve.annee.desc(), Releve.periode.desc(), Releve.id_releve.desc())
    )

    total = requete.count()
    offset = (page - 1) * par_page
    releves = requete.offset(offset).limit(par_page).all()

    # Sérialisation des résultats
    resultats = [serialiser_releve(r) for r in releves]

    return {
        "total": total,
        "total_tous": total_tous,
        "total_anomalies": total_anomalies,
        "total_erreurs": total_erreurs,
        "page": page,
        "par_page": par_page,
        "pages": (total + par_page - 1) // par_page if total > 0 else 1,
        "anomalies_sur_page": sum(1 for r in resultats if r.get("est_anomalie")),
        "erreurs_sur_page": sum(1 for r in resultats if r.get("est_erreur")),
        "resultats": resultats,
    }


@router.get("/export-csv")
def exporter_releves_csv(
    db: Session = Depends(get_db),
    annee: Optional[int] = Query(None),
    periode: Optional[int] = Query(None, ge=1, le=12),
    site: Optional[str] = Query(None),
    tournee: Optional[str] = Query(None),
    id_collecteur: Optional[int] = Query(None),
    type_lecture: Optional[str] = Query(None),
    observation: Optional[str] = Query(None),
    profil: Optional[str] = Query(None),
    statut: Optional[str] = Query("tous"),
    recherche: Optional[str] = Query(None),
):
    """
    Exporte les relevés filtrés au format CSV (sans pagination).
    Utilise les mêmes paramètres de filtre que l'endpoint de liste.
    Limite à 10 000 lignes pour éviter la surcharge serveur.
    """
    conditions = construire_filtres(
        db, annee, periode, site, tournee, id_collecteur, type_lecture, observation, profil, recherche, statut
    )

    releves = (
        db.query(Releve)
        .options(
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.tournee).joinedload(Tournee.site),
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.collecteur),
            joinedload(Releve.installation).joinedload(Installation.client),
            joinedload(Releve.compteur),
            joinedload(Releve.collecteur),
            joinedload(Releve.type_lecture),
            joinedload(Releve.observation),
            joinedload(Releve.profil),
            joinedload(Releve.import_obj),
        )
        .filter(and_(*conditions))
        .order_by(Releve.annee.desc(), Releve.periode.desc())
        .limit(10000)
        .all()
    )

    sortie = io.StringIO()
    ecrivain = csv.writer(sortie, delimiter=";")

    ecrivain.writerow([
        "ID", "Année", "Période", "Site", "Tournée", "Carnet",
        "Installation", "Type", "Client N°", "Nom Client",
        "Compteur", "Lect. Précédente", "Lect. Nouvelle",
        "Code Type Lecture", "Description Type Lecture", "Observation", "Profil", "Collecteur",
        "Statut", "Détail Anomalie / Erreur", "Date Import"
    ])

    for r in releves:
        s = serialiser_releve(r)
        statut_libelle = "Erreur" if s["est_erreur"] else ("Anomalie" if s["est_anomalie"] else "Normal")
        detail = s.get("message_erreur") or s.get("type_anomalie") or "—"
        ecrivain.writerow([
            s["id_releve"],
            s["annee"] or "—",
            s["periode"] or "—",
            s["site"] or "—",
            s["tournee"] or "—",
            s["carnet"] or "—",
            s["installation"] or "—",
            s["type_installation"] or "—",
            s["numero_client"] or "—",
            s["nom_client"] or "—",
            s["numero_compteur"] or "—",
            s["lecture_precedente"] or "—",
            s["lecture_nouvelle"] or "—",
            s["type_lecture"] or "—",
            s["description_type_lecture"] or "—",
            s["observation"] or "—",
            s["profil"] or "—",
            s["collecteur"] or "—",
            statut_libelle,
            detail,
            s["date_import"] or "—",
        ])

    # Envoi de la réponse en streaming
    sortie.seek(0)
    return StreamingResponse(
        iter([sortie.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=releves_export.csv"},
    )


@router.get("/{id_releve}")
def detail_releve(id_releve: int, db: Session = Depends(get_db)):
    """
    Retourne le détail complet d'un relevé par son identifiant.

    Args:
        id_releve: Identifiant unique du relevé.

    Returns:
        dict: Toutes les informations du relevé avec les données liées.

    Raises:
        HTTPException 404: Si le relevé n'existe pas.
    """
    from fastapi import HTTPException

    r = (
        db.query(Releve)
        .options(
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.tournee).joinedload(Tournee.site),
            joinedload(Releve.installation).joinedload(Installation.client),
            joinedload(Releve.compteur),
            joinedload(Releve.collecteur),
            joinedload(Releve.type_lecture),
            joinedload(Releve.observation),
            joinedload(Releve.profil),
            joinedload(Releve.import_obj),
        )
        .filter(Releve.id_releve == id_releve)
        .first()
    )

    if not r:
        raise HTTPException(404, "Relevé introuvable")

    return serialiser_releve(r)


@router.post("/{id_releve}/alerter-collecteur")
def alerter_collecteur(
    id_releve: int,
    request: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Envoie un ordre de mission par e-mail direct au collecteur responsable
    de l'installation concernée par une anomalie ou une erreur.
    Lui demande de refaire la collecte sur le terrain et de revenir au bureau.

    Si le collecteur n'a pas d'adresse e-mail renseignée, l'opération est refusée.
    """
    from fastapi import HTTPException
    from app.services.email_service import notifier_collecteur_recollecte
    from app.services.audit_service import journaliser_action
    from app.models import Utilisateur

    adresse_ip = request.client.host if request.client else None

    # Identification de l'utilisateur émetteur (si token fourni)
    login_operateur = "Système"
    id_user = None
    if authorization and authorization.startswith("Bearer token_"):
        try:
            id_user = int(authorization.replace("Bearer token_", ""))
            user = db.query(Utilisateur).filter_by(id_utilisateur=id_user).first()
            if user:
                login_operateur = user.login
        except Exception:
            pass

    # Récupération du relevé avec ses relations
    r = (
        db.query(Releve)
        .options(
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.tournee).joinedload(Tournee.site),
            joinedload(Releve.installation).joinedload(Installation.client),
            joinedload(Releve.collecteur),
            joinedload(Releve.observation),
        )
        .filter(Releve.id_releve == id_releve)
        .first()
    )

    if not r:
        raise HTTPException(404, "Relevé introuvable")

    # Détermination du collecteur (direct ou via le carnet)
    carnet = r.installation.carnet if r.installation else None
    collecteur = r.collecteur or (carnet.collecteur if carnet else None)

    if not collecteur:
        raise HTTPException(
            400,
            "Aucun collecteur n'est attribué à cette tournée/carnet. "
            "Veuillez d'abord assigner un collecteur dans la gestion des collecteurs."
        )

    if not collecteur.email or "@" not in collecteur.email:
        raise HTTPException(
            400,
            f"Le collecteur '{collecteur.nom_collecteur}' ne possède pas d'adresse e-mail. "
            f"Veuillez renseigner son e-mail dans la page Collecteurs pour pouvoir lui transmettre des alertes."
        )

    # Données pour l'e-mail
    num_inst = (r.installation.numero_installation if r.installation else r.numero_installation_brut) or "Inconnue"
    tournee_code = carnet.tournee.code_tournee if (carnet and carnet.tournee) else (r.code_tournee_brut or "?")
    carnet_code = carnet.code_carnet if carnet else (r.code_carnet_brut or "?")
    client_nom = (r.installation.client.nom_client if (r.installation and r.installation.client) else r.nom_client_brut) or ""
    motif = r.message_erreur or r.type_anomalie or "Anomalie de relevé constatée"

    # Envoi de l'e-mail d'alerte / recolle
    resultat_envoi = notifier_collecteur_recollecte(
        email_collecteur=collecteur.email,
        nom_collecteur=collecteur.nom_collecteur,
        numero_installation=num_inst,
        tournee=tournee_code,
        carnet=carnet_code,
        client_nom=client_nom,
        anomalie=motif
    )

    if not resultat_envoi.get("succes"):
        raise HTTPException(500, resultat_envoi.get("message", "Échec lors de l'envoi de l'e-mail."))

    # Journalisation d'audit de l'envoi
    journaliser_action(
        db=db,
        login=login_operateur,
        id_utilisateur=id_user,
        action="ENVOI_EMAIL_COLLECTEUR",
        entite="RELEVE",
        details=(
            f"Ordre de recollecte transmis par e-mail à '{collecteur.nom_collecteur}' "
            f"({collecteur.email}) pour l'installation {num_inst} (Tournée {tournee_code}-Carnet {carnet_code})."
        ),
        adresse_ip=adresse_ip
    )

    return {
        "message": f"Ordre de recollecte transmis avec succès à {collecteur.nom_collecteur} ({collecteur.email}).",
        "email_collecteur": collecteur.email,
        "nom_collecteur": collecteur.nom_collecteur,
        "numero_installation": num_inst,
        "simule": resultat_envoi.get("simule", False)
    }

