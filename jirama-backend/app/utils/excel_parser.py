import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime


# ============ CONFIGURATION ============
COLONNES_UTILES = {
    "Site": "site",
    "Tournée": "tournee_complete",     # 7 caractères : site+tournee+carnet
    "Année": "annee",
    "Periode": "periode",
    "Installation": "installation",
    "Compteur": "compteur",
    "Client.": "numero_client",
    "Client": "nom_client",
    "Lecture Précédente": "lecture_precedente",
    "Lecture Nouvelle": "lecture_nouvelle",
    "Type Lecture": "type_lecture",     # Colonne N (code)
    "Observation": "observation",
    "Profil - Client 7": "profil_client",
}


def lire_fichier_excel(chemin_fichier: str) -> pd.DataFrame:
    """Lit un fichier Excel et retourne le DataFrame complet."""
    try:
        df = pd.read_excel(chemin_fichier, dtype=str)
        return df
    except Exception as e:
        raise ValueError(f"Erreur de lecture du fichier : {e}")


def extraire_colonnes_utiles(df: pd.DataFrame) -> pd.DataFrame:
    """Sélectionne uniquement les colonnes utiles."""
    # Vérifier que toutes les colonnes existent
    colonnes_manquantes = [
        col for col in COLONNES_UTILES.keys() if col not in df.columns
    ]
    if colonnes_manquantes:
        raise ValueError(f"Colonnes manquantes : {colonnes_manquantes}")

    # Sélectionner et renommer
    df_filtre = df[list(COLONNES_UTILES.keys())].copy()
    df_filtre = df_filtre.rename(columns=COLONNES_UTILES)
    return df_filtre


def decoder_installation(installation: str) -> Optional[Dict]:
    """
    Décode un numéro d'installation de 12 caractères.
    
    Exemple : 10324600800E
    - Site      : 103   (pos 1-3)
    - Tournée   : 24    (pos 4-5)
    - Carnet    : 60    (pos 6-7)
    - Compte    : 0800  (pos 8-11)
    - Type      : E     (pos 12)
    """
    if not installation or len(str(installation)) != 12:
        return None

    installation = str(installation).strip()

    return {
        "site": installation[0:3],
        "tournee": installation[3:5],
        "carnet": installation[5:7],
        "compte": installation[7:11],
        "type_installation": installation[11:12],
    }


def decoder_tournee_complete(tournee_complete: str) -> Optional[Dict]:
    """
    Décode la colonne B "Tournée" (7 caractères).
    
    Exemple : 1032460
    - Site    : 103  (pos 1-3)
    - Tournée : 24   (pos 4-5)
    - Carnet  : 60   (pos 6-7)
    """
    if not tournee_complete or len(str(tournee_complete)) != 7:
        return None

    tournee_complete = str(tournee_complete).strip()

    return {
        "site": tournee_complete[0:3],
        "tournee": tournee_complete[3:5],
        "carnet": tournee_complete[5:7],
    }


def convertir_date(valeur) -> Optional[str]:
    """Convertit une valeur en chaîne de date."""
    if pd.isna(valeur) or valeur == "":
        return None
    try:
        if isinstance(valeur, str):
            return valeur
        return pd.to_datetime(valeur).strftime("%Y-%m-%d")
    except Exception:
        return None


def analyser_lignes(df: pd.DataFrame) -> Dict:
    """
    Analyse toutes les lignes et retourne un rapport détaillé.
    
    Retourne :
    {
        "total": 100,
        "valides": [...],
        "ignorees": [...],
        "erreurs": [...],
    }
    """
    resultats = {
        "total": len(df),
        "valides": [],     # Toutes les lignes traitées prêtes pour insertion en base
        "ignorees": [],    # Uniquement les lignes 100% vides du classeur Excel
        "erreurs": [],     # Résumé des lignes avec erreurs pour le rapport
        "anomalies": [],   # Résumé des lignes avec anomalies pour le rapport
    }

    for index, ligne in df.iterrows():
        numero_ligne = index + 2  # +2 car Excel commence à 1 et il y a l'en-tête

        # Ligne totalement vide dans le fichier Excel (lignes résiduelles)
        if ligne.dropna().empty:
            resultats["ignorees"].append({
                "ligne": numero_ligne,
                "raison": "Ligne totalement vide dans le classeur Excel",
            })
            continue

        installation_brute = str(ligne.get("installation", "")).strip() if not pd.isna(ligne.get("installation")) else ""
        compteur_brut = str(ligne.get("compteur", "")).strip() if not pd.isna(ligne.get("compteur")) else ""
        num_client_brut = str(ligne.get("numero_client", "")).strip() if not pd.isna(ligne.get("numero_client")) else ""
        nom_client_brut = str(ligne.get("nom_client", "")).strip() if not pd.isna(ligne.get("nom_client")) else ""
        tournee_complete_brute = str(ligne.get("tournee_complete", "")).strip() if not pd.isna(ligne.get("tournee_complete")) else ""

        # Décodage de l'installation si valide
        decoded_install = decoder_installation(installation_brute) if installation_brute else None

        erreurs_ligne = []
        if not installation_brute:
            erreurs_ligne.append("Numéro d'installation manquant")
        elif not decoded_install:
            erreurs_ligne.append(f"Format d'installation invalide ({len(installation_brute)} car., attendu 12)")

        # Vérification Tournée Excel (colonne B)
        incoherence_tournee = False
        if decoded_install and tournee_complete_brute:
            tournee_calculee = installation_brute[0:7]
            if tournee_complete_brute != tournee_calculee:
                incoherence_tournee = True

        # Validation Année
        annee_val = None
        annee = ligne.get("annee")
        if pd.isna(annee) or not str(annee).strip():
            erreurs_ligne.append("Année manquante")
        else:
            try:
                annee_val = int(float(str(annee).strip()))
                if not (2000 <= annee_val <= 2100):
                    erreurs_ligne.append(f"Année hors plage ({annee_val})")
            except Exception:
                erreurs_ligne.append(f"Année invalide ({annee})")

        # Validation Période
        periode_val = None
        periode = ligne.get("periode")
        if pd.isna(periode) or not str(periode).strip():
            erreurs_ligne.append("Période manquante")
        else:
            try:
                periode_val = int(float(str(periode).strip()))
                if not (1 <= periode_val <= 12):
                    erreurs_ligne.append(f"Période invalide ({periode_val}, attendu 1 à 12)")
            except Exception:
                erreurs_ligne.append(f"Période invalide ({periode})")

        # Compteur
        if not compteur_brut:
            erreurs_ligne.append("Numéro de compteur manquant")

        # Client
        if not num_client_brut:
            erreurs_ligne.append("Numéro de client manquant")
        if not nom_client_brut:
            erreurs_ligne.append("Nom de client manquant")

        # Lectures
        lect_prec = ligne.get("lecture_precedente")
        lecture_precedente = str(lect_prec).strip() if (not pd.isna(lect_prec) and str(lect_prec).strip() != "") else None

        lect_nouv = ligne.get("lecture_nouvelle")
        lecture_nouvelle = str(lect_nouv).strip() if (not pd.isna(lect_nouv) and str(lect_nouv).strip() != "") else None
        if not lecture_nouvelle:
            erreurs_ligne.append("Lecture nouvelle manquante")

        # Type lecture
        type_lect = ligne.get("type_lecture")
        type_lecture = str(type_lect).strip() if (not pd.isna(type_lect) and str(type_lect).strip() != "") else None
        if not type_lecture:
            erreurs_ligne.append("Code type de lecture manquant")

        # Observation
        obs = ligne.get("observation")
        observation = str(obs).strip() if (not pd.isna(obs) and str(obs).strip() != "") else None

        # Profil client
        prof = ligne.get("profil_client")
        profil_client = str(prof).strip() if (not pd.isna(prof) and str(prof).strip() != "") else None

        # Détection de l'anomalie R2 (lecture nouvelle < précédente sans observation)
        anomalie_lecture = False
        type_anomalie = None
        if lecture_precedente and lecture_nouvelle and not observation:
            try:
                if int(lecture_nouvelle) < int(lecture_precedente):
                    anomalie_lecture = True
                    type_anomalie = "R2 - Lecture régressive sans observation"
            except (ValueError, TypeError):
                pass

        if incoherence_tournee and not type_anomalie:
            type_anomalie = "Incohérence tournée colonne B"

        est_erreur = len(erreurs_ligne) > 0
        message_erreur = " ; ".join(erreurs_ligne) if est_erreur else None

        # Construction de l'objet ligne consolidé
        donnees_ligne = {
            "ligne": numero_ligne,
            "site": decoded_install["site"] if decoded_install else (installation_brute[0:3] if len(installation_brute) >= 3 else None),
            "tournee": decoded_install["tournee"] if decoded_install else (installation_brute[3:5] if len(installation_brute) >= 5 else None),
            "carnet": decoded_install["carnet"] if decoded_install else (installation_brute[5:7] if len(installation_brute) >= 7 else None),
            "compte": decoded_install["compte"] if decoded_install else (installation_brute[7:11] if len(installation_brute) >= 11 else None),
            "type_installation": decoded_install["type_installation"] if decoded_install else (installation_brute[11:12] if len(installation_brute) >= 12 else None),
            "installation": installation_brute,
            "compteur": compteur_brut,
            "numero_client": num_client_brut,
            "nom_client": nom_client_brut,
            "annee": annee_val,
            "periode": periode_val,
            "lecture_precedente": lecture_precedente,
            "lecture_nouvelle": lecture_nouvelle,
            "type_lecture": type_lecture,
            "observation": observation,
            "profil_client": profil_client,
            "anomalie_lecture": anomalie_lecture,
            "incoherence_tournee": incoherence_tournee,
            "est_erreur": est_erreur,
            "message_erreur": message_erreur,
            "est_anomalie": anomalie_lecture or incoherence_tournee,
            "type_anomalie": type_anomalie,
        }

        # On conserve TOUTES les lignes pour insertion en base
        resultats["valides"].append(donnees_ligne)

        # Rapport des anomalies
        if donnees_ligne["est_anomalie"]:
            resultats["anomalies"].append({
                "ligne": numero_ligne,
                "installation": installation_brute,
                "type": type_anomalie,
            })

        # Rapport des erreurs
        if est_erreur:
            resultats["erreurs"].append({
                "ligne": numero_ligne,
                "installation": installation_brute,
                "raison": message_erreur,
            })

    return resultats