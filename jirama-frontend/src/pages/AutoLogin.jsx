import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

function AutoLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setErreur('Token manquant');
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
        setErreur(err.response?.data?.detail || 'Connexion automatique échouée');
        setChargement(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96 text-center">
        {chargement ? (
          <>
            <div className="text-4xl mb-4">🔄</div>
            <p className="text-gray-700">Connexion automatique en cours...</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-red-600 mb-2">Erreur</h1>
            <p className="text-gray-700 mb-4">{erreur}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Retour à la connexion
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default AutoLogin;