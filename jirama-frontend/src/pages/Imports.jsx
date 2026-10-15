/**
 * Page d'historique des imports Excel de la JIRAMA.
 *
 * Affiche la liste chronologique des imports réalisés, le nombre de relevés insérés
 * et permet la suppression intégrale en cascade avec indicateur visuel de chargement.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import { importService } from '../services/importService';
import {
  IconFileExcel,
  IconPlus,
  IconTrash,
} from '../components/Icons';

function Imports() {
  const [imports, setImports] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [importASupprimer, setImportASupprimer] = useState(null);
  const navigate = useNavigate();

  const afficherToast = (message, type = 'success') => setToast({ message, type });

  // ─── Chargement de l'historique des imports ──────────────────────────────────
  const charger = async () => {
    try {
      setChargement(true);
      const data = await importService.historique();
      setImports(data);
    } catch (err) {
      afficherToast("Erreur lors de la récupération de l'historique", 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  // ─── Suppression en cascade avec indicateur de progression ───────────────────
  const confirmerSuppression = async () => {
    if (!importASupprimer) return;
    setSuppressionEnCours(true);
    try {
      const res = await importService.supprimer(importASupprimer.id_import);
      afficherToast(res.message || 'Import et données associées supprimés avec succès');
      setConfirmOuvert(false);
      setImportASupprimer(null);
      await charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur lors de la suppression de l\'import', 'error');
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <PageLayout title="Historique des imports Excel" toast={toast} setToast={setToast}>
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs text-gray-500 font-medium">
          {imports.length} fichier(s) importé(s) au total
        </span>
        <button
          onClick={() => navigate('/imports/nouveau')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-bold shadow-sm"
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouvel import</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement de l'historique des imports..." />
        ) : imports.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-xs">
            Aucun import enregistré pour le moment. Cliquez sur "Nouvel import" pour commencer.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Fichier source</th>
                <th className="px-6 py-3.5">Date et heure</th>
                <th className="px-6 py-3.5">Volume de relevés</th>
                <th className="px-6 py-3.5">Utilisateur</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imports.map((imp) => (
                <tr key={imp.id_import} className="hover:bg-gray-50/70 transition">
                  <td className="px-6 py-4 font-semibold text-gray-800">
                    <div className="flex items-center gap-2">
                      <IconFileExcel className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate max-w-xs">{imp.nom_fichier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(imp.date_import)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      {imp.releves_inseres} relevé(s)
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{imp.utilisateur}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setImportASupprimer(imp);
                        setConfirmOuvert(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation de suppression avec indicateur de progression intégré */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => {
          if (!suppressionEnCours) setConfirmOuvert(false);
        }}
        onConfirm={confirmerSuppression}
        chargement={suppressionEnCours}
        messageChargement="Suppression en cascade en cours : relevés, compteurs et installations associés..."
        title="Supprimer l'import et toutes ses données"
        message={`Confirmez-vous la suppression du fichier "${importASupprimer?.nom_fichier}" ?\n\nTous les relevés de ce fichier ainsi que les compteurs, installations et clients devenus orphelins seront définitivement supprimés de la base de données.`}
      />
    </PageLayout>
  );
}

export default Imports;