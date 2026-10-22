"""
Routeur de gestion du profil personnel de l'utilisateur connecté.

Permet à chaque agent ou administrateur de :
  - Consulter les informations de son compte et ses statistiques personnelles
  - Modifier son nom complet, son identifiant (login) et son adresse e-mail
  - Modifier son mot de passe de manière sécurisée (avec vérification de l'ancien)
  - Consulter, régénérer et télécharger son QR code de connexion rapide
  - Consulter son historique d'audit personnel (connexions, actions CRUD, imports)
"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import bcrypt
from datetime import datetime

from app.database import get_db
from app.models import Utilisateur, Import, JournalActivite
from app.utils.helpers import (
    generer_token_qr, generer_qr_code_base64, generer_expiration_token
)
from app.services.audit_service import journaliser_action
from app.services.email_service import envoyer_email

router = APIRouter(prefix="/api/profil", tags=["Profil Utilisateur"])


# ============ SCHÉMAS PYDANTIC POUR LE PROFIL ============
class ModificationProfilRequest(BaseModel):
    nom_utilisateur: str
    login: str
    email: Optional[str] = None


class ChangementMotDePasseRequest(BaseModel):
    ancien_mot_de_passe: str
    nouveau_mot_de_passe: str


def hash_password(password: str) -> str:
    """Hache un mot de passe en clair avec bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Vérifie un mot de passe avec son hash bcrypt."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_utilisateur_connecte(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> Utilisateur:
    """
    Extrait et valide l'utilisateur actuellement connecté depuis l'en-tête Authorization.
    Accessible à tout compte actif (ADMIN ou USER).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Session non authentifiée. Veuillez vous connecter.")

    token = authorization.replace("Bearer ", "")
    try:
        id_user = int(token.replace("token_", ""))
    except ValueError:
        raise HTTPException(401, "Jeton de session invalide.")

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_user).first()
    if not user or not user.actif:
        raise HTTPException(401, "Compte utilisateur inactif ou introuvable.")

    return user


# ============ 1. CONSULTER MON PROFIL ET STATISTIQUES ============
@router.get("/moi")
def obtenir_mon_profil(
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_utilisateur_connecte)
):
    """
    Retourne la fiche complète de l'utilisateur connecté avec :
      - Identité, identifiant, rôle et e-mail
      - QR Code de connexion instantanée
      - Statistiques personnelles (imports réalisés, actions effectuées, dernière connexion)
    """
    # Nombre d'imports réalisés par cet utilisateur
    nb_imports = db.query(Import).filter_by(id_utilisateur=user.id_utilisateur).count()

    # Nombre d'actions enregistrées dans le journal d'audit
    nb_actions = db.query(JournalActivite).filter(
        (JournalActivite.id_utilisateur == user.id_utilisateur) |
        (JournalActivite.login == user.login)
    ).count()

    # Dernière connexion enregistrée
    derniere_connexion_row = (
        db.query(JournalActivite.date_action)
        .filter(
            JournalActivite.login == user.login,
            JournalActivite.action == "CONNEXION"
        )
        .order_by(JournalActivite.date_action.desc())
        .first()
    )
    derniere_connexion = derniere_connexion_row[0] if derniere_connexion_row else user.date_creation

    # Génération / restitution du QR code
    url_qr = f"http://localhost:5173/auto-login?token={user.token_qr}" if user.token_qr else None
    qr_base64 = generer_qr_code_base64(url_qr) if url_qr else None

    return {
        "id_utilisateur": user.id_utilisateur,
        "login": user.login,
        "nom_utilisateur": user.nom_utilisateur,
        "email": user.email,
        "role": user.role,
        "actif": user.actif,
        "date_creation": user.date_creation,
        "token_qr": user.token_qr,
        "token_expire_le": user.token_expire_le,
        "url_qr": url_qr,
        "qr_code_base64": qr_base64,
        "statistiques": {
            "nb_imports": nb_imports,
            "nb_actions_journal": nb_actions,
            "derniere_connexion": derniere_connexion,
        }
    }


# ============ 2. METTRE À JOUR MES INFORMATIONS PERSONNELLES ============
@router.put("/moi")
def modifier_mon_profil(
    data: ModificationProfilRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_utilisateur_connecte)
):
    """
    Permet à l'utilisateur de modifier son nom complet, son login et son adresse e-mail.
    Garantit l'unicité de l'identifiant (login) en base de données.
    """
    adresse_ip = request.client.host if request.client else None
    nouveau_login = data.login.strip()
    nouveau_nom = data.nom_utilisateur.strip()
    nouvel_email = data.email.strip() if data.email else None

    if not nouveau_login or not nouveau_nom:
        raise HTTPException(400, "Le nom complet et l'identifiant ne peuvent pas être vides.")

    # Vérification d'unicité du login si modifié
    if nouveau_login != user.login:
        conflit = db.query(Utilisateur).filter(
            Utilisateur.login == nouveau_login,
            Utilisateur.id_utilisateur != user.id_utilisateur
        ).first()
        if conflit:
            raise HTTPException(400, f"L'identifiant '{nouveau_login}' est déjà utilisé par un autre compte.")

    ancien_login = user.login
    user.nom_utilisateur = nouveau_nom
    user.login = nouveau_login
    user.email = nouvel_email
    db.commit()
    db.refresh(user)

    journaliser_action(
        db=db,
        login=user.login,
        id_utilisateur=user.id_utilisateur,
        action="MODIFICATION_PROFIL",
        entite="UTILISATEUR",
        details=f"Mise à jour des informations de profil personnel (ancien login: '{ancien_login}', nouvel email: '{user.email or 'aucun'}').",
        adresse_ip=adresse_ip
    )

    return {
        "message": "Informations de profil mises à jour avec succès.",
        "utilisateur": {
            "id_utilisateur": user.id_utilisateur,
            "login": user.login,
            "nom_utilisateur": user.nom_utilisateur,
            "email": user.email,
            "role": user.role,
        }
    }


# ============ 3. CHANGER MON MOT DE PASSE ============
@router.put("/mot-de-passe")
def changer_mon_mot_de_passe(
    data: ChangementMotDePasseRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_utilisateur_connecte)
):
    """
    Change le mot de passe de l'utilisateur connecté après vérification de son ancien mot de passe.
    """
    adresse_ip = request.client.host if request.client else None

    # 1. Vérification de l'ancien mot de passe
    if not verify_password(data.ancien_mot_de_passe, user.mot_de_passe_hash):
        journaliser_action(
            db=db,
            login=user.login,
            id_utilisateur=user.id_utilisateur,
            action="ECHEC_CHANGEMENT_MDP",
            entite="UTILISATEUR",
            details="Échec de changement de mot de passe : ancien mot de passe incorrect.",
            adresse_ip=adresse_ip
        )
        raise HTTPException(400, "L'ancien mot de passe saisi est incorrect.")

    # 2. Validation de la complexité minimale
    if len(data.nouveau_mot_de_passe) < 6:
        raise HTTPException(400, "Le nouveau mot de passe doit comporter au moins 6 caractères.")

    # 3. Hachage et mise à jour
    user.mot_de_passe_hash = hash_password(data.nouveau_mot_de_passe)
    db.commit()

    # Envoi éventuel d'une notification par e-mail
    if user.email:
        envoyer_email(
            destinataire=user.email,
            sujet="Sécurité JIRAMA : Modification de votre mot de passe",
            corps_texte=(
                f"Bonjour {user.nom_utilisateur},\n\n"
                f"Le mot de passe de votre compte JIRAMA ({user.login}) a été modifié avec succès "
                f"le {datetime.utcnow().strftime('%d/%m/%Y à %H:%M')}.\n\n"
                f"Si vous n'êtes pas à l'origine de cette action, veuillez contacter un administrateur d'urgence.\n\n"
                f"Cordialement,\nÉquipe Sécurité JIRAMA"
            )
        )

    journaliser_action(
        db=db,
        login=user.login,
        id_utilisateur=user.id_utilisateur,
        action="CHANGEMENT_MDP",
        entite="UTILISATEUR",
        details="Modification réussie du mot de passe personnel.",
        adresse_ip=adresse_ip
    )

    return {"message": "Votre mot de passe a été modifié avec succès."}


# ============ 4. RÉGÉNÉRER MON QR CODE PERSONNEL ============
@router.post("/regenerer-qr")
def regenerer_mon_qr_code(
    request: Request,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_utilisateur_connecte)
):
    """
    Renouvelle le jeton QR code personnel de l'utilisateur avec une nouvelle date d'expiration.
    """
    adresse_ip = request.client.host if request.client else None

    token = generer_token_qr()
    user.token_qr = token
    user.token_expire_le = generer_expiration_token()
    db.commit()
    db.refresh(user)

    url_qr = f"http://localhost:5173/auto-login?token={token}"
    qr_base64 = generer_qr_code_base64(url_qr)

    journaliser_action(
        db=db,
        login=user.login,
        id_utilisateur=user.id_utilisateur,
        action="REGENERATION_QR_PROFIL",
        entite="UTILISATEUR",
        details="Renouvellement du QR code de connexion instantanée.",
        adresse_ip=adresse_ip
    )

    return {
        "message": "Nouveau QR code généré avec succès.",
        "qr_code_base64": qr_base64,
        "token": token,
        "token_expire_le": user.token_expire_le,
        "url_qr": url_qr
    }


# ============ 5. MON HISTORIQUE D'ACTIVITÉ PERSONNEL ============
@router.get("/mon-historique")
def obtenir_mon_historique(
    limite: int = Query(50, ge=1, le=100),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_utilisateur_connecte)
):
    """
    Retourne la liste chronologique des actions effectuées exclusivement
    par l'utilisateur connecté (connexions, imports, modifications, alertes).
    """
    query = db.query(JournalActivite).filter(
        (JournalActivite.id_utilisateur == user.id_utilisateur) |
        (JournalActivite.login == user.login)
    )

    if action:
        query = query.filter(JournalActivite.action == action.upper())

    activites = query.order_by(JournalActivite.date_action.desc()).limit(limite).all()

    return [
        {
            "id_journal": a.id_journal,
            "action": a.action,
            "entite": a.entite,
            "details": a.details,
            "adresse_ip": a.adresse_ip,
            "date_action": a.date_action,
        }
        for a in activites
    ]
