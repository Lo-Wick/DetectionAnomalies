/**
 * Page de gestion des collecteurs et de leurs affectations territoriales.
 * 
 * Un collecteur s'occupe de plusieurs tournées et carnets de la JIRAMA.
 * Fonctionnalités complètes :
 *  - Enregistrement du nom et de l'adresse e-mail (nécessaire pour alertes de recollecte)
 *  - Détection automatique des conflits d'affectation : si un carnet est déjà occupé,
 *    l'utilisateur choisit :
 *      * "Oui" : transférer tous les carnets au nouveau collecteur
 *      * "Non" : affecter uniquement les carnets non occupés
 *      * "Annuler" : abandonner la modification
 *  - Demande de confirmation systématique avant toute action sensible
 *  - Indicateurs de chargement et icônes vectorielles SVG (zéro émoticône)
 *  - Support complet du mode sombre et affichage responsive
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
  IconMail,
  IconAlertTriangle,
  IconInfo,
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
  const [emailCollecteur, setEmailCollecteur] = useState('');
  const [carnetsSelectionnes, setCarnetsSelectionnes] = useState([]);
  const [rechercheCarnet, setRechercheCarnet] = useState('');

  // ─── Modale de conflit d'affectation ───────────────────────────────────────
  const [modalConflit, setModalConflit] = useState({
    ouvert: false,
    carnetsEnConflit: [],
    payloadEnAttente: null,
  });

  // ─── Boîte de confirmation générique pour toute action ─────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    ouvert: false,
    titre: '',
    message: '',
    type: 'danger',
    texteConfirmer: 'Confirmer',
    onConfirmer: () => {},
  });

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

  // ─── Gestion de la modale d'édition ────────────────────────────────────────
  const ouvrirCreation = () => {
    setCollecteurEnEdition(null);
    setNomCollecteur('');
    setEmailCollecteur('');
    setCarnetsSelectionnes([]);
    setRechercheCarnet('');
    setModalOuvert(true);
  };

  const ouvrirEdition = (c) => {
    setCollecteurEnEdition(c);
    setNomCollecteur(c.nom_collecteur);
    setEmailCollecteur(c.email || '');
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
      setCarnetsSelectionnes((prev) =>
        prev.filter((id) => !idsTournee.includes(id))
      );
    } else {
      setCarnetsSelectionnes((prev) => [
        ...prev,
        ...idsTournee.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  // ─── Soumission du formulaire avec détection de conflit ────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nomCollecteur.trim()) {
      return afficherToast('Veuillez saisir un nom pour le collecteur', 'error');
    }

    // Détection des carnets déjà assignés à un AUTRE collecteur
    const carnetsOccupes = carnetsDisponibles.filter(
      (c) =>
        carnetsSelectionnes.includes(c.id_carnet) &&
        c.id_collecteur &&
        c.id_collecteur !== collecteurEnEdition?.id_collecteur
    );

    const payload = {
      nom_collecteur: nomCollecteur.trim(),
      email: emailCollecteur.trim() || null,
      carnet_ids: carnetsSelectionnes,
    };

    if (carnetsOccupes.length > 0) {
      // Affichage de la boîte d'alerte de conflit
      setModalConflit({
        ouvert: true,
        carnetsEnConflit: carnetsOccupes,
        payloadEnAttente: payload,
      });
    } else {
      // Demande de confirmation standard avant enregistrement
      setConfirmDialog({
        ouvert: true,
        titre: collecteurEnEdition ? 'Modifier le collecteur' : 'Créer le collecteur',
        message: `Voulez-vous vraiment enregistrer ${
          collecteurEnEdition ? 'les modifications pour' : 'le collecteur'
        } "${nomCollecteur.trim()}" avec ses ${carnetsSelectionnes.length} carnet(s) ?`,
        type: 'info',
        texteConfirmer: 'Enregistrer',
        onConfirmer: () => executerEnregistrement(payload, true),
      });
    }
  };

  // ─── Exécution de l'enregistrement en base ─────────────────────────────────
  const executerEnregistrement = async (payload, forcerReaffectation) => {
    try {
      payload.forcer_reaffectation = forcerReaffectation;

      if (collecteurEnEdition) {
        await api.put(`/referentiels/collecteurs/${collecteurEnEdition.id_collecteur}`, payload);
        afficherToast('Collecteur et affectations mis à jour');
      } else {
        await api.post('/referentiels/collecteurs', payload);
        afficherToast('Collecteur créé avec ses affectations');
      }

      setModalOuvert(false);
      setModalConflit({ ouvert: false, carnetsEnConflit: [], payloadEnAttente: null });
      setConfirmDialog((prev) => ({ ...prev, ouvert: false }));
      chargerDonnees();
    } catch (err) {
      afficherToast(err.response?.data?.detail || "Erreur lors de l'enregistrement", 'error');
    }
  };

  // ─── Suppression d'un collecteur avec confirmation ─────────────────────────
  const demanderSuppression = (c) => {
    setConfirmDialog({
      ouvert: true,
      titre: 'Supprimer le collecteur',
      message: `Voulez-vous vraiment supprimer le collecteur "${c.nom_collecteur}" ? Ses ${c.nb_carnets} carnet(s) seront désaffectés mais conservés dans le système.`,
      type: 'danger',
      texteConfirmer: 'Supprimer définitivement',
      onConfirmer: async () => {
        try {
          await api.delete(`/referentiels/collecteurs/${c.id_collecteur}`);
          afficherToast('Collecteur supprimé avec succès');
          setConfirmDialog((prev) => ({ ...prev, ouvert: false }));
          chargerDonnees();
        } catch (err) {
          afficherToast(err.response?.data?.detail || 'Erreur lors de la suppression', 'error');
        }
      },
    });
  };

  // Groupement des carnets disponibles par Tournée
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

  const collecteursFiltres = collecteurs.filter((c) => {
    const q = recherche.toLowerCase();
    return (
      c.nom_collecteur.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <PageLayout title="Gestion des collecteurs et affectations territoriales" toast={toast} setToast={setToast}>
      {/* ─── Barre d'actions supérieure ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white shadow-xs"
          />
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>

        <button
          onClick={ouvrirCreation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-bold shadow-xs"
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouveau collecteur</span>
        </button>
      </div>

      {/* ─── Liste des collecteurs avec leurs tournées/carnets ──────────────────── */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-xs border border-gray-200 dark:border-slate-700 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement des collecteurs et de leurs affectations..." />
        ) : collecteursFiltres.length === 0 ? (
          <div className="p-16 text-center text-gray-500 dark:text-slate-400 text-xs">
            {recherche ? 'Aucun collecteur trouvé pour cette recherche.' : 'Aucun collecteur enregistré.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Nom du collecteur</th>
                  <th className="px-5 py-3.5">Adresse e-mail</th>
                  <th className="px-5 py-3.5">Nombre de carnets</th>
                  <th className="px-5 py-3.5">Tournées & Carnets pris en charge</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 font-medium">
                {collecteursFiltres.map((c) => (
                  <tr key={c.id_collecteur} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition">
                    <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                        <IconCollecteurs className="w-3.5 h-3.5" />
                      </div>
                      <span>{c.nom_collecteur}</span>
                    </td>

                    {/* Email du collecteur */}
                    <td className="px-5 py-3.5">
                      {c.email ? (
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-slate-300">
                          <IconMail className="w-3.5 h-3.5 text-gray-400" />
                          <span>{c.email}</span>
                        </div>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded">
                          Pas d'e-mail (alertes indisponibles)
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-blue-600 dark:text-blue-400">
                      {c.nb_carnets} carnet(s)
                    </td>

                    <td className="px-5 py-3.5 max-w-md">
                      {c.carnets && c.carnets.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {c.carnets.map((car) => (
                            <span
                              key={car.id_carnet}
                              className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded text-[10px] font-mono"
                              title={car.libelle}
                            >
                              T.{car.code_tournee}-C.{car.code_carnet}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-500 italic text-[11px]">Aucun carnet attribué</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => ouvrirEdition(c)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition"
                        title="Modifier le collecteur et ses affectations"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => demanderSuppression(c)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition"
                        title="Supprimer le collecteur"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modale de création / édition ──────────────────────────────────────── */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={collecteurEnEdition ? 'Modifier le collecteur' : 'Ajouter un nouveau collecteur'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Nom complet du collecteur <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Jean RAKOTO"
                value={nomCollecteur}
                onChange={(e) => setNomCollecteur(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Adresse e-mail (pour alertes directes de recollecte)
              </label>
              <input
                type="email"
                placeholder="Ex: jean.collecteur@jirama.mg"
                value={emailCollecteur}
                onChange={(e) => setEmailCollecteur(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Permet d'envoyer un ordre de mission en cas d'anomalie sur un relevé.
              </p>
            </div>
          </div>

          {/* Sélecteur multiple de tournées / carnets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
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
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50/50 dark:bg-slate-800 dark:text-white"
              />
              <IconSearch className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
            </div>

            {/* Liste scrollable des carnets groupés */}
            <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-3 max-h-64 overflow-y-auto space-y-3 bg-gray-50/30 dark:bg-slate-900/40">
              {Object.keys(carnetsParTournee).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">Aucun carnet disponible</p>
              ) : (
                Object.entries(carnetsParTournee).map(([tourneeTitre, listeCarnets]) => {
                  const tourneeCode = listeCarnets[0]?.code_tournee;
                  const tousCoches = listeCarnets.every((c) =>
                    carnetsSelectionnes.includes(c.id_carnet)
                  );

                  return (
                    <div key={tourneeTitre} className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-50 dark:border-slate-700/60">
                        <span className="text-[11px] font-bold text-gray-800 dark:text-white">{tourneeTitre}</span>
                        <button
                          type="button"
                          onClick={() => selectionnerTousTournee(tourneeCode)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          {tousCoches ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                        {listeCarnets.map((car) => {
                          const estSelectionne = carnetsSelectionnes.includes(car.id_carnet);
                          const dejaOccupe = car.id_collecteur && car.id_collecteur !== collecteurEnEdition?.id_collecteur;

                          return (
                            <button
                              key={car.id_carnet}
                              type="button"
                              onClick={() => toggleCarnet(car.id_carnet)}
                              className={`flex flex-col text-left p-1.5 rounded-md border text-[11px] transition ${
                                estSelectionne
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : dejaOccupe
                                  ? 'bg-amber-50/70 dark:bg-amber-950/30 text-gray-700 dark:text-slate-300 border-amber-200 dark:border-amber-900'
                                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-mono font-bold">Carnet {car.code_carnet}</span>
                                {estSelectionne && <IconCheck className="w-3 h-3 text-white" />}
                              </div>
                              {dejaOccupe && (
                                <span className={`text-[9px] truncate ${estSelectionne ? 'text-blue-100' : 'text-amber-700 dark:text-amber-400'}`}>
                                  ({car.nom_collecteur})
                                </span>
                              )}
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

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModalOuvert(false)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Modale d'alerte sur les conflits de tournées/carnets déjà occupés ─── */}
      <Modal
        isOpen={modalConflit.ouvert}
        onClose={() => setModalConflit({ ouvert: false, carnetsEnConflit: [], payloadEnAttente: null })}
        title="Attention : Tournée / Carnet déjà attribué"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
            <IconAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {modalConflit.carnetsEnConflit.length} carnet(s) sélectionné(s) sont déjà occupés par un autre collecteur :
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                {modalConflit.carnetsEnConflit.map((c) => (
                  <li key={c.id_carnet}>
                    Tournée {c.code_tournee} — Carnet {c.code_carnet} (actuellement :{' '}
                    <strong>{c.nom_collecteur}</strong>)
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            Souhaitez-vous affecter directement l'ensemble de ces carnets à ce nouveau collecteur ?
          </p>

          <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs space-y-2 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">Option « Oui » :</span>
              <span className="text-gray-600 dark:text-slate-300">
                Tout sera affecté au nouveau collecteur (les anciens liens seront réassignés).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 dark:text-slate-300">Option « Non » :</span>
              <span className="text-gray-600 dark:text-slate-300">
                Seuls les carnets non occupés seront ajoutés ; les carnets déjà occupés resteront avec leur collecteur actuel.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-700">
            {/* Annuler */}
            <button
              type="button"
              onClick={() => setModalConflit({ ouvert: false, carnetsEnConflit: [], payloadEnAttente: null })}
              className="px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 transition order-3 sm:order-1"
            >
              Annuler
            </button>

            {/* Non : uniquement les libres */}
            <button
              type="button"
              onClick={() => executerEnregistrement(modalConflit.payloadEnAttente, false)}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-lg text-xs font-bold transition order-2"
            >
              Non, garder uniquement les libres
            </button>

            {/* Oui : tout affecter */}
            <button
              type="button"
              onClick={() => executerEnregistrement(modalConflit.payloadEnAttente, true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition order-1 sm:order-3"
            >
              Oui, tout affecter à ce collecteur
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Dialogue de confirmation générique pour toute action ─────────────── */}
      <ConfirmDialog
        isOpen={confirmDialog.ouvert}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, ouvert: false }))}
        onConfirm={confirmDialog.onConfirmer}
        title={confirmDialog.titre}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.texteConfirmer}
        cancelText="Annuler"
      />
    </PageLayout>
  );
}

export default Collecteurs;