from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import bcrypt
from app.database import get_db
from app.models import Utilisateur
from app.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


def hash_password(password: str) -> str:
    """Hash un mot de passe avec bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Vérifie un mot de passe contre son hash bcrypt."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Utilisateur).filter_by(login=credentials.login).first()

    if not user or not verify_password(credentials.mot_de_passe, user.mot_de_passe_hash):
        raise HTTPException(401, "Identifiants invalides")

    if not user.actif:
        raise HTTPException(403, "Compte désactivé")

    # Pour l'instant, token simple (JWT à ajouter plus tard)
    return TokenResponse(
        access_token=f"token_{user.id_utilisateur}",
        role=user.role,
        nom_utilisateur=user.nom_utilisateur,
    )



from datetime import datetime
from app.models import Utilisateur
from app.utils import generer_token_qr


@router.get("/auto-login")
def auto_login(token: str, db: Session = Depends(get_db)):
    """Connexion automatique via QR code."""
    user = db.query(Utilisateur).filter_by(token_qr=token).first()

    if not user:
        raise HTTPException(401, "QR code invalide")

    if user.token_expire_le and user.token_expire_le < datetime.utcnow():
        raise HTTPException(401, "QR code expiré")

    if not user.actif:
        raise HTTPException(403, "Compte désactivé")

    return {
        "access_token": f"token_{user.id_utilisateur}",
        "token_type": "bearer",
        "role": user.role,
        "nom_utilisateur": user.nom_utilisateur,
    }