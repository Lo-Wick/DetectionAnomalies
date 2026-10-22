/**
 * Page de connexion de l'application JIRAMA.
 *
 * Authentifie les agents et administrateurs via leur identifiant et mot de passe,
 * gère la politique de sécurité (blocage 5 tentatives erronées pendant 3 jours),
 * et prend en compte la déconnexion automatique d'inactivité (30 min).
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { IconAlertCircle, IconInfo, IconLock } from '../components/Icons';

function Login() {
  const [login, setLogin] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [messageInactivite, setMessageInactivite] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('motif') === 'inactivite') {
      setMessageInactivite(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessageInactivite(false);
    setChargement(true);

    try {
      const data = await authService.login(login, motDePasse);

      // Enregistrement de la session utilisateur
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify({
        nom_utilisateur: data.nom_utilisateur,
        role: data.role,
      }));

      // Redirection vers le tableau de bord
      navigate('/dashboard');
    } catch (err) {
      const messageDetail = err.response?.data?.detail;
      if (messageDetail) {
        setErreur(messageDetail);
      } else if (err.response?.status === 401) {
        setErreur('Identifiants de connexion incorrects.');
      } else if (err.response?.status === 403) {
        setErreur('Accès refusé ou compte actuellement verrouillé.');
      } else {
        setErreur('Impossible de joindre le serveur JIRAMA. Vérifiez votre connexion.');
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-slate-800 transition">
        {/* En-tête avec logo JIRAMA officiel */}
        <div className="text-center mb-6">
          <div className="inline-block p-2 bg-white rounded-2xl shadow-md mb-3 border border-gray-100">
            <img
              src="/logo-jirama.png"
              alt="Logo JIRAMA"
              className="w-16 h-16 object-contain mx-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
            JIRAMA Mahajanga
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            Détection des anomalies de relèves
          </p>
        </div>

        {/* Alerte de déconnexion automatique après inactivité */}
        {messageInactivite && (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl mb-5 text-xs font-medium">
            <IconInfo className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">
              Vous avez été déconnecté automatiquement après 30 minutes d'inactivité par mesure de sécurité.
            </span>
          </div>
        )}

        {/* Message d'erreur / blocage sécurité */}
        {erreur && (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl mb-5 text-xs font-medium">
            <IconAlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{erreur}</span>
          </div>
        )}

        {/* Formulaire de connexion */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Identifiant
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition"
              placeholder="Ex: admin ou votre identifiant"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={chargement}
              className={`w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition duration-200 text-sm ${
                chargement ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {chargement ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
            <IconLock className="w-3.5 h-3.5 text-gray-400" />
            <span>Sécurité renforcée : verrouillage après 5 échecs pendant 3 jours</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;