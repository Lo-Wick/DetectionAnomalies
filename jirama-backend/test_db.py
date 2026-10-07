from app.database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version();"))
        print("✅ Connexion réussie !")
        print(result.fetchone())
except Exception as e:
    print("❌ Erreur :", e)