from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Site, Tournee
from app.schemas import SiteCreate, SiteResponse

router = APIRouter(prefix="/api/sites", tags=["Sites"])


@router.get("/", response_model=List[SiteResponse])
def lister_sites(db: Session = Depends(get_db)):
    """Liste tous les sites."""
    return db.query(Site).order_by(Site.code_site).all()


@router.get("/{id_site}", response_model=SiteResponse)
def obtenir_site(id_site: int, db: Session = Depends(get_db)):
    """Récupère un site par son ID."""
    site = db.query(Site).filter_by(id_site=id_site).first()
    if not site:
        raise HTTPException(404, "Site introuvable")
    return site


@router.post("/", response_model=SiteResponse, status_code=201)
def creer_site(site: SiteCreate, db: Session = Depends(get_db)):
    """Crée un nouveau site."""
    existant = db.query(Site).filter_by(code_site=site.code_site).first()
    if existant:
        raise HTTPException(400, f"Le code site '{site.code_site}' existe déjà")

    nouveau = Site(**site.model_dump())
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return nouveau


@router.put("/{id_site}", response_model=SiteResponse)
def modifier_site(id_site: int, site: SiteCreate, db: Session = Depends(get_db)):
    """Modifie un site existant."""
    existant = db.query(Site).filter_by(id_site=id_site).first()
    if not existant:
        raise HTTPException(404, "Site introuvable")

    # Vérifier que le nouveau code n'est pas déjà utilisé par un autre site
    conflit = db.query(Site).filter(
        Site.code_site == site.code_site,
        Site.id_site != id_site
    ).first()
    if conflit:
        raise HTTPException(400, f"Le code site '{site.code_site}' est déjà utilisé")

    existant.code_site = site.code_site
    existant.nom_site = site.nom_site
    db.commit()
    db.refresh(existant)
    return existant


@router.delete("/{id_site}")
def supprimer_site(id_site: int, db: Session = Depends(get_db)):
    """Supprime un site."""
    site = db.query(Site).filter_by(id_site=id_site).first()
    if not site:
        raise HTTPException(404, "Site introuvable")

    # Vérifier si des tournées dépendent de ce site
    tournees = db.query(Tournee).filter_by(id_site=id_site).count()
    if tournees > 0:
        raise HTTPException(
            400,
            f"Impossible de supprimer : {tournees} tournée(s) liée(s) à ce site"
        )

    db.delete(site)
    db.commit()
    return {"message": "Site supprimé avec succès"}