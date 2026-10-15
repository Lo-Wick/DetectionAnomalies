from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from tempfile import NamedTemporaryFile
from app.database import get_db
from app.models import Import, Utilisateur, Releve, Installation, Compteur, Client, Site, Tournee, Carnet, Collecteur
from app.routers.utilisateurs import verifier_admin
from app.utils.excel_parser import (
    lire_fichier_excel, extraire_colonnes_utiles, analyser_lignes
)
from app.services.import_service import inserer_releves

router = APIRouter(prefix="/api/imports", tags=["Imports"])


from typing import Optional


@router.post("/analyser")
async def analyser_fichier(
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Analyse un fichier Excel et retourne un rapport complet.
    Conserve les lignes avec anomalies et les lignes avec erreurs.
    """
    if not fichier.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Format de fichier non supporté (xlsx ou xls)")

    # Sauvegarder temporairement
    with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        shutil.copyfileobj(fichier.file, tmp)
        chemin_tmp = tmp.name

    try:
        # Lire et analyser
        df = lire_fichier_excel(chemin_tmp)
        df_filtre = extraire_colonnes_utiles(df)
        rapport = analyser_lignes(df_filtre)

        return {
            "nom_fichier": fichier.filename,
            "total": rapport["total"],
            "valides_count": len(rapport["valides"]),
            "ignorees_count": len(rapport["ignorees"]),
            "erreurs_count": len(rapport["erreurs"]),
            "anomalies_count": len(rapport["anomalies"]),
            "apercu_valides": rapport["valides"][:50],  # 50 premières lignes
            "anomalies": rapport["anomalies"],
            "ignorees": rapport["ignorees"],
            "erreurs": rapport["erreurs"],
            "_raw_valides": rapport["valides"],
        }
    except Exception as e:
        raise HTTPException(500, f"Erreur d'analyse : {e}")
    finally:
        if os.path.exists(chemin_tmp):
            os.remove(chemin_tmp)


@router.post("/valider")
async def valider_import(
    fichier: UploadFile = File(...),
    id_collecteur: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Valide et insère les données du fichier Excel.
    Le choix du collecteur est facultatif : chaque installation est
    automatiquement attribuée à son collecteur selon son carnet / tournée.
    """
    # Conversion sécurisée de l'ID collecteur
    id_col_num = None
    if id_collecteur and id_collecteur not in ("undefined", "null", "", "None"):
        try:
            id_col_num = int(id_collecteur)
        except (ValueError, TypeError):
            id_col_num = None

    if id_col_num:
        collecteur = db.query(Collecteur).filter_by(id_collecteur=id_col_num).first()
        if not collecteur:
            raise HTTPException(400, "Collecteur spécifié introuvable")

    # Récupérer l'utilisateur connecté ou l'administrateur par défaut
    admin = db.query(Utilisateur).filter_by(role="ADMIN").first()
    if not admin:
        admin = db.query(Utilisateur).first()
    if not admin:
        raise HTTPException(500, "Aucun utilisateur trouvé pour lier l'import")

    # Sauvegarder le fichier temporairement
    with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        shutil.copyfileobj(fichier.file, tmp)
        chemin_tmp = tmp.name

    try:
        # Analyser le classeur Excel
        df = lire_fichier_excel(chemin_tmp)
        df_filtre = extraire_colonnes_utiles(df)
        rapport = analyser_lignes(df_filtre)

        # Insérer TOUTES les lignes (valides, anomalies, et erreurs)
        stats = inserer_releves(
            db,
            rapport["valides"],
            id_collecteur=id_col_num,
            id_utilisateur=admin.id_utilisateur,
            nom_fichier=fichier.filename,
        )

        return {
            "message": "Import effectué avec succès",
            "stats": stats,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erreur d'import : {e}")
    finally:
        if os.path.exists(chemin_tmp):
            os.remove(chemin_tmp)


@router.get("/historique")
def historique_imports(db: Session = Depends(get_db)):
    """Liste tous les imports avec le nombre réel de relevés."""
    imports = db.query(Import).order_by(Import.date_import.desc()).all()

    resultats = []
    for imp in imports:
        nb_releves = db.query(Releve).filter_by(id_import=imp.id_import).count()
        resultats.append({
            "id_import": imp.id_import,
            "nom_fichier": imp.nom_fichier,
            "date_import": imp.date_import,
            "nombre_lignes": imp.nombre_lignes,
            "releves_inseres": nb_releves,
            "utilisateur": imp.utilisateur.nom_utilisateur if imp.utilisateur else "—",
        })

    return resultats


@router.delete("/{id_import}")
def supprimer_import(id_import: int, db: Session = Depends(get_db)):
    """
    Supprime un import et toutes les données associées en cascade :
    - Tous les relevés liés à cet import
    - Les compteurs et installations orphelins (qui n'ont plus aucun relevé)
    - Les clients orphelins (qui n'ont plus aucune installation)
    """
    imp = db.query(Import).filter_by(id_import=id_import).first()
    if not imp:
        raise HTTPException(404, "Import introuvable")

    # 1. Récupérer les ID des installations concernées par cet import
    installations_ids = [
        r[0] for r in db.query(Releve.id_installation)
        .filter(Releve.id_import == id_import, Releve.id_installation.isnot(None))
        .distinct()
        .all()
    ]

    # 2. Supprimer tous les relevés de cet import
    nb_releves = db.query(Releve).filter_by(id_import=id_import).delete()

    # 3. Supprimer les installations orphelines (qui n'ont plus aucun relevé dans la base)
    clients_concernes_ids = set()
    nb_installations_supprimees = 0
    for id_inst in installations_ids:
        autres_releves = db.query(Releve).filter_by(id_installation=id_inst).count()
        if autres_releves == 0:
            inst = db.query(Installation).filter_by(id_installation=id_inst).first()
            if inst:
                clients_concernes_ids.add(inst.id_client)
                # Supprimer les compteurs associés à cette installation
                db.query(Compteur).filter_by(id_installation=id_inst).delete()
                db.delete(inst)
                nb_installations_supprimees += 1

    db.flush()

    # 4. Supprimer les clients devenus orphelins (plus aucune installation)
    nb_clients_supprimes = 0
    for id_cli in clients_concernes_ids:
        autres_inst = db.query(Installation).filter_by(id_client=id_cli).count()
        if autres_inst == 0:
            cli = db.query(Client).filter_by(id_client=id_cli).first()
            if cli:
                db.delete(cli)
                nb_clients_supprimes += 1

    # 5. Supprimer l'enregistrement Import lui-même
    db.delete(imp)
    db.commit()

    return {
        "message": f"Import et données associées supprimés ({nb_releves} relevé(s), {nb_clients_supprimes} client(s) supprimé(s))",
        "releves_supprimes": nb_releves,
        "installations_supprimees": nb_installations_supprimees,
        "clients_supprimes": nb_clients_supprimes,
    }