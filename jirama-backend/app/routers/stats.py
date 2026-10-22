"""
Routeur des statistiques globales pour le tableau de bord.

Ce module expose un endpoint unique qui agrège les données
nécessaires au tableau de bord de l'application JIRAMA :
  - Compteurs généraux (relevés, anomalies, imports, clients)
  - Évolution mensuelle des relevés et anomalies
  - Dernières anomalies détectées
  - Imports récents
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from collections import defaultdict

from app.database import get_db
from app.models import (
    Releve, Import, Client, Site, Collecteur,
    Installation, Carnet, Tournee, Observation
)

router = APIRouter(prefix="/api/stats", tags=["Statistiques"])


def _est_anomalie_r2(releve: Releve) -> bool:
    """
    Vérifie si un relevé est une anomalie de type R2.

    Règle R2 : lecture nouvelle < lecture précédente ET pas d'observation.

    Args:
        releve: Instance du modèle Releve.

    Returns:
        bool: True si anomalie R2, False sinon.
    """
    if (releve.lecture_precedente is None
            or releve.lecture_nouvelle is None
            or releve.id_observation is not None):
        return False
    try:
        return int(releve.lecture_nouvelle) < int(releve.lecture_precedente)
    except (ValueError, TypeError):
        return False


@router.get("/dashboard")
def statistiques_dashboard(db: Session = Depends(get_db)):
    """
    Calcule et retourne toutes les statistiques nécessaires au tableau de bord.

    Données retournées :
      - total_releves : Nombre total de relevés en base
      - total_anomalies : Nombre d'anomalies R2 détectées
      - total_imports : Nombre d'imports enregistrés
      - total_clients : Nombre de clients distincts
      - total_sites : Nombre de sites
      - evolution_mensuelle : Évolution sur les 12 dernières périodes
      - dernieres_anomalies : Les 5 dernières anomalies détectées
      - derniers_imports : Les 5 derniers imports

    Returns:
        dict: Toutes les statistiques agrégées pour le tableau de bord.
    """
    # ─── Compteurs généraux ─────────────────────────────────────────────────────
    total_releves = db.query(func.count(Releve.id_releve)).scalar()
    total_imports = db.query(func.count(Import.id_import)).scalar()
    total_clients = db.query(func.count(Client.id_client)).scalar()
    total_sites = db.query(func.count(Site.id_site)).scalar()

    # ─── Détection des anomalies R2 ────────────────────────────────────────────
    # Pré-filtre SQL pour réduire le volume à analyser côté Python
    candidats_anomalies = (
        db.query(Releve)
        .filter(
            Releve.id_observation.is_(None),
            Releve.lecture_precedente.isnot(None),
            Releve.lecture_nouvelle.isnot(None),
        )
        .options(
            joinedload(Releve.installation).joinedload(Installation.client),
            joinedload(Releve.installation).joinedload(Installation.carnet)
                .joinedload(Carnet.tournee).joinedload(Tournee.site),
            joinedload(Releve.collecteur),
            joinedload(Releve.observation),
            joinedload(Releve.import_obj),
        )
        .order_by(Releve.annee.desc(), Releve.periode.desc())
        .all()
    )

    # Application de la règle R2 côté Python
    anomalies = [r for r in candidats_anomalies if _est_anomalie_r2(r)]
    total_anomalies = len(anomalies)

    # ─── Évolution mensuelle ────────────────────────────────────────────────────
    # Agrégation des relevés et anomalies par (annee, periode)
    tous_releves = (
        db.query(Releve.annee, Releve.periode)
        .order_by(Releve.annee.asc(), Releve.periode.asc())
        .all()
    )

    # Comptage des relevés par période
    releves_par_periode = defaultdict(int)
    for r in tous_releves:
        cle = f"{r.annee}-{r.periode:02d}"
        releves_par_periode[cle] += 1

    # Comptage des anomalies par période
    anomalies_par_periode = defaultdict(int)
    for a in anomalies:
        cle = f"{a.annee}-{a.periode:02d}"
        anomalies_par_periode[cle] += 1

    # Fusion dans une liste triée (12 dernières périodes)
    toutes_periodes = sorted(set(releves_par_periode.keys()) | set(anomalies_par_periode.keys()))
    evolution_mensuelle = [
        {
            "periode": p,
            "releves": releves_par_periode.get(p, 0),
            "anomalies": anomalies_par_periode.get(p, 0),
        }
        for p in toutes_periodes[-12:]  # Les 12 dernières périodes seulement
    ]

    # ─── Dernières anomalies (5 plus récentes) ─────────────────────────────────
    dernieres_anomalies = []
    for r in anomalies[:5]:
        carnet = r.installation.carnet if r.installation else None
        tournee = carnet.tournee if carnet else None
        site = tournee.site if tournee else None
        diff = int(r.lecture_precedente) - int(r.lecture_nouvelle)
        dernieres_anomalies.append({
            "id_releve": r.id_releve,
            "installation": r.installation.numero_installation if r.installation else None,
            "nom_client": r.installation.client.nom_client if r.installation and r.installation.client else None,
            "site": site.code_site if site else None,
            "annee": r.annee,
            "periode": r.periode,
            "lecture_precedente": r.lecture_precedente,
            "lecture_nouvelle": r.lecture_nouvelle,
            "ecart": diff,
            "collecteur": r.collecteur.nom_collecteur if r.collecteur else None,
        })

    # ─── Derniers imports (5 plus récents) ─────────────────────────────────────
    derniers_imports_raw = (
        db.query(Import)
        .options(joinedload(Import.utilisateur))
        .order_by(Import.date_import.desc())
        .limit(5)
        .all()
    )

    derniers_imports = [
        {
            "id_import": imp.id_import,
            "nom_fichier": imp.nom_fichier,
            "date_import": imp.date_import.isoformat() if imp.date_import else None,
            "nombre_lignes": imp.nombre_lignes,
            "utilisateur": imp.utilisateur.nom_utilisateur if imp.utilisateur else "—",
        }
        for imp in derniers_imports_raw
    ]

    # ─── Répartition des anomalies par site ────────────────────────────────────
    anomalies_par_site = defaultdict(int)
    for a in anomalies:
        carnet = a.installation.carnet if a.installation else None
        tournee = carnet.tournee if carnet else None
        site = tournee.site if tournee else None
        code_site = site.code_site if site else "Inconnu"
        anomalies_par_site[code_site] += 1

    repartition_sites = [
        {"site": code, "count": nb}
        for code, nb in sorted(anomalies_par_site.items(), key=lambda x: x[1], reverse=True)
    ]

    # ─── Retour de toutes les statistiques ─────────────────────────────────────
    return {
        # Compteurs principaux
        "total_releves": total_releves,
        "total_anomalies": total_anomalies,
        "total_imports": total_imports,
        "total_clients": total_clients,
        "total_sites": total_sites,

        # Pour les graphiques
        "evolution_mensuelle": evolution_mensuelle,
        "repartition_anomalies_par_site": repartition_sites,

        # Pour les tableaux d'aperçu
        "dernieres_anomalies": dernieres_anomalies,
        "derniers_imports": derniers_imports,
    }


@router.get("/observations")
def statistiques_observations(
    annee: Optional[int] = Query(None, description="Filtrer par année"),
    mois: Optional[int] = Query(None, ge=1, le=12, description="Filtrer par mois / période (1-12)"),
    db: Session = Depends(get_db),
):
    """
    Calcule la distribution des observations présentes dans les relevés de compteurs.

    Permet un filtrage ciblé par année et/ou par mois (période 1-12),
    ou la restitution de toutes les observations sans aucun filtre si non spécifié.

    Returns:
        dict: Statistiques d'observations avec pourcentages, totaux et options de filtrage disponibles.
    """
    # ─── Options disponibles pour alimenter dynamiquement les menus déroulants ───
    annees_disponibles_raw = (
        db.query(Releve.annee)
        .filter(Releve.annee.isnot(None))
        .distinct()
        .order_by(Releve.annee.desc())
        .all()
    )
    annees_disponibles = [int(a[0]) for a in annees_disponibles_raw]

    # Mois disponibles (si une année est sélectionnée, on restreint aux mois de cette année)
    mois_query = db.query(Releve.periode).filter(Releve.periode.isnot(None))
    if annee:
        mois_query = mois_query.filter(Releve.annee == annee)
    mois_disponibles_raw = mois_query.distinct().order_by(Releve.periode.asc()).all()
    mois_disponibles = [int(m[0]) for m in mois_disponibles_raw]

    # ─── Construction de la requête pour les observations ─────────────────────────
    conditions = [Releve.id_observation.isnot(None)]
    if annee:
        conditions.append(Releve.annee == annee)
    if mois:
        conditions.append(Releve.periode == mois)

    lignes_obs = (
        db.query(
            Observation.code_observation,
            Observation.description,
            func.count(Releve.id_releve).label("total")
        )
        .join(Observation, Releve.id_observation == Observation.id_observation)
        .filter(and_(*conditions))
        .group_by(Observation.code_observation, Observation.description)
        .order_by(func.count(Releve.id_releve).desc())
        .all()
    )

    total_general = sum(l[2] for l in lignes_obs)

    donnees = []
    for code, description, count in lignes_obs:
        pourcentage = round((count / total_general * 100), 2) if total_general > 0 else 0
        donnees.append({
            "code": code,
            "description": description or f"Observation {code}",
            "nom_affiche": f"{code} - {description}" if description else code,
            "total": count,
            "pourcentage": pourcentage,
        })

    return {
        "annee_selectionnee": annee,
        "mois_selectionne": mois,
        "total_observations": total_general,
        "annees_disponibles": annees_disponibles,
        "mois_disponibles": mois_disponibles,
        "donnees": donnees,
    }

