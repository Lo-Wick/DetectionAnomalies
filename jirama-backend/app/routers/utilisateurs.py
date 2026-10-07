from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
import bcrypt
from app.database import get_db
from app.models import Utilisateur
from app.schemas import (
    UtilisateurCreate, UtilisateurResponse, UtilisateurAvecMotDePasse,
    ChangerStatutRequest
)
from app.utils import (
    generer_mot_de_passe, generer_token_qr, generer_qr_code_base64,
    generer_expiration_token
)

router = APIRouter(prefix="/api/utilisateurs", tags=["Utilisateurs"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verifier_admin(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Vérifie que l'utilisateur connecté est bien ADMIN."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token manquant")

    token = authorization.replace("Bearer ", "")

    # Format : token_<id>
    try:
        id_user = int(token.replace("token_", ""))
    except ValueError:
        raise HTTPException(401, "Token invalide")

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_user).first()
    if not user or user.role != "ADMIN" or not user.actif:
        raise HTTPException(403, "Accès réservé aux administrateurs")

    return user


# ============ LISTER ============
@router.get("/", response_model=List[UtilisateurResponse])
def lister_utilisateurs(
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(verifier_admin)
):
    return db.query(Utilisateur).order_by(Utilisateur.date_creation.desc()).all()


# ============ CRÉER ============
@router.post("/", response_model=UtilisateurAvecMotDePasse, status_code=201)
def creer_utilisateur(
    data: UtilisateurCreate,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(verifier_admin)
):
    # Vérifier login unique
    if db.query(Utilisateur).filter_by(login=data.login).first():
        raise HTTPException(400, f"Le login '{data.login}' existe déjà")

    if data.role not in ("ADMIN", "USER"):
        raise HTTPException(400, "Rôle invalide (ADMIN ou USER)")

    # Générer mot de passe et token QR
    mot_de_passe = generer_mot_de_passe(6)
    token = generer_token_qr()
    expiration = generer_expiration_token()

    nouveau = Utilisateur(
        login=data.login,
        nom_utilisateur=data.nom_utilisateur,
        mot_de_passe_hash=hash_password(mot_de_passe),
        role=data.role,
        actif=True,
        token_qr=token,
        token_expire_le=expiration,
    )
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)

    # Générer QR code (URL de connexion automatique)
    url_qr = f"http://localhost:5173/auto-login?token={token}"
    qr_base64 = generer_qr_code_base64(url_qr)

    return {
        "utilisateur": nouveau,
        "mot_de_passe_clair": mot_de_passe,
        "qr_code_base64": qr_base64,
    }


# ============ MODIFIER ============
@router.put("/{id_utilisateur}", response_model=UtilisateurResponse)
def modifier_utilisateur(
    id_utilisateur: int,
    data: UtilisateurCreate,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    # Interdire de modifier son propre rôle
    if user.id_utilisateur == admin.id_utilisateur and data.role != admin.role:
        raise HTTPException(400, "Vous ne pouvez pas modifier votre propre rôle")

    # Vérifier login unique
    conflit = db.query(Utilisateur).filter(
        Utilisateur.login == data.login,
        Utilisateur.id_utilisateur != id_utilisateur
    ).first()
    if conflit:
        raise HTTPException(400, "Ce login est déjà utilisé")

    user.login = data.login
    user.nom_utilisateur = data.nom_utilisateur
    user.role = data.role
    db.commit()
    db.refresh(user)
    return user


# ============ CHANGER STATUT ============
@router.patch("/{id_utilisateur}/statut", response_model=UtilisateurResponse)
def changer_statut(
    id_utilisateur: int,
    data: ChangerStatutRequest,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    if user.id_utilisateur == admin.id_utilisateur:
        raise HTTPException(400, "Vous ne pouvez pas désactiver votre propre compte")

    user.actif = data.actif
    db.commit()
    db.refresh(user)
    return user


# ============ RÉGÉNÉRER MOT DE PASSE ============
@router.post("/{id_utilisateur}/regenerer-mot-de-passe")
def regenerer_mot_de_passe(
    id_utilisateur: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(verifier_admin)
):
    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    nouveau_mdp = generer_mot_de_passe(6)
    user.mot_de_passe_hash = hash_password(nouveau_mdp)
    db.commit()

    return {
        "message": "Mot de passe régénéré",
        "mot_de_passe_clair": nouveau_mdp,
    }


# ============ RÉGÉNÉRER QR ============
@router.post("/{id_utilisateur}/regenerer-qr")
def regenerer_qr(
    id_utilisateur: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(verifier_admin)
):
    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    token = generer_token_qr()
    user.token_qr = token
    user.token_expire_le = generer_expiration_token()
    db.commit()
    db.refresh(user)

    url_qr = f"http://localhost:5173/auto-login?token={token}"
    qr_base64 = generer_qr_code_base64(url_qr)

    return {
        "qr_code_base64": qr_base64,
        "token": token,
        "expire_le": user.token_expire_le,
    }


# ============ SUPPRIMER ============
@router.delete("/{id_utilisateur}")
def supprimer_utilisateur(
    id_utilisateur: int,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    if user.id_utilisateur == admin.id_utilisateur:
        raise HTTPException(400, "Vous ne pouvez pas supprimer votre propre compte")

    # Vérifier s'il y a des imports liés
    from app.models import Import
    imports = db.query(Import).filter_by(id_utilisateur=id_utilisateur).count()
    if imports > 0:
        raise HTTPException(
            400,
            f"Impossible de supprimer : {imports} import(s) lié(s). Désactivez plutôt le compte."
        )

    db.delete(user)
    db.commit()
    return {"message": "Utilisateur supprimé"}