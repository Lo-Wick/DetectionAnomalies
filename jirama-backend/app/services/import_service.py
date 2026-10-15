"""
Service métier pour l'insertion des relevés depuis un fichier Excel JIRAMA.

Ce module gère l'insertion performante et robuste des fichiers volumineux (10 000+ lignes) :
 - Mise en cache mémoire des référentiels (sites, tournées, carnets, types, observations, profils)
   afin d'éviter des dizaines de milliers de requêtes SELECT unitaires.
 - Normalisation défensive des numéros de compte et types d'installation.
 - Utilisation de points de sauvegarde (SAVEPOINTS / begin_nested) pour isoler les erreurs
   ligne par ligne sans faire échouer l'ensemble de la transaction globale.
 - Aucune ligne n'est perdue : toute ligne en erreur est enregistrée avec est_erreur=True
   et son message d'anomalie pour consultation dans la page des relevés.
"""

from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models import (
    Site, Tournee, Carnet, Client, Installation, Compteur,
    Collecteur, TypeLecture, Observation, ProfilClient,
    Import, Releve, Utilisateur
)


def inserer_releves(
    db: Session,
    lignes_valides: List[dict],
    id_collecteur: Optional[int] = None,
    id_utilisateur: Optional[int] = None,
    nom_fichier: str = "import.xlsx",
) -> dict:
    """
    Insère toutes les lignes analysées (y compris avec erreurs ou anomalies).
    Garantit une exécution rapide et infaillible même pour plus de 10 000 lignes.
    
    Args:
        db: Session SQLAlchemy active.
        lignes_valides: Liste des dictionnaires de lignes analysées.
        id_collecteur: ID optionnel du collecteur forcé globalement.
        id_utilisateur: ID de l'utilisateur à l'origine de l'import.
        nom_fichier: Nom du classeur Excel importé.
        
    Returns:
        dict: Statistiques détaillées de l'insertion.
    """
    stats = {
        "inseres": 0,
        "ignores_doublons": 0,
        "erreurs_sauvegardees": 0,
        "anomalies_sauvegardees": 0,
        "erreurs": [],
        "crees": {
            "sites": 0,
            "tournees": 0,
            "carnets": 0,
            "clients": 0,
            "installations": 0,
            "compteurs": 0,
            "types_lecture": 0,
            "observations": 0,
            "profils": 0,
        }
    }

    if not lignes_valides:
        return stats

    # ─── 1. Préchargement en mémoire des référentiels pour haute performance ────
    sites_cache = {s.code_site: s for s in db.query(Site).all()}
    tournees_cache = {(t.id_site, t.code_tournee): t for t in db.query(Tournee).all()}
    carnets_cache = {(c.id_tournee, c.code_carnet): c for c in db.query(Carnet).all()}
    types_cache = {t.code_type: t for t in db.query(TypeLecture).all()}
    obs_cache = {o.code_observation: o for o in db.query(Observation).all()}
    profils_cache = {p.code_profil: p for p in db.query(ProfilClient).all()}
    
    # Caches dynamiques pour clients, installations et compteurs
    clients_cache = {c.numero_client: c for c in db.query(Client).all()}
    installations_cache = {i.numero_installation: i for i in db.query(Installation).all()}
    compteurs_cache = {c.numero_compteur: c for c in db.query(Compteur).all()}

    # ─── 2. Création de l'enregistrement d'import ───────────────────────────────
    if not id_utilisateur:
        user_par_defaut = db.query(Utilisateur).filter_by(role="ADMIN").first() or db.query(Utilisateur).first()
        id_utilisateur = user_par_defaut.id_utilisateur if user_par_defaut else None

    nouvel_import = Import(
        nom_fichier=nom_fichier,
        nombre_lignes=len(lignes_valides),
        id_utilisateur=id_utilisateur,
    )
    db.add(nouvel_import)
    db.flush()

    # ─── 3. Traitement et insertion ligne par ligne ─────────────────────────────
    for index_ligne, ligne in enumerate(lignes_valides):
        # Utilisation d'un point de sauvegarde (savepoint) pour chaque ligne
        # Si une erreur inattendue survient sur une ligne, elle ne contamine pas la transaction
        try:
            with db.begin_nested():
                est_erreur = ligne.get("est_erreur", False)
                message_erreur = ligne.get("message_erreur")
                est_anomalie = ligne.get("est_anomalie", False)
                type_anomalie = ligne.get("type_anomalie")

                installation_obj = None
                compteur_obj = None
                type_lecture_obj = None
                observation_obj = None
                profil_obj = None
                id_collecteur_ligne = id_collecteur

                # ─── A. Gestion Site / Tournée / Carnet ─────────────────────────
                carnet_obj = None
                site_code = str(ligne.get("site") or "").strip()
                if site_code:
                    site = sites_cache.get(site_code)
                    if not site:
                        site = Site(code_site=site_code, nom_site=f"Site {site_code}")
                        db.add(site)
                        db.flush()
                        sites_cache[site_code] = site
                        stats["crees"]["sites"] += 1

                    tournee_code = str(ligne.get("tournee") or "").strip()
                    if tournee_code:
                        cle_tournee = (site.id_site, tournee_code)
                        tournee = tournees_cache.get(cle_tournee)
                        if not tournee:
                            tournee = Tournee(code_tournee=tournee_code, id_site=site.id_site)
                            db.add(tournee)
                            db.flush()
                            tournees_cache[cle_tournee] = tournee
                            stats["crees"]["tournees"] += 1

                        carnet_code = str(ligne.get("carnet") or "").strip()
                        if carnet_code:
                            cle_carnet = (tournee.id_tournee, carnet_code)
                            carnet_obj = carnets_cache.get(cle_carnet)
                            if not carnet_obj:
                                carnet_obj = Carnet(code_carnet=carnet_code, id_tournee=tournee.id_tournee)
                                db.add(carnet_obj)
                                db.flush()
                                carnets_cache[cle_carnet] = carnet_obj
                                stats["crees"]["carnets"] += 1

                # Attribution automatique du collecteur depuis le carnet
                if not id_collecteur_ligne and carnet_obj and carnet_obj.id_collecteur:
                    id_collecteur_ligne = carnet_obj.id_collecteur

                # ─── B. Gestion du Client ───────────────────────────────────────
                client_obj = None
                num_cli = str(ligne.get("numero_client") or "").strip()
                nom_cli = str(ligne.get("nom_client") or "").strip()
                if num_cli:
                    client_obj = clients_cache.get(num_cli)
                    if not client_obj:
                        client_obj = Client(numero_client=num_cli, nom_client=nom_cli or f"Client {num_cli}")
                        db.add(client_obj)
                        db.flush()
                        clients_cache[num_cli] = client_obj
                        stats["crees"]["clients"] += 1
                    elif nom_cli and client_obj.nom_client != nom_cli:
                        client_obj.nom_client = nom_cli

                # ─── C. Gestion de l'Installation ───────────────────────────────
                num_inst = str(ligne.get("installation") or "").strip()
                if num_inst and carnet_obj and client_obj:
                    installation_obj = installations_cache.get(num_inst)
                    if not installation_obj:
                        # Normalisation sécurisée du compte (pad à 4 chiffres si numérique court)
                        compte_brut = str(ligne.get("compte") or "").strip()
                        if compte_brut.isdigit() and len(compte_brut) < 4:
                            compte_propre = compte_brut.zfill(4)
                        else:
                            compte_propre = compte_brut or "0000"

                        # Type d'installation sécurisé
                        type_brut = str(ligne.get("type_installation") or "").strip().upper()
                        type_propre = type_brut if type_brut in ("E", "W") else (type_brut[:1] if type_brut else "E")

                        installation_obj = Installation(
                            numero_installation=num_inst,
                            numero_compte=compte_propre,
                            type_installation=type_propre,
                            id_carnet=carnet_obj.id_carnet,
                            id_client=client_obj.id_client,
                        )
                        db.add(installation_obj)
                        db.flush()
                        installations_cache[num_inst] = installation_obj
                        stats["crees"]["installations"] += 1

                    # Si l'installation existe déjà, déduire son collecteur si non défini
                    if not id_collecteur_ligne and installation_obj.carnet and installation_obj.carnet.id_collecteur:
                        id_collecteur_ligne = installation_obj.carnet.id_collecteur

                # ─── D. Gestion du Compteur ─────────────────────────────────────
                num_cpt = str(ligne.get("compteur") or "").strip()
                if num_cpt and installation_obj:
                    compteur_obj = compteurs_cache.get(num_cpt)
                    if not compteur_obj:
                        compteur_obj = Compteur(
                            numero_compteur=num_cpt,
                            id_installation=installation_obj.id_installation,
                        )
                        db.add(compteur_obj)
                        db.flush()
                        compteurs_cache[num_cpt] = compteur_obj
                        stats["crees"]["compteurs"] += 1

                # ─── E. Type de lecture ─────────────────────────────────────────
                code_t = str(ligne.get("type_lecture") or "").strip()
                if code_t:
                    type_lecture_obj = types_cache.get(code_t)
                    if not type_lecture_obj:
                        type_lecture_obj = TypeLecture(code_type=code_t, description=f"Type {code_t}")
                        db.add(type_lecture_obj)
                        db.flush()
                        types_cache[code_t] = type_lecture_obj
                        stats["crees"]["types_lecture"] += 1

                # ─── F. Observation ─────────────────────────────────────────────
                code_o = str(ligne.get("observation") or "").strip()
                if code_o:
                    observation_obj = obs_cache.get(code_o)
                    if not observation_obj:
                        observation_obj = Observation(code_observation=code_o, description=f"Observation {code_o}")
                        db.add(observation_obj)
                        db.flush()
                        obs_cache[code_o] = observation_obj
                        stats["crees"]["observations"] += 1

                # ─── G. Profil client ───────────────────────────────────────────
                code_p = str(ligne.get("profil_client") or "").strip()
                if code_p:
                    profil_obj = profils_cache.get(code_p)
                    if not profil_obj:
                        profil_obj = ProfilClient(code_profil=code_p, description=f"Profil {code_p}")
                        db.add(profil_obj)
                        db.flush()
                        profils_cache[code_p] = profil_obj
                        stats["crees"]["profils"] += 1

                # ─── H. Création de la ligne de Relevé ───────────────────────────
                releve = Releve(
                    annee=ligne.get("annee"),
                    periode=ligne.get("periode"),
                    lecture_precedente=ligne.get("lecture_precedente"),
                    lecture_nouvelle=ligne.get("lecture_nouvelle"),
                    id_installation=installation_obj.id_installation if installation_obj else None,
                    id_compteur=compteur_obj.id_compteur if compteur_obj else None,
                    id_collecteur=id_collecteur_ligne,
                    id_type_lecture=type_lecture_obj.id_type_lecture if type_lecture_obj else None,
                    id_observation=observation_obj.id_observation if observation_obj else None,
                    id_profil=profil_obj.id_profil if profil_obj else None,
                    id_import=nouvel_import.id_import,
                    # Suivi erreurs et anomalies
                    est_erreur=est_erreur,
                    message_erreur=message_erreur,
                    est_anomalie=est_anomalie,
                    type_anomalie=type_anomalie,
                    # Sauvegarde brute pour traçabilité parfaite
                    numero_installation_brut=ligne.get("installation"),
                    nom_client_brut=ligne.get("nom_client"),
                    numero_client_brut=ligne.get("numero_client"),
                    numero_compteur_brut=ligne.get("compteur"),
                    code_tournee_brut=ligne.get("tournee"),
                    code_carnet_brut=ligne.get("carnet"),
                )
                db.add(releve)
                stats["inseres"] += 1

                if est_erreur:
                    stats["erreurs_sauvegardees"] += 1
                if est_anomalie:
                    stats["anomalies_sauvegardees"] += 1

        except Exception as err_ligne:
            # En cas d'erreur imprévue sur une ligne, le savepoint est annulé
            # On enregistre la ligne comme relevé en erreur sans bloquer le reste de l'import
            try:
                with db.begin_nested():
                    releve_secours = Releve(
                        annee=ligne.get("annee"),
                        periode=ligne.get("periode"),
                        lecture_precedente=ligne.get("lecture_precedente"),
                        lecture_nouvelle=ligne.get("lecture_nouvelle"),
                        id_import=nouvel_import.id_import,
                        est_erreur=True,
                        message_erreur=f"Anomalie de format : {err_ligne}",
                        numero_installation_brut=ligne.get("installation"),
                        nom_client_brut=ligne.get("nom_client"),
                        numero_client_brut=ligne.get("numero_client"),
                        numero_compteur_brut=ligne.get("compteur"),
                        code_tournee_brut=ligne.get("tournee"),
                        code_carnet_brut=ligne.get("carnet"),
                    )
                    db.add(releve_secours)
                    stats["inseres"] += 1
                    stats["erreurs_sauvegardees"] += 1
            except Exception:
                pass

            stats["erreurs"].append({
                "ligne": ligne.get("ligne", index_ligne + 2),
                "installation": ligne.get("installation"),
                "erreur": str(err_ligne),
            })

    # Mise à jour finale du total de relevés de l'import et validation définitive
    nouvel_import.nombre_lignes = stats["inseres"]
    db.commit()

    return stats