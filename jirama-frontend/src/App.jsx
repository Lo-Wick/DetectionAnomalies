import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/imports" element={<Imports />} />
        <Route path="/releves" element={<Releves />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/tournees" element={<Tournees />} />
        <Route path="/carnets" element={<Carnets />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/collecteurs" element={<Collecteurs />} />
        <Route path="/observations" element={<Observations />} />
        <Route path="/profils" element={<Profils />} />
        <Route path="/utilisateurs" element={<Utilisateurs />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;