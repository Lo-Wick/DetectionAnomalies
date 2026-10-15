/**
 * Page de gestion des tournées JIRAMA.
 *
 * Permet de visualiser, ajouter, modifier et supprimer les tournées de relève
 * associées à un site géographique (ex: Tournée 24 sur le Site 103).
 *
 * Intègre PageLayout (barre latérale à gauche), LoadingProgress et des icônes SVG.
 */

import React, { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import { IconSearch, IconPlus, IconEdit, IconTrash, IconFilter } from '../components/Icons';
import { tourneeService } from '../services/tourneeService';
import { siteService } from '../services/siteService';

function Tournees() {
  // ─── États des données et formulaires ─────────────────────────────────────────
  const [tournees, setTournees] = useState([]);
  const [sites, setSites] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtreSite, setFiltreSite] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [tourneeEnEdition, setTourneeEnEdition] = useState(null);
  const [formData, setFormData] = useState({ code_tournee: '', id_site: '' });
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [tourneeASupprimer, setTourneeASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const afficherToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // ─── Chargement conjoint des tournées et des sites ────────────────────────────
  const chargerDonnees = async () => {
    try {
      setChargement(true);
      const [tourneesData, sitesData] = await Promise.all([
        tourneeService.lister(),
        siteService.lister(),
      ]);
      setTournees(tourneesData);
      setSites(sitesData);
    } catch (err) {
      afficherToast('Erreur lors du chargement des tournées', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  // ─── Gestion de la modale d'ajout / modification ──────────────────────────────
  const ouvrirCreation = () => {
    setTourneeEnEdition(null);
    setFormData({
      code_tournee: '',
      id_site: sites.length > 0 ? String(sites[0].id_site) : '',
    });
    setModalOuvert(true);
  };

  const ouvrirEdition = (tournee) => {
    setTourneeEnEdition(tournee);
    setFormData({
      code_tournee: tournee.code_tournee,
      id_site: String(tournee.id_site),
    });
    setModalOuvert(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code_tournee: formData.code_tournee,
        id_site: parseInt(formData.id_site, 10),
      };

      if (tourneeEnEdition) {
        await tourneeService.modifier(tourneeEnEdition.id_tournee, payload);
        afficherToast('Tournée modifiée avec succès');
      } else {
        await tourneeService.creer(payload);
        afficherToast('Tournée créée avec succès');
      }
      setModalOuvert(false);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || "Erreur lors de l'enregistrement";
      afficherToast(message, 'error');
    }
  };

  // ─── Suppression d'une tournée ────────────────────────────────────────────────
  const demanderSuppression = (tournee) => {
    setTourneeASupprimer(tournee);
    setConfirmOuvert(true);
  };

  const confirmerSuppression = async () => {
    try {
      await tourneeService.supprimer(tourneeASupprimer.id_tournee);
      afficherToast('Tournée supprimée avec succès');
      setConfirmOuvert(false);
      setTourneeASupprimer(null);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  // ─── Filtres combinés (recherche + site) ───────────────────────────────────────
  const tourneesFiltrees = tournees.filter((t) => {
    const matchRecherche =
      t.code_tournee.toLowerCase().includes(recherche.toLowerCase()) ||
      (t.nom_site && t.nom_site.toLowerCase().includes(recherche.toLowerCase()));
    const matchSite = !filtreSite || t.id_site === parseInt(filtreSite, 10);
    return matchRecherche && matchSite;
  });

  return (
    <PageLayout title="Gestion des tournées" toast={toast} setToast={setToast}>
      {/* Barre d'actions et filtres */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Champ de recherche */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <IconSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Rechercher tournée ou site..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Filtre par site */}
          <div className="relative">
            <select
              value={filtreSite}
              onChange={(e) => setFiltreSite(e.target.value)}
              className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id_site} value={s.id_site}>
                  {s.code_site} — {s.nom_site}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg">
            {tourneesFiltrees.length} tournée(s)
          </span>
        </div>

        <button
          onClick={ouvrirCreation}
          disabled={sites.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title={sites.length === 0 ? "Veuillez d'abord enregistrer un site" : ''}
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouvelle tournée</span>
        </button>
      </div>

      {/* Tableau des tournées */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement de la liste des tournées..." />
        ) : tourneesFiltrees.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {recherche || filtreSite
              ? 'Aucune tournée ne correspond aux critères sélectionnés'
              : 'Aucune tournée enregistrée'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Code tournée</th>
                  <th className="px-6 py-3 text-left">Site d'appartenance</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tourneesFiltrees.map((t) => (
                  <tr key={t.id_tournee} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-4 font-mono font-semibold text-blue-600">
                      {t.code_tournee}
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium">
                      {t.nom_site}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => ouvrirEdition(t)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
                          title="Modifier cette tournée"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => demanderSuppression(t)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                          title="Supprimer cette tournée"
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
        title={tourneeEnEdition ? 'Modifier la tournée' : 'Nouvelle tournée'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site parent *
            </label>
            <select
              value={formData.id_site}
              onChange={(e) => setFormData({ ...formData, id_site: e.target.value })}
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
              Code tournée *
            </label>
            <input
              type="text"
              value={formData.code_tournee}
              onChange={(e) => setFormData({ ...formData, code_tournee: e.target.value })}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: 24"
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
              {tourneeEnEdition ? 'Modifier' : 'Créer'}
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
        message={`Voulez-vous vraiment supprimer la tournée "${tourneeASupprimer?.code_tournee}" du site "${tourneeASupprimer?.nom_site}" ?`}
      />
    </PageLayout>
  );
}

export default Tournees;