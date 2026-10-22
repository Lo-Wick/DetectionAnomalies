"""
Routeur d'authentification des utilisateurs JIRAMA.

Gère :
  - La connexion classique par identifiant et mot de passe
  - Le verrouillage de sécurité automatique : après 5 tentatives erronées,
    le compte est bloqué pendant 3 jours. Seul un administrateur peut le débloquer avant.
  - La connexion instantanée par QR code sécurisé
  - La déconnexion et la journalisation d'audit systématique
"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
import bcrypt
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Utilisateur
from app.schemas import LoginRequest, TokenResponse
from app.services.audit_service import journaliser_action

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


def hash_password(password: str) -> str:
    """Hache un mot de passe en clair avec bcrypt et sel sécurisé."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Vérifie la correspondance entre un mot de passe en clair et son hachage bcrypt."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Connexion utilisateur avec gestion stricte de la sécurité :
      - Blocage pendant 3 jours dès la 5ème tentative échouée
      - Déblocage automatique après écoulement des 3 jours ou par un admin
      - Traces d'audit dans la table journal_activite
    """
    adresse_ip = request.client.host if request.client else None
    maintenant = datetime.utcnow()

    user = db.query(Utilisateur).filter_by(login=credentials.login).first()

    if not user:
        # Journalisation de tentative sur un identifiant inexistant
        journaliser_action(
            db=db,
            login=credentials.login,
            action="CONNEXION_ECHOUEE",
            entite="AUTHENTIFICATION",
            details="Tentative de connexion avec un identifiant inexistant.",
            adresse_ip=adresse_ip
        )
        raise HTTPException(401, "Identifiants invalides")

    # 1. Vérification du verrouillage temporel (3 jours)
    if user.bloque_jusqu_a:
        if user.bloque_jusqu_a > maintenant:
            date_fin_str = user.bloque_jusqu_a.strftime("%d/%m/%Y à %H:%M")
            journaliser_action(
                db=db,
                login=user.login,
                id_utilisateur=user.id_utilisateur,
                action="TENTATIVE_SUR_COMPTE_BLOQUE",
                entite="AUTHENTIFICATION",
                details=f"Tentative de connexion refusée : compte bloqué jusqu'au {date_fin_str}.",
                adresse_ip=adresse_ip
            )
            raise HTTPException(
                403,
                f"Compte temporairement bloqué suite à 5 tentatives échouées. "
                f"Déblocage prévu le {date_fin_str} ou auprès d'un administrateur."
            )
        else:
            # La période de 3 jours est écoulée : réinitialisation automatique du blocage
            user.bloque_jusqu_a = None
            user.tentatives_echouees = 0
            db.commit()

    # 2. Vérification du mot de passe
    if not verify_password(credentials.mot_de_passe, user.mot_de_passe_hash):
        user.tentatives_echouees = (user.tentatives_echouees or 0) + 1

        if user.tentatives_echouees >= 5:
            # Déclenchement du verrouillage de 3 jours
            user.bloque_jusqu_a = maintenant + timedelta(days=3)
            db.commit()

            date_fin_str = user.bloque_jusqu_a.strftime("%d/%m/%Y à %H:%M")
            journaliser_action(
                db=db,
                login=user.login,
                id_utilisateur=user.id_utilisateur,
                action="BLOCAGE_COMPTE",
                entite="AUTHENTIFICATION",
                details=f"Compte bloqué pour 3 jours (5 échecs consécutifs). Échéance : {date_fin_str}.",
                adresse_ip=adresse_ip
            )
            raise HTTPException(
                403,
                f"Votre compte a été bloqué pour une durée de 3 jours (jusqu'au {date_fin_str}) "
                f"après 5 tentatives infructueuses. Veuillez contacter un administrateur."
            )

        db.commit()
        tentatives_restantes = max(0, 5 - user.tentatives_echouees)
        journaliser_action(
            db=db,
            login=user.login,
            id_utilisateur=user.id_utilisateur,
            action="CONNEXION_ECHOUEE",
            entite="AUTHENTIFICATION",
            details=f"Mot de passe incorrect ({user.tentatives_echouees}/5 tentatives).",
            adresse_ip=adresse_ip
        )
        raise HTTPException(
            401,
            f"Identifiants invalides. {tentatives_restantes} tentative(s) restante(s) avant blocage de sécurité."
        )

    # 3. Vérification du statut actif
    if not user.actif:
        journaliser_action(
            db=db,
            login=user.login,
            id_utilisateur=user.id_utilisateur,
            action="CONNEXION_REFUSEE",
            entite="AUTHENTIFICATION",
            details="Tentative de connexion sur un compte désactivé par l'administrateur.",
            adresse_ip=adresse_ip
        )
        raise HTTPException(403, "Compte désactivé par l'administrateur.")

    # 4. Succès de connexion : réinitialisation du compteur d'erreurs
    user.tentatives_echouees = 0
    user.bloque_jusqu_a = None
    db.commit()

    journaliser_action(
        db=db,
        login=user.login,
        id_utilisateur=user.id_utilisateur,
        action="CONNEXION",
        entite="AUTHENTIFICATION",
        details="Connexion réussie par identifiant et mot de passe.",
        adresse_ip=adresse_ip
    )

    return TokenResponse(
        access_token=f"token_{user.id_utilisateur}",
        role=user.role,
        nom_utilisateur=user.nom_utilisateur,
    )


@router.post("/logout")
def logout(
    request: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Journalise la déconnexion volontaire de l'utilisateur."""
    adresse_ip = request.client.host if request.client else None
    if authorization and authorization.startswith("Bearer token_"):
        try:
            id_user = int(authorization.replace("Bearer token_", ""))
            user = db.query(Utilisateur).filter_by(id_utilisateur=id_user).first()
            if user:
                journaliser_action(
                    db=db,
                    login=user.login,
                    id_utilisateur=user.id_utilisateur,
                    action="DECONNEXION",
                    entite="AUTHENTIFICATION",
                    details="Déconnexion de l'application.",
                    adresse_ip=adresse_ip
                )
        except Exception:
            pass
    return {"message": "Déconnexion enregistrée avec succès"}


@router.get("/auto-login")
def auto_login(token: str, request: Request, db: Session = Depends(get_db)):
    """Connexion automatique et sécurisée via QR code."""
    adresse_ip = request.client.host if request.client else None
    maintenant = datetime.utcnow()

    user = db.query(Utilisateur).filter_by(token_qr=token).first()

    if not user:
        raise HTTPException(401, "QR code invalide")

    if user.token_expire_le and user.token_expire_le < maintenant:
        journaliser_action(
            db=db,
            login=user.login,
            id_utilisateur=user.id_utilisateur,
            action="CONNEXION_QR_ECHOUEE",
            entite="AUTHENTIFICATION",
            details="Tentative de connexion par QR code expiré.",
            adresse_ip=adresse_ip
        )
        raise HTTPException(401, "QR code expiré")

    if user.bloque_jusqu_a and user.bloque_jusqu_a > maintenant:
        raise HTTPException(403, "Compte actuellement bloqué par mesure de sécurité.")

    if not user.actif:
        raise HTTPException(403, "Compte désactivé")

    # Réinitialisation des erreurs en cas de connexion QR valide
    user.tentatives_echouees = 0
    user.bloque_jusqu_a = None
    db.commit()

    journaliser_action(
        db=db,
        login=user.login,
        id_utilisateur=user.id_utilisateur,
        action="CONNEXION",
        entite="AUTHENTIFICATION",
        details="Connexion réussie via QR code.",
        adresse_ip=adresse_ip
    )

    return {
        "access_token": f"token_{user.id_utilisateur}",
        "token_type": "bearer",
        "role": user.role,
        "nom_utilisateur": user.nom_utilisateur,
    }