import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { authService } from '../services/authService';

function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <div
        className={`transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'mr-64' : 'mr-0'
        }`}
      >
        {/* Header */}
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            Tableau de bord JIRAMA
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">
                {user?.nom_utilisateur || 'Utilisateur'}
              </p>
              <p className="text-xs text-gray-500">{user?.role || 'USER'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {/* Cartes statistiques */}
        <main className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700">Relevés</h2>
              <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700">Anomalies</h2>
              <p className="text-3xl font-bold text-red-600 mt-2">0</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700">Imports</h2>
              <p className="text-3xl font-bold text-green-600 mt-2">0</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;