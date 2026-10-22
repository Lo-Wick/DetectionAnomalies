/**
 * Composant Sidebar (Menu latéral gauche).
 * 
 * Positionné à gauche de l'écran avec logo JIRAMA officiel (logo-jirama.png).
 * Le pied de page textuel a été retiré pour un affichage compact et fluide
 * évitant tout défilement inutile.
 * Supporte le mode sombre, le masquage/affichage et le responsive mobile.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  IconDashboard,
  IconImports,
  IconNewImport,
  IconReleves,
  IconSites,
  IconTournees,
  IconCarnets,
  IconClients,
  IconCollecteurs,
  IconObservations,
  IconProfils,
  IconUsers,
  IconTypesLecture,
  IconChevronLeft,
  IconUserProfile,
} from './Icons';

function Sidebar({ isOpen, onToggle }) {
  const menuItems = [
    { path: '/dashboard', label: 'Tableau de bord', Icon: IconDashboard },
    { path: '/mon-profil', label: 'Mon profil', Icon: IconUserProfile },
    { path: '/imports', label: 'Historique des imports', Icon: IconImports },
    { path: '/imports/nouveau', label: 'Nouvel import Excel', Icon: IconNewImport },
    { path: '/releves', label: 'Relevés & Anomalies', Icon: IconReleves },
    { path: '/sites', label: 'Sites', Icon: IconSites },
    { path: '/tournees', label: 'Tournées', Icon: IconTournees },
    { path: '/carnets', label: 'Carnets', Icon: IconCarnets },
    { path: '/clients', label: 'Clients', Icon: IconClients },
    { path: '/collecteurs', label: 'Collecteurs', Icon: IconCollecteurs },
    { path: '/observations', label: 'Observations', Icon: IconObservations },
    { path: '/profils', label: 'Profils clients', Icon: IconProfils },
    { path: '/utilisateurs', label: 'Utilisateurs', Icon: IconUsers },
    { path: '/types-lecture', label: 'Types de lecture', Icon: IconTypesLecture },
  ];

  return (
    <>
      {/* Arrière-plan assombri (overlay) sur mobile et tablette lorsque le menu est ouvert */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen bg-slate-900 dark:bg-slate-950 text-white shadow-2xl transition-all duration-300 ease-in-out z-50 ${
          isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'
        } flex flex-col`}
      >
        {/* En-tête de la Sidebar avec le logo JIRAMA officiel */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 dark:border-slate-800/80 bg-slate-950 flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logo-jirama.png"
              alt="Logo JIRAMA"
              className="w-9 h-9 object-contain rounded-md bg-white p-0.5 shadow-md flex-shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white tracking-wide truncate">JIRAMA</h2>
              <p className="text-[10px] text-blue-400 font-medium truncate">Détection d'anomalies</p>
            </div>
          </div>

          {/* Bouton pour masquer le menu */}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Masquer le menu"
          >
            <IconChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation : prend tout l'espace restant, sans pied de page superflu */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-1">
          {menuItems.map((item) => {
            const { Icon } = item;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;