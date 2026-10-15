/**
 * Page de gestion des collecteurs et de leurs affectations territoriales.
 * 
 * Un collecteur s'occupe de plusieurs tournées et carnets de la JIRAMA.
 * Cette page permet de :
 *  - Lister les collecteurs avec leurs tournées et carnets assignés
 *  - Créer un collecteur et lui affecter des tournées/carnets
 *  - Modifier le nom et les affectations de tournées/carnets d'un collecteur
 *  - Supprimer un collecteur
 *  - Afficher les indicateurs de chargement via LoadingProgress
 *  - Utiliser des icônes vectorielles SVG (aucune émoticône)
 */

import React, { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import api from '../services/api';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCollecteurs,
  IconCarnets,
  IconCheck,
} from '../components/Icons';

function Collecteurs() {
  const [collecteurs, setCollecteurs] = useState([]);
  const [carnetsDisponibles, setCarnetsDisponibles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');

  // ─── Modale d'ajout / modification ─────────────────────────────────────────
  const [modalOuvert, setModalOuvert] = useState(false);
  const [collecteurEnEdition, setCollecteurEnEdition] = useState(null);
  const [nomCollecteur, setNomCollecteur] = useState('');
  const [carnetsSelectionnes, setCarnetsSelectionnes] = useState([]);
  const [rechercheCarnet, setRechercheCarnet] = useState('');

  // ─── Suppression ───────────────────────────────────────────────────────────
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [collecteurASupprimer, setCollecteurASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const afficherToast = (message, type = 'success') => setToast({ message, type });

  // ─── Chargement des données ────────────────────────────────────────────────
  const chargerDonnees = async () => {
    try {
      setChargement(true);
      const [resColl, resCarnets] = await Promise.all([
        api.get('/referentiels/collecteurs'),
        api.get('/referentiels/collecteurs/carnets-disponibles'),
      ]);
      setCollecteurs(resColl.data || []);
      setCarnetsDisponibles(resCarnets.data || []);
    } catch (err) {
      afficherToast('Erreur lors du chargement des collecteurs', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  // ─── Gestion de la modale ──────────────────────────────────────────────────
  const ouvrirCreation = () => {
    setCollecteurEnEdition(null);
    setNomCollecteur('');
    setCarnetsSelectionnes([]);
    setRechercheCarnet('');
    setModalOuvert(true);
  };

  const ouvrirEdition = (c) => {
    setCollecteurEnEdition(c);
    setNomCollecteur(c.nom_collecteur);
    setCarnetsSelectionnes(c.carnet_ids || []);
    setRechercheCarnet('');
    setModalOuvert(true);
  };

  const toggleCarnet = (idCarnet) => {
    setCarnetsSelectionnes((prev) =>
      prev.includes(idCarnet)
        ? prev.filter((id) => id !== idCarnet)
        : [...prev, idCarnet]
    );
  };

  const selectionnerTousTournee = (tourneeCode) => {
    const idsTournee = carnetsDisponibles
      .filter((c) => c.code_tournee === tourneeCode)
      .map((c) => c.id_carnet);

    const tousDejaSelectionnes = idsTournee.every((id) =>
      carnetsSelectionnes.includes(id)
    );

    if (tousDejaSelectionnes) {
      // Désélectionner tous les carnets de cette tournée
      setCarnetsSelectionnes((prev) =>
        prev.filter((id) => !idsTournee.includes(id))
      );
    } else {
      // Ajouter tous les carnets de cette tournée
      setCarnetsSelectionnes((prev) => [
        ...prev,
        ...idsTournee.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nomCollecteur.trim()) {
      return afficherToast('Veuillez saisir un nom pour le collecteur', 'error');
    }

    try {
      const payload = {
        nom_collecteur: nomCollecteur.trim(),
        carnet_ids: carnetsSelectionnes,
      };

      if (collecteurEnEdition) {
        await api.put(`/referentiels/collecteurs/${collecteurEnEdition.id_collecteur}`, payload);
        afficherToast('Collecteur et affectations mis à jour');
      } else {
        await api.post('/referentiels/collecteurs', payload);
        afficherToast('Collecteur créé avec ses affectations');
      }

      setModalOuvert(false);
      chargerDonnees();
    } catch (err) {
      afficherToast(err.response?.data?.detail || "Erreur lors de l'enregistrement", 'error');
    }
  };

  const confirmerSuppression = async () => {
    try {
      await api.delete(`/referentiels/collecteurs/${collecteurASupprimer.id_collecteur}`);
      afficherToast('Collecteur supprimé avec succès');
      setConfirmOuvert(false);
      setCollecteurASupprimer(null);
      chargerDonnees();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur lors de la suppression', 'error');
    }
  };

  // Groupement des carnets disponibles par Tournée pour une sélection ergonomique
  const carnetsFiltres = carnetsDisponibles.filter((c) => {
    if (!rechercheCarnet) return true;
    const q = rechercheCarnet.toLowerCase();
    return (
      c.code_tournee.toLowerCase().includes(q) ||
      c.code_carnet.toLowerCase().includes(q) ||
      c.nom_site.toLowerCase().includes(q)
    );
  });

  const carnetsParTournee = carnetsFiltres.reduce((acc, carnet) => {
    const cle = `Tournée ${carnet.code_tournee} (${carnet.nom_site})`;
    if (!acc[cle]) acc[cle] = [];
    acc[cle].push(carnet);
    return acc;
  }, {});

  const collecteursFiltres = collecteurs.filter((c) =>
    c.nom_collecteur.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <PageLayout title="Gestion des collecteurs et affectations territoriales" toast={toast} setToast={setToast}>
      {/* ─── Barre d'actions supérieure ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Rechercher un collecteur..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-sm"
          />
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>

        <button
          onClick={ouvrirCreation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-bold shadow-sm"
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouveau collecteur</span>
        </button>
      </div>

      {/* ─── Liste des collecteurs avec leurs tournées/carnets ──────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement des collecteurs et de leurs affectations..." />
        ) : collecteursFiltres.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-xs">
            {recherche ? 'Aucun collecteur trouvé pour cette recherche.' : 'Aucun collecteur enregistré.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nom du collecteur</th>
                  <th className="px-6 py-3.5">Nombre de carnets</th>
                  <th className="px-6 py-3.5">Tournées & Carnets pris en charge</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {collecteursFiltres.map((c) => (
                  <tr key={c.id_collecteur} className="hover:bg-gray-50/70 transition">
                    {/* Nom */}
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {c.nom_collecteur.charAt(0).toUpperCase()}
                        </div>
                        <span>{c.nom_collecteur}</span>
                      </div>
                    </td>

                    {/* Nombre de carnets */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                        <IconCarnets className="w-3.5 h-3.5" />
                        <span>{c.nb_carnets || 0} carnet(s)</span>
                      </span>
                    </td>

                    {/* Badges des tournées / carnets assignés */}
                    <td className="px-6 py-4 max-w-md">
                      {c.carnets && c.carnets.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {c.carnets.map((car) => (
                            <span
                              key={car.id_carnet}
                              className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-mono"
                              title={car.libelle}
                            >
                              T.{car.code_tournee}-C.{car.code_carnet}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Aucun carnet affecté</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => ouvrirEdition(c)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                          title="Modifier le nom et affecter des carnets"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          <span>Affectations</span>
                        </button>
                        <button
                          onClick={() => {
                            setCollecteurASupprimer(c);
                            setConfirmOuvert(true);
                          }}
                          className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs transition"
                          title="Supprimer ce collecteur"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modale d'ajout / modification et d'affectation ──────────────────────── */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={collecteurEnEdition ? `Modifier le collecteur & affectations` : `Nouveau collecteur`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nom complet du collecteur <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Rakoto Jean"
              value={nomCollecteur}
              onChange={(e) => setNomCollecteur(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Sélecteur multiple de tournées / carnets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-700">
                Tournées et carnets pris en charge ({carnetsSelectionnes.length} sélectionné(s))
              </label>
              <span className="text-[10px] text-gray-400">
                Cochez les carnets à attribuer à ce collecteur
              </span>
            </div>

            {/* Barre de recherche dans les carnets */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Filtrer par tournée, carnet ou site..."
                value={rechercheCarnet}
                onChange={(e) => setRechercheCarnet(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
              />
              <IconSearch className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
            </div>

            {/* Liste scrollable des carnets groupés */}
            <div className="border border-gray-200 rounded-xl p-3 max-h-64 overflow-y-auto space-y-3 bg-gray-50/30">
              {Object.keys(carnetsParTournee).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">Aucun carnet disponible</p>
              ) : (
                Object.entries(carnetsParTournee).map(([tourneeTitre, listeCarnets]) => {
                  const tourneeCode = listeCarnets[0]?.code_tournee;
                  const tousCoches = listeCarnets.every((c) =>
                    carnetsSelectionnes.includes(c.id_carnet)
                  );

                  return (
                    <div key={tourneeTitre} className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-50">
                        <span className="text-[11px] font-bold text-gray-800">{tourneeTitre}</span>
                        <button
                          type="button"
                          onClick={() => selectionnerTousTournee(tourneeCode)}
                          className="text-[10px] text-blue-600 hover:underline font-semibold"
                        >
                          {tousCoches ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {listeCarnets.map((car) => {
                          const estSelectionne = carnetsSelectionnes.includes(car.id_carnet);
                          return (
                            <button
                              key={car.id_carnet}
                              type="button"
                              onClick={() => toggleCarnet(car.id_carnet)}
                              className={`flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono border transition ${
                                estSelectionne
                                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <span>C.{car.code_carnet}</span>
                              {estSelectionne && <IconCheck className="w-3 h-3 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalOuvert(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-bold shadow-sm"
            >
              Enregistrer le collecteur
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Confirmation de suppression ───────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Supprimer le collecteur"
        message={`Confirmez-vous la suppression du collecteur ${collecteurASupprimer?.nom_collecteur} ? Ses tournées et carnets seront désaffectés sans être supprimés.`}
      />
    </PageLayout>
  );
}

export default Collecteurs;