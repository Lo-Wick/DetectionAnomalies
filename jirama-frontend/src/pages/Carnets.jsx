import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { carnetService } from '../services/carnetService';
import { tourneeService } from '../services/tourneeService';
import { siteService } from '../services/siteService';
import { authService } from '../services/authService';

function Carnets() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [carnets, setCarnets] = useState([]);
  const [tournees, setTournees] = useState([]);
  const [sites, setSites] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtreSite, setFiltreSite] = useState('');
  const [filtreTournee, setFiltreTournee] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [carnetEnEdition, setCarnetEnEdition] = useState(null);
  const [formData, setFormData] = useState({
    code_carnet: '',
    id_site: '',
    id_tournee: '',
  });
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [carnetASupprimer, setCarnetASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const chargerDonnees = async () => {
    try {
      setChargement(true);
      const [cData, tData, sData] = await Promise.all([
        carnetService.lister(),
        tourneeService.lister(),
        siteService.lister(),
      ]);
      setCarnets(cData);
      setTournees(tData);
      setSites(sData);
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

  // Tournées filtrées par site sélectionné (dans le formulaire)
  const tourneesDuSite = formData.id_site
    ? tournees.filter((t) => t.id_site === parseInt(formData.id_site))
    : [];

  const ouvrirCreation = () => {
    setCarnetEnEdition(null);
    setFormData({ code_carnet: '', id_site: '', id_tournee: '' });
    setModalOuvert(true);
  };

  const ouvrirEdition = (carnet) => {
    setCarnetEnEdition(carnet);
    setFormData({
      code_carnet: carnet.code_carnet,
      id_site: carnet.id_site,
      id_tournee: carnet.id_tournee,
    });
    setModalOuvert(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code_carnet: formData.code_carnet,
        id_tournee: parseInt(formData.id_tournee),
      };

      if (carnetEnEdition) {
        await carnetService.modifier(carnetEnEdition.id_carnet, payload);
        afficherToast('Carnet modifié avec succès');
      } else {
        await carnetService.creer(payload);
        afficherToast('Carnet créé avec succès');
      }
      setModalOuvert(false);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de l\'opération';
      afficherToast(message, 'error');
    }
  };

  const demanderSuppression = (carnet) => {
    setCarnetASupprimer(carnet);
    setConfirmOuvert(true);
  };

  const confirmerSuppression = async () => {
    try {
      await carnetService.supprimer(carnetASupprimer.id_carnet);
      afficherToast('Carnet supprimé avec succès');
      setConfirmOuvert(false);
      setCarnetASupprimer(null);
      chargerDonnees();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  // Filtres
  const carnetsFiltres = carnets.filter((c) => {
    const matchRecherche =
      c.code_carnet.toLowerCase().includes(recherche.toLowerCase()) ||
      c.code_tournee.toLowerCase().includes(recherche.toLowerCase()) ||
      c.nom_site.toLowerCase().includes(recherche.toLowerCase());
    const matchSite = !filtreSite || c.id_site === parseInt(filtreSite);
    const matchTournee = !filtreTournee || c.id_tournee === parseInt(filtreTournee);
    return matchRecherche && matchSite && matchTournee;
  });

  // Tournées pour le filtre (selon site)
  const tourneesPourFiltre = filtreSite
    ? tournees.filter((t) => t.id_site === parseInt(filtreSite))
    : tournees;

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'}`}>
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Gestion des carnets</h1>
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
                onChange={(e) => {
                  setFiltreSite(e.target.value);
                  setFiltreTournee('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les sites</option>
                {sites.map((s) => (
                  <option key={s.id_site} value={s.id_site}>
                    {s.code_site} — {s.nom_site}
                  </option>
                ))}
              </select>
              <select
                value={filtreTournee}
                onChange={(e) => setFiltreTournee(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes les tournées</option>
                {tourneesPourFiltre.map((t) => (
                  <option key={t.id_tournee} value={t.id_tournee}>
                    {t.code_tournee} — {t.nom_site}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">
                {carnetsFiltres.length} carnet(s)
              </span>
            </div>
            <button
              onClick={ouvrirCreation}
              disabled={tournees.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              title={tournees.length === 0 ? 'Créez d\'abord une tournée' : ''}
            >
              + Nouveau carnet
            </button>
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {chargement ? (
              <div className="p-12 text-center text-gray-500">Chargement...</div>
            ) : carnetsFiltres.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {recherche || filtreSite || filtreTournee
                  ? 'Aucun carnet trouvé'
                  : 'Aucun carnet enregistré'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code carnet</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tournée</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Site</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {carnetsFiltres.map((c) => (
                    <tr key={c.id_carnet} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{c.code_carnet}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{c.code_tournee}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{c.nom_site}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => ouvrirEdition(c)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 mr-2"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => demanderSuppression(c)}
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
        title={carnetEnEdition ? 'Modifier le carnet' : 'Nouveau carnet'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélection site (uniquement pour filtrer les tournées) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site *
            </label>
            <select
              value={formData.id_site}
              onChange={(e) =>
                setFormData({ ...formData, id_site: e.target.value, id_tournee: '' })
              }
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

          {/* Sélection tournée (dépend du site) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tournée *
            </label>
            <select
              value={formData.id_tournee}
              onChange={(e) => setFormData({ ...formData, id_tournee: e.target.value })}
              required
              disabled={!formData.id_site}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">
                {formData.id_site ? '— Sélectionner une tournée —' : '— Choisir d\'abord un site —'}
              </option>
              {tourneesDuSite.map((t) => (
                <option key={t.id_tournee} value={t.id_tournee}>
                  {t.code_tournee}
                </option>
              ))}
            </select>
          </div>

          {/* Code carnet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code carnet *
            </label>
            <input
              type="text"
              value={formData.code_carnet}
              onChange={(e) => setFormData({ ...formData, code_carnet: e.target.value })}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 05"
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
              {carnetEnEdition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Confirmer la suppression"
        message={`Voulez-vous vraiment supprimer le carnet "${carnetASupprimer?.code_carnet}" (Tournée ${carnetASupprimer?.code_tournee}, ${carnetASupprimer?.nom_site}) ?`}
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

export default Carnets;