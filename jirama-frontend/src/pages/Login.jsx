/**
 * Page de connexion de l'application JIRAMA.
 *
 * Authentifie les agents et administrateurs via leur identifiant et mot de passe,
 * stocke le token JWT et le profil dans le stockage local, puis redirige vers
 * le tableau de bord opérationnel.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { IconAlertCircle } from '../components/Icons';

function Login() {
  const [login, setLogin] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
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
      if (err.response?.status === 401) {
        setErreur('Identifiants de connexion incorrects');
      } else if (err.response?.status === 403) {
        setErreur('Votre compte a été désactivé par un administrateur');
      } else {
        setErreur('Impossible de joindre le serveur JIRAMA. Vérifiez votre connexion.');
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        {/* En-tête avec titre institutionnel */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mb-3 shadow-inner">
            <span className="font-extrabold text-2xl tracking-tighter">JIR</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            JIRAMA Mahajanga
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            Détection des anomalies de relèves
          </p>
        </div>

        {/* Message d'erreur éventuel */}
        {erreur && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            <IconAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{erreur}</span>
          </div>
        )}

        {/* Formulaire de connexion */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Identifiant
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition"
              placeholder="Ex: admin ou votre identifiant"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="Votre mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={chargement}
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {chargement ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Plateforme sécurisée &copy; {new Date().getFullYear()} JIRAMA
        </p>
      </div>
    </div>
  );
}

export default Login;