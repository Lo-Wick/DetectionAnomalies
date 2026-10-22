/**
 * Hook de déconnexion automatique après inactivité.
 * 
 * Surveille l'activité de l'utilisateur (souris, clavier, tactile, défilement).
 * Si aucune action n'est constatée pendant 30 minutes consécutives,
 * la session est fermée automatiquement et l'utilisateur est redirigé
 * vers l'écran de connexion avec une notification explicative.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

// Délai d'inactivité fixé à 30 minutes (en millisecondes)
const DELAI_INACTIVITE_MS = 30 * 60 * 1000;

export function useInactivityTimeout() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);

  useEffect(() => {
    // Ne pas appliquer la déconnexion automatique sur la page de connexion ou d'auto-connexion
    const cheminsExclus = ['/login', '/auto-login'];
    if (cheminsExclus.includes(location.pathname)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    /**
     * Déconnecte l'utilisateur et redirige vers la page de login.
     */
    const deconnecterParInactivite = () => {
      authService.logout();
      navigate('/login?motif=inactivite');
    };

    /**
     * Réinitialise le compte à rebours de 30 minutes à chaque interaction détectée.
     */
    const reinitialiserTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(deconnecterParInactivite, DELAI_INACTIVITE_MS);
    };

    // Événements surveillés pour détecter une présence humaine
    const evenements = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Enregistrement des écouteurs globaux
    evenements.forEach((evt) => {
      window.addEventListener(evt, reinitialiserTimer, { passive: true });
    });

    // Démarrage initial du minuteur
    reinitialiserTimer();

    // Nettoyage lors du démontage
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      evenements.forEach((evt) => {
        window.removeEventListener(evt, reinitialiserTimer);
      });
    };
  }, [navigate, location.pathname]);
}
