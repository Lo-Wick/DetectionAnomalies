import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toast from './Toast';
import { authService } from '../services/authService';

function PageLayout({ title, toast, setToast, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'}`}>
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{user?.nom_utilisateur}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Déconnexion
            </button>
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default PageLayout;