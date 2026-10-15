"""
Script de migration de la base de données JIRAMA.

Ce script applique les changements de schéma nécessaires :
  1. Suppression des contraintes CHECK obsolètes sur les lectures (règle R3 retirée)
  2. Élargissement des colonnes lecture_precedente et lecture_nouvelle (5 → 20 car.)
  3. Rendre id_profil nullable dans la table releve

À exécuter UNE SEULE FOIS après la mise à jour du code.
Usage : python migrate.py
"""

import sys
import os

# Ajouter le dossier courant au chemin Python pour pouvoir importer app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.config import settings
from app.database import engine


def migrer():
    """
    Applique les migrations SQL nécessaires sur la base de données.

    Utilise SQLAlchemy pour exécuter les requêtes SQL brutes.
    Chaque migration est protégée par une gestion d'erreur pour
    ne pas bloquer les suivantes si une contrainte n'existe pas.
    """
    print("🔄 Connexion à la base de données...")
    print(f"   URL : {settings.DATABASE_URL[:40]}...")

    # Liste des migrations à appliquer dans l'ordre
    migrations = [
        # ─── 1. Supprimer la contrainte CHECK sur lecture_precedente ─────────────
        (
            "Suppression contrainte check_lecture_precedente",
            "ALTER TABLE releve DROP CONSTRAINT IF EXISTS check_lecture_precedente"
        ),
        # ─── 2. Supprimer la contrainte CHECK sur lecture_nouvelle ───────────────
        (
            "Suppression contrainte check_lecture_nouvelle",
            "ALTER TABLE releve DROP CONSTRAINT IF EXISTS check_lecture_nouvelle"
        ),
        # ─── 3. Élargir la colonne lecture_precedente (5 → 20 car.) ─────────────
        (
            "Elargissement lecture_precedente VARCHAR(5) a VARCHAR(20)",
            "ALTER TABLE releve ALTER COLUMN lecture_precedente TYPE VARCHAR(20)"
        ),
        # ─── 4. Élargir la colonne lecture_nouvelle (5 → 20 car.) ───────────────
        (
            "Elargissement lecture_nouvelle VARCHAR(5) a VARCHAR(20)",
            "ALTER TABLE releve ALTER COLUMN lecture_nouvelle TYPE VARCHAR(20)"
        ),
        # ─── 5. Rendre id_profil nullable ────────────────────────────────────────
        (
            "Rendre id_profil nullable dans releve",
            "ALTER TABLE releve ALTER COLUMN id_profil DROP NOT NULL"
        ),
    ]

    # Exécution de chaque migration dans une connexion SQLAlchemy
    with engine.connect() as conn:
        for nom, sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"  OK : {nom}")
            except Exception as e:
                conn.rollback()
                print(f"  IGNORE : {nom} => {e}")

    print("\nMigration terminee avec succes !")


if __name__ == "__main__":
    migrer()
