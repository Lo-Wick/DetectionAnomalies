"""
Fichier de configuration de la base de données PostgreSQL.

Ce module initialise le moteur SQLAlchemy, la session locale,
et la classe de base pour tous les modèles ORM.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Création du moteur SQLAlchemy connecté à PostgreSQL
# echo=False → les requêtes SQL ne sont pas affichées dans la console (mode production silencieux)
engine = create_engine(settings.DATABASE_URL, echo=False)

# Fabrique de sessions : chaque session est indépendante
# autocommit=False → les transactions sont validées manuellement avec db.commit()
# autoflush=False  → les modifications ne sont pas envoyées automatiquement avant chaque requête
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe de base dont héritent tous les modèles SQLAlchemy
Base = declarative_base()


def get_db():
    """
    Générateur de session de base de données.

    Utilisé comme dépendance FastAPI via Depends(get_db).
    Garantit que la session est toujours fermée après chaque requête,
    même en cas d'erreur.

    Yields:
        Session: session SQLAlchemy active.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        # Fermeture garantie de la session pour libérer la connexion
        db.close()