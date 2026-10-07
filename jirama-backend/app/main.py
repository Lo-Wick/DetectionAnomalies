from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app import models
from app.routers import sites, auth, tournees, carnets
from app.routers import sites, auth, tournees, carnets, referentiels
from app.routers import sites, auth, tournees, carnets, referentiels, utilisateurs

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API JIRAMA", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sites.router)
app.include_router(tournees.router)
app.include_router(carnets.router)
app.include_router(referentiels.router)
app.include_router(utilisateurs.router)

@app.get("/")
def root():
    return {"message": "API JIRAMA opérationnelle", "version": "1.0.0"}