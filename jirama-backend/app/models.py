from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, 
    UniqueConstraint, CheckConstraint, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ============ 1. UTILISATEUR ============
class Utilisateur(Base):
    __tablename__ = "utilisateur"
    
    id_utilisateur = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, nullable=False, index=True)
    mot_de_passe_hash = Column(String(255), nullable=False)
    nom_utilisateur = Column(String(100), nullable=False)
    role = Column(String(10), nullable=False, default="USER")
    token_qr = Column(String(255), unique=True, nullable=True)
    token_expire_le = Column(DateTime, nullable=True)
    actif = Column(Boolean, default=True)
    date_creation = Column(DateTime, server_default=func.now())
    
    imports = relationship("Import", back_populates="utilisateur")
    
    __table_args__ = (
        CheckConstraint("role IN ('ADMIN', 'USER')", name="check_role"),
    )


# ============ 2. SITE ============
class Site(Base):
    __tablename__ = "site"
    
    id_site = Column(Integer, primary_key=True, index=True)
    code_site = Column(String(10), unique=True, nullable=False)
    nom_site = Column(String(100), nullable=False)
    
    tournees = relationship("Tournee", back_populates="site")


# ============ 3. TOURNEE ============
class Tournee(Base):
    __tablename__ = "tournee"
    
    id_tournee = Column(Integer, primary_key=True, index=True)
    code_tournee = Column(String(10), nullable=False)
    id_site = Column(Integer, ForeignKey("site.id_site"), nullable=False)
    
    site = relationship("Site", back_populates="tournees")
    carnets = relationship("Carnet", back_populates="tournee")
    
    __table_args__ = (
        UniqueConstraint("id_site", "code_tournee", name="uq_site_tournee"),
    )


# ============ 4. CARNET ============
class Carnet(Base):
    __tablename__ = "carnet"
    
    id_carnet = Column(Integer, primary_key=True, index=True)
    code_carnet = Column(String(10), nullable=False)
    id_tournee = Column(Integer, ForeignKey("tournee.id_tournee"), nullable=False)
    
    tournee = relationship("Tournee", back_populates="carnets")
    installations = relationship("Installation", back_populates="carnet")
    
    __table_args__ = (
        UniqueConstraint("id_tournee", "code_carnet", name="uq_tournee_carnet"),
    )


# ============ 5. CLIENT ============
class Client(Base):
    __tablename__ = "client"
    
    id_client = Column(Integer, primary_key=True, index=True)
    numero_client = Column(String(50), unique=True, nullable=False)
    nom_client = Column(String(200), nullable=False)
    
    installations = relationship("Installation", back_populates="client")


# ============ 6. INSTALLATION ============
class Installation(Base):
    __tablename__ = "installation"
    
    id_installation = Column(Integer, primary_key=True, index=True)
    numero_installation = Column(String(12), unique=True, nullable=False, index=True)
    numero_compte = Column(String(4), nullable=False)
    type_installation = Column(String(1), nullable=False)
    id_carnet = Column(Integer, ForeignKey("carnet.id_carnet"), nullable=False)
    id_client = Column(Integer, ForeignKey("client.id_client"), nullable=False)
    
    carnet = relationship("Carnet", back_populates="installations")
    client = relationship("Client", back_populates="installations")
    compteurs = relationship("Compteur", back_populates="installation")
    releves = relationship("Releve", back_populates="installation")
    
    __table_args__ = (
        UniqueConstraint("id_carnet", "numero_compte", "type_installation", 
                         name="uq_carnet_compte_type"),
        CheckConstraint("char_length(numero_installation) = 12", 
                        name="check_numero_installation"),
        CheckConstraint("char_length(numero_compte) = 4", 
                        name="check_numero_compte"),
        CheckConstraint("type_installation IN ('E', 'W')", 
                        name="check_type_installation"),
    )


# ============ 7. COMPTEUR ============
class Compteur(Base):
    __tablename__ = "compteur"
    
    id_compteur = Column(Integer, primary_key=True, index=True)
    numero_compteur = Column(String(50), unique=True, nullable=False, index=True)
    id_installation = Column(Integer, ForeignKey("installation.id_installation"), 
                             nullable=False)
    
    installation = relationship("Installation", back_populates="compteurs")
    releves = relationship("Releve", back_populates="compteur")
    
    __table_args__ = (
        UniqueConstraint("id_installation", "numero_compteur", 
                         name="uq_installation_compteur"),
    )


# ============ 8. COLLECTEUR ============
class Collecteur(Base):
    __tablename__ = "collecteur"
    
    id_collecteur = Column(Integer, primary_key=True, index=True)
    nom_collecteur = Column(String(100), nullable=False)
    
    releves = relationship("Releve", back_populates="collecteur")


# ============ 9. TYPE_LECTURE ============
class TypeLecture(Base):
    __tablename__ = "type_lecture"
    
    id_type_lecture = Column(Integer, primary_key=True, index=True)
    code_type = Column(String(10), unique=True, nullable=False)
    description = Column(String(200))
    
    releves = relationship("Releve", back_populates="type_lecture")


# ============ 10. OBSERVATION ============
class Observation(Base):
    __tablename__ = "observation"
    
    id_observation = Column(Integer, primary_key=True, index=True)
    code_observation = Column(String(10), unique=True, nullable=False)
    description = Column(String(200))
    
    releves = relationship("Releve", back_populates="observation")


# ============ 11. PROFIL_CLIENT ============
class ProfilClient(Base):
    __tablename__ = "profil_client"
    
    id_profil = Column(Integer, primary_key=True, index=True)
    code_profil = Column(String(10), unique=True, nullable=False)
    description = Column(String(200))
    
    releves = relationship("Releve", back_populates="profil")


# ============ 12. IMPORT ============
class Import(Base):
    __tablename__ = "import"
    
    id_import = Column(Integer, primary_key=True, index=True)
    nom_fichier = Column(String(255), nullable=False)
    date_import = Column(DateTime, server_default=func.now())
    nombre_lignes = Column(Integer, default=0)
    id_utilisateur = Column(Integer, ForeignKey("utilisateur.id_utilisateur"), 
                            nullable=False)
    
    utilisateur = relationship("Utilisateur", back_populates="imports")
    releves = relationship("Releve", back_populates="import_obj")


# ============ 13. RELEVE ============
class Releve(Base):
    __tablename__ = "releve"
    
    id_releve = Column(Integer, primary_key=True, index=True)
    annee = Column(Integer, nullable=False)
    periode = Column(Integer, nullable=False)
    lecture_precedente = Column(String(5), nullable=True)
    lecture_nouvelle = Column(String(5), nullable=False)
    
    id_installation = Column(Integer, ForeignKey("installation.id_installation"), 
                             nullable=False)
    id_compteur = Column(Integer, ForeignKey("compteur.id_compteur"), nullable=False)
    id_collecteur = Column(Integer, ForeignKey("collecteur.id_collecteur"), 
                           nullable=False)
    id_type_lecture = Column(Integer, ForeignKey("type_lecture.id_type_lecture"), 
                             nullable=False)
    id_observation = Column(Integer, ForeignKey("observation.id_observation"), 
                            nullable=True)
    id_profil = Column(Integer, ForeignKey("profil_client.id_profil"), nullable=False)
    id_import = Column(Integer, ForeignKey("import.id_import"), nullable=False)
    
    installation = relationship("Installation", back_populates="releves")
    compteur = relationship("Compteur", back_populates="releves")
    collecteur = relationship("Collecteur", back_populates="releves")
    type_lecture = relationship("TypeLecture", back_populates="releves")
    observation = relationship("Observation", back_populates="releves")
    profil = relationship("ProfilClient", back_populates="releves")
    import_obj = relationship("Import", back_populates="releves")
    
    __table_args__ = (
        UniqueConstraint("id_installation", "annee", "periode", 
                         name="uq_installation_annee_periode"),
        CheckConstraint("annee BETWEEN 2000 AND 2100", name="check_annee"),
        CheckConstraint("periode BETWEEN 1 AND 12", name="check_periode"),
        CheckConstraint(
            "char_length(lecture_precedente) = 5 OR lecture_precedente IS NULL", 
            name="check_lecture_precedente"
        ),
        CheckConstraint("char_length(lecture_nouvelle) = 5", 
                        name="check_lecture_nouvelle"),
    )