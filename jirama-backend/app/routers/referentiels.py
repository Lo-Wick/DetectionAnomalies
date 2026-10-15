from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Client, Collecteur, Observation, ProfilClient, TypeLecture, Installation, Carnet, Tournee, Site
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/api/referentiels", tags=["Référentiels"])


# ============ HELPERS GÉNÉRIQUES ============
def serialiser_client(c):
    return {"id_client": c.id_client, "numero_client": c.numero_client, "nom_client": c.nom_client}


def serialiser_collecteur(c):
    carnets_data = []
    for carnet in (c.carnets or []):
        tournee = carnet.tournee
        site = tournee.site if tournee else None
        carnets_data.append({
            "id_carnet": carnet.id_carnet,
            "code_carnet": carnet.code_carnet,
            "id_tournee": carnet.id_tournee,
            "code_tournee": tournee.code_tournee if tournee else "",
            "id_site": site.id_site if site else None,
            "nom_site": site.nom_site if site else "",
            "libelle": f"Tournée {tournee.code_tournee if tournee else '?'} — Carnet {carnet.code_carnet} ({site.nom_site if site else ''})"
        })
    return {
        "id_collecteur": c.id_collecteur,
        "nom_collecteur": c.nom_collecteur,
        "carnets": carnets_data,
        "nb_carnets": len(carnets_data),
        "carnet_ids": [car["id_carnet"] for car in carnets_data],
    }


def serialiser_observation(o):
    return {"id_observation": o.id_observation, "code_observation": o.code_observation, "description": o.description}


def serialiser_profil(p):
    return {"id_profil": p.id_profil, "code_profil": p.code_profil, "description": p.description}


def serialiser_type(t):
    return {"id_type_lecture": t.id_type_lecture, "code_type": t.code_type, "description": t.description}


# ============ CLIENTS ============
@router.get("/clients")
def lister_clients(db: Session = Depends(get_db)):
    return [serialiser_client(c) for c in db.query(Client).order_by(Client.nom_client).all()]


@router.post("/clients", status_code=201)
def creer_client(data: dict, db: Session = Depends(get_db)):
    if db.query(Client).filter_by(numero_client=data["numero_client"]).first():
        raise HTTPException(400, f"Le numéro client '{data['numero_client']}' existe déjà")
    nouveau = Client(numero_client=data["numero_client"], nom_client=data["nom_client"])
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return serialiser_client(nouveau)


@router.put("/clients/{id}")
def modifier_client(id: int, data: dict, db: Session = Depends(get_db)):
    c = db.query(Client).filter_by(id_client=id).first()
    if not c:
        raise HTTPException(404, "Client introuvable")
    conflit = db.query(Client).filter(
        Client.numero_client == data["numero_client"],
        Client.id_client != id
    ).first()
    if conflit:
        raise HTTPException(400, "Ce numéro client est déjà utilisé")
    c.numero_client = data["numero_client"]
    c.nom_client = data["nom_client"]
    db.commit()
    db.refresh(c)
    return serialiser_client(c)


@router.delete("/clients/{id}")
def supprimer_client(id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter_by(id_client=id).first()
    if not c:
        raise HTTPException(404, "Client introuvable")
    installations = db.query(Installation).filter_by(id_client=id).count()
    if installations > 0:
        raise HTTPException(400, f"Impossible de supprimer : {installations} installation(s) liée(s)")
    db.delete(c)
    db.commit()
    return {"message": "Client supprimé"}


# ============ COLLECTEURS ============
@router.get("/collecteurs")
def lister_collecteurs(db: Session = Depends(get_db)):
    """Liste tous les collecteurs avec leurs tournées/carnets associés."""
    collecteurs = (
        db.query(Collecteur)
        .options(joinedload(Collecteur.carnets).joinedload(Carnet.tournee).joinedload(Tournee.site))
        .order_by(Collecteur.nom_collecteur)
        .all()
    )
    return [serialiser_collecteur(c) for c in collecteurs]


@router.get("/collecteurs/carnets-disponibles")
def lister_carnets_disponibles(db: Session = Depends(get_db)):
    """
    Retourne l'ensemble des carnets (tournées/carnets) existants
    pour permettre l'affectation à un collecteur.
    """
    carnets = (
        db.query(Carnet)
        .options(joinedload(Carnet.tournee).joinedload(Tournee.site), joinedload(Carnet.collecteur))
        .all()
    )
    res = []
    for c in carnets:
        tournee = c.tournee
        site = tournee.site if tournee else None
        res.append({
            "id_carnet": c.id_carnet,
            "code_carnet": c.code_carnet,
            "id_tournee": c.id_tournee,
            "code_tournee": tournee.code_tournee if tournee else "",
            "id_site": site.id_site if site else None,
            "nom_site": site.nom_site if site else "",
            "id_collecteur": c.id_collecteur,
            "nom_collecteur": c.collecteur.nom_collecteur if c.collecteur else None,
            "libelle": f"T.{tournee.code_tournee if tournee else '?'}-C.{c.code_carnet} ({site.nom_site if site else 'Site inconnu'})"
        })
    # Trier par site puis tournée puis carnet
    res.sort(key=lambda x: (x["nom_site"], x["code_tournee"], x["code_carnet"]))
    return res


@router.post("/collecteurs", status_code=201)
def creer_collecteur(data: dict, db: Session = Depends(get_db)):
    """Crée un collecteur et lui affecte éventuellement des tournées/carnets."""
    nouveau = Collecteur(nom_collecteur=data["nom_collecteur"])
    db.add(nouveau)
    db.flush()

    carnet_ids = data.get("carnet_ids", [])
    if carnet_ids:
        db.query(Carnet).filter(Carnet.id_carnet.in_(carnet_ids)).update(
            {"id_collecteur": nouveau.id_collecteur}, synchronize_session=False
        )

    db.commit()
    db.refresh(nouveau)
    return serialiser_collecteur(nouveau)


@router.put("/collecteurs/{id}")
def modifier_collecteur(id: int, data: dict, db: Session = Depends(get_db)):
    """Modifie le nom du collecteur et ses affectations de tournées/carnets."""
    c = db.query(Collecteur).filter_by(id_collecteur=id).first()
    if not c:
        raise HTTPException(404, "Collecteur introuvable")
    c.nom_collecteur = data.get("nom_collecteur", c.nom_collecteur)

    if "carnet_ids" in data:
        # Libérer les anciens carnets
        db.query(Carnet).filter_by(id_collecteur=id).update({"id_collecteur": None}, synchronize_session=False)
        # Assigner les nouveaux carnets
        if data["carnet_ids"]:
            db.query(Carnet).filter(Carnet.id_carnet.in_(data["carnet_ids"])).update(
                {"id_collecteur": id}, synchronize_session=False
            )

    db.commit()
    db.refresh(c)
    return serialiser_collecteur(c)


@router.delete("/collecteurs/{id}")
def supprimer_collecteur(id: int, db: Session = Depends(get_db)):
    c = db.query(Collecteur).filter_by(id_collecteur=id).first()
    if not c:
        raise HTTPException(404, "Collecteur introuvable")
    # Détacher les carnets
    db.query(Carnet).filter_by(id_collecteur=id).update({"id_collecteur": None})
    db.delete(c)
    db.commit()
    return {"message": "Collecteur supprimé"}


# ============ OBSERVATIONS ============
@router.get("/observations")
def lister_observations(db: Session = Depends(get_db)):
    return [serialiser_observation(o) for o in db.query(Observation).order_by(Observation.code_observation).all()]


@router.post("/observations", status_code=201)
def creer_observation(data: dict, db: Session = Depends(get_db)):
    if db.query(Observation).filter_by(code_observation=data["code_observation"]).first():
        raise HTTPException(400, f"Le code '{data['code_observation']}' existe déjà")
    nouveau = Observation(code_observation=data["code_observation"], description=data.get("description", ""))
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return serialiser_observation(nouveau)


@router.put("/observations/{id}")
def modifier_observation(id: int, data: dict, db: Session = Depends(get_db)):
    o = db.query(Observation).filter_by(id_observation=id).first()
    if not o:
        raise HTTPException(404, "Observation introuvable")
    conflit = db.query(Observation).filter(
        Observation.code_observation == data["code_observation"],
        Observation.id_observation != id
    ).first()
    if conflit:
        raise HTTPException(400, "Ce code est déjà utilisé")
    o.code_observation = data["code_observation"]
    o.description = data.get("description", "")
    db.commit()
    db.refresh(o)
    return serialiser_observation(o)


@router.delete("/observations/{id}")
def supprimer_observation(id: int, db: Session = Depends(get_db)):
    o = db.query(Observation).filter_by(id_observation=id).first()
    if not o:
        raise HTTPException(404, "Observation introuvable")
    db.delete(o)
    db.commit()
    return {"message": "Observation supprimée"}


# ============ PROFILS CLIENTS ============
@router.get("/profils")
def lister_profils(db: Session = Depends(get_db)):
    return [serialiser_profil(p) for p in db.query(ProfilClient).order_by(ProfilClient.code_profil).all()]


@router.post("/profils", status_code=201)
def creer_profil(data: dict, db: Session = Depends(get_db)):
    if db.query(ProfilClient).filter_by(code_profil=data["code_profil"]).first():
        raise HTTPException(400, f"Le code '{data['code_profil']}' existe déjà")
    nouveau = ProfilClient(code_profil=data["code_profil"], description=data.get("description", ""))
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return serialiser_profil(nouveau)


@router.put("/profils/{id}")
def modifier_profil(id: int, data: dict, db: Session = Depends(get_db)):
    p = db.query(ProfilClient).filter_by(id_profil=id).first()
    if not p:
        raise HTTPException(404, "Profil introuvable")
    conflit = db.query(ProfilClient).filter(
        ProfilClient.code_profil == data["code_profil"],
        ProfilClient.id_profil != id
    ).first()
    if conflit:
        raise HTTPException(400, "Ce code est déjà utilisé")
    p.code_profil = data["code_profil"]
    p.description = data.get("description", "")
    db.commit()
    db.refresh(p)
    return serialiser_profil(p)


@router.delete("/profils/{id}")
def supprimer_profil(id: int, db: Session = Depends(get_db)):
    p = db.query(ProfilClient).filter_by(id_profil=id).first()
    if not p:
        raise HTTPException(404, "Profil introuvable")
    db.delete(p)
    db.commit()
    return {"message": "Profil supprimé"}


# ============ TYPES DE LECTURE ============
@router.get("/types-lecture")
def lister_types(db: Session = Depends(get_db)):
    return [serialiser_type(t) for t in db.query(TypeLecture).order_by(TypeLecture.code_type).all()]


@router.post("/types-lecture", status_code=201)
def creer_type(data: dict, db: Session = Depends(get_db)):
    if db.query(TypeLecture).filter_by(code_type=data["code_type"]).first():
        raise HTTPException(400, f"Le code '{data['code_type']}' existe déjà")
    nouveau = TypeLecture(code_type=data["code_type"], description=data.get("description", ""))
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return serialiser_type(nouveau)


@router.put("/types-lecture/{id}")
def modifier_type(id: int, data: dict, db: Session = Depends(get_db)):
    t = db.query(TypeLecture).filter_by(id_type_lecture=id).first()
    if not t:
        raise HTTPException(404, "Type introuvable")
    conflit = db.query(TypeLecture).filter(
        TypeLecture.code_type == data["code_type"],
        TypeLecture.id_type_lecture != id
    ).first()
    if conflit:
        raise HTTPException(400, "Ce code est déjà utilisé")
    t.code_type = data["code_type"]
    t.description = data.get("description", "")
    db.commit()
    db.refresh(t)
    return serialiser_type(t)


@router.delete("/types-lecture/{id}")
def supprimer_type(id: int, db: Session = Depends(get_db)):
    t = db.query(TypeLecture).filter_by(id_type_lecture=id).first()
    if not t:
        raise HTTPException(404, "Type introuvable")
    db.delete(t)
    db.commit()
    return {"message": "Type supprimé"}