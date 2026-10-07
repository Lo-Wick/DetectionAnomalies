from pydantic import BaseModel
from datetime import datetime

# ===== SITE =====
class SiteBase(BaseModel):
    code_site: str
    nom_site: str

class SiteCreate(SiteBase):
    pass

class SiteResponse(SiteBase):
    id_site: int
    
    class Config:
        from_attributes = True

# ===== UTILISATEUR =====
class LoginRequest(BaseModel):
    login: str
    mot_de_passe: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    nom_utilisateur: str

# ===== TOURNEE =====
class TourneeBase(BaseModel):
    code_tournee: str
    id_site: int

class TourneeCreate(TourneeBase):
    pass

class TourneeResponse(TourneeBase):
    id_tournee: int
    
    class Config:
        from_attributes = True

# ===== TOURNEE =====
class TourneeBase(BaseModel):
    code_tournee: str
    id_site: int


class TourneeCreate(TourneeBase):
    pass


class TourneeResponse(BaseModel):
    id_tournee: int
    code_tournee: str
    id_site: int
    nom_site: str  # ← enrichi pour l'affichage

    class Config:
        from_attributes = True


# ===== CARNET =====
class CarnetBase(BaseModel):
    code_carnet: str
    id_tournee: int


class CarnetCreate(CarnetBase):
    pass


class CarnetResponse(BaseModel):
    id_carnet: int
    code_carnet: str
    id_tournee: int
    code_tournee: str
    id_site: int
    nom_site: str

    class Config:
        from_attributes = True


# ===== UTILISATEUR =====
class UtilisateurCreate(BaseModel):
    login: str
    nom_utilisateur: str
    role: str = "USER"


class UtilisateurResponse(BaseModel):
    id_utilisateur: int
    login: str
    nom_utilisateur: str
    role: str
    actif: bool
    date_creation: datetime
    token_qr: str | None = None
    token_expire_le: datetime | None = None

    class Config:
        from_attributes = True


class UtilisateurAvecMotDePasse(BaseModel):
    utilisateur: UtilisateurResponse
    mot_de_passe_clair: str
    qr_code_base64: str


class ChangerStatutRequest(BaseModel):
    actif: bool