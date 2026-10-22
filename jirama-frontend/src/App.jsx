/**
 * Point d'entrée des routes et de la gestion globale de l'application JIRAMA.
 * 
 * Intègre :
 *  - Le ThemeProvider (gestion du mode clair et mode sombre)
 *  - La surveillance d'inactivité de 30 minutes avec déconnexion automatique
 *  - L'ensemble des routes protégées et publiques
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Imports from './pages/Imports';
import ImportNouveau from './pages/ImportNouveau';
import Releves from './pages/Releves';
import Sites from './pages/Sites';
import Tournees from './pages/Tournees';
import Carnets from './pages/Carnets';
import Clients from './pages/Clients';
import Collecteurs from './pages/Collecteurs';
import Observations from './pages/Observations';
import Profils from './pages/Profils';
import Utilisateurs from './pages/Utilisateurs';
import TypesLecture from './pages/TypesLecture';
import AutoLogin from './pages/AutoLogin';
import MonProfil from './pages/MonProfil';

/**
 * Composant interne pour activer le hook de surveillance d'inactivité
 * au sein du contexte BrowserRouter.
 */
function AppContent() {
  // Déconnexion automatique après 30 minutes d'inactivité
  useInactivityTimeout();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auto-login" element={<AutoLogin />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/mon-profil" element={<ProtectedRoute><MonProfil /></ProtectedRoute>} />
      <Route path="/imports" element={<ProtectedRoute><Imports /></ProtectedRoute>} />
      <Route path="/imports/nouveau" element={<ProtectedRoute><ImportNouveau /></ProtectedRoute>} />
      <Route path="/releves" element={<ProtectedRoute><Releves /></ProtectedRoute>} />
      {/* Redirection transparente de l'ancienne page anomalies vers la liste des relevés filtrée sur les anomalies */}
      <Route path="/anomalies" element={<Navigate to="/releves?statut=anomalies" replace />} />

      <Route path="/sites" element={<ProtectedRoute><Sites /></ProtectedRoute>} />
      <Route path="/tournees" element={<ProtectedRoute><Tournees /></ProtectedRoute>} />
      <Route path="/carnets" element={<ProtectedRoute><Carnets /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/collecteurs" element={<ProtectedRoute><Collecteurs /></ProtectedRoute>} />
      <Route path="/observations" element={<ProtectedRoute><Observations /></ProtectedRoute>} />
      <Route path="/profils" element={<ProtectedRoute><Profils /></ProtectedRoute>} />
      <Route path="/utilisateurs" element={<ProtectedRoute><Utilisateurs /></ProtectedRoute>} />
      <Route path="/types-lecture" element={<ProtectedRoute><TypesLecture /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;