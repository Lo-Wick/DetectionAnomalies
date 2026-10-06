import { useState } from 'react';
import Sidebar from '../components/Sidebar';

function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar à droite */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Contenu principal */}
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
          <button
            onClick={toggleSidebar}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
          >
            {isSidebarOpen ? '▶ Masquer le menu' : '◀ Afficher le menu'}
          </button>
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