/**
 * Layout commun des pages de l'application JIRAMA.
 * 
 * Intègre la Sidebar repositionnée à gauche, l'en-tête responsive avec bouton
 * d'ouverture/fermeture du menu, les notifications Toast et la gestion de session.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toast from './Toast';
import { authService } from '../services/authService';
import { IconMenu, IconLogout } from './Icons';

function PageLayout({ title, toast, setToast, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Menu latéral gauche */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Zone de contenu principal décalée selon l'état de la barre latérale */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        {/* Barre supérieure d'en-tête */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Bouton pour afficher/masquer le menu */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title={isSidebarOpen ? "Masquer le menu" : "Afficher le menu"}
            >
              <IconMenu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Informations utilisateur connecté */}
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800 leading-tight">
                {user?.nom_utilisateur || 'Utilisateur'}
              </p>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 uppercase tracking-wider">
                {user?.role || 'USER'}
              </span>
            </div>

            {/* Bouton de déconnexion */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition text-xs font-semibold"
            >
              <IconLogout className="w-4 h-4" />
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        {/* Corps de la page */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
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