/**
 * Composant Sidebar (Menu latéral gauche).
 * 
 * Positionné à gauche de l'écran avec possibilité d'être masqué ou affiché
 * via un bouton toggle à icône SVG.
 * Utilise exclusivement des icônes SVG sans aucune émoticône.
 * La page Anomalies a été retirée du menu (centralisée dans Relevés).
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
  IconChevronRight,
} from './Icons';

function Sidebar({ isOpen, onToggle }) {
  const menuItems = [
    { path: '/dashboard', label: 'Tableau de bord', Icon: IconDashboard },
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
      <aside
        className={`fixed top-0 left-0 h-screen bg-slate-900 text-white shadow-2xl transition-all duration-300 ease-in-out z-50 ${
          isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'
        } flex flex-col justify-between`}
      >
        {/* En-tête de la Sidebar */}
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
                J
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">JIRAMA</h2>
                <p className="text-[10px] text-blue-400 font-medium">Détection d'anomalies</p>
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

          {/* Navigation */}
          <div className="p-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const { Icon } = item;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Pied de page du menu */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 text-center bg-slate-950">
          Système JIRAMA Majunga
        </div>
      </aside>

      {/* Petit bouton d'ouverture lorsque la barre latérale est complètement masquée */}
      {/* {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-3 left-3 z-40 p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-blue-600 transition flex items-center gap-2"
          title="Afficher le menu"
        >
          <IconChevronRight className="w-5 h-5" />
          <span className="text-xs font-semibold pr-1">Menu</span>
        </button>
      )} */}
    </>
  );
}

export default Sidebar;