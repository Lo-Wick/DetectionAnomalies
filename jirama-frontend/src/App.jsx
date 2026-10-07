import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Imports from './pages/Imports';
import Releves from './pages/Releves';
import Anomalies from './pages/Anomalies';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/imports" element={<ProtectedRoute><Imports /></ProtectedRoute>} />
        <Route path="/releves" element={<ProtectedRoute><Releves /></ProtectedRoute>} />
        <Route path="/anomalies" element={<ProtectedRoute><Anomalies /></ProtectedRoute>} />
        <Route path="/sites" element={<ProtectedRoute><Sites /></ProtectedRoute>} />
        <Route path="/tournees" element={<ProtectedRoute><Tournees /></ProtectedRoute>} />
        <Route path="/carnets" element={<ProtectedRoute><Carnets /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/collecteurs" element={<ProtectedRoute><Collecteurs /></ProtectedRoute>} />
        <Route path="/observations" element={<ProtectedRoute><Observations /></ProtectedRoute>} />
        <Route path="/profils" element={<ProtectedRoute><Profils /></ProtectedRoute>} />
        <Route path="/utilisateurs" element={<ProtectedRoute><Utilisateurs /></ProtectedRoute>} />
        <Route path="/types-lecture" element={<ProtectedRoute><TypesLecture /></ProtectedRoute>} />
        <Route path="/auto-login" element={<AutoLogin />} />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;