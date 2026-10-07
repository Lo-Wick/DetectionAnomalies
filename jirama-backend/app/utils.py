import secrets
import string
import qrcode
from io import BytesIO
import base64
from datetime import datetime, timedelta

def generer_mot_de_passe(longueur=6):
    """Génère un mot de passe aléatoire de 6 caractères (lettres + chiffres)."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(longueur))


def generer_token_qr():
    """Génère un token unique pour la connexion QR."""
    return secrets.token_urlsafe(32)


def generer_qr_code_base64(data: str) -> str:
    """Génère un QR code et le retourne en base64 (utilisable dans une balise img)."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"


def generer_expiration_token():
    """Retourne la date d'expiration du token QR (7 jours)."""
    return datetime.utcnow() + timedelta(days=7)