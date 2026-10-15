from sqlalchemy import text
from app.database import engine

def ajouter_index():
    requetes = [
        # Index sur les codes uniques
        "CREATE INDEX IF NOT EXISTS idx_site_code ON site(code_site);",
        "CREATE INDEX IF NOT EXISTS idx_client_numero ON client(numero_client);",
        "CREATE INDEX IF NOT EXISTS idx_installation_numero ON installation(numero_installation);",
        "CREATE INDEX IF NOT EXISTS idx_compteur_numero ON compteur(numero_compteur);",
        
        # Index sur les FK (souvent filtrées)
        "CREATE INDEX IF NOT EXISTS idx_tournee_site ON tournee(id_site);",
        "CREATE INDEX IF NOT EXISTS idx_carnet_tournee ON carnet(id_tournee);",
        "CREATE INDEX IF NOT EXISTS idx_installation_carnet ON installation(id_carnet);",
        "CREATE INDEX IF NOT EXISTS idx_installation_client ON installation(id_client);",
        "CREATE INDEX IF NOT EXISTS idx_compteur_installation ON compteur(id_installation);",
        
        # Index sur les relevés (table centrale)
        "CREATE INDEX IF NOT EXISTS idx_releve_installation ON releve(id_installation);",
        "CREATE INDEX IF NOT EXISTS idx_releve_compteur ON releve(id_compteur);",
        "CREATE INDEX IF NOT EXISTS idx_releve_collecteur ON releve(id_collecteur);",
        "CREATE INDEX IF NOT EXISTS idx_releve_import ON releve(id_import);",
        "CREATE INDEX IF NOT EXISTS idx_releve_annee_periode ON releve(annee, periode);",
        
        # Index sur utilisateur
        "CREATE INDEX IF NOT EXISTS idx_utilisateur_login ON utilisateur(login);",
        "CREATE INDEX IF NOT EXISTS idx_utilisateur_token_qr ON utilisateur(token_qr);",
    ]
    
    with engine.connect() as conn:
        for req in requetes:
            try:
                conn.execute(text(req))
                print(f"✅ {req}")
            except Exception as e:
                print(f"⚠️ {req} → {e}")
        conn.commit()
    print("\n🎉 Index ajoutés !")


if __name__ == "__main__":
    ajouter_index()