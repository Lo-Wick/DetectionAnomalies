from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Tournee, Site, Carnet
from app.schemas import TourneeCreate

router = APIRouter(prefix="/api/tournees", tags=["Tournées"])


def serialiser_tournee(t: Tournee) -> dict:
    """Enrichit une tournée avec le nom du site pour l'affichage."""
    return {
        "id_tournee": t.id_tournee,
        "code_tournee": t.code_tournee,
        "id_site": t.id_site,
        "nom_site": t.site.nom_site if t.site else "",
    }


@router.get("/")
def lister_tournees(db: Session = Depends(get_db)):
    """Liste toutes les tournées avec le nom du site."""
    tournees = db.query(Tournee).order_by(Tournee.code_tournee).all()
    return [serialiser_tournee(t) for t in tournees]


@router.get("/par-site/{id_site}")
def lister_tournees_par_site(id_site: int, db: Session = Depends(get_db)):
    """Liste les tournées d'un site donné."""
    tournees = db.query(Tournee).filter_by(id_site=id_site).all()
    return [serialiser_tournee(t) for t in tournees]


@router.get("/{id_tournee}")
def obtenir_tournee(id_tournee: int, db: Session = Depends(get_db)):
    """Récupère une tournée par son ID."""
    t = db.query(Tournee).filter_by(id_tournee=id_tournee).first()
    if not t:
        raise HTTPException(404, "Tournée introuvable")
    return serialiser_tournee(t)


@router.post("/", status_code=201)
def creer_tournee(tournee: TourneeCreate, db: Session = Depends(get_db)):
    """Crée une nouvelle tournée."""
    # Vérifier que le site existe
    site = db.query(Site).filter_by(id_site=tournee.id_site).first()
    if not site:
        raise HTTPException(400, f"Le site avec l'ID {tournee.id_site} n'existe pas")

    # Vérifier l'unicité (id_site, code_tournee)
    existant = db.query(Tournee).filter_by(
        id_site=tournee.id_site,
        code_tournee=tournee.code_tournee
    ).first()
    if existant:
        raise HTTPException(
            400,
            f"La tournée '{tournee.code_tournee}' existe déjà pour le site '{site.nom_site}'"
        )

    nouvelle = Tournee(**tournee.model_dump())
    db.add(nouvelle)
    db.commit()
    db.refresh(nouvelle)
    return serialiser_tournee(nouvelle)


@router.put("/{id_tournee}")
def modifier_tournee(id_tournee: int, tournee: TourneeCreate, db: Session = Depends(get_db)):
    """Modifie une tournée existante."""
    existante = db.query(Tournee).filter_by(id_tournee=id_tournee).first()
    if not existante:
        raise HTTPException(404, "Tournée introuvable")

    site = db.query(Site).filter_by(id_site=tournee.id_site).first()
    if not site:
        raise HTTPException(400, "Le site spécifié n'existe pas")

    # Vérifier conflit d'unicité
    conflit = db.query(Tournee).filter(
        Tournee.id_site == tournee.id_site,
        Tournee.code_tournee == tournee.code_tournee,
        Tournee.id_tournee != id_tournee
    ).first()
    if conflit:
        raise HTTPException(
            400,
            f"La tournée '{tournee.code_tournee}' existe déjà pour ce site"
        )

    existante.code_tournee = tournee.code_tournee
    existante.id_site = tournee.id_site
    db.commit()
    db.refresh(existante)
    return serialiser_tournee(existante)


@router.delete("/{id_tournee}")
def supprimer_tournee(id_tournee: int, db: Session = Depends(get_db)):
    """Supprime une tournée."""
    tournee = db.query(Tournee).filter_by(id_tournee=id_tournee).first()
    if not tournee:
        raise HTTPException(404, "Tournée introuvable")

    # Vérifier si des carnets dépendent de cette tournée
    carnets = db.query(Carnet).filter_by(id_tournee=id_tournee).count()
    if carnets > 0:
        raise HTTPException(
            400,
            f"Impossible de supprimer : {carnets} carnet(s) lié(s) à cette tournée"
        )

    db.delete(tournee)
    db.commit()
    return {"message": "Tournée supprimée avec succès"}