import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { siteService } from '../services/siteService';
import { authService } from '../services/authService';

function Sites() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sites, setSites] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [siteEnEdition, setSiteEnEdition] = useState(null);
  const [formData, setFormData] = useState({ code_site: '', nom_site: '' });
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [siteASupprimer, setSiteASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // Charger les sites
  const chargerSites = async () => {
    try {
      setChargement(true);
      const data = await siteService.lister();
      setSites(data);
    } catch (err) {
      afficherToast('Erreur lors du chargement', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerSites();
  }, []);

  const afficherToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // Ouvrir modal pour création
  const ouvrirCreation = () => {
    setSiteEnEdition(null);
    setFormData({ code_site: '', nom_site: '' });
    setModalOuvert(true);
  };

  // Ouvrir modal pour édition
  const ouvrirEdition = (site) => {
    setSiteEnEdition(site);
    setFormData({ code_site: site.code_site, nom_site: site.nom_site });
    setModalOuvert(true);
  };

  // Soumettre le formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (siteEnEdition) {
        await siteService.modifier(siteEnEdition.id_site, formData);
        afficherToast('Site modifié avec succès');
      } else {
        await siteService.creer(formData);
        afficherToast('Site créé avec succès');
      }
      setModalOuvert(false);
      chargerSites();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de l\'opération';
      afficherToast(message, 'error');
    }
  };

  // Demander confirmation de suppression
  const demanderSuppression = (site) => {
    setSiteASupprimer(site);
    setConfirmOuvert(true);
  };

  // Confirmer la suppression
  const confirmerSuppression = async () => {
    try {
      await siteService.supprimer(siteASupprimer.id_site);
      afficherToast('Site supprimé avec succès');
      setConfirmOuvert(false);
      setSiteASupprimer(null);
      chargerSites();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  // Filtrer les sites
  const sitesFiltres = sites.filter((s) =>
    s.code_site.toLowerCase().includes(recherche.toLowerCase()) ||
    s.nom_site.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'}`}>
        {/* Header */}
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Gestion des sites</h1>
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

        {/* Contenu */}
        <main className="p-8">
          {/* Barre d'actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Rechercher un site..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                {sitesFiltres.length} site(s)
              </span>
            </div>
            <button
              onClick={ouvrirCreation}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              + Nouveau site
            </button>
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {chargement ? (
              <div className="p-12 text-center text-gray-500">Chargement...</div>
            ) : sitesFiltres.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {recherche ? 'Aucun site trouvé' : 'Aucun site enregistré'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nom</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sitesFiltres.map((site) => (
                    <tr key={site.id_site} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{site.code_site}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{site.nom_site}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => ouvrirEdition(site)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 mr-2"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => demanderSuppression(site)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Modal formulaire */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={siteEnEdition ? 'Modifier le site' : 'Nouveau site'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code site *
            </label>
            <input
              type="text"
              value={formData.code_site}
              onChange={(e) => setFormData({ ...formData, code_site: e.target.value })}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 103"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du site *
            </label>
            <input
              type="text"
              value={formData.nom_site}
              onChange={(e) => setFormData({ ...formData, nom_site: e.target.value })}
              required
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Mahajanga"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOuvert(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {siteEnEdition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Confirmer la suppression"
        message={`Voulez-vous vraiment supprimer le site "${siteASupprimer?.nom_site}" (${siteASupprimer?.code_site}) ?`}
      />

      {/* Toast */}
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

export default Sites;