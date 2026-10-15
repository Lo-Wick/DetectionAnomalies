/**
 * Tableau de bord principal de l'application JIRAMA.
 *
 * Ce composant charge les statistiques réelles depuis l'API (/api/stats/dashboard)
 * et les affiche sous forme de :
 *  - Cartes de métriques principales (relevés, anomalies, imports, clients) avec icônes SVG
 *  - Graphique en barres de l'évolution mensuelle des relevés et anomalies
 *  - Tableau des 5 dernières anomalies détectées avec lien direct vers les relevés filtrés
 *  - Liste des 5 derniers imports
 *
 * Aucune émoticône n'est utilisée : tous les symboles sont des composants SVG vectoriels.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import PageLayout from '../components/PageLayout';
import LoadingProgress from '../components/LoadingProgress';
import {
  IconReleves,
  IconAlertTriangle,
  IconImports,
  IconClients,
  IconRefresh,
  IconCheck
} from '../components/Icons';
import api from '../services/api';

// ─── Composant principal ────────────────────────────────────────────────────────
function Dashboard() {
  // ─── États des données et du chargement ───────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);

  // ─── Chargement initial des statistiques ──────────────────────────────────────
  useEffect(() => {
    chargerStatistiques();
  }, []);

  /**
   * Récupère les métriques globales et l'historique auprès de l'API.
   */
  const chargerStatistiques = async () => {
    setChargement(true);
    try {
      const res = await api.get('/stats/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error('Erreur chargement stats:', err);
      setToast({
        type: 'erreur',
        message: 'Impossible de charger les statistiques du tableau de bord.'
      });
    } finally {
      setChargement(false);
    }
  };

  // ─── Données pour le graphique d'évolution mensuelle ──────────────────────────
  const donneesGraphique = (stats?.evolution_mensuelle ?? []).map((item) => {
    const [annee, mois] = item.periode.split('-');
    const nomMois = new Date(0, parseInt(mois, 10) - 1).toLocaleString('fr-FR', { month: 'short' });
    return {
      periode: `${nomMois} ${annee.slice(2)}`,
      releves: item.releves,
      anomalies: item.anomalies,
    };
  });

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
            onClick={chargerStatistiques}
            className="mt-3 sm:mt-0 inline-flex items-center gap-2 px-3.5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium self-start sm:self-auto"
            title="Rafraîchir les statistiques"
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
                <ResponsiveContainer width="100%" height={290}>
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