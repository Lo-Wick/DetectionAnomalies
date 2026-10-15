/**
 * Page de gestion des utilisateurs JIRAMA (Accès Administrateur).
 *
 * Permet de :
 *  - Lister les utilisateurs avec recherche par login ou nom
 *  - Créer un compte avec génération automatique du mot de passe et QR code
 *  - Régénérer un mot de passe ou un QR code
 *  - Activer / Désactiver un utilisateur
 *  - Supprimer un compte
 *
 * Tous les indicateurs et boutons utilisent des icônes SVG sans aucune émoticône.
 */

import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PageLayout from '../components/PageLayout';
import LoadingProgress from '../components/LoadingProgress';
import {
  IconSearch,
  IconPlus,
  IconQr,
  IconKey,
  IconCheck,
  IconClose,
  IconTrash,
  IconCopy,
  IconDownload,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfo,
} from '../components/Icons';
import { utilisateurService } from '../services/utilisateurService';
import { authService } from '../services/authService';

function Utilisateurs() {
  // ─── États principaux ─────────────────────────────────────────────────────────
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);

  // Modale de création
  const [modalCreation, setModalCreation] = useState(false);
  const [formData, setFormData] = useState({
    login: '',
    nom_utilisateur: '',
    role: 'USER',
  });

  // Modale de résultat (mot de passe généré + QR)
  const [modalResultat, setModalResultat] = useState(false);
  const [resultat, setResultat] = useState(null);

  // Modale d'affichage du QR code existant
  const [modalQR, setModalQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  // Confirmation de suppression
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [userASupprimer, setUserASupprimer] = useState(null);

  const currentUser = authService.getCurrentUser();
  const afficherToast = (message, type = 'success') => setToast({ message, type });

  // ─── Chargement des utilisateurs ─────────────────────────────────────────────
  const charger = async () => {
    try {
      setChargement(true);
      const data = await utilisateurService.lister();
      setUtilisateurs(data);
    } catch (err) {
      afficherToast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  // ─── Création d'un utilisateur ───────────────────────────────────────────────
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
      const message = err.response?.data?.detail || "Erreur lors de la création de l'utilisateur";
      afficherToast(message, 'error');
    }
  };

  // ─── Activation / Désactivation ──────────────────────────────────────────────
  const toggleStatut = async (user) => {
    try {
      await utilisateurService.changerStatut(user.id_utilisateur, !user.actif);
      afficherToast(`Compte ${!user.actif ? 'activé' : 'désactivé'} avec succès`);
      charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur lors du changement de statut', 'error');
    }
  };

  // ─── Régénération du mot de passe ────────────────────────────────────────────
  const regenererMdp = async (user) => {
    if (!window.confirm(`Régénérer le mot de passe pour "${user.nom_utilisateur}" ?\nL'ancien mot de passe deviendra immédiatement invalide.`)) return;
    try {
      const data = await utilisateurService.regenererMotDePasse(user.id_utilisateur);
      setResultat({
        utilisateur: user,
        mot_de_passe_clair: data.mot_de_passe_clair,
        qr_code_base64: null,
      });
      setModalResultat(true);
    } catch (err) {
      afficherToast('Erreur lors de la régénération du mot de passe', 'error');
    }
  };

  // ─── Visualisation du QR code ────────────────────────────────────────────────
  const voirQR = async (user) => {
    try {
      const data = await utilisateurService.regenererQR(user.id_utilisateur);
      setQrData({ user, qr: data.qr_code_base64, expire: data.expire_le });
      setModalQR(true);
      charger();
    } catch (err) {
      afficherToast('Erreur lors de la génération du QR code', 'error');
    }
  };

  // ─── Suppression définitive ──────────────────────────────────────────────────
  const confirmerSuppression = async () => {
    try {
      await utilisateurService.supprimer(userASupprimer.id_utilisateur);
      afficherToast('Utilisateur supprimé avec succès');
      setConfirmOuvert(false);
      setUserASupprimer(null);
      charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur lors de la suppression', 'error');
      setConfirmOuvert(false);
    }
  };

  // ─── Utilitaires d'exportation ────────────────────────────────────────────────
  const copierMotDePasse = () => {
    navigator.clipboard.writeText(resultat.mot_de_passe_clair);
    afficherToast('Mot de passe copié dans le presse-papiers !');
  };

  const telechargerQR = () => {
    const link = document.createElement('a');
    link.href = resultat?.qr_code_base64 || qrData?.qr;
    link.download = `qr_${resultat?.utilisateur.login || qrData?.user.login}.png`;
    link.click();
  };

  // ─── Filtrage en temps réel ───────────────────────────────────────────────────
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

  // Sécurité d'accès réservé ADMIN
  if (currentUser?.role !== 'ADMIN') {
    return (
      <PageLayout title="Gestion des utilisateurs" toast={toast} setToast={setToast}>
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
          <IconAlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <p className="font-medium text-sm">Accès réservé exclusivement aux administrateurs de la JIRAMA.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Gestion des utilisateurs" toast={toast} setToast={setToast}>
      {/* Barre d'outils */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <IconSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Rechercher par nom ou identifiant..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
            {utilisateursFiltres.length} utilisateur(s)
          </span>
        </div>

        <button
          onClick={() => setModalCreation(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouvel utilisateur</span>
        </button>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message="Chargement des comptes utilisateurs..." />
        ) : utilisateursFiltres.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {recherche ? 'Aucun utilisateur ne correspond à votre recherche' : 'Aucun utilisateur enregistré'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Nom complet</th>
                  <th className="px-6 py-3 text-left">Identifiant (login)</th>
                  <th className="px-6 py-3 text-left">Rôle</th>
                  <th className="px-6 py-3 text-left">Statut</th>
                  <th className="px-6 py-3 text-left">Créé le</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {utilisateursFiltres.map((u) => (
                  <tr key={u.id_utilisateur} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {u.nom_utilisateur}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600">
                      {u.login}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          u.role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          u.actif
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.actif ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {formatDate(u.date_creation)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Bouton QR Code */}
                        <button
                          onClick={() => voirQR(u)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium"
                          title="Afficher le QR code de connexion"
                        >
                          <IconQr className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>

                        {/* Bouton régénération de mot de passe */}
                        <button
                          onClick={() => regenererMdp(u)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition font-medium"
                          title="Régénérer le mot de passe"
                        >
                          <IconKey className="w-3.5 h-3.5" />
                          <span>MDP</span>
                        </button>

                        {/* Bouton bascule statut */}
                        <button
                          onClick={() => toggleStatut(u)}
                          disabled={u.login === currentUser?.login}
                          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                            u.actif
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          } disabled:opacity-30 disabled:cursor-not-allowed`}
                          title={u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                        >
                          {u.actif ? (
                            <>
                              <IconClose className="w-3.5 h-3.5 text-gray-600" />
                              <span>Désactiver</span>
                            </>
                          ) : (
                            <>
                              <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Activer</span>
                            </>
                          )}
                        </button>

                        {/* Bouton supprimer */}
                        <button
                          onClick={() => {
                            setUserASupprimer(u);
                            setConfirmOuvert(true);
                          }}
                          disabled={u.login === currentUser?.login}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Supprimer définitivement"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale de création */}
      <Modal
        isOpen={modalCreation}
        onClose={() => setModalCreation(false)}
        title="Créer un compte utilisateur"
      >
        <form onSubmit={handleCreation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet *
            </label>
            <input
              type="text"
              value={formData.nom_utilisateur}
              onChange={(e) => setFormData({ ...formData, nom_utilisateur: e.target.value })}
              required
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Rakoto Jean"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant (login) *
            </label>
            <input
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              required
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: rakoto.j"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rôle attribué *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="USER">Utilisateur standard (USER)</option>
              <option value="ADMIN">Administrateur système (ADMIN)</option>
            </select>
          </div>

          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <IconInfo className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p>
              Un mot de passe sécurisé à 6 caractères sera généré automatiquement, ainsi qu'un QR code de connexion instantanée.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalCreation(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
            >
              Générer les identifiants
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale de résultat (mot de passe généré + QR) */}
      <Modal
        isOpen={modalResultat}
        onClose={() => setModalResultat(false)}
        title="Identifiants générés"
      >
        {resultat && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <IconCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  Compte créé avec succès pour {resultat.utilisateur.nom_utilisateur}
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Veuillez transmettre ces informations à l'utilisateur. Le mot de passe ne pourra plus être réaffiché.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Identifiant (login)
              </label>
              <input
                type="text"
                value={resultat.utilisateur.login}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Mot de passe temporaire
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={resultat.mot_de_passe_clair}
                  readOnly
                  className="flex-1 px-4 py-2.5 border border-amber-300 rounded-lg bg-amber-50 font-mono text-xl font-bold tracking-widest text-center text-amber-900"
                />
                <button
                  onClick={copierMotDePasse}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-semibold shadow-sm"
                >
                  <IconCopy className="w-4 h-4" />
                  <span>Copier</span>
                </button>
              </div>
            </div>

            {resultat.qr_code_base64 && (
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  QR code de connexion automatique
                </label>
                <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <img src={resultat.qr_code_base64} alt="QR code" className="w-44 h-44 rounded-lg bg-white p-2 shadow-sm" />
                  <p className="text-xs text-gray-500 text-center">
                    Scannez pour vous authentifier instantanément sur mobile ou tablette
                  </p>
                  <button
                    onClick={telechargerQR}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium"
                  >
                    <IconDownload className="w-3.5 h-3.5" />
                    <span>Télécharger l'image</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setModalResultat(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale d'affichage du QR code existant */}
      <Modal isOpen={modalQR} onClose={() => setModalQR(false)} title="QR Code de connexion">
        {qrData && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              QR code pour <strong>{qrData.user.nom_utilisateur}</strong> ({qrData.user.login})
            </p>
            <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <img src={qrData.qr} alt="QR code" className="w-48 h-48 rounded-lg bg-white p-2 shadow-sm" />
              <p className="text-xs text-gray-500">
                Date d'expiration : {new Date(qrData.expire).toLocaleDateString('fr-FR')}
              </p>
              <button
                onClick={telechargerQR}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium"
              >
                <IconDownload className="w-3.5 h-3.5" />
                <span>Télécharger l'image</span>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalQR(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation de suppression */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Supprimer l'utilisateur"
        message={`Confirmez-vous la suppression définitive du compte "${userASupprimer?.nom_utilisateur}" (${userASupprimer?.login}) ? Cette action est irréversible.`}
      />
    </PageLayout>
  );
}

export default Utilisateurs;