/**
 * Tableau de bord principal de l'application JIRAMA.
 *
 * Ce composant charge les statistiques réelles depuis l'API (/api/stats/dashboard et /api/stats/observations)
 * et les affiche sous forme de :
 *  - Cartes de métriques principales (relevés, anomalies, imports, clients) avec icônes SVG
 *  - Graphique en barres de l'évolution mensuelle des relevés et anomalies
 *  - Diagramme circulaire (PieChart) des observations présentes dans les relevés,
 *    filtrable dynamiquement par Année et Mois/Période, avec option pour afficher toutes les observations sans filtre
 *  - Tableau des 5 dernières anomalies détectées avec lien direct vers les relevés filtrés
 *  - Liste des 5 derniers imports
 *
 * Aucune émoticône n'est utilisée : tous les symboles sont des composants SVG vectoriels.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import PageLayout from '../components/PageLayout';
import LoadingProgress from '../components/LoadingProgress';
import {
  IconReleves,
  IconAlertTriangle,
  IconImports,
  IconClients,
  IconRefresh,
  IconCheck,
  IconObservations,
  IconFilter,
  IconPieChart,
} from '../components/Icons';
import api from '../services/api';

// ─── Noms des mois en français ──────────────────────────────────────────────────
const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// ─── Palette de couleurs pour le diagramme circulaire ──────────────────────────
const COULEURS_PIE = [
  '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444',
  '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
  '#84CC16', '#64748B'
];

// ─── Composant principal ────────────────────────────────────────────────────────
function Dashboard() {
  // ─── États des métriques globales ─────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);

  // ─── États du diagramme circulaire des observations ──────────────────────────
  const [statsObs, setStatsObs] = useState(null);
  const [filtreAnnee, setFiltreAnnee] = useState('');
  const [filtreMois, setFiltreMois] = useState('');
  const [chargementObs, setChargementObs] = useState(false);

  // ─── Chargement initial des données ──────────────────────────────────────────
  useEffect(() => {
    chargerDonneesGlobales();
  }, []);

  /**
   * Charge simultanément les statistiques générales et les statistiques des observations.
   */
  const chargerDonneesGlobales = async () => {
    setChargement(true);
    try {
      await Promise.all([
        chargerStatistiques(),
        chargerStatistiquesObservations(filtreAnnee, filtreMois)
      ]);
    } finally {
      setChargement(false);
    }
  };

  /**
   * Récupère les métriques globales et l'historique auprès de l'API.
   */
  const chargerStatistiques = async () => {
    try {
      const res = await api.get('/stats/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error('Erreur chargement stats:', err);
      setToast({
        type: 'erreur',
        message: 'Impossible de charger les statistiques du tableau de bord.'
      });
    }
  };

  /**
   * Récupère la distribution des observations avec filtres optionnels par année et mois.
   * Si annee et mois sont vides, récupère toutes les observations sans filtration.
   */
  const chargerStatistiquesObservations = async (anneeVal, moisVal) => {
    setChargementObs(true);
    try {
      const params = {};
      if (anneeVal) params.annee = parseInt(anneeVal, 10);
      if (moisVal) params.mois = parseInt(moisVal, 10);

      const res = await api.get('/stats/observations', { params });
      setStatsObs(res.data);
    } catch (err) {
      console.error('Erreur chargement observations:', err);
      setToast({
        type: 'erreur',
        message: 'Impossible de charger la répartition des observations.'
      });
    } finally {
      setChargementObs(false);
    }
  };

  /**
   * Modifie le filtre Année et rafraîchit immédiatement le diagramme circulaire.
   */
  const handleChangementAnnee = (e) => {
    const nouvAnnee = e.target.value;
    setFiltreAnnee(nouvAnnee);
    chargerStatistiquesObservations(nouvAnnee, filtreMois);
  };

  /**
   * Modifie le filtre Mois et rafraîchit immédiatement le diagramme circulaire.
   */
  const handleChangementMois = (e) => {
    const nouvMois = e.target.value;
    setFiltreMois(nouvMois);
    chargerStatistiquesObservations(filtreAnnee, nouvMois);
  };

  /**
   * Réinitialise tous les filtres pour afficher l'intégralité des observations sans restriction.
   */
  const reinitialiserFiltresObservations = () => {
    setFiltreAnnee('');
    setFiltreMois('');
    chargerStatistiquesObservations('', '');
  };

  // ─── Formatage des données pour le graphique en barres ───────────────────────
  const donneesGraphique = (stats?.evolution_mensuelle ?? []).map((item) => {
    const [annee, mois] = item.periode.split('-');
    const nomMois = new Date(0, parseInt(mois, 10) - 1).toLocaleString('fr-FR', { month: 'short' });
    return {
      periode: `${nomMois} ${annee.slice(2)}`,
      releves: item.releves,
      anomalies: item.anomalies,
    };
  });

  // ─── Formatage des données pour le diagramme circulaire (PieChart) ───────────
  // Si le nombre d'observations dépasse 7, regrouper les plus petites dans "Autres"
  const observationsBrutes = statsObs?.donnees || [];
  let donneesPie = [];
  if (observationsBrutes.length > 7) {
    const top6 = observationsBrutes.slice(0, 6);
    const reste = observationsBrutes.slice(6);
    const totalReste = reste.reduce((acc, curr) => acc + curr.total, 0);
    const pourcentageReste = Math.round(reste.reduce((acc, curr) => acc + curr.pourcentage, 0) * 100) / 100;
    donneesPie = [
      ...top6,
      {
        code: 'AUTRES',
        description: 'Autres observations combinées',
        nom_affiche: 'Autres observations',
        total: totalReste,
        pourcentage: pourcentageReste,
      }
    ];
  } else {
    donneesPie = observationsBrutes;
  }

  // Infobulle personnalisée pour le diagramme circulaire
  const CustomTooltipPie = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-200 text-xs space-y-1 z-50">
          <p className="font-bold text-gray-800">{d.nom_affiche}</p>
          <p className="text-gray-500">{d.description}</p>
          <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between gap-4 font-semibold">
            <span className="text-blue-600">{d.total.toLocaleString()} relevé(s)</span>
            <span className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{d.pourcentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <PageLayout title="Tableau de bord JIRAMA" toast={toast} setToast={setToast}>
      <div className="space-y-6">
        {/* En-tête contextuel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Vue d'ensemble opérationnelle</h2>
            <p className="text-sm text-gray-500">Mahajanga — Surveillance et analyse des relevés de compteurs</p>
          </div>
          <button
            onClick={chargerDonneesGlobales}
            className="mt-3 sm:mt-0 inline-flex items-center gap-2 px-3.5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium self-start sm:self-auto"
            title="Rafraîchir toutes les statistiques"
          >
            <IconRefresh className="w-4 h-4 text-gray-600" />
            <span>Rafraîchir</span>
          </button>
        </div>

        {chargement ? (
          /* Indicateur de chargement moderne */
          <div className="py-20">
            <LoadingProgress message="Chargement des statistiques en temps réel..." progress={65} />
          </div>
        ) : (
          <>
            {/* ─── Cartes de métriques principales ─────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <CarteMetrique
                titre="Total relevés"
                valeur={stats?.total_releves ?? 0}
                couleur="blue"
                Icon={IconReleves}
                lien="/releves"
              />
              <CarteMetrique
                titre="Anomalies R2"
                valeur={stats?.total_anomalies ?? 0}
                couleur="orange"
                Icon={IconAlertTriangle}
                lien="/releves?statut=anomalies"
              />
              <CarteMetrique
                titre="Imports Excel"
                valeur={stats?.total_imports ?? 0}
                couleur="green"
                Icon={IconImports}
                lien="/imports"
              />
              <CarteMetrique
                titre="Clients JIRAMA"
                valeur={stats?.total_clients ?? 0}
                couleur="purple"
                Icon={IconClients}
                lien="/clients"
              />
            </div>

            {/* ─── Graphique d'évolution mensuelle ────────────────────────────── */}
            {donneesGraphique.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      Évolution mensuelle — Relevés & Anomalies
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Historique des volumes traités par période</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {donneesGraphique.length} période(s)
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={donneesGraphique} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="periode" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(val, name) => [val.toLocaleString(), name === 'releves' ? 'Relevés' : 'Anomalies']}
                    />
                    <Legend formatter={(val) => (val === 'releves' ? 'Relevés globaux' : 'Anomalies détectées')} />
                    <Bar dataKey="releves" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="anomalies" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ─── Diagramme circulaire : Répartition des observations dans les relevés ─ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {/* En-tête et barre de filtrage */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <IconPieChart className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-800">
                        Répartition des observations dans les relevés
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                        {statsObs?.total_observations?.toLocaleString() || 0} relevé(s)
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Distribution des motifs et constats relevés sur le terrain (compteur déposé, maison fermée, etc.)
                    </p>
                  </div>
                </div>

                {/* Filtres : Année, Mois et bouton "Toutes sans filtre" */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Filtre Année */}
                  <div className="relative">
                    <select
                      value={filtreAnnee}
                      onChange={handleChangementAnnee}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      title="Filtrer par année"
                    >
                      <option value="">Toutes les années</option>
                      {(statsObs?.annees_disponibles || []).map((a) => (
                        <option key={a} value={a}>
                          Année {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtre Mois / Période */}
                  <div className="relative">
                    <select
                      value={filtreMois}
                      onChange={handleChangementMois}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      title="Filtrer par mois / période"
                    >
                      <option value="">Tous les mois</option>
                      {(statsObs?.mois_disponibles?.length ? statsObs.mois_disponibles : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map((m) => (
                        <option key={m} value={m}>
                          {String(m).padStart(2, '0')} — {NOMS_MOIS[m - 1]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bouton pour réinitialiser et voir toutes les observations sans aucun filtre */}
                  <button
                    type="button"
                    onClick={reinitialiserFiltresObservations}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      !filtreAnnee && !filtreMois
                        ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Afficher toutes les observations sans restriction de date"
                  >
                    <IconFilter className="w-3.5 h-3.5" />
                    <span>Toutes sans filtre</span>
                  </button>
                </div>
              </div>

              {/* Corps du diagramme circulaire et détails */}
              {chargementObs ? (
                <div className="py-16">
                  <LoadingProgress message="Actualisation de la répartition des observations..." progress={50} />
                </div>
              ) : !observationsBrutes.length ? (
                <div className="py-16 flex flex-col items-center justify-center text-center text-gray-400">
                  <IconObservations className="w-10 h-10 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Aucune observation enregistrée</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {filtreAnnee || filtreMois
                      ? 'Aucun relevé avec observation ne correspond aux filtres de période sélectionnés.'
                      : "Aucun relevé dans la base ne possède d'observation."}
                  </p>
                  {(filtreAnnee || filtreMois) && (
                    <button
                      onClick={reinitialiserFiltresObservations}
                      className="mt-4 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      Effacer les filtres
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-4">
                  {/* ─── Diagramme circulaire (Donut) ────────────────────────────── */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={donneesPie}
                          dataKey="total"
                          nameKey="nom_affiche"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={105}
                          paddingAngle={3}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {donneesPie.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COULEURS_PIE[index % COULEURS_PIE.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltipPie />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Centre du Donut avec compteur d'observations */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <p className="text-xl font-extrabold text-gray-800 leading-tight">
                        {statsObs?.total_observations?.toLocaleString()}
                      </p>
                      <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                        Observations
                      </p>
                    </div>
                  </div>

                  {/* ─── Liste détaillée avec codes, libellés et pourcentages ─────── */}
                  <div className="lg:col-span-7">
                    <div className="max-h-64 overflow-y-auto pr-2 space-y-2.5">
                      {observationsBrutes.map((obs, idx) => {
                        const couleur = COULEURS_PIE[idx % COULEURS_PIE.length];
                        return (
                          <div
                            key={obs.code}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/80 hover:bg-gray-100/70 border border-gray-100 transition group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Pastille de couleur */}
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: couleur }}
                              />
                              {/* Code et description */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-gray-800">
                                    {obs.code}
                                  </span>
                                  <span className="text-xs text-gray-600 truncate">
                                    — {obs.description}
                                  </span>
                                </div>
                                {/* Petite barre de progression horizontale */}
                                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(obs.pourcentage, 100)}%`,
                                      backgroundColor: couleur,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Nombres et pourcentages */}
                            <div className="text-right pl-3 flex-shrink-0">
                              <span className="text-xs font-bold text-gray-800 block">
                                {obs.total.toLocaleString()}
                              </span>
                              <span className="text-[11px] font-semibold text-gray-500">
                                {obs.pourcentage}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Lignes basses : Dernières anomalies + Derniers imports ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Dernières anomalies détectées ─────────────────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <IconAlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-base font-bold text-gray-800">Dernières anomalies</h3>
                  </div>
                  <Link
                    to="/releves?statut=anomalies"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Voir toutes les anomalies &rarr;
                  </Link>
                </div>
                {!stats?.dernieres_anomalies?.length ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <IconCheck className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-gray-600">Aucune anomalie détectée récemment</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {stats.dernieres_anomalies.map((a) => (
                      <li
                        key={a.id_releve}
                        className="flex items-start gap-3 p-3 bg-amber-50/60 rounded-lg border border-amber-200/60 hover:bg-amber-50 transition"
                      >
                        <IconAlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.nom_client || 'Client anonyme'}</p>
                          <p className="text-xs font-mono text-gray-500">{a.installation}</p>
                          <p className="text-xs text-amber-800 font-medium mt-1">
                            Lecture nouvelle : {a.lecture_nouvelle} &lt; précédente : {a.lecture_precedente} (écart : {a.ecart})
                            — {a.annee}/P{a.periode}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ── Derniers imports Excel ────────────────────────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <IconImports className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-gray-800">Derniers imports</h3>
                  </div>
                  <Link
                    to="/imports"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Voir l'historique complet &rarr;
                  </Link>
                </div>
                {!stats?.derniers_imports?.length ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <p className="text-sm font-medium text-gray-500">Aucun fichier importé pour le moment</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {stats.derniers_imports.map((imp) => (
                      <li
                        key={imp.id_import}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200/80 hover:bg-gray-100/60 transition"
                      >
                        <IconImports className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{imp.nom_fichier}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {imp.nombre_lignes?.toLocaleString()} relevé(s) — par {imp.utilisateur || 'Système'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {imp.date_import ? new Date(imp.date_import).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

// ─── Composant de carte métrique ──────────────────────────────────────────────
/**
 * Affiche une carte de statistique cliquable avec couleur et icône SVG.
 *
 * @param {string} titre - Libellé de la métrique
 * @param {number} valeur - Valeur numérique à afficher
 * @param {string} couleur - Thème couleur (blue, orange, green, purple)
 * @param {React.ComponentType} Icon - Composant d'icône SVG
 * @param {string} lien - Route de redirection au clic
 */
function CarteMetrique({ titre, valeur, couleur, Icon, lien }) {
  const styles = {
    blue: {
      fond: 'bg-blue-50/50 hover:bg-blue-50',
      texte: 'text-blue-800',
      bordure: 'border-blue-200',
      valeur: 'text-blue-600',
      icone: 'text-blue-500'
    },
    orange: {
      fond: 'bg-amber-50/50 hover:bg-amber-50',
      texte: 'text-amber-800',
      bordure: 'border-amber-200',
      valeur: 'text-amber-600',
      icone: 'text-amber-500'
    },
    green: {
      fond: 'bg-emerald-50/50 hover:bg-emerald-50',
      texte: 'text-emerald-800',
      bordure: 'border-emerald-200',
      valeur: 'text-emerald-600',
      icone: 'text-emerald-500'
    },
    purple: {
      fond: 'bg-purple-50/50 hover:bg-purple-50',
      texte: 'text-purple-800',
      bordure: 'border-purple-200',
      valeur: 'text-purple-600',
      icone: 'text-purple-500'
    },
  };
  const c = styles[couleur] || styles.blue;

  return (
    <Link
      to={lien}
      className={`block ${c.fond} border ${c.bordure} rounded-xl p-5 shadow-sm hover:shadow transition group`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs uppercase tracking-wider font-semibold ${c.texte}`}>{titre}</p>
          <p className={`text-2xl font-extrabold ${c.valeur} mt-2 group-hover:scale-105 transition transform origin-left`}>
            {valeur.toLocaleString()}
          </p>
        </div>
        {Icon && <Icon className={`w-8 h-8 ${c.icone} opacity-80 group-hover:opacity-100 transition`} />}
      </div>
    </Link>
  );
}

export default Dashboard;