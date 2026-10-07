import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { tourneeService } from '../services/tourneeService';
import { siteService } from '../services/siteService';
import { authService } from '../services/authService';

function Tournees() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tournees, setTournees] = useState([]);
  const [sites, setSites] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtreSite, setFiltreSite] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [tourneeEnEdition, setTourneeEnEdition] = useState(null);
  const [formData, setFormData] = useState({ code_tournee: '', id_site: '' });
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [tourneeASupprimer, setTourneeASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const chargerDonnees = async () => {
    try {
      setChargement(true);
      const [tourneesData, sitesData] = await Promise.all([
        tourneeService.lister(),
        siteService.lister(),
      ]);
      setTournees(tourneesData);
      setSites(sitesData);
    } catch (err) {
      afficherToast('Erreur lors du chargement', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const afficherToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const ouvrirCreation = () => {
    setTourneeEnEdition(null);
    setFormData({
      code_tournee: '',
      id_site: sites.length > 0 ? sites[0].id_site : '',
    });
    setModalOuvert(true);
  };

  const ouvrirEdition = (tournee) => {
    setTourneeEnEdition(tournee);
    setFormData({
      code_tournee: tournee.code_tournee,
      id_site: tournee.id_site,
    });
    setModalOuvert(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code_tournee: formData.code_tournee,
        id_site: parseInt(formData.id_site),
      };

      if (tourneeEnEdition) {
        await tourneeService.modifier(tourneeEnEdition.id_tournee, payload);
        afficherToast('Tournée modifiée avec succès');
      } else {
        await tourneeService.creer(payload);
        afficherToast('Tournée créée avec succès');
      }
      setModalOuvert(false);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de l\'opération';
      afficherToast(message, 'error');
    }
  };

  const demanderSuppression = (tournee) => {
    setTourneeASupprimer(tournee);
    setConfirmOuvert(true);
  };

  const confirmerSuppression = async () => {
    try {
      await tourneeService.supprimer(tourneeASupprimer.id_tournee);
      afficherToast('Tournée supprimée avec succès');
      setConfirmOuvert(false);
      setTourneeASupprimer(null);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  // Filtres combinés
  const tourneesFiltrees = tournees.filter((t) => {
    const matchRecherche =
      t.code_tournee.toLowerCase().includes(recherche.toLowerCase()) ||
      t.nom_site.toLowerCase().includes(recherche.toLowerCase());
    const matchSite = !filtreSite || t.id_site === parseInt(filtreSite);
    return matchRecherche && matchSite;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'}`}>
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Gestion des tournées</h1>
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

        <main className="p-8">
          {/* Filtres */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="text"
                placeholder="Rechercher..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filtreSite}
                onChange={(e) => setFiltreSite(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les sites</option>
                {sites.map((s) => (
                  <option key={s.id_site} value={s.id_site}>
                    {s.code_site} — {s.nom_site}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">
                {tourneesFiltrees.length} tournée(s)
              </span>
            </div>
            <button
              onClick={ouvrirCreation}
              disabled={sites.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={sites.length === 0 ? 'Créez d\'abord un site' : ''}
            >
              + Nouvelle tournée
            </button>
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {chargement ? (
              <div className="p-12 text-center text-gray-500">Chargement...</div>
            ) : tourneesFiltrees.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {recherche || filtreSite ? 'Aucune tournée trouvée' : 'Aucune tournée enregistrée'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code tournée</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Site</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tourneesFiltrees.map((t) => (
                    <tr key={t.id_tournee} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{t.code_tournee}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{t.nom_site}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => ouvrirEdition(t)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 mr-2"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => demanderSuppression(t)}
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

      {/* Modal */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={tourneeEnEdition ? 'Modifier la tournée' : 'Nouvelle tournée'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site parent *
            </label>
            <select
              value={formData.id_site}
              onChange={(e) => setFormData({ ...formData, id_site: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sélectionner un site —</option>
              {sites.map((s) => (
                <option key={s.id_site} value={s.id_site}>
                  {s.code_site} — {s.nom_site}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code tournée *
            </label>
            <input
              type="text"
              value={formData.code_tournee}
              onChange={(e) => setFormData({ ...formData, code_tournee: e.target.value })}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 56"
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
              {tourneeEnEdition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Confirmer la suppression"
        message={`Voulez-vous vraiment supprimer la tournée "${tourneeASupprimer?.code_tournee}" du site "${tourneeASupprimer?.nom_site}" ?`}
      />

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

export default Tournees;