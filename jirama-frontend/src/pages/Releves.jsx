/**
 * Page de consultation et d'analyse des relevés de compteurs JIRAMA.
 * 
 * Centralise l'ensemble des relevés importés :
 *  - Affichage de toutes les lignes : normales, anomalies (R2) et erreurs de saisie
 *  - Boutons de filtre rapide : Tous / Anomalies uniquement / Erreurs uniquement
 *  - Listes déroulantes dynamiques alimentées depuis la base de données :
 *      * Types de lecture (avec codes et descriptions)
 *      * Observations (avec codes et descriptions)
 *      * Profils clients (avec codes et descriptions)
 *  - Filtrage par tournée dérivée directement de l'installation
 *  - Affichage de la description du type de lecture selon le code
 *  - Attribution automatique du collecteur responsable selon la tournée/carnet
 *  - Export CSV complet
 *  - Aucune émoticône (icônes SVG exclusivement)
 */

import React, { useState, useEffect, useCallback } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import api from '../services/api';
import {
  IconSearch,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertTriangle,
  IconAlertCircle,
  IconCheck,
  IconElectricity,
  IconWater,
  IconEye,
  IconChevronLeft,
  IconChevronRight,
  IconMail,
} from '../components/Icons';


function Releves() {
  // ─── État des données et pagination ────────────────────────────────────────
  const [releves, setReleves] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalTous, setTotalTous] = useState(0);
  const [totalAnomalies, setTotalAnomalies] = useState(0);
  const [totalErreurs, setTotalErreurs] = useState(0);
  const [pageCourante, setPageCourante] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [parPage] = useState(20);
  const [chargement, setChargement] = useState(true);

  // ─── Référentiels pour les listes déroulantes dynamiques ──────────────────
  const [sites, setSites] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [typesLecture, setTypesLecture] = useState([]);
  const [observations, setObservations] = useState([]);
  const [profils, setProfils] = useState([]);

  // ─── Filtres actifs ────────────────────────────────────────────────────────
  const [filtres, setFiltres] = useState({
    annee: '',
    periode: '',
    site: '',
    tournee: '',
    id_collecteur: '',
    type_lecture: '',
    observation: '',
    profil: '',
    statut: 'tous', // 'tous' | 'anomalies' | 'erreurs'
    recherche: '',
  });

  // ─── État de l'interface ───────────────────────────────────────────────────
  const [releveDetail, setReleveDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [dialogueEmail, setDialogueEmail] = useState({
    ouvert: false,
    releve: null,
    enCours: false,
  });

  const afficherToast = (message, type = 'success') => setToast({ message, type });

  /**
   * Vérifie la disponibilité d'une adresse email pour le collecteur
   * et ouvre la modale de confirmation.
   */
  const preparerEnvoiEmail = (releve) => {
    if (!releve.id_collecteur || releve.collecteur === 'Non attribué') {
      return afficherToast(
        "Aucun collecteur n'est attribué à cette tournée/carnet. Veuillez d'abord lui affecter un collecteur dans la page Collecteurs.",
        'error'
      );
    }

    if (!releve.email_collecteur) {
      return afficherToast(
        `Le collecteur "${releve.collecteur}" n'a pas d'adresse e-mail renseignée. Impossible d'envoyer la notification.`,
        'error'
      );
    }

    setDialogueEmail({
      ouvert: true,
      releve,
      enCours: false,
    });
  };

  /**
   * Déclenche l'appel API backend pour transmettre l'ordre de recollecte par email.
   */
  const confirmerEnvoiEmail = async () => {
    const rel = dialogueEmail.releve;
    if (!rel) return;

    try {
      setDialogueEmail((prev) => ({ ...prev, enCours: true }));
      const res = await api.post(`/releves/${rel.id_releve}/alerter-collecteur`);
      afficherToast(
        res.data?.message || `Ordre de recollecte transmis avec succès à ${rel.collecteur}`,
        'success'
      );
      setDialogueEmail({ ouvert: false, releve: null, enCours: false });
    } catch (err) {
      const msg = err.response?.data?.detail || "Erreur lors de l'envoi de l'e-mail au collecteur";
      afficherToast(msg, 'error');
      setDialogueEmail((prev) => ({ ...prev, enCours: false }));
    }
  };


  // ─── Chargement des référentiels pour les listes déroulantes ───────────────
  useEffect(() => {
    const chargerReferentiels = async () => {
      try {
        const [resSites, resColl, resTypes, resObs, resProf] = await Promise.all([
          api.get('/sites'),
          api.get('/referentiels/collecteurs'),
          api.get('/referentiels/types-lecture'),
          api.get('/referentiels/observations'),
          api.get('/referentiels/profils'),
        ]);
        setSites(resSites.data || []);
        setCollecteurs(resColl.data || []);
        setTypesLecture(resTypes.data || []);
        setObservations(resObs.data || []);
        setProfils(resProf.data || []);
      } catch (err) {
        console.error('Erreur chargement référentiels:', err);
      }
    };
    chargerReferentiels();
  }, []);

  // ─── Chargement des relevés filtrés ────────────────────────────────────────
  const chargerReleves = useCallback(
    async (page = 1) => {
      setChargement(true);
      try {
        const params = {
          page,
          par_page: parPage,
          statut: filtres.statut,
        };
        if (filtres.annee) params.annee = parseInt(filtres.annee, 10);
        if (filtres.periode) params.periode = parseInt(filtres.periode, 10);
        if (filtres.site) params.site = filtres.site;
        if (filtres.tournee) params.tournee = filtres.tournee;
        if (filtres.id_collecteur) params.id_collecteur = parseInt(filtres.id_collecteur, 10);
        if (filtres.type_lecture) params.type_lecture = filtres.type_lecture;
        if (filtres.observation) params.observation = filtres.observation;
        if (filtres.profil) params.profil = filtres.profil;
        if (filtres.recherche) params.recherche = filtres.recherche;

        const res = await api.get('/releves/', { params });
        setReleves(res.data.resultats || []);
        setTotal(res.data.total || 0);
        setTotalTous(res.data.total_tous || 0);
        setTotalAnomalies(res.data.total_anomalies || 0);
        setTotalErreurs(res.data.total_erreurs || 0);
        setPageCourante(res.data.page || 1);
        setTotalPages(res.data.pages || 1);
      } catch (err) {
        afficherToast('Erreur lors de la récupération des relevés', 'error');
      } finally {
        setChargement(false);
      }
    },
    [filtres, parPage]
  );

  useEffect(() => {
    chargerReleves(1);
  }, [chargerReleves]);

  const handleChangementFiltre = (champ, valeur) => {
    setFiltres((prev) => ({ ...prev, [champ]: valeur }));
  };

  const reinitialiserFiltres = () => {
    setFiltres({
      annee: '',
      periode: '',
      site: '',
      tournee: '',
      id_collecteur: '',
      type_lecture: '',
      observation: '',
      profil: '',
      statut: 'tous',
      recherche: '',
    });
  };

  // ─── Export CSV ────────────────────────────────────────────────────────────
  const exporterCSV = async () => {
    setExportEnCours(true);
    try {
      const params = { statut: filtres.statut };
      if (filtres.annee) params.annee = filtres.annee;
      if (filtres.periode) params.periode = filtres.periode;
      if (filtres.site) params.site = filtres.site;
      if (filtres.tournee) params.tournee = filtres.tournee;
      if (filtres.id_collecteur) params.id_collecteur = filtres.id_collecteur;
      if (filtres.type_lecture) params.type_lecture = filtres.type_lecture;
      if (filtres.observation) params.observation = filtres.observation;
      if (filtres.profil) params.profil = filtres.profil;
      if (filtres.recherche) params.recherche = filtres.recherche;

      const res = await api.get('/releves/export-csv', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `releves_jirama_${filtres.statut}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      afficherToast('Export CSV téléchargé avec succès');
    } catch (err) {
      afficherToast("Erreur lors de l'export CSV", 'error');
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <PageLayout title="Relevés de compteurs & Analyse d'anomalies" toast={toast} setToast={setToast}>
      {/* ─── Boutons de bascule rapide de statut ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => handleChangementFiltre('statut', 'tous')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              filtres.statut === 'tous'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>Tous les relevés</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                filtres.statut === 'tous' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {totalTous}
            </span>
          </button>

          <button
            onClick={() => handleChangementFiltre('statut', 'anomalies')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              filtres.statut === 'anomalies'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <IconAlertTriangle className="w-3.5 h-3.5" />
            {/* <span>Anomalies uniquement</span> */}
            <span>Nouvel index inferieur</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                filtres.statut === 'anomalies' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {totalAnomalies}
            </span>
          </button>

          <button
            onClick={() => handleChangementFiltre('statut', 'erreurs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              filtres.statut === 'erreurs'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <IconAlertCircle className="w-3.5 h-3.5" />
            {/* <span>Erreurs de saisie</span> */}
            <span>Sans nouvel index</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                filtres.statut === 'erreurs' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {totalErreurs}
            </span>
          </button>
        </div>

        {/* Bouton d'export CSV */}
        {/* <button
          onClick={exporterCSV}
          disabled={exportEnCours || total === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-xs font-semibold shadow-sm"
        >
          <IconDownload className="w-4 h-4" />
          <span>{exportEnCours ? 'Génération...' : 'Exporter CSV'}</span>
        </button> */}
      </div>

      {/* ─── Bloc des filtres multicritères ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
            <IconFilter className="w-4 h-4 text-blue-600" />
            <span>Filtres de recherche multicritères</span>
          </div>
          <button
            onClick={reinitialiserFiltres}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition font-medium"
          >
            <IconRefresh className="w-3.5 h-3.5" />
            <span>Réinitialiser les filtres</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Recherche globale */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              Recherche globale
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Installation, n° client, nom..."
                value={filtres.recherche}
                onChange={(e) => handleChangementFiltre('recherche', e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <IconSearch className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
            </div>
          </div>

          {/* Année */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Année</label>
            <input
              type="number"
              placeholder="Ex: 2026"
              value={filtres.annee}
              onChange={(e) => handleChangementFiltre('annee', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Période / Mois */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Période (mois)</label>
            <select
              value={filtres.periode}
              onChange={(e) => handleChangementFiltre('periode', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Toutes les périodes</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Mois {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* Site */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Site</label>
            <select
              value={filtres.site}
              onChange={(e) => handleChangementFiltre('site', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id_site} value={s.code_site}>
                  {s.code_site} — {s.nom_site}
                </option>
              ))}
            </select>
          </div>

          {/* Tournée selon installation */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              Tournée (d'après installation)
            </label>
            <input
              type="text"
              placeholder="Ex: 24 (pos 4-5)"
              value={filtres.tournee}
              onChange={(e) => handleChangementFiltre('tournee', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>

          {/* Collecteur */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Collecteur</label>
            <select
              value={filtres.id_collecteur}
              onChange={(e) => handleChangementFiltre('id_collecteur', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Tous les collecteurs</option>
              {collecteurs.map((c) => (
                <option key={c.id_collecteur} value={c.id_collecteur}>
                  {c.nom_collecteur}
                </option>
              ))}
            </select>
          </div>

          {/* Type de lecture (dynamique depuis BD) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Type de lecture</label>
            <select
              value={filtres.type_lecture}
              onChange={(e) => handleChangementFiltre('type_lecture', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Tous les types</option>
              {typesLecture.map((t) => (
                <option key={t.id_type_lecture} value={t.code_type}>
                  {t.code_type} — {t.description || 'Sans description'}
                </option>
              ))}
            </select>
          </div>

          {/* Observation (dynamique depuis BD) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Observation</label>
            <select
              value={filtres.observation}
              onChange={(e) => handleChangementFiltre('observation', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Toutes les observations</option>
              {observations.map((o) => (
                <option key={o.id_observation} value={o.code_observation}>
                  {o.code_observation} — {o.description || 'Sans description'}
                </option>
              ))}
            </select>
          </div>

          {/* Profil Client (dynamique depuis BD) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Profil client</label>
            <select
              value={filtres.profil}
              onChange={(e) => handleChangementFiltre('profil', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Tous les profils</option>
              {profils.map((p) => (
                <option key={p.id_profil} value={p.code_profil}>
                  {p.code_profil} — {p.description || 'Sans description'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Tableau des résultats ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement des relevés et analyse des données..." />
        ) : releves.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">
            Aucun relevé trouvé correspondant à vos critères de recherche.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Installation</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3">Lect. Préc.</th>
                  <th className="px-4 py-3">Lect. Nouv.</th>
                  <th className="px-4 py-3">Type de lecture</th>
                  <th className="px-4 py-3">Observation</th>
                  <th className="px-4 py-3">Collecteur attribué</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {releves.map((r) => {
                  const estErreur = r.est_erreur;
                  const estAnomalie = r.est_anomalie;

                  // Ligne stylisée selon le statut
                  let rowBg = 'hover:bg-gray-50/60';
                  if (estErreur) rowBg = 'bg-rose-50/40 hover:bg-rose-50/80 border-l-4 border-rose-500';
                  else if (estAnomalie) rowBg = 'bg-amber-50/40 hover:bg-amber-50/80 border-l-4 border-amber-500';

                  return (
                    <tr key={r.id_releve} className={`${rowBg} transition`}>
                      {/* Badge Statut */}
                      <td className="px-4 py-3">
                        {estErreur ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800"
                            title={r.message_erreur || 'Erreur détectée'}
                          >
                            <IconAlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Erreur</span>
                          </span>
                        ) : estAnomalie ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"
                            title={r.type_anomalie || 'Anomalie de relevé'}
                          >
                            <IconAlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Anomalie R2</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <IconCheck className="w-3 h-3 text-emerald-600" />
                            <span>Normal</span>
                          </span>
                        )}
                      </td>

                      {/* Numéro Installation & Type */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          {r.type_installation === 'E' ? (
                            <span title="Électricité"><IconElectricity className="w-3.5 h-3.5 text-amber-500" /></span>
                          ) : r.type_installation === 'W' ? (
                            <span title="Eau"><IconWater className="w-3.5 h-3.5 text-blue-500" /></span>
                          ) : null}
                          <span className="font-semibold text-gray-800">{r.installation || '—'}</span>
                        </div>
                        {r.tournee && (
                          <span className="text-[10px] text-gray-400">
                            Tournée {r.tournee} / Carnet {r.carnet || '—'}
                          </span>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800 truncate max-w-[140px]">{r.nom_client || '—'}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.numero_client || '—'}</div>
                      </td>

                      {/* Période */}
                      <td className="px-4 py-3 text-gray-600">
                        {r.annee ? `${r.annee} / P${String(r.periode || 0).padStart(2, '0')}` : '—'}
                      </td>

                      {/* Lectures */}
                      <td className="px-4 py-3 font-mono text-gray-500">{r.lecture_precedente ?? '—'}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">{r.lecture_nouvelle ?? '—'}</td>

                      {/* Type de lecture avec description */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{r.type_lecture || '—'}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[130px]" title={r.description_type_lecture}>
                          {r.description_type_lecture || '—'}
                        </div>
                      </td>

                      {/* Observation */}
                      <td className="px-4 py-3">
                        {r.observation ? (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px]"
                            title={r.description_observation}
                          >
                            {r.observation}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Collecteur attribué */}
                      <td className="px-4 py-3 text-gray-700">
                        <span className="truncate max-w-[120px] inline-block font-medium">
                          {r.collecteur}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        {/* Bouton pour alerter le collecteur par e-mail en cas d'anomalie ou de besoin de recollecte */}
                        <button
                          onClick={() => preparerEnvoiEmail(r)}
                          className={`p-1.5 rounded-lg transition ${
                            r.email_collecteur
                              ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                              : 'text-gray-300 dark:text-slate-600 hover:text-gray-400'
                          }`}
                          title={
                            r.email_collecteur
                              ? `Envoyer ordre de recollecte par e-mail à ${r.collecteur} (${r.email_collecteur})`
                              : `Le collecteur "${r.collecteur}" n'a pas d'adresse e-mail renseignée`
                          }
                        >
                          <IconMail className="w-4 h-4" />
                        </button>

                        {/* Bouton Détail */}
                        <button
                          onClick={() => setReleveDetail(r)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition"
                          title="Voir le détail complet du relevé"
                        >
                          <IconEye className="w-4 h-4" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Pagination ────────────────────────────────────────────────────────── */}
        {!chargement && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page <span className="font-semibold text-gray-700">{pageCourante}</span> sur{' '}
              <span className="font-semibold text-gray-700">{totalPages}</span> ({total} relevés)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => chargerReleves(pageCourante - 1)}
                disabled={pageCourante === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-100 transition"
              >
                <IconChevronLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>

              <button
                onClick={() => chargerReleves(pageCourante + 1)}
                disabled={pageCourante === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-100 transition"
              >
                <span>Suivant</span>
                <IconChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modale de détail d'un relevé ───────────────────────────────────────── */}
      <Modal
        isOpen={!!releveDetail}
        title={releveDetail ? `Détail du Relevé #${releveDetail.id_releve}` : ''}
        onClose={() => setReleveDetail(null)}
        maxWidth="max-w-2xl"
      >
        {releveDetail && (
          <div className="space-y-4">
            {/* Bannière de notification si erreur ou anomalie */}
            {releveDetail.est_erreur && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <IconAlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wide">Erreur de saisie détectée</h4>
                  <p className="text-xs text-rose-700 mt-0.5">{releveDetail.message_erreur}</p>
                </div>
              </div>
            )}

            {releveDetail.est_anomalie && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <IconAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide">Anomalie détectée</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {releveDetail.type_anomalie || 'Lecture nouvelle inférieure à la précédente sans observation justificative.'}
                  </p>
                </div>
              </div>
            )}

            {/* Grille des caractéristiques */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs bg-gray-50/80 p-4 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Installation</span>
                <span className="font-mono font-bold text-gray-800 text-sm">{releveDetail.installation || '—'}</span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Fluide / Énergie</span>
                <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                  {releveDetail.type_installation === 'E' ? (
                    <>
                      <IconElectricity className="w-3.5 h-3.5 text-amber-500" />
                      <span>Électricité (E)</span>
                    </>
                  ) : releveDetail.type_installation === 'W' ? (
                    <>
                      <IconWater className="w-3.5 h-3.5 text-blue-500" />
                      <span>Eau (W)</span>
                    </>
                  ) : (
                    <span>Non spécifié</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Période</span>
                <span className="font-bold text-gray-800">
                  {releveDetail.annee ? `${releveDetail.annee} — Période ${releveDetail.periode}` : '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Abonné / Client</span>
                <span className="font-bold text-gray-800">{releveDetail.nom_client || '—'}</span>
                <span className="text-gray-400 block text-[10px]">{releveDetail.numero_client}</span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Compteur</span>
                <span className="font-mono font-bold text-gray-800">{releveDetail.numero_compteur || '—'}</span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Collecteur</span>
                <span className="font-bold text-gray-800">{releveDetail.collecteur}</span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Lect. Précédente</span>
                <span className="font-mono font-bold text-gray-600 text-sm">{releveDetail.lecture_precedente ?? '—'}</span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Lect. Nouvelle</span>
                <span className="font-mono font-bold text-blue-700 text-sm">{releveDetail.lecture_nouvelle ?? '—'}</span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Secteur géographique</span>
                <span className="font-bold text-gray-800">
                  Tournée {releveDetail.tournee || '—'} / Carnet {releveDetail.carnet || '—'}
                </span>
                <span className="text-gray-400 block text-[10px]">{releveDetail.nom_site || `Site ${releveDetail.site}`}</span>
              </div>

              <div className="col-span-2">
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Type de lecture</span>
                <span className="font-bold text-gray-800">
                  {releveDetail.type_lecture_complet}
                </span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Observation</span>
                <span className="font-bold text-gray-800">
                  {releveDetail.observation ? `${releveDetail.observation} (${releveDetail.description_observation})` : 'Aucune'}
                </span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Profil Client</span>
                <span className="font-bold text-gray-800">
                  {releveDetail.profil ? `${releveDetail.profil} (${releveDetail.description_profil})` : 'Par défaut (0)'}
                </span>
              </div>

              <div>
                <span className="text-gray-400 font-semibold uppercase text-[10px] block">Import source</span>
                <span className="font-mono text-gray-600">Import #{releveDetail.id_import}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
              {/* Bouton pour envoyer l'ordre de recollecte depuis la modale */}
              {releveDetail.id_collecteur && (
                <button
                  type="button"
                  onClick={() => preparerEnvoiEmail(releveDetail)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                    releveDetail.email_collecteur
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                  title={
                    releveDetail.email_collecteur
                      ? `Transmettre l'ordre de mission à ${releveDetail.collecteur}`
                      : 'Adresse e-mail du collecteur non renseignée'
                  }
                >
                  <IconMail className="w-4 h-4" />
                  <span>
                    {releveDetail.email_collecteur
                      ? `Alerter le collecteur (${releveDetail.collecteur})`
                      : 'Collecteur sans e-mail'}
                  </span>
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setReleveDetail(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Boîte de confirmation avant envoi d'ordre de recollecte par e-mail ─── */}
      <ConfirmDialog
        isOpen={dialogueEmail.ouvert}
        onClose={() => setDialogueEmail({ ouvert: false, releve: null, enCours: false })}
        onConfirm={confirmerEnvoiEmail}
        title="Ordre de mission : Recollecte de compteur"
        message={
          dialogueEmail.releve
            ? `Voulez-vous vraiment envoyer un ordre de recollecte par e-mail à "${dialogueEmail.releve.collecteur}" (${dialogueEmail.releve.email_collecteur}) pour l'installation ${dialogueEmail.releve.installation} ?\n\nIl lui sera demandé de se rendre sur place, de refaire la lecture et de se présenter au bureau JIRAMA.`
            : ''
        }
        type="warning"
        confirmText={dialogueEmail.enCours ? 'Transmission en cours...' : "Confirmer l'envoi"}
        cancelText="Annuler"
      />
    </PageLayout>
  );
}

export default Releves;