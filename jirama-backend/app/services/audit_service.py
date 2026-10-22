"""
Service de traçabilité et d'audit des actions utilisateurs.

Permet d'enregistrer de façon normalisée dans la table journal_activite
chaque événement important survenant dans l'application :
  - Tentatives et succès de connexion / déconnexion
  - Opérations CRUD (Création, Modification, Suppression)
  - Déblocages manuels de comptes
  - Envois d'e-mails aux collecteurs ou utilisateurs
"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models import JournalActivite


def journaliser_action(
    db: Session,
    login: str,
    action: str,
    entite: str,
    details: str,
    id_utilisateur: Optional[int] = None,
    adresse_ip: Optional[str] = None
) -> JournalActivite:
    """
    Enregistre un événement dans le journal d'activité d'audit.

    Args:
        db: Session SQLAlchemy de base de données.
        login: Identifiant de l'utilisateur ayant réalisé l'action.
        action: Type d'action (CONNEXION, DECONNEXION, CREATION, MODIFICATION, SUPPRESSION, etc.).
        entite: Domaine fonctionnel (AUTHENTIFICATION, UTILISATEUR, COLLECTEUR, RELEVE, etc.).
        details: Descriptif explicite en français de l'action exécutée.
        id_utilisateur: Identifiant numérique de l'utilisateur (optionnel).
        adresse_ip: Adresse IP source de la requête (optionnel).

    Returns:
        JournalActivite: L'enregistrement créé en base.
    """
    try:
        entree = JournalActivite(
            id_utilisateur=id_utilisateur,
            login=login,
            action=action.upper(),
            entite=entite.upper(),
            details=details,
            adresse_ip=adresse_ip,
        )
        db.add(entree)
        db.commit()
        db.refresh(entree)
        return entree
    except Exception as exc:
        db.rollback()
        # Ne bloque pas le flux principal en cas d'erreur de journalisation
        print(f"[AUDIT] Erreur lors de l'enregistrement de l'action: {exc}")
        return None
