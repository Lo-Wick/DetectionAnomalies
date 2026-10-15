"""
Routeur de détection et consultation des anomalies.

Une anomalie est un relevé présentant au moins l'une de ces situations :
  - R2 : Lecture nouvelle < lecture précédente SANS observation justificative
  - R4 : Incohérence entre la colonne Tournée Excel et le numéro d'installation

Ce module expose les endpoints permettant de :
  - Lister les anomalies avec filtres (type, période, collecteur)
  - Exporter le rapport d'anomalies en CSV
  - Récupérer les statistiques globales des anomalies
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import Optional
import csv
import io

from app.database import get_db
from app.models import (
    Releve, Installation, Carnet, Tournee, Site, Client,
    Compteur, Collecteur, TypeLecture, Observation, Import
)

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies"])


def _est_inferieur(lecture_nouvelle: str, lecture_precedente: str) -> bool:
    """
    Compare deux valeurs de lecture pour détecter une anomalie de type R2.

    Retourne True si la lecture nouvelle est strictement inférieure
    à la lecture précédente (what would indicate a meter rollback ou une erreur).

    Args:
        lecture_nouvelle: Valeur de la nouvelle lecture (chaîne).
        lecture_precedente: Valeur de la lecture précédente (chaîne).

    Returns:
        bool: True si anomalie R2 détectée, False sinon ou si valeurs non numériques.
    """
    try:
        return int(lecture_nouvelle) < int(lecture_precedente)
    except (ValueError, TypeError):
        return False


def serialiser_anomalie(r: Releve, type_anomalie: str, detail: str) -> dict:
    """
    Convertit un relevé en dictionnaire d'anomalie avec le contexte métier.

    Args:
        r: Instance du modèle Releve avec relations chargées.
        type_anomalie: Code du type d'anomalie (ex: "R2", "R4").
        detail: Description textuelle de l'anomalie pour l'affichage.

    Returns:
        Dictionnaire contenant le relevé et l'information d'anomalie.
    """
    # Récupération de la hiérarchie géographique
    carnet = r.installation.carnet if r.installation else None
    tournee = carnet.tournee if carnet else None
    site = tournee.site if tournee else None

    return {
        "id_releve": r.id_releve,
        "type_anomalie": type_anomalie,
        "detail_anomalie": detail,
        "annee": r.annee,
        "periode": r.periode,
        "installation": r.installation.numero_installation if r.installation else None,
        "type_installation": r.installation.type_installation if r.installation else None,
        "site": site.code_site if site else None,
        "nom_site": site.nom_site if site else None,
        "tournee": tournee.code_tournee if tournee else None,
        "carnet": carnet.code_carnet if carnet else None,
        "nom_client": r.installation.client.nom_client if r.installation and r.installation.client else None,
        "numero_client": r.installation.client.numero_client if r.installation and r.installation.client else None,
        "lecture_precedente": r.lecture_precedente,
        "lecture_nouvelle": r.lecture_nouvelle,
        "observation": r.observation.code_observation if r.observation else None,
        "type_lecture": r.type_lecture.code_type if r.type_lecture else None,
        "collecteur": r.collecteur.nom_collecteur if r.collecteur else None,
        "id_collecteur": r.id_collecteur,
        "date_import": r.import_obj.date_import.isoformat() if r.import_obj and r.import_obj.date_import else None,
    }


def _options_joinedload():
    """
    Retourne la liste des options de chargement anticipé (joinedload).

    Ces options permettent de charger toutes les entités liées en une seule
    requête SQL, évitant ainsi le problème N+1.

    Returns:
        Liste d'options SQLAlchemy joinedload.
    """
    return [
        joinedload(Releve.installation).joinedload(Installation.carnet)
            .joinedload(Carnet.tournee).joinedload(Tournee.site),
        joinedload(Releve.installation).joinedload(Installation.client),
        joinedload(Releve.compteur),
        joinedload(Releve.collecteur),
        joinedload(Releve.type_lecture),
        joinedload(Releve.observation),
        joinedload(Releve.profil),
        joinedload(Releve.import_obj),
    ]


def _detecter_anomalies_r2(releves: list) -> list:
    """
    Applique la règle R2 sur une liste de relevés et retourne les anomalies.

    Règle R2 : Lecture nouvelle < lecture précédente SANS observation.
    Cette situation peut indiquer un compteur défectueux ou une erreur de saisie.

    Args:
        releves: Liste d'objets Releve SQLAlchemy.

    Returns:
        Liste de dictionnaires d'anomalies détectées.
    """
    anomalies = []
    for r in releves:
        # R2 : seulement si pas d'observation et les deux lectures sont présentes
        if (r.lecture_precedente is not None
                and r.lecture_nouvelle is not None
                and r.id_observation is None
                and _est_inferieur(r.lecture_nouvelle, r.lecture_precedente)):

            diff = int(r.lecture_precedente) - int(r.lecture_nouvelle)
            detail = (
                f"Lecture nouvelle ({r.lecture_nouvelle}) < "
                f"précédente ({r.lecture_precedente}) "
                f"— écart de {diff} sans observation"
            )
            anomalies.append(serialiser_anomalie(r, "R2", detail))

    return anomalies


@router.get("/")
def lister_anomalies(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Numéro de page"),
    par_page: int = Query(20, ge=1, le=200, description="Résultats par page"),
    annee: Optional[int] = Query(None, description="Filtrer par année"),
    periode: Optional[int] = Query(None, ge=1, le=12, description="Filtrer par période"),
    id_collecteur: Optional[int] = Query(None, description="Filtrer par collecteur"),
    site: Optional[str] = Query(None, description="Filtrer par code site"),
):
    """
    Liste toutes les anomalies détectées avec filtres et pagination.

    Applique la règle R2 : lecture nouvelle < lecture précédente sans observation.
    Les résultats peuvent être filtrés par année, période, collecteur et site.

    Returns:
        dict: Total, pagination, et liste des anomalies détectées.
    """
    # ─── Construction des conditions SQL de base ────────────────────────────────
    conditions = []

    # Condition R2 : lecture nouvelle < lecture précédente AND pas d'observation
    # On ne peut pas comparer directement des chaînes en SQL pour des nombres,
    # donc on récupère les candidats et on filtre côté Python.
    # Optimisation : on exclut d'abord les relevés avec observation.
    conditions.append(Releve.id_observation.is_(None))
    conditions.append(Releve.lecture_precedente.isnot(None))
    conditions.append(Releve.lecture_nouvelle.isnot(None))

    # Filtres additionnels
    if annee:
        conditions.append(Releve.annee == annee)
    if periode:
        conditions.append(Releve.periode == periode)
    if id_collecteur:
        conditions.append(Releve.id_collecteur == id_collecteur)

    # Filtre par site (via sous-requête)
    if site:
        ids_installations = (
            db.query(Installation.id_installation)
            .join(Carnet, Installation.id_carnet == Carnet.id_carnet)
            .join(Tournee, Carnet.id_tournee == Tournee.id_tournee)
            .join(Site, Tournee.id_site == Site.id_site)
            .filter(Site.code_site == site)
            .scalar_subquery()
        )
        conditions.append(Releve.id_installation.in_(ids_installations))

    # ─── Récupération des candidats potentiels ──────────────────────────────────
    candidats = (
        db.query(Releve)
        .options(*_options_joinedload())
        .filter(and_(*conditions))
        .order_by(Releve.annee.desc(), Releve.periode.desc())
        .all()
    )

    # ─── Application de la règle R2 côté Python ─────────────────────────────────
    # (Nécessaire car la comparaison numérique de chaînes n'est pas fiable en SQL)
    toutes_anomalies = _detecter_anomalies_r2(candidats)

    # ─── Pagination manuelle sur les résultats filtrés ─────────────────────────
    total = len(toutes_anomalies)
    debut = (page - 1) * par_page
    fin = debut + par_page
    page_anomalies = toutes_anomalies[debut:fin]

    return {
        "total": total,
        "page": page,
        "par_page": par_page,
        "pages": (total + par_page - 1) // par_page,
        "resultats": page_anomalies,
    }


@router.get("/stats")
def statistiques_anomalies(db: Session = Depends(get_db)):
    """
    Calcule les statistiques globales des anomalies pour le tableau de bord.

    Retourne :
      - Nombre total d'anomalies R2 détectées
      - Répartition par période (mois) pour l'année en cours
      - Les 5 collecteurs avec le plus d'anomalies

    Returns:
        dict: Statistiques agrégées des anomalies.
    """
    # Récupération de tous les candidats R2 (sans observation, avec deux lectures)
    candidats = (
        db.query(Releve)
        .options(*_options_joinedload())
        .filter(
            Releve.id_observation.is_(None),
            Releve.lecture_precedente.isnot(None),
            Releve.lecture_nouvelle.isnot(None),
        )
        .all()
    )

    # Application de la règle R2
    anomalies = _detecter_anomalies_r2(candidats)
    total = len(anomalies)

    # Répartition par mois (pour les graphiques)
    repartition_periode = {}
    for a in anomalies:
        cle = f"{a['annee']}-{a['periode']:02d}"
        repartition_periode[cle] = repartition_periode.get(cle, 0) + 1

    # Top 5 collecteurs avec le plus d'anomalies
    par_collecteur = {}
    for a in anomalies:
        nom = a["collecteur"] or "Inconnu"
        par_collecteur[nom] = par_collecteur.get(nom, 0) + 1

    top_collecteurs = sorted(par_collecteur.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_anomalies": total,
        "repartition_par_periode": [
            {"periode": k, "count": v}
            for k, v in sorted(repartition_periode.items())
        ],
        "top_collecteurs": [
            {"collecteur": nom, "count": nb}
            for nom, nb in top_collecteurs
        ],
    }


@router.get("/export-csv")
def exporter_anomalies_csv(
    db: Session = Depends(get_db),
    annee: Optional[int] = Query(None),
    periode: Optional[int] = Query(None, ge=1, le=12),
    id_collecteur: Optional[int] = Query(None),
    site: Optional[str] = Query(None),
):
    """
    Exporte les anomalies filtrées au format CSV.

    Utilise les mêmes paramètres de filtre que l'endpoint de liste.

    Returns:
        StreamingResponse: Fichier CSV téléchargeable.
    """
    # Mêmes filtres que pour la liste
    conditions = [
        Releve.id_observation.is_(None),
        Releve.lecture_precedente.isnot(None),
        Releve.lecture_nouvelle.isnot(None),
    ]

    if annee:
        conditions.append(Releve.annee == annee)
    if periode:
        conditions.append(Releve.periode == periode)
    if id_collecteur:
        conditions.append(Releve.id_collecteur == id_collecteur)
    if site:
        ids_installations = (
            db.query(Installation.id_installation)
            .join(Carnet, Installation.id_carnet == Carnet.id_carnet)
            .join(Tournee, Carnet.id_tournee == Tournee.id_tournee)
            .join(Site, Tournee.id_site == Site.id_site)
            .filter(Site.code_site == site)
            .scalar_subquery()
        )
        conditions.append(Releve.id_installation.in_(ids_installations))

    candidats = (
        db.query(Releve)
        .options(*_options_joinedload())
        .filter(and_(*conditions))
        .all()
    )

    # Détection des anomalies R2
    anomalies = _detecter_anomalies_r2(candidats)

    # Génération du CSV en mémoire
    sortie = io.StringIO()
    ecrivain = csv.writer(sortie, delimiter=";")

    # En-tête
    ecrivain.writerow([
        "ID Relevé", "Type Anomalie", "Détail",
        "Année", "Période", "Site", "Tournée",
        "Installation", "Nom Client", "N° Client",
        "Lect. Précédente", "Lect. Nouvelle",
        "Collecteur", "Date Import"
    ])

    # Lignes
    for a in anomalies:
        ecrivain.writerow([
            a["id_releve"], a["type_anomalie"], a["detail_anomalie"],
            a["annee"], a["periode"], a["site"], a["tournee"],
            a["installation"], a["nom_client"], a["numero_client"],
            a["lecture_precedente"], a["lecture_nouvelle"],
            a["collecteur"], a["date_import"],
        ])

    sortie.seek(0)
    return StreamingResponse(
        iter([sortie.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rapport_anomalies.csv"},
    )
