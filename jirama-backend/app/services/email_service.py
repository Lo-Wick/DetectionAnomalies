"""
Service d'envoi d'e-mails pour l'application JIRAMA.

Gère deux cas d'usage principaux :
  1. Notification au collecteur : lui ordonner de refaire la collecte d'une installation
     en anomalie ou erreur, puis de se présenter au bureau.
  2. Envoi des identifiants (mot de passe généré) à l'utilisateur lors de la création
     ou de la réinitialisation de son compte.

Si aucun serveur SMTP n'est renseigné dans les paramètres (.env),
le service fonctionne en mode simulation contrôlée, enregistre les messages
dans le journal et retourne un succès sans interrompre le traitement.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings


def envoyer_email(destinataire: str, sujet: str, corps_texte: str, corps_html: str = None) -> dict:
    """
    Envoie un e-mail via le serveur SMTP configuré, ou simule l'envoi en environnement de test.

    Args:
        destinataire: Adresse e-mail cible.
        sujet: Objet du message.
        corps_texte: Contenu textuel brut.
        corps_html: Contenu HTML enrichi (optionnel).

    Returns:
        dict: Résultat de l'opération avec statut (True/False) et message explicatif.
    """
    if not destinataire or "@" not in destinataire:
        return {
            "succes": False,
            "message": "Adresse e-mail invalide ou absente."
        }

    # Création du message MIME
    msg = MIMEMultipart("alternative")
    msg["Subject"] = sujet
    msg["From"] = settings.SMTP_FROM
    msg["To"] = destinataire

    msg.attach(MIMEText(corps_texte, "plain", "utf-8"))
    if corps_html:
        msg.attach(MIMEText(corps_html, "html", "utf-8"))

    # Vérification de la configuration SMTP
    if not settings.SMTP_HOST:
        message_erreur = (
            "Aucun serveur SMTP n'est configuré dans le fichier backend .env (SMTP_HOST manquant). "
            "Pour recevoir des e-mails réels, veuillez renseigner votre serveur SMTP (ex: Gmail, Outlook)."
        )
        print(f"[ERREUR E-MAIL] {message_erreur}")
        return {
            "succes": False,
            "simule": False,
            "message": message_erreur
        }


    try:
        if settings.SMTP_PORT == 465:
            serveur = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        else:
            serveur = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            if settings.SMTP_TLS:
                serveur.starttls()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            serveur.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        serveur.sendmail(settings.SMTP_FROM, [destinataire], msg.as_string())
        serveur.quit()

        return {
            "succes": True,
            "simule": False,
            "message": f"E-mail transmis avec succès à {destinataire}."
        }
    except Exception as exc:
        print(f"[ERREUR EMAIL] Échec d'envoi vers {destinataire}: {exc}")
        return {
            "succes": False,
            "message": f"Erreur lors de l'envoi de l'e-mail: {str(exc)}"
        }


def notifier_collecteur_recollecte(
    email_collecteur: str,
    nom_collecteur: str,
    numero_installation: str,
    tournee: str = "",
    carnet: str = "",
    client_nom: str = "",
    anomalie: str = ""
) -> dict:
    """
    Transmet un ordre de mission au collecteur lui demandant de refaire
    la relève du compteur de l'installation et de revenir au bureau JIRAMA.
    """
    sujet = f"URGENT JIRAMA - Ordre de recollecte installation {numero_installation}"

    corps_texte = (
        f"Bonjour {nom_collecteur},\n\n"
        f"Une anomalie ou erreur a été constatée lors de l'analyse des relevés de compteurs JIRAMA :\n"
        f"  - N° Installation : {numero_installation}\n"
        f"  - Client concerné : {client_nom or 'Non précisé'}\n"
        f"  - Tournée / Carnet : Tournée {tournee or '?'} / Carnet {carnet or '?'}\n"
        f"  - Motif du signalement : {anomalie or 'Anomalie de lecture détectée'}\n\n"
        f"INSTRUCTION IMPORTANTE :\n"
        f"Merci de vous rendre à nouveau sur place afin de REFAIRE LA COLLECTE de cette installation "
        f"et de REVENIR IMMÉDIATEMENT AU BUREAU pour vérification.\n\n"
        f"Cordialement,\n"
        f"Service Contrôle et Détection des Anomalies - JIRAMA Majunga"
    )

    corps_html = f"""
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #b91c1c; margin-top: 0;">Ordre de mission : Recollecte de compteur</h2>
        <p>Bonjour <strong>{nom_collecteur}</strong>,</p>
        <p>Un problème a été détecté sur l'un des relevés affectés à votre secteur :</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 4px 0;"><strong>Installation :</strong> <code>{numero_installation}</code></p>
            <p style="margin: 4px 0;"><strong>Client :</strong> {client_nom or '—'}</p>
            <p style="margin: 4px 0;"><strong>Secteur :</strong> Tournée {tournee or '?'} — Carnet {carnet or '?'}</p>
            <p style="margin: 4px 0; color: #991b1b;"><strong>Motif :</strong> {anomalie or 'Anomalie de relevé détectée'}</p>
        </div>
        <p style="font-size: 15px; font-weight: bold; color: #1e3a8a;">
            Consigne obligatoire : Veuillez refaire la relève de cette installation et vous présenter immédiatement au bureau JIRAMA.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #64748b;">
            Message automatique généré par le système de détection des anomalies JIRAMA Majunga.
        </p>
    </div>
    """

    return envoyer_email(email_collecteur, sujet, corps_texte, corps_html)


def envoyer_identifiants_utilisateur(
    email: str,
    nom_utilisateur: str,
    login: str,
    mot_de_passe: str
) -> dict:
    """
    Envoie le mot de passe généré et les identifiants d'accès à l'utilisateur.
    """
    sujet = "Vos identifiants d'accès à l'application JIRAMA"

    corps_texte = (
        f"Bonjour {nom_utilisateur},\n\n"
        f"Vos accès à l'application JIRAMA Détection d'anomalies ont été configurés :\n\n"
        f"  - Identifiant (Login) : {login}\n"
        f"  - Mot de passe temporaire : {mot_de_passe}\n"
        f"  - Adresse de l'application : http://localhost:5173/login\n\n"
        f"IMPORTANT : Pour votre sécurité, ne communiquez ce mot de passe à personne.\n\n"
        f"Cordialement,\n"
        f"L'équipe d'administration JIRAMA"
    )

    corps_html = f"""
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">Bienvenue sur l'application JIRAMA</h2>
        <p>Bonjour <strong>{nom_utilisateur}</strong>,</p>
        <p>Voici vos identifiants pour vous connecter à la plateforme de détection d'anomalies :</p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 6px 0;"><strong>Identifiant (Login) :</strong> <code>{login}</code></p>
            <p style="margin: 6px 0;"><strong>Mot de passe :</strong> <strong style="font-size: 16px; color: #1d4ed8; letter-spacing: 1px;">{mot_de_passe}</strong></p>
        </div>
        <p>
            Vous pouvez vous connecter dès maintenant sur :
            <a href="http://localhost:5173/login" style="color: #2563eb; text-decoration: underline;">Accéder à JIRAMA</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #64748b;">
            Système d'administration JIRAMA. Veuillez conserver ces informations confidentielles.
        </p>
    </div>
    """

    return envoyer_email(email, sujet, corps_texte, corps_html)
