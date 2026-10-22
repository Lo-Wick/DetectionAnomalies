"""
Définition des 13 modèles SQLAlchemy de l'application JIRAMA.

Chaque classe représente une table PostgreSQL et ses relations.
L'ordre de définition respecte les dépendances (FK) :
  Site → Tournée → Carnet → Installation → Compteur
  Client, Collecteur, TypeLecture, Observation, ProfilClient (référentiels)
  Import, Relève (tables transactionnelles)
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey,
    UniqueConstraint, CheckConstraint, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ============================================================
# 1. UTILISATEUR
# Représente un compte d'accès à l'application (ADMIN ou USER).
# Chaque utilisateur peut se connecter par login/mot de passe
# ou via un QR code avec durée de vie limitée.
# ============================================================
class Utilisateur(Base):
    __tablename__ = "utilisateur"
    
    id_utilisateur = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), nullable=True)  # Adresse e-mail pour réception du mot de passe
    mot_de_passe_hash = Column(String(255), nullable=False)
    nom_utilisateur = Column(String(100), nullable=False)
    role = Column(String(10), nullable=False, default="USER")
    token_qr = Column(String(255), unique=True, nullable=True)
    token_expire_le = Column(DateTime, nullable=True)
    actif = Column(Boolean, default=True)
    # Gestion des tentatives échouées et verrouillage automatique pendant 3 jours
    tentatives_echouees = Column(Integer, default=0, nullable=False)
    bloque_jusqu_a = Column(DateTime, nullable=True)
    date_creation = Column(DateTime, server_default=func.now())
    
    imports = relationship("Import", back_populates="utilisateur")
    activites = relationship("JournalActivite", back_populates="utilisateur")
    
    __table_args__ = (
        CheckConstraint("role IN ('ADMIN', 'USER')", name="check_role"),
    )


# ============================================================
# 2. SITE
# Unité géographique de premier niveau (ex: Site 103 = Mahajanga).
# Identifié par un code unique de 3 chiffres extrait du numéro d'installation.
# ============================================================
class Site(Base):
    __tablename__ = "site"
    
    id_site = Column(Integer, primary_key=True, index=True)
    code_site = Column(String(10), unique=True, nullable=False)
    nom_site = Column(String(100), nullable=False)
    
    tournees = relationship("Tournee", back_populates="site")


# ============================================================
# 3. TOURNEE
# Subdivision d'un site. Une tournée = un agent couvre un secteur.
# Code unique dans le contexte d'un site (contrainte composite).
# ============================================================
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


# ============================================================
# 4. CARNET
# Regroupement d'installations dans une tournée.
# Code unique dans le contexte d'une tournée (contrainte composite).
# ============================================================
class Carnet(Base):
    __tablename__ = "carnet"
    
    id_carnet = Column(Integer, primary_key=True, index=True)
    code_carnet = Column(String(10), nullable=False)
    id_tournee = Column(Integer, ForeignKey("tournee.id_tournee"), nullable=False)
    # Collecteur responsable de ce carnet/tournée
    id_collecteur = Column(Integer, ForeignKey("collecteur.id_collecteur", ondelete="SET NULL"), nullable=True)
    
    tournee = relationship("Tournee", back_populates="carnets")
    collecteur = relationship("Collecteur", back_populates="carnets")
    installations = relationship("Installation", back_populates="carnet")
    
    __table_args__ = (
        UniqueConstraint("id_tournee", "code_carnet", name="uq_tournee_carnet"),
    )


# ============================================================
# 5. CLIENT
# Abonné JIRAMA identifié par son numéro client unique.
# Un client peut avoir plusieurs installations (eau E et électricité W).
# ============================================================
class Client(Base):
    __tablename__ = "client"
    
    id_client = Column(Integer, primary_key=True, index=True)
    numero_client = Column(String(50), unique=True, nullable=False)
    nom_client = Column(String(200), nullable=False)
    
    installations = relationship("Installation", back_populates="client")


# ============================================================
# 6. INSTALLATION
# Raccordement physique d'un client au réseau JIRAMA.
# Le numéro d'installation (12 car.) encode : site + tournée + carnet + compte + type.
# type_installation : 'E' = électricité, 'W' = eau.
# ============================================================
class Installation(Base):
    __tablename__ = "installation"
    
    id_installation = Column(Integer, primary_key=True, index=True)
    numero_installation = Column(String(50), unique=True, nullable=False, index=True)
    numero_compte = Column(String(20), nullable=True)
    type_installation = Column(String(10), nullable=True)
    id_carnet = Column(Integer, ForeignKey("carnet.id_carnet"), nullable=False)
    id_client = Column(Integer, ForeignKey("client.id_client"), nullable=False)
    
    carnet = relationship("Carnet", back_populates="installations")
    client = relationship("Client", back_populates="installations")
    compteurs = relationship("Compteur", back_populates="installation")
    releves = relationship("Releve", back_populates="installation")


# ============================================================
# 7. COMPTEUR
# Appareil physique de mesure installé sur une installation.
# Un compteur peut être remplacé au fil du temps ; le relevé
# référence le compteur réellement utilisé lors de la lecture.
# ============================================================
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


# ============================================================
# 8. COLLECTEUR
# Agent de terrain chargé de relever les compteurs.
# Ce n'est PAS un utilisateur de l'application — c'est un référentiel
# sélectionné au moment de l'import Excel.
# ============================================================
class Collecteur(Base):
    __tablename__ = "collecteur"
    
    id_collecteur = Column(Integer, primary_key=True, index=True)
    nom_collecteur = Column(String(100), nullable=False)
    email = Column(String(120), nullable=True)  # Adresse e-mail pour ordres de mission et alertes
    
    # Carnets (tournées/carnets) attribués à ce collecteur
    carnets = relationship("Carnet", back_populates="collecteur")
    releves = relationship("Releve", back_populates="collecteur")


# ============================================================
# 9. TYPE_LECTURE
# Code indiquant la nature d'un relevé (ex: 01 = normal, 02 = estimé).
# Extrait de la colonne N du fichier Excel.
# ============================================================
class TypeLecture(Base):
    __tablename__ = "type_lecture"
    
    id_type_lecture = Column(Integer, primary_key=True, index=True)
    code_type = Column(String(10), unique=True, nullable=False)
    description = Column(String(200))
    
    releves = relationship("Releve", back_populates="type_lecture")


# ============================================================
# 10. OBSERVATION
# Observation relevée lors de la lecture (ex: MF = mauvais fonctionnement).
# Peut être NULL si aucune observation particulière.
# ============================================================
class Observation(Base):
    __tablename__ = "observation"
    
    id_observation = Column(Integer, primary_key=True, index=True)
    code_observation = Column(String(10), unique=True, nullable=False)
    description = Column(String(200))
    
    releves = relationship("Releve", back_populates="observation")


# ============================================================
# 11. PROFIL_CLIENT
# Classification du client (ex: 0 = non défini, 7 = domestique).
# Le profil '0' est créé par défaut si absent.
# ============================================================
class ProfilClient(Base):
    __tablename__ = "profil_client"
    
    id_profil = Column(Integer, primary_key=True, index=True)
    code_profil = Column(String(10), unique=True, nullable=False)
    description = Column(String(200))
    
    releves = relationship("Releve", back_populates="profil")


# ============================================================
# 12. IMPORT
# Traçabilité de chaque import de fichier Excel.
# Relie tous les relevés insérés à leur fichier source.
# ============================================================
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


# ============================================================
# 13. RELEVE
# Table centrale de l'application. Chaque enregistrement correspond
# à une ligne de relevé importée depuis un fichier Excel JIRAMA.
# Contrainte d'unicité : (installation, annee, periode) — pas de doublons.
# IMPORTANT : les contraintes CHECK sur la longueur des lectures
# ont été retirées (règle R3 supprimée) car les valeurs peuvent
# avoir des longueurs variables dans les fichiers réels.
# ============================================================
class Releve(Base):
    __tablename__ = "releve"
    
    id_releve = Column(Integer, primary_key=True, index=True)
    # Année et période (nullables pour enregistrer les lignes avec erreurs de date)
    annee = Column(Integer, nullable=True)
    periode = Column(Integer, nullable=True)
    # Longueur étendue à 20 car. pour accepter les valeurs variables des fichiers Excel
    lecture_precedente = Column(String(20), nullable=True)
    lecture_nouvelle = Column(String(20), nullable=True)
    
    # Clés étrangères (nullables pour permettre la persistance de toutes les lignes, y compris avec erreurs)
    id_installation = Column(Integer, ForeignKey("installation.id_installation"), nullable=True)
    id_compteur = Column(Integer, ForeignKey("compteur.id_compteur"), nullable=True)
    id_collecteur = Column(Integer, ForeignKey("collecteur.id_collecteur"), nullable=True)
    id_type_lecture = Column(Integer, ForeignKey("type_lecture.id_type_lecture"), nullable=True)
    id_observation = Column(Integer, ForeignKey("observation.id_observation"), nullable=True)
    id_profil = Column(Integer, ForeignKey("profil_client.id_profil"), nullable=True)
    id_import = Column(Integer, ForeignKey("import.id_import"), nullable=False)
    
    # Indicateurs et informations sur les erreurs et anomalies
    est_erreur = Column(Boolean, default=False, nullable=False)
    message_erreur = Column(Text, nullable=True)
    est_anomalie = Column(Boolean, default=False, nullable=False)
    type_anomalie = Column(String(50), nullable=True)

    # Données brutes issues du fichier Excel (conservées même en cas d'erreur de parsing)
    numero_installation_brut = Column(String(50), nullable=True)
    nom_client_brut = Column(String(200), nullable=True)
    numero_client_brut = Column(String(50), nullable=True)
    numero_compteur_brut = Column(String(50), nullable=True)
    code_tournee_brut = Column(String(20), nullable=True)
    code_carnet_brut = Column(String(20), nullable=True)

    installation = relationship("Installation", back_populates="releves")
    compteur = relationship("Compteur", back_populates="releves")
    collecteur = relationship("Collecteur", back_populates="releves")
    type_lecture = relationship("TypeLecture", back_populates="releves")
    observation = relationship("Observation", back_populates="releves")
    profil = relationship("ProfilClient", back_populates="releves")
    import_obj = relationship("Import", back_populates="releves")
    
    __table_args__ = (
        # Contrainte d'unicité : un seul relevé par installation et par période
        UniqueConstraint("id_installation", "annee", "periode",
                         name="uq_installation_annee_periode"),
    )


# ============================================================
# 14. JOURNAL_ACTIVITE (Audit & Traçabilité des actions)
# Enregistre l'ensemble des activités des utilisateurs :
#   - Connexions réussies ou échouées
#   - Déconnexions
#   - Opérations CRUD (Création, Modification, Suppression)
#   - Envois d'e-mails et déblocages de comptes
# ============================================================
class JournalActivite(Base):
    __tablename__ = "journal_activite"

    id_journal = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateur.id_utilisateur", ondelete="SET NULL"), nullable=True)
    login = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # CONNEXION, DECONNEXION, CREATION, MODIFICATION, SUPPRESSION, etc.
    entite = Column(String(50), nullable=False)  # AUTHENTIFICATION, UTILISATEUR, SITE, RELEVE, COLLECTEUR, etc.
    details = Column(Text, nullable=False)        # Explication en français clair de l'action exécutée
    adresse_ip = Column(String(50), nullable=True)
    date_action = Column(DateTime, server_default=func.now(), index=True)

    utilisateur = relationship("Utilisateur", back_populates="activites")