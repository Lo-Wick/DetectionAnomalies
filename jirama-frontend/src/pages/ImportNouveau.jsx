/**
 * Page d'import et d'analyse de fichiers Excel JIRAMA.
 * 
 * Fonctionnalités :
 *  - Drag & drop ou sélection de fichiers .xlsx ou .xls
 *  - Barre de progression lors de la sélection du fichier
 *  - Deux barres de progression pendant l'analyse :
 *      1. Calcul et vérification du nombre de lignes
 *      2. Analyse détaillée ligne par ligne avec compteur et étapes textuelles
 *  - Plus besoin de choisir manuellement le collecteur : chaque installation
 *    est automatiquement attribuée à son collecteur selon la tournée/carnet
 *  - Ne filtre/n'ignore aucune ligne : toutes les lignes (normales, anomalies, erreurs)
 *    sont importées et consultables dans la page des relevés
 *  - Progression visuelle lors de l'enregistrement définitif en base de données
 *  - Aucune émoticône (icônes SVG uniquement)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import LoadingProgress from '../components/LoadingProgress';
import { importService } from '../services/importService';
import {
  IconNewImport,
  IconFileExcel,
  IconCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconDownload,
  IconClose,
  IconRefresh,
} from '../components/Icons';

function ImportNouveau() {
  const [fichier, setFichier] = useState(null);
  const [chargementFichier, setChargementFichier] = useState(0); // 0 à 100%
  const [fichierPret, setFichierPret] = useState(false);

  // ─── États pour la progression de l'analyse ────────────────────────────────
  const [enAnalyse, setEnAnalyse] = useState(false);
  const [progressionComptage, setProgressionComptage] = useState(0); // 0 à 100%
  const [tacheComptage, setTacheComptage] = useState('');
  const [progressionAnalyse, setProgressionAnalyse] = useState(0); // 0 à 100%
  const [tacheAnalyse, setTacheAnalyse] = useState('');
  const [lignesTraitees, setLignesTraitees] = useState(0);
  const [totalLignesEstimees, setTotalLignesEstimees] = useState(0);

  // ─── Résultats de l'analyse et état d'enregistrement ───────────────────────
  const [rapport, setRapport] = useState(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [progressionInsertion, setProgressionInsertion] = useState(0);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const afficherToast = (message, type = 'success') => setToast({ message, type });

  // ─── Sélection du fichier et simulation de chargement local ─────────────────
  const traiterFichier = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      return afficherToast('Format accepté : classeur Excel (.xlsx ou .xls)', 'error');
    }

    setFichier(f);
    setRapport(null);
    setFichierPret(false);
    setChargementFichier(10);

    // Progression de lecture locale du fichier
    let progres = 10;
    const interval = setInterval(() => {
      progres += 30;
      if (progres >= 100) {
        clearInterval(interval);
        setChargementFichier(100);
        setFichierPret(true);
      } else {
        setChargementFichier(progres);
      }
    }, 100);
  };

  const handleFichierChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      traiterFichier(f);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50/50', 'border-blue-500');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-blue-50/50', 'border-blue-500');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50/50', 'border-blue-500');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      traiterFichier(f);
    }
  };

  // ─── Lancement de l'analyse avec doubles barres de progression ─────────────
  const analyser = async () => {
    if (!fichier) return afficherToast('Veuillez sélectionner un fichier', 'error');

    setEnAnalyse(true);
    setProgressionComptage(15);
    setTacheComptage('Ouverture et lecture de la structure du classeur Excel...');
    setProgressionAnalyse(0);
    setTacheAnalyse('En attente du comptage des lignes...');

    try {
      // Progression du calcul du nombre de lignes
      setTimeout(() => {
        setProgressionComptage(60);
        setTacheComptage('Identification des colonnes et calcul du nombre total de lignes...');
      }, 300);

      setTimeout(() => {
        setProgressionComptage(95);
        setTacheComptage('Extraction du flux de données...');
      }, 600);

      // Appel réel à l'API backend
      const dataPromise = importService.analyser(fichier);

      // Progression de l'analyse des lignes
      setTimeout(() => {
        setProgressionComptage(100);
        setTacheComptage('Structure du classeur validée.');
        setTacheAnalyse('Vérification des numéros d\'installations (Site, Tournée, Carnet)...');
        setProgressionAnalyse(30);
      }, 900);

      setTimeout(() => {
        setProgressionAnalyse(65);
        setTacheAnalyse('Détection des écarts de relevés (R2) et vérification des formats...');
      }, 1400);

      const data = await dataPromise;

      setTotalLignesEstimees(data.total);
      setLignesTraitees(data.valides_count);
      setProgressionAnalyse(100);
      setTacheAnalyse(`Analyse terminée : ${data.valides_count} ligne(s) prêtes pour l'insertion.`);

      setTimeout(() => {
        setRapport(data);
        setEnAnalyse(false);
        afficherToast(`Analyse terminée avec succès : ${data.valides_count} relevé(s) prêt(s).`);
      }, 400);
    } catch (err) {
      setEnAnalyse(false);
      afficherToast(err.response?.data?.detail || "Erreur lors de l'analyse du fichier Excel", 'error');
    }
  };

  // ─── Validation et insertion en base de données avec barre de progression ──
  const validerImport = async () => {
    if (!rapport || !fichier) return;

    setImportEnCours(true);
    setProgressionInsertion(15);

    // Simulation d'avancement de l'insertion en base
    const timer1 = setTimeout(() => setProgressionInsertion(45), 300);
    const timer2 = setTimeout(() => setProgressionInsertion(75), 800);

    try {
      // Attribution automatique du collecteur par carnet/tournée dans le backend
      const data = await importService.valider(fichier);
      clearTimeout(timer1);
      clearTimeout(timer2);
      setProgressionInsertion(100);

      const nbInseres = data?.stats?.inseres || rapport.valides_count;
      afficherToast(`Import réussi : ${nbInseres} relevé(s) enregistré(s) dans la base !`);

      // Redirection vers la liste des relevés après 1 seconde
      setTimeout(() => {
        navigate('/releves');
      }, 1200);
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setImportEnCours(false);
      afficherToast(err.response?.data?.detail || "Erreur lors de l'enregistrement des relevés en base", 'error');
    }
  };

  // ─── Téléchargement du rapport d'erreurs en CSV ────────────────────────────
  const telechargerRapportErreurs = () => {
    if (!rapport) return;

    const listeErreurs = rapport.erreurs || [];
    const listeAnomalies = rapport.anomalies || [];

    const csv = [
      ['Ligne', 'Installation', 'Erreur ou Anomalie'],
      ...listeErreurs.map((e) => [e.ligne, e.installation, e.raison || 'Format invalide']),
      ...listeAnomalies.map((a) => [a.ligne, a.installation, `Anomalie: ${a.type || 'R2'}`]),
    ]
      .map((row) => row.map((c) => `"${c || ''}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_anomalies_erreurs_${Date.now()}.csv`;
    link.click();
  };

  return (
    <PageLayout title="Nouvel import de relevés Excel" toast={toast} setToast={setToast}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ─── 1. Zone de sélection du fichier ───────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
              1
            </span>
            <span>Sélection du fichier Excel des relevés</span>
          </h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-8 text-center transition bg-gray-50/50 hover:bg-blue-50/30"
          >
            {fichier ? (
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <IconFileExcel className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{fichier.name}</p>
                  <p className="text-xs text-gray-500">{(fichier.size / 1024).toFixed(1)} Ko</p>
                </div>

                {/* Barre de progression du chargement du fichier */}
                <div className="max-w-xs mx-auto">
                  <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                    <span>Chargement local du fichier</span>
                    <span className="font-bold text-blue-700">{chargementFichier}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200"
                      style={{ width: `${chargementFichier}%` }}
                    />
                  </div>
                </div>

                {!enAnalyse && !importEnCours && (
                  <button
                    onClick={() => {
                      setFichier(null);
                      setRapport(null);
                      setFichierPret(false);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600 font-medium transition pt-1"
                  >
                    <IconClose className="w-3.5 h-3.5" />
                    <span>Choisir un autre fichier</span>
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <IconNewImport className="w-6 h-6" />
                </div>
                <p className="font-semibold text-gray-700 text-sm mb-1">
                  Glissez-déposez votre fichier Excel ici
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Formats acceptés : .xlsx ou .xls (taille maximale 50 Mo)
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm">
                  <span>Parcourir mes dossiers</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFichierChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Bouton pour déclencher l'analyse */}
          {fichierPret && !rapport && !enAnalyse && !importEnCours && (
            <div className="mt-5 flex justify-end">
              <button
                onClick={analyser}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <IconCheck className="w-4 h-4" />
                <span>Lancer l'analyse du classeur</span>
              </button>
            </div>
          )}
        </div>

        {/* ─── 2. Doubles barres de progression pendant l'analyse ─────────────── */}
        {enAnalyse && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 space-y-5">
            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
              Traitement et analyse en cours...
            </h3>

            {/* Barre 1 : Calcul du nombre de lignes */}
            <div>
              <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                <span>Étape 1 : Calcul et vérification du nombre de lignes</span>
                <span className="font-bold text-blue-700">{progressionComptage}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner mb-1.5">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressionComptage}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 italic">{tacheComptage}</p>
            </div>

            {/* Barre 2 : Analyse de toutes les lignes */}
            <div>
              <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                <span>Étape 2 : Analyse détaillée des lignes et règles métier</span>
                <span className="font-bold text-blue-700">{progressionAnalyse}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner mb-1.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressionAnalyse}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 italic">{tacheAnalyse}</p>
            </div>
          </div>
        )}

        {/* ─── 3. Enregistrement en cours avec barre de progression ────────────── */}
        {importEnCours && (
          <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2.5 text-emerald-800 font-bold text-sm">
              <IconRefresh className="w-5 h-5 text-emerald-600 animate-spin" />
              <span>Insertion des données en cours dans la base PostgreSQL...</span>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                <span>Progression de l'enregistrement et de l'indexation</span>
                <span className="font-bold text-emerald-700">{progressionInsertion}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressionInsertion}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              Création des compteurs, installations, traçabilité des relevés et attribution automatique des collecteurs...
            </p>
          </div>
        )}

        {/* ─── 4. Résultats de l'analyse & validation de l'import ──────────────── */}
        {rapport && !importEnCours && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                2
              </span>
              <span>Rapport d'analyse du fichier</span>
            </h2>

            {/* Cartes de métriques */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Total lignes</span>
                <span className="text-xl font-bold text-gray-900">{rapport.total}</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-700 uppercase block mb-1 flex items-center gap-1">
                  <IconCheck className="w-3.5 h-3.5" />
                  <span>Lignes à importer</span>
                </span>
                <span className="text-xl font-bold text-emerald-900">{rapport.valides_count}</span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[11px] font-bold text-amber-700 uppercase block mb-1 flex items-center gap-1">
                  <IconAlertTriangle className="w-3.5 h-3.5" />
                  <span>Anomalies R2</span>
                </span>
                <span className="text-xl font-bold text-amber-900">{rapport.anomalies_count || 0}</span>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <span className="text-[11px] font-bold text-rose-700 uppercase block mb-1 flex items-center gap-1">
                  <IconAlertCircle className="w-3.5 h-3.5" />
                  <span>Erreurs de format</span>
                </span>
                <span className="text-xl font-bold text-rose-900">{rapport.erreurs_count || 0}</span>
              </div>
            </div>

            {/* Information sur l'attribution automatique des collecteurs */}
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 leading-relaxed">
              <strong>Attribution automatique :</strong> Vous n'avez pas besoin de sélectionner de collecteur.
              Chaque relevé est automatiquement relié au collecteur responsable de sa tournée et de son carnet.
              Toutes les lignes (y compris les anomalies et erreurs) sont importées pour traçabilité complète.
            </div>

            {/* Boutons d'action finale */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
              {((rapport.erreurs_count > 0) || (rapport.anomalies_count > 0)) && (
                <button
                  type="button"
                  onClick={telechargerRapportErreurs}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition"
                >
                  <IconDownload className="w-4 h-4" />
                  <span>Télécharger le rapport anomalies/erreurs</span>
                </button>
              )}

              <button
                type="button"
                onClick={validerImport}
                disabled={rapport.valides_count === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition ml-auto disabled:opacity-50"
              >
                <IconCheck className="w-4 h-4" />
                <span>
                  Confirmer l'importation de tous les relevés ({rapport.valides_count})
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default ImportNouveau;