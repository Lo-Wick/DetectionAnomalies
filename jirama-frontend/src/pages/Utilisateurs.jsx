import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PageLayout from '../components/PageLayout';
import { utilisateurService } from '../services/utilisateurService';
import { authService } from '../services/authService';

function Utilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);

  // Modal création
  const [modalCreation, setModalCreation] = useState(false);
  const [formData, setFormData] = useState({
    login: '',
    nom_utilisateur: '',
    role: 'USER',
  });

  // Modal résultat (mot de passe + QR)
  const [modalResultat, setModalResultat] = useState(false);
  const [resultat, setResultat] = useState(null);

  // Modal QR existant
  const [modalQR, setModalQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  // Confirmation suppression
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [userASupprimer, setUserASupprimer] = useState(null);

  const currentUser = authService.getCurrentUser();
  const afficherToast = (message, type = 'success') => setToast({ message, type });

  const charger = async () => {
    try {
      setChargement(true);
      const data = await utilisateurService.lister();
      setUtilisateurs(data);
    } catch (err) {
      afficherToast('Erreur lors du chargement', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const handleCreation = async (e) => {
    e.preventDefault();
    try {
      const data = await utilisateurService.creer(formData);
      setResultat(data);
      setModalCreation(false);
      setModalResultat(true);
      setFormData({ login: '', nom_utilisateur: '', role: 'USER' });
      charger();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la création';
      afficherToast(message, 'error');
    }
  };

  const toggleStatut = async (user) => {
    try {
      await utilisateurService.changerStatut(user.id_utilisateur, !user.actif);
      afficherToast(`Utilisateur ${!user.actif ? 'activé' : 'désactivé'}`);
      charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const regenererMdp = async (user) => {
    if (!confirm(`Régénérer le mot de passe de "${user.nom_utilisateur}" ?\nL'ancien mot de passe ne sera plus valide.`)) return;
    try {
      const data = await utilisateurService.regenererMotDePasse(user.id_utilisateur);
      setResultat({
        utilisateur: user,
        mot_de_passe_clair: data.mot_de_passe_clair,
        qr_code_base64: null,
      });
      setModalResultat(true);
    } catch (err) {
      afficherToast('Erreur', 'error');
    }
  };

  const voirQR = async (user) => {
    try {
      const data = await utilisateurService.regenererQR(user.id_utilisateur);
      setQrData({ user, qr: data.qr_code_base64, expire: data.expire_le });
      setModalQR(true);
      charger();
    } catch (err) {
      afficherToast('Erreur lors de la génération du QR', 'error');
    }
  };

  const confirmerSuppression = async () => {
    try {
      await utilisateurService.supprimer(userASupprimer.id_utilisateur);
      afficherToast('Utilisateur supprimé');
      setConfirmOuvert(false);
      setUserASupprimer(null);
      charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur', 'error');
      setConfirmOuvert(false);
    }
  };

  const copierMotDePasse = () => {
    navigator.clipboard.writeText(resultat.mot_de_passe_clair);
    afficherToast('Mot de passe copié !');
  };

  const telechargerQR = () => {
    const link = document.createElement('a');
    link.href = resultat.qr_code_base64 || qrData.qr;
    link.download = `qr_${resultat?.utilisateur.login || qrData.user.login}.png`;
    link.click();
  };

  const utilisateursFiltres = utilisateurs.filter(
    (u) =>
      u.login.toLowerCase().includes(recherche.toLowerCase()) ||
      u.nom_utilisateur.toLowerCase().includes(recherche.toLowerCase())
  );

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Vérifier si l'utilisateur connecté est admin
  if (currentUser?.role !== 'ADMIN') {
    return (
      <PageLayout title="Gestion des utilisateurs" toast={toast} setToast={setToast}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
          ⛔ Accès réservé aux administrateurs
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Gestion des utilisateurs" toast={toast} setToast={setToast}>
      {/* Barre d'actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">{utilisateursFiltres.length} utilisateur(s)</span>
        </div>
        <button
          onClick={() => setModalCreation(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          + Nouvel utilisateur
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {chargement ? (
          <div className="p-12 text-center text-gray-500">Chargement...</div>
        ) : utilisateursFiltres.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Aucun utilisateur</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Login</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rôle</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Créé le</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {utilisateursFiltres.map((u) => (
                <tr key={u.id_utilisateur} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">{u.nom_utilisateur}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono">{u.login}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        u.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        u.actif
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {u.actif ? '● Actif' : '○ Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(u.date_creation)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => voirQR(u)}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 mr-1"
                      title="Voir le QR code"
                    >
                      📱 QR
                    </button>
                    <button
                      onClick={() => regenererMdp(u)}
                      className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 mr-1"
                      title="Régénérer le mot de passe"
                    >
                      🔑 MDP
                    </button>
                    <button
                      onClick={() => toggleStatut(u)}
                      disabled={u.id_utilisateur === utilisateurs.find(x => x.login === currentUser?.login)?.id_utilisateur}
                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 mr-1 disabled:opacity-30"
                    >
                      {u.actif ? '🚫' : '✓'}
                    </button>
                    <button
                      onClick={() => {
                        setUserASupprimer(u);
                        setConfirmOuvert(true);
                      }}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal création */}
      <Modal
        isOpen={modalCreation}
        onClose={() => setModalCreation(false)}
        title="Nouvel utilisateur"
      >
        <form onSubmit={handleCreation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
            <input
              type="text"
              value={formData.nom_utilisateur}
              onChange={(e) => setFormData({ ...formData, nom_utilisateur: e.target.value })}
              required
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Rakoto Jean"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login *</label>
            <input
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              required
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: rakoto.j"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USER">Utilisateur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            ℹ️ Un mot de passe de 6 caractères sera généré automatiquement, ainsi qu'un QR code de connexion.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalCreation(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Créer et générer les identifiants
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal résultat (mot de passe + QR) */}
      <Modal
        isOpen={modalResultat}
        onClose={() => setModalResultat(false)}
        title="✅ Identifiants générés"
      >
        {resultat && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 mb-2">
                Utilisateur <strong>{resultat.utilisateur.nom_utilisateur}</strong> créé avec succès.
              </p>
              <p className="text-xs text-green-700">
                ⚠️ Notez bien ces informations, le mot de passe ne sera plus affiché.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={resultat.utilisateur.login}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={resultat.mot_de_passe_clair}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-yellow-50 font-mono text-lg font-bold tracking-widest text-center"
                />
                <button
                  onClick={copierMotDePasse}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  📋 Copier
                </button>
              </div>
            </div>

            {resultat.qr_code_base64 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR code de connexion automatique
                </label>
                <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <img src={resultat.qr_code_base64} alt="QR code" className="w-48 h-48" />
                  <p className="text-xs text-gray-500 text-center">
                    Scannez ce QR code pour vous connecter automatiquement
                  </p>
                  <button
                    onClick={telechargerQR}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    ⬇️ Télécharger le QR
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setModalResultat(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal QR existant */}
      <Modal isOpen={modalQR} onClose={() => setModalQR(false)} title="QR code de connexion">
        {qrData && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              QR code pour <strong>{qrData.user.nom_utilisateur}</strong>
            </p>
            <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <img src={qrData.qr} alt="QR code" className="w-56 h-56" />
              <p className="text-xs text-gray-500">
                Expire le : {new Date(qrData.expire).toLocaleDateString('fr-FR')}
              </p>
              <button
                onClick={telechargerQR}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                ⬇️ Télécharger
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setModalQR(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation suppression */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Supprimer l'utilisateur"
        message={`Voulez-vous vraiment supprimer "${userASupprimer?.nom_utilisateur}" (${userASupprimer?.login}) ?`}
      />
    </PageLayout>
  );
}

export default Utilisateurs;