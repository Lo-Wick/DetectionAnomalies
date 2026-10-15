/**
 * Page de gestion des carnets JIRAMA.
 *
 * Permet de visualiser, ajouter, modifier et supprimer les carnets
 * rattachés à une tournée spécifique (ex: Carnet 60 rattaché à la Tournée 24).
 *
 * Intègre PageLayout (barre latérale à gauche), LoadingProgress et des icônes SVG.
 */

import React, { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import { IconSearch, IconPlus, IconEdit, IconTrash } from '../components/Icons';
import { carnetService } from '../services/carnetService';
import { tourneeService } from '../services/tourneeService';
import { siteService } from '../services/siteService';

function Carnets() {
  // ─── États des données et formulaires ─────────────────────────────────────────
  const [carnets, setCarnets] = useState([]);
  const [tournees, setTournees] = useState([]);
  const [sites, setSites] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtreSite, setFiltreSite] = useState('');
  const [filtreTournee, setFiltreTournee] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [carnetEnEdition, setCarnetEnEdition] = useState(null);
  const [formData, setFormData] = useState({
    code_carnet: '',
    id_site: '',
    id_tournee: '',
  });
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [carnetASupprimer, setCarnetASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const afficherToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // ─── Chargement de toutes les données associées ───────────────────────────────
  const chargerDonnees = async () => {
    try {
      setChargement(true);
      const [cData, tData, sData] = await Promise.all([
        carnetService.lister(),
        tourneeService.lister(),
        siteService.lister(),
      ]);
      setCarnets(cData);
      setTournees(tData);
      setSites(sData);
    } catch (err) {
      afficherToast('Erreur lors du chargement des carnets', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  // Tournées filtrées selon le site sélectionné dans le formulaire
  const tourneesDuSite = formData.id_site
    ? tournees.filter((t) => t.id_site === parseInt(formData.id_site, 10))
    : [];

  // ─── Gestion de la modale d'ajout / modification ──────────────────────────────
  const ouvrirCreation = () => {
    setCarnetEnEdition(null);
    setFormData({ code_carnet: '', id_site: '', id_tournee: '' });
    setModalOuvert(true);
  };

  const ouvrirEdition = (carnet) => {
    setCarnetEnEdition(carnet);
    setFormData({
      code_carnet: carnet.code_carnet,
      id_site: String(carnet.id_site),
      id_tournee: String(carnet.id_tournee),
    });
    setModalOuvert(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code_carnet: formData.code_carnet,
        id_tournee: parseInt(formData.id_tournee, 10),
      };

      if (carnetEnEdition) {
        await carnetService.modifier(carnetEnEdition.id_carnet, payload);
        afficherToast('Carnet modifié avec succès');
      } else {
        await carnetService.creer(payload);
        afficherToast('Carnet créé avec succès');
      }
      setModalOuvert(false);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || "Erreur lors de l'enregistrement";
      afficherToast(message, 'error');
    }
  };

  // ─── Suppression d'un carnet ──────────────────────────────────────────────────
  const demanderSuppression = (carnet) => {
    setCarnetASupprimer(carnet);
    setConfirmOuvert(true);
  };

  const confirmerSuppression = async () => {
    try {
      await carnetService.supprimer(carnetASupprimer.id_carnet);
      afficherToast('Carnet supprimé avec succès');
      setConfirmOuvert(false);
      setCarnetASupprimer(null);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  // ─── Filtrage des carnets ─────────────────────────────────────────────────────
  const carnetsFiltres = carnets.filter((c) => {
    const matchRecherche =
      c.code_carnet.toLowerCase().includes(recherche.toLowerCase()) ||
      (c.code_tournee && c.code_tournee.toLowerCase().includes(recherche.toLowerCase())) ||
      (c.nom_site && c.nom_site.toLowerCase().includes(recherche.toLowerCase()));
    const matchSite = !filtreSite || c.id_site === parseInt(filtreSite, 10);
    const matchTournee = !filtreTournee || c.id_tournee === parseInt(filtreTournee, 10);
    return matchRecherche && matchSite && matchTournee;
  });

  const tourneesPourFiltre = filtreSite
    ? tournees.filter((t) => t.id_site === parseInt(filtreSite, 10))
    : tournees;

  return (
    <PageLayout title="Gestion des carnets" toast={toast} setToast={setToast}>
      {/* Barre d'actions et filtres */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Recherche textuelle */}
          <div className="relative w-full sm:w-60">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <IconSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Rechercher..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Filtre site */}
          <select
            value={filtreSite}
            onChange={(e) => {
              setFiltreSite(e.target.value);
              setFiltreTournee('');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tous les sites</option>
            {sites.map((s) => (
              <option key={s.id_site} value={s.id_site}>
                {s.code_site} — {s.nom_site}
              </option>
            ))}
          </select>

          {/* Filtre tournée */}
          <select
            value={filtreTournee}
            onChange={(e) => setFiltreTournee(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Toutes les tournées</option>
            {tourneesPourFiltre.map((t) => (
              <option key={t.id_tournee} value={t.id_tournee}>
                Tournée {t.code_tournee} ({t.nom_site})
              </option>
            ))}
          </select>

          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg">
            {carnetsFiltres.length} carnet(s)
          </span>
        </div>

        <button
          onClick={ouvrirCreation}
          disabled={tournees.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title={tournees.length === 0 ? "Veuillez d'abord enregistrer une tournée" : ''}
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouveau carnet</span>
        </button>
      </div>

      {/* Tableau des carnets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement de la liste des carnets..." />
        ) : carnetsFiltres.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {recherche || filtreSite || filtreTournee
              ? 'Aucun carnet ne correspond aux filtres actifs'
              : 'Aucun carnet enregistré'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Code carnet</th>
                  <th className="px-6 py-3 text-left">Tournée</th>
                  <th className="px-6 py-3 text-left">Site</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carnetsFiltres.map((c) => (
                  <tr key={c.id_carnet} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-4 font-mono font-semibold text-blue-600">
                      {c.code_carnet}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      Tournée {c.code_tournee}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {c.nom_site}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => ouvrirEdition(c)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
                          title="Modifier ce carnet"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => demanderSuppression(c)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                          title="Supprimer ce carnet"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          <span>Supprimer</span>
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

      {/* Modale d'ajout / modification */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={carnetEnEdition ? 'Modifier le carnet' : 'Nouveau carnet'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site *
            </label>
            <select
              value={formData.id_site}
              onChange={(e) =>
                setFormData({ ...formData, id_site: e.target.value, id_tournee: '' })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Sélectionner un site —</option>
              {sites.map((s) => (
                <option key={s.id_site} value={s.id_site}>
                  {s.code_site} — {s.nom_site}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tournée *
            </label>
            <select
              value={formData.id_tournee}
              onChange={(e) => setFormData({ ...formData, id_tournee: e.target.value })}
              required
              disabled={!formData.id_site}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
            >
              <option value="">
                {formData.id_site ? '— Sélectionner une tournée —' : "— Choisir d'abord un site —"}
              </option>
              {tourneesDuSite.map((t) => (
                <option key={t.id_tournee} value={t.id_tournee}>
                  Tournée {t.code_tournee}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code carnet *
            </label>
            <input
              type="text"
              value={formData.code_carnet}
              onChange={(e) => setFormData({ ...formData, code_carnet: e.target.value })}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: 60"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalOuvert(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
            >
              {carnetEnEdition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de suppression */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Confirmer la suppression"
        message={`Voulez-vous vraiment supprimer le carnet "${carnetASupprimer?.code_carnet}" de la Tournée ${carnetASupprimer?.code_tournee} ?`}
      />
    </PageLayout>
  );
}

export default Carnets;