"""
Routeur d'administration des utilisateurs et du journal d'audit JIRAMA.

Fournit :
  - La gestion CRUD complète des comptes utilisateurs (login, nom, email, rôle)
  - La régénération de mot de passe et de QR code avec envoi d'e-mail
  - Le déblocage administratif anticipé des comptes verrouillés pour 5 erreurs
  - La consultation complète du journal d'audit des connexions et des opérations CRUD
"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import bcrypt
from datetime import datetime

from app.database import get_db
from app.models import Utilisateur, Import, JournalActivite
from app.schemas import (
    UtilisateurCreate, UtilisateurResponse, UtilisateurAvecMotDePasse,
    ChangerStatutRequest, JournalActiviteResponse
)
from app.utils.helpers import (
    generer_mot_de_passe, generer_token_qr, generer_qr_code_base64,
    generer_expiration_token
)
from app.services.audit_service import journaliser_action
from app.services.email_service import envoyer_identifiants_utilisateur

router = APIRouter(prefix="/api/utilisateurs", tags=["Utilisateurs"])


def hash_password(password: str) -> str:
    """Hache un mot de passe avec bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verifier_admin(authorization: str = Header(None), db: Session = Depends(get_db)) -> Utilisateur:
    """Vérifie que l'utilisateur connecté possède le rôle ADMIN."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token manquant")

    token = authorization.replace("Bearer ", "")
    try:
        id_user = int(token.replace("token_", ""))
    except ValueError:
        raise HTTPException(401, "Token invalide")

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_user).first()
    if not user or user.role != "ADMIN" or not user.actif:
        raise HTTPException(403, "Accès réservé aux administrateurs JIRAMA")

    return user


# ============ LISTE DU JOURNAL D'ACTIVITE (AUDIT) ============
@router.get("/audit-journal", response_model=List[JournalActiviteResponse])
def lister_journal_audit(
    limite: int = Query(50, ge=1, le=200, description="Nombre maximum d'enregistrements"),
    recherche: Optional[str] = Query(None, description="Recherche par login, action ou détails"),
    action: Optional[str] = Query(None, description="Filtrer par type d'action"),
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(verifier_admin)
):
    """
    Retourne l'historique récent des connexions et des opérations CRUD
    effectuées par l'ensemble des utilisateurs sur l'application.
    """
    query = db.query(JournalActivite)

    if action:
        query = query.filter(JournalActivite.action == action.upper())

    if recherche:
        motif = f"%{recherche}%"
        query = query.filter(
            (JournalActivite.login.ilike(motif)) |
            (JournalActivite.details.ilike(motif)) |
            (JournalActivite.entite.ilike(motif))
        )

    return query.order_by(JournalActivite.date_action.desc()).limit(limite).all()


# ============ LISTER LES UTILISATEURS ============
@router.get("/", response_model=List[UtilisateurResponse])
def lister_utilisateurs(
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(verifier_admin)
):
    """Liste l'ensemble des utilisateurs avec leurs informations de profil et de sécurité."""
    return db.query(Utilisateur).order_by(Utilisateur.date_creation.desc()).all()


# ============ CRÉER UN UTILISATEUR ============
@router.post("/", response_model=UtilisateurAvecMotDePasse, status_code=201)
def creer_utilisateur(
    data: UtilisateurCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """
    Crée un nouvel utilisateur JIRAMA avec mot de passe et QR code générés automatiquement.
    Si une adresse e-mail est fournie, les identifiants lui sont transmis par e-mail.
    """
    adresse_ip = request.client.host if request.client else None

    # Vérification d'unicité du login
    if db.query(Utilisateur).filter_by(login=data.login).first():
        raise HTTPException(400, f"Le login '{data.login}' est déjà attribué à un autre compte.")

    if data.role not in ("ADMIN", "USER"):
        raise HTTPException(400, "Le rôle doit être ADMIN ou USER.")

    # Génération du mot de passe temporaire et du jeton QR
    mot_de_passe = generer_mot_de_passe(8)
    token = generer_token_qr()
    expiration = generer_expiration_token()

    nouveau = Utilisateur(
        login=data.login.strip(),
        nom_utilisateur=data.nom_utilisateur.strip(),
        email=data.email.strip() if data.email else None,
        mot_de_passe_hash=hash_password(mot_de_passe),
        role=data.role,
        actif=True,
        tentatives_echouees=0,
        bloque_jusqu_a=None,
        token_qr=token,
        token_expire_le=expiration,
    )
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)

    # Envoi éventuel des identifiants par e-mail
    email_envoye = False
    if nouveau.email:
        res_email = envoyer_identifiants_utilisateur(
            email=nouveau.email,
            nom_utilisateur=nouveau.nom_utilisateur,
            login=nouveau.login,
            mot_de_passe=mot_de_passe
        )
        email_envoye = res_email.get("succes", False)

    # Journalisation d'audit de la création
    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="CREATION",
        entite="UTILISATEUR",
        details=f"Création de l'utilisateur '{nouveau.login}' (Rôle: {nouveau.role}, Email: {nouveau.email or 'aucun'}).",
        adresse_ip=adresse_ip
    )

    # Génération du QR code en base64
    url_qr = f"http://localhost:5173/auto-login?token={token}"
    qr_base64 = generer_qr_code_base64(url_qr)

    return {
        "utilisateur": nouveau,
        "mot_de_passe_clair": mot_de_passe,
        "qr_code_base64": qr_base64,
        "email_envoye": email_envoye,
    }


# ============ MODIFIER UN UTILISATEUR ============
@router.put("/{id_utilisateur}", response_model=UtilisateurResponse)
def modifier_utilisateur(
    id_utilisateur: int,
    data: UtilisateurCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """Met à jour les informations d'un utilisateur existant (nom, email, rôle)."""
    adresse_ip = request.client.host if request.client else None

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    # Protection contre la modification de son propre rôle admin
    if user.id_utilisateur == admin.id_utilisateur and data.role != admin.role:
        raise HTTPException(400, "Vous ne pouvez pas modifier votre propre rôle administrateur.")

    # Conflit sur le login
    conflit = db.query(Utilisateur).filter(
        Utilisateur.login == data.login,
        Utilisateur.id_utilisateur != id_utilisateur
    ).first()
    if conflit:
        raise HTTPException(400, "Cet identifiant (login) est déjà utilisé par un autre compte.")

    user.login = data.login.strip()
    user.nom_utilisateur = data.nom_utilisateur.strip()
    user.email = data.email.strip() if data.email else None
    user.role = data.role
    db.commit()
    db.refresh(user)

    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="MODIFICATION",
        entite="UTILISATEUR",
        details=f"Modification des informations de l'utilisateur '{user.login}' (Email: {user.email or 'aucun'}).",
        adresse_ip=adresse_ip
    )

    return user


# ============ DÉBLOQUER UN UTILISATEUR ============
@router.post("/{id_utilisateur}/debloquer", response_model=UtilisateurResponse)
def debloquer_utilisateur(
    id_utilisateur: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """
    Débloque immédiatement un compte ayant été verrouillé suite à 5 tentatives erronées.
    Remet à zéro le compteur d'erreurs et supprime l'échéance de blocage.
    """
    adresse_ip = request.client.host if request.client else None

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    user.bloque_jusqu_a = None
    user.tentatives_echouees = 0
    db.commit()
    db.refresh(user)

    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="DEBLOCAGE",
        entite="UTILISATEUR",
        details=f"Déblocage anticipé du compte '{user.login}' par l'administrateur {admin.login}.",
        adresse_ip=adresse_ip
    )

    return user


# ============ CHANGER LE STATUT (ACTIF/INACTIF) ============
@router.patch("/{id_utilisateur}/statut", response_model=UtilisateurResponse)
def changer_statut(
    id_utilisateur: int,
    data: ChangerStatutRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """Active ou désactive l'accès à un compte utilisateur."""
    adresse_ip = request.client.host if request.client else None

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    if user.id_utilisateur == admin.id_utilisateur:
        raise HTTPException(400, "Vous ne pouvez pas désactiver votre propre compte administrateur.")

    user.actif = data.actif
    db.commit()
    db.refresh(user)

    action_label = "Activation" if data.actif else "Désactivation"
    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="MODIFICATION_STATUT",
        entite="UTILISATEUR",
        details=f"{action_label} du compte '{user.login}'.",
        adresse_ip=adresse_ip
    )

    return user


# ============ RÉGÉNÉRER LE MOT DE PASSE ============
@router.post("/{id_utilisateur}/regenerer-mot-de-passe")
def regenerer_mot_de_passe(
    id_utilisateur: int,
    request: Request,
    envoyer_email: bool = Query(True, description="Transmettre par e-mail à l'adresse de l'utilisateur"),
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """
    Régénère un nouveau mot de passe aléatoire et l'envoie optionnellement
    à l'adresse e-mail de l'utilisateur concerné.
    """
    adresse_ip = request.client.host if request.client else None

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    nouveau_mdp = generer_mot_de_passe(8)
    user.mot_de_passe_hash = hash_password(nouveau_mdp)
    # Réinitialise aussi tout blocage résiduel
    user.tentatives_echouees = 0
    user.bloque_jusqu_a = None
    db.commit()

    email_statut = None
    if envoyer_email and user.email:
        res = envoyer_identifiants_utilisateur(
            email=user.email,
            nom_utilisateur=user.nom_utilisateur,
            login=user.login,
            mot_de_passe=nouveau_mdp
        )
        email_statut = res

    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="REGENERATION_MDP",
        entite="UTILISATEUR",
        details=f"Régénération du mot de passe pour le compte '{user.login}' (E-mail envoyé: {bool(email_statut and email_statut.get('succes'))}).",
        adresse_ip=adresse_ip
    )

    return {
        "message": "Nouveau mot de passe généré avec succès.",
        "mot_de_passe_clair": nouveau_mdp,
        "email_destinataire": user.email,
        "email_statut": email_statut
    }


# ============ RÉGÉNÉRER LE QR CODE ============
@router.post("/{id_utilisateur}/regenerer-qr")
def regenerer_qr(
    id_utilisateur: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """Régénère un jeton QR code sécurisé avec validité temporelle renouvelée."""
    adresse_ip = request.client.host if request.client else None

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

    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="REGENERATION_QR",
        entite="UTILISATEUR",
        details=f"Régénération du QR code de connexion pour le compte '{user.login}'.",
        adresse_ip=adresse_ip
    )

    return {
        "qr_code_base64": qr_base64,
        "token": token,
        "expire_le": user.token_expire_le,
    }


# ============ SUPPRIMER UN UTILISATEUR ============
@router.delete("/{id_utilisateur}")
def supprimer_utilisateur(
    id_utilisateur: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(verifier_admin)
):
    """Supprime un compte utilisateur après vérification d'absence de dépendances transactionnelles."""
    adresse_ip = request.client.host if request.client else None

    user = db.query(Utilisateur).filter_by(id_utilisateur=id_utilisateur).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    if user.id_utilisateur == admin.id_utilisateur:
        raise HTTPException(400, "Vous ne pouvez pas supprimer votre propre compte administrateur.")

    nb_imports = db.query(Import).filter_by(id_utilisateur=id_utilisateur).count()
    if nb_imports > 0:
        raise HTTPException(
            400,
            f"Suppression impossible : {nb_imports} import(s) de données associé(s). Désactivez plutôt le compte."
        )

    login_supprime = user.login
    db.delete(user)
    db.commit()

    journaliser_action(
        db=db,
        login=admin.login,
        id_utilisateur=admin.id_utilisateur,
        action="SUPPRESSION",
        entite="UTILISATEUR",
        details=f"Suppression définitive du compte utilisateur '{login_supprime}'.",
        adresse_ip=adresse_ip
    )

    return {"message": "Utilisateur supprimé avec succès"}