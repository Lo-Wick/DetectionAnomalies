"""
Point d'entrée principal de l'API JIRAMA.

Ce module crée l'application FastAPI, configure le middleware CORS,
crée les tables en base de données si elles n'existent pas,
et enregistre tous les routeurs (groupes d'endpoints).

Endpoints disponibles :
  - /api/auth         : Authentification (login, auto-login QR)
  - /api/sites        : Gestion des sites géographiques
  - /api/tournees     : Gestion des tournées
  - /api/carnets      : Gestion des carnets
  - /api/referentiels : Clients, collecteurs, observations, profils, types lecture
  - /api/utilisateurs : Gestion des comptes utilisateurs (ADMIN uniquement)
  - /api/imports      : Import et historique des fichiers Excel
  - /api/releves      : Consultation et filtrage des relevés
  - /api/anomalies    : Détection et gestion des anomalies
  - /api/stats        : Statistiques pour le tableau de bord
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app import models  # noqa: F401 — nécessaire pour que SQLAlchemy découvre tous les modèles
from app.routers import (
    auth,
    sites,
    tournees,
    carnets,
    referentiels,
    utilisateurs,
    imports,
    releves,
    anomalies,
    stats,
    profil,
)


# ─── Création automatique des tables ───────────────────────────────────────────
# Si les tables n'existent pas encore en base, elles sont créées ici.
# En production, on utilisera des migrations Alembic à la place.
Base.metadata.create_all(bind=engine)

# ─── Application FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title="API JIRAMA — Détection d'anomalies",
    version="1.0.0",
    description="API de gestion et d'analyse des relevés de compteurs JIRAMA à Mahajanga."
)

# ─── Middleware CORS ───────────────────────────────────────────────────────────
# Autoriser le frontend React (localhost:5173) à appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Enregistrement des routeurs ───────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(sites.router)
app.include_router(tournees.router)
app.include_router(carnets.router)
app.include_router(referentiels.router)
app.include_router(utilisateurs.router)
app.include_router(imports.router)
app.include_router(releves.router)
app.include_router(anomalies.router)
app.include_router(stats.router)
app.include_router(profil.router)



@app.get("/", tags=["Santé"])
def root():
    """Endpoint de santé : vérifie que l'API est opérationnelle."""
    return {"message": "API JIRAMA opérationnelle", "version": "1.0.0"}
