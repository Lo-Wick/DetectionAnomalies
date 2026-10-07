import { NavLink } from 'react-router-dom';

function Sidebar({ isOpen, onToggle }) {
  const menuItems = [
    { path: '/dashboard', label: 'Tableau de bord', icon: '' },
    { path: '/imports', label: 'Imports', icon: '' },
    { path: '/releves', label: 'Relevés', icon: '' },
    { path: '/anomalies', label: 'Anomalies', icon: '' },
    { path: '/sites', label: 'Sites', icon: '' },
    { path: '/tournees', label: 'Tournées', icon: '' },
    { path: '/carnets', label: 'Carnets', icon: '' },
    { path: '/clients', label: 'Clients', icon: '' },
    { path: '/collecteurs', label: 'Collecteurs', icon: '' },
    { path: '/observations', label: 'Observations', icon: '' },
    { path: '/profils', label: 'Profils clients', icon: '' },
    { path: '/utilisateurs', label: 'Utilisateurs', icon: '' },
  ];

  return (
    <aside
      className={`fixed top-0 right-0 h-screen bg-white shadow-2xl transition-all duration-300 ease-in-out z-50 ${
        isOpen ? 'w-64' : 'w-0'
      } overflow-hidden`}
    >
      {/* Bouton toggle interne */}
      <button
        onClick={onToggle}
        className="absolute top-4 -left-12 w-12 h-12 bg-blue-600 text-white rounded-l-lg flex items-center justify-center hover:bg-blue-700 transition shadow-lg"
        title={isOpen ? 'Masquer le menu' : 'Afficher le menu'}
      >
        {isOpen ? '▶' : '◀'}
      </button>

      {/* Contenu du menu */}
      <div className="p-4 h-full overflow-y-auto">
        <h2 className="text-xl font-bold text-blue-600 mb-6 px-3">
          Menu JIRAMA
        </h2>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;