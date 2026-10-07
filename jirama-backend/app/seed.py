from app.database import SessionLocal
from app.models import Utilisateur, Site, TypeLecture, Observation, ProfilClient
import bcrypt


def hash_password(password: str) -> str:
    """Hash un mot de passe avec bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_database():
    db = SessionLocal()

    try:
        # 1. Admin principal
        if not db.query(Utilisateur).filter_by(login="admin").first():
            admin = Utilisateur(
                login="admin",
                mot_de_passe_hash=hash_password("admin123"),
                nom_utilisateur="Administrateur Principal",
                role="ADMIN",
                actif=True,
            )
            db.add(admin)
            print("✅ Admin créé : login=admin, mot de passe=admin123")

        # 2. Sites
        sites = [
            ("103", "Mahajanga"),
            ("101", "Antsirabe"),
        ]
        for code, nom in sites:
            if not db.query(Site).filter_by(code_site=code).first():
                db.add(Site(code_site=code, nom_site=nom))
                print(f"✅ Site créé : {code} - {nom}")

        # 3. Types de lecture
        types = [
            ("1", "Lecture normale"),
            ("2", "Relevé spécial"),
            ("3", "Estimation"),
        ]
        for code, desc in types:
            if not db.query(TypeLecture).filter_by(code_type=code).first():
                db.add(TypeLecture(code_type=code, description=desc))
                print(f"✅ Type lecture créé : {code} - {desc}")

        # 4. Observations
        observations = [
            ("A", "Arrêt de compteur"),
            ("DEL", "Délestage"),
            ("ABS", "Absence client"),
        ]
        for code, desc in observations:
            if not db.query(Observation).filter_by(code_observation=code).first():
                db.add(Observation(code_observation=code, description=desc))
                print(f"✅ Observation créée : {code} - {desc}")

        # 5. Profils clients
        profils = [
            ("1", "Particulier"),
            ("2", "Entreprise"),
            ("7", "Administration"),
        ]
        for code, desc in profils:
            if not db.query(ProfilClient).filter_by(code_profil=code).first():
                db.add(ProfilClient(code_profil=code, description=desc))
                print(f"✅ Profil créé : {code} - {desc}")

        db.commit()
        print("\n🎉 Seed terminé avec succès !")

    except Exception as e:
        db.rollback()
        print(f"❌ Erreur : {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()