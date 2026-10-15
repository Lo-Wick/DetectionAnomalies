/**
 * Page de gestion des sites JIRAMA.
 *
 * Permet de visualiser, ajouter, modifier et supprimer les sites géographiques
 * d'exploitation (ex: 103 — Mahajanga).
 *
 * Intègre PageLayout (barre latérale à gauche), LoadingProgress et des icônes SVG.
 */

import React, { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import { IconSearch, IconPlus, IconEdit, IconTrash } from '../components/Icons';
import { siteService } from '../services/siteService';

function Sites() {
  // ─── États des données et formulaires ─────────────────────────────────────────
  const [sites, setSites] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [siteEnEdition, setSiteEnEdition] = useState(null);
  const [formData, setFormData] = useState({ code_site: '', nom_site: '' });
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [siteASupprimer, setSiteASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const afficherToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // ─── Chargement de la liste des sites ─────────────────────────────────────────
  const chargerSites = async () => {
    try {
      setChargement(true);
      const data = await siteService.lister();
      setSites(data);
    } catch (err) {
      afficherToast('Erreur lors du chargement des sites', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerSites();
  }, []);

  // ─── Gestion de la modale d'ajout / modification ──────────────────────────────
  const ouvrirCreation = () => {
    setSiteEnEdition(null);
    setFormData({ code_site: '', nom_site: '' });
    setModalOuvert(true);
  };

  const ouvrirEdition = (site) => {
    setSiteEnEdition(site);
    setFormData({ code_site: site.code_site, nom_site: site.nom_site });
    setModalOuvert(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (siteEnEdition) {
        await siteService.modifier(siteEnEdition.id_site, formData);
        afficherToast('Site modifié avec succès');
      } else {
        await siteService.creer(formData);
        afficherToast('Site créé avec succès');
      }
      setModalOuvert(false);
      chargerSites();
    } catch (err) {
      const message = err.response?.data?.detail || "Erreur lors de l'enregistrement";
      afficherToast(message, 'error');
    }
  };

  // ─── Suppression d'un site ────────────────────────────────────────────────────
  const demanderSuppression = (site) => {
    setSiteASupprimer(site);
    setConfirmOuvert(true);
  };

  const confirmerSuppression = async () => {
    try {
      await siteService.supprimer(siteASupprimer.id_site);
      afficherToast('Site supprimé avec succès');
      setConfirmOuvert(false);
      setSiteASupprimer(null);
      chargerSites();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  // ─── Filtrage en temps réel ───────────────────────────────────────────────────
  const sitesFiltres = sites.filter((s) =>
    s.code_site.toLowerCase().includes(recherche.toLowerCase()) ||
    s.nom_site.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <PageLayout title="Gestion des sites" toast={toast} setToast={setToast}>
      {/* Barre d'outils et recherche */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <IconSearch className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par code ou nom..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <button
          onClick={ouvrirCreation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouveau site</span>
        </button>
      </div>

      {/* Tableau des sites */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement de la liste des sites..." />
        ) : sitesFiltres.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {recherche ? 'Aucun site ne correspond à votre recherche' : 'Aucun site enregistré'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Code site</th>
                  <th className="px-6 py-3 text-left">Nom du site</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sitesFiltres.map((site) => (
                  <tr key={site.id_site} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-4 font-mono font-semibold text-blue-600">
                      {site.code_site}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {site.nom_site}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => ouvrirEdition(site)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
                          title="Modifier ce site"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => demanderSuppression(site)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                          title="Supprimer ce site"
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
        title={siteEnEdition ? 'Modifier le site' : 'Nouveau site'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code site *
            </label>
            <input
              type="text"
              value={formData.code_site}
              onChange={(e) => setFormData({ ...formData, code_site: e.target.value })}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: 103"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du site *
            </label>
            <input
              type="text"
              value={formData.nom_site}
              onChange={(e) => setFormData({ ...formData, nom_site: e.target.value })}
              required
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Mahajanga"
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
              {siteEnEdition ? 'Modifier' : 'Créer'}
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
        message={`Voulez-vous vraiment supprimer le site "${siteASupprimer?.nom_site}" (${siteASupprimer?.code_site}) ? Cette action est irréversible.`}
      />
    </PageLayout>
  );
}

export default Sites;