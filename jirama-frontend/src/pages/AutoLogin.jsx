/**
 * Page d'authentification automatique par QR code.
 *
 * Traite le jeton de connexion unique transmis en paramètre URL (?token=...)
 * et initialise la session de l'utilisateur sans saisie manuelle.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { IconRefresh, IconAlertCircle } from '../components/Icons';

function AutoLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setErreur('Jeton de connexion manquant ou invalide.');
      setChargement(false);
      return;
    }

    api
      .get(`/auth/auto-login?token=${token}`)
      .then((response) => {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem(
          'user',
          JSON.stringify({
            nom_utilisateur: response.data.nom_utilisateur,
            role: response.data.role,
          })
        );
        navigate('/dashboard');
      })
      .catch((err) => {
        setErreur(err.response?.data?.detail || 'La connexion automatique a échoué ou le jeton a expiré.');
        setChargement(false);
      });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border border-gray-100">
        {chargement ? (
          <div className="py-6">
            <IconRefresh className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-800 mb-1">Authentification en cours</h2>
            <p className="text-xs text-gray-500">Validation du QR code auprès du serveur...</p>
          </div>
        ) : (
          <div className="py-4">
            <IconAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-gray-800 mb-2">Erreur de connexion</h1>
            <p className="text-xs text-gray-600 mb-6 bg-red-50 border border-red-200 p-3 rounded-lg leading-relaxed">
              {erreur}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
            >
              Retour à la page de connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AutoLogin;