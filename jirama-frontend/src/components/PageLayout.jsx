/**
 * Layout commun des pages de l'application JIRAMA.
 * 
 * Intègre :
 *  - La Sidebar rétractable et responsive (décalage sur grand écran, superposition sur mobile)
 *  - L'en-tête avec bouton menu, titre, bascule Thème Clair / Sombre, identité utilisateur et déconnexion
 *  - Les notifications Toast pour les retours d'actions
 *  - Le respect strict de la charte sans aucune émoticône (icônes SVG uniquement)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toast from './Toast';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';
import { IconMenu, IconLogout, IconSun, IconMoon } from './Icons';

function PageLayout({ title, toast, setToast, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const { theme, toggleTheme, estSombre } = useTheme();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-gray-100 flex transition-colors duration-200">
      {/* Menu latéral gauche */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Zone de contenu principal : décalée sur desktop, plein écran sur mobile */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'lg:ml-64 ml-0' : 'ml-0'
        }`}
      >
        {/* Barre supérieure d'en-tête */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Bouton pour afficher/masquer le menu */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition flex-shrink-0"
              title={isSidebarOpen ? "Masquer le menu" : "Afficher le menu"}
            >
              <IconMenu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white truncate">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
            {/* Bouton de bascule Mode Clair / Mode Sombre */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-amber-400 dark:hover:bg-slate-800 transition"
              title={estSombre ? "Passer en mode clair" : "Passer en mode sombre"}
              type="button"
            >
              {estSombre ? (
                <IconSun className="w-5 h-5 text-amber-400" />
              ) : (
                <IconMoon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* Informations utilisateur connecté cliquables vers le profil */}
            <button
              onClick={() => navigate('/mon-profil')}
              className="text-right hidden sm:flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition group text-left"
              title="Voir et modifier mon profil"
            >
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight truncate max-w-[140px] transition">
                  {user?.nom_utilisateur || 'Utilisateur'}
                </p>
                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 uppercase tracking-wider">
                  {user?.role || 'USER'}
                </span>
              </div>
            </button>

            {/* Bouton de déconnexion */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-600 hover:text-white dark:hover:bg-rose-700 transition text-xs font-semibold"
              title="Déconnexion de l'application"
            >
              <IconLogout className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>

        {/* Corps de la page */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Notifications Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default PageLayout;