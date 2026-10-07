from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Carnet, Tournee, Installation
from app.schemas import CarnetCreate

router = APIRouter(prefix="/api/carnets", tags=["Carnets"])


def serialiser_carnet(c: Carnet) -> dict:
    """Enrichit un carnet avec tournée + site pour l'affichage."""
    tournee = c.tournee
    site = tournee.site if tournee else None
    return {
        "id_carnet": c.id_carnet,
        "code_carnet": c.code_carnet,
        "id_tournee": c.id_tournee,
        "code_tournee": tournee.code_tournee if tournee else "",
        "id_site": site.id_site if site else None,
        "nom_site": site.nom_site if site else "",
    }


@router.get("/")
def lister_carnets(db: Session = Depends(get_db)):
    """Liste tous les carnets avec tournée et site."""
    carnets = db.query(Carnet).order_by(Carnet.code_carnet).all()
    return [serialiser_carnet(c) for c in carnets]


@router.get("/par-tournee/{id_tournee}")
def lister_carnets_par_tournee(id_tournee: int, db: Session = Depends(get_db)):
    """Liste les carnets d'une tournée donnée."""
    carnets = db.query(Carnet).filter_by(id_tournee=id_tournee).all()
    return [serialiser_carnet(c) for c in carnets]


@router.get("/{id_carnet}")
def obtenir_carnet(id_carnet: int, db: Session = Depends(get_db)):
    """Récupère un carnet par son ID."""
    c = db.query(Carnet).filter_by(id_carnet=id_carnet).first()
    if not c:
        raise HTTPException(404, "Carnet introuvable")
    return serialiser_carnet(c)


@router.post("/", status_code=201)
def creer_carnet(carnet: CarnetCreate, db: Session = Depends(get_db)):
    """Crée un nouveau carnet."""
    tournee = db.query(Tournee).filter_by(id_tournee=carnet.id_tournee).first()
    if not tournee:
        raise HTTPException(400, f"La tournée avec l'ID {carnet.id_tournee} n'existe pas")

    # Unicité (id_tournee, code_carnet)
    existant = db.query(Carnet).filter_by(
        id_tournee=carnet.id_tournee,
        code_carnet=carnet.code_carnet
    ).first()
    if existant:
        raise HTTPException(
            400,
            f"Le carnet '{carnet.code_carnet}' existe déjà pour la tournée '{tournee.code_tournee}'"
        )

    nouveau = Carnet(**carnet.model_dump())
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return serialiser_carnet(nouveau)


@router.put("/{id_carnet}")
def modifier_carnet(id_carnet: int, carnet: CarnetCreate, db: Session = Depends(get_db)):
    """Modifie un carnet existant."""
    existant = db.query(Carnet).filter_by(id_carnet=id_carnet).first()
    if not existant:
        raise HTTPException(404, "Carnet introuvable")

    tournee = db.query(Tournee).filter_by(id_tournee=carnet.id_tournee).first()
    if not tournee:
        raise HTTPException(400, "La tournée spécifiée n'existe pas")

    # Vérifier conflit
    conflit = db.query(Carnet).filter(
        Carnet.id_tournee == carnet.id_tournee,
        Carnet.code_carnet == carnet.code_carnet,
        Carnet.id_carnet != id_carnet
    ).first()
    if conflit:
        raise HTTPException(
            400,
            f"Le carnet '{carnet.code_carnet}' existe déjà pour cette tournée"
        )

    existant.code_carnet = carnet.code_carnet
    existant.id_tournee = carnet.id_tournee
    db.commit()
    db.refresh(existant)
    return serialiser_carnet(existant)


@router.delete("/{id_carnet}")
def supprimer_carnet(id_carnet: int, db: Session = Depends(get_db)):
    """Supprime un carnet."""
    carnet = db.query(Carnet).filter_by(id_carnet=id_carnet).first()
    if not carnet:
        raise HTTPException(404, "Carnet introuvable")

    # Protection FK : installations liées
    installations = db.query(Installation).filter_by(id_carnet=id_carnet).count()
    if installations > 0:
        raise HTTPException(
            400,
            f"Impossible de supprimer : {installations} installation(s) liée(s) à ce carnet"
        )

    db.delete(carnet)
    db.commit()
    return {"message": "Carnet supprimé avec succès"}