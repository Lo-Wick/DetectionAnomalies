/**
 * Page d'administration des utilisateurs et du journal d'audit JIRAMA.
 *
 * Fonctionnalités complètes :
 *  - Gestion des comptes utilisateurs (login, nom, email, rôle, statut)
 *  - Envoi automatique ou manuel du mot de passe généré par e-mail
 *  - Sécurité avancée : détection du blocage 5 tentatives / 3 jours et déblocage anticipé par l'admin
 *  - Journal d'audit complet retraçant les dernières connexions et opérations CRUD de chaque utilisateur
 *  - Boîtes de dialogue de confirmation (ConfirmDialog) pour chaque action sensible
 *  - Zéro émoticône (icônes vectorielles SVG exclusivement) et support complet du mode sombre
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
  IconUsers,
  IconHistory,
  IconLock,
  IconUnlock,
  IconMail,
} from '../components/Icons';
import { utilisateurService } from '../services/utilisateurService';
import { authService } from '../services/authService';

function Utilisateurs() {
  // ─── Onglet actif ─────────────────────────────────────────────────────────────
  const [ongletActif, setOngletActif] = useState('utilisateurs'); // 'utilisateurs' | 'audit'

  // ─── Données Utilisateurs ─────────────────────────────────────────────────────
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);

  // ─── Données Journal d'audit ──────────────────────────────────────────────────
  const [journalAudit, setJournalAudit] = useState([]);
  const [chargementAudit, setChargementAudit] = useState(false);
  const [rechercheAudit, setRechercheAudit] = useState('');
  const [filtreActionAudit, setFiltreActionAudit] = useState('');

  // ─── Modale de création / édition ─────────────────────────────────────────────
  const [modalCreation, setModalCreation] = useState(false);
  const [formData, setFormData] = useState({
    login: '',
    nom_utilisateur: '',
    email: '',
    role: 'USER',
  });

  // ─── Modale de résultat (mot de passe généré + QR) ───────────────────────────
  const [modalResultat, setModalResultat] = useState(false);
  const [resultat, setResultat] = useState(null);

  // ─── Modale QR Code ───────────────────────────────────────────────────────────
  const [modalQR, setModalQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  // ─── Boîte de dialogue de confirmation générique pour chaque action ───────────
  const [dialogueAction, setDialogueAction] = useState({
    ouvert: false,
    titre: '',
    message: '',
    type: 'danger',
    texteConfirmer: 'Confirmer',
    onConfirmer: () => {},
  });

  const currentUser = authService.getCurrentUser();
  const afficherToast = (message, type = 'success') => setToast({ message, type });

  // ─── Chargement des utilisateurs ─────────────────────────────────────────────
  const chargerUtilisateurs = async () => {
    try {
      setChargement(true);
      const data = await utilisateurService.lister();
      setUtilisateurs(data || []);
    } catch (err) {
      afficherToast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setChargement(false);
    }
  };

  // ─── Chargement du journal d'audit ───────────────────────────────────────────
  const chargerJournalAudit = async () => {
    try {
      setChargementAudit(true);
      const params = { limite: 100 };
      if (rechercheAudit) params.recherche = rechercheAudit;
      if (filtreActionAudit) params.action = filtreActionAudit;

      const data = await utilisateurService.listerJournalAudit(params);
      setJournalAudit(data || []);
    } catch (err) {
      afficherToast("Impossible de charger le journal d'audit", 'error');
    } finally {
      setChargementAudit(false);
    }
  };

  useEffect(() => {
    chargerUtilisateurs();
  }, []);

  useEffect(() => {
    if (ongletActif === 'audit') {
      chargerJournalAudit();
    }
  }, [ongletActif, filtreActionAudit]);

  // ─── Création d'un utilisateur ───────────────────────────────────────────────
  const handleCreation = async (e) => {
    e.preventDefault();
    try {
      const data = await utilisateurService.creer(formData);
      setResultat(data);
      setModalCreation(false);
      setModalResultat(true);
      setFormData({ login: '', nom_utilisateur: '', email: '', role: 'USER' });
      afficherToast(
        data.email_envoye
          ? `Compte créé et mot de passe transmis par e-mail à ${data.utilisateur.email}`
          : data.utilisateur?.email
          ? `Compte créé. Attention : l'e-mail n'a pas pu être envoyé (serveur SMTP non configuré dans .env).`
          : 'Compte utilisateur créé avec succès.',
        data.email_envoye || !data.utilisateur?.email ? 'success' : 'warning'
      );

      chargerUtilisateurs();
    } catch (err) {
      const message = err.response?.data?.detail || "Erreur lors de la création de l'utilisateur";
      afficherToast(message, 'error');
    }
  };

  // ─── Activation / Désactivation avec confirmation ────────────────────────────
  const demanderChangementStatut = (user) => {
    const actionNom = user.actif ? 'désactiver' : 'activer';
    setDialogueAction({
      ouvert: true,
      titre: `Confirmation de ${actionNom}`,
      message: `Voulez-vous vraiment ${actionNom} le compte de "${user.nom_utilisateur}" (${user.login}) ?`,
      type: user.actif ? 'danger' : 'info',
      texteConfirmer: user.actif ? 'Désactiver' : 'Activer',
      onConfirmer: async () => {
        try {
          await utilisateurService.changerStatut(user.id_utilisateur, !user.actif);
          afficherToast(`Compte ${!user.actif ? 'activé' : 'désactivé'} avec succès`);
          chargerUtilisateurs();
        } catch (err) {
          afficherToast(err.response?.data?.detail || 'Erreur lors du changement de statut', 'error');
        } finally {
          setDialogueAction((prev) => ({ ...prev, ouvert: false }));
        }
      },
    });
  };

  // ─── Déblocage anticipé d'un compte verrouillé pour 5 erreurs ────────────────
  const demanderDeblocageCompte = (user) => {
    setDialogueAction({
      ouvert: true,
      titre: 'Débloquer le compte utilisateur',
      message: `Ce compte a été bloqué suite à 5 tentatives infructueuses. Voulez-vous lever immédiatement le verrouillage pour "${user.nom_utilisateur}" (${user.login}) ?`,
      type: 'info',
      texteConfirmer: 'Débloquer maintenant',
      onConfirmer: async () => {
        try {
          await utilisateurService.debloquer(user.id_utilisateur);
          afficherToast(`Le compte de "${user.login}" a été débloqué avec succès.`);
          chargerUtilisateurs();
        } catch (err) {
          afficherToast(err.response?.data?.detail || 'Erreur lors du déblocage du compte', 'error');
        } finally {
          setDialogueAction((prev) => ({ ...prev, ouvert: false }));
        }
      },
    });
  };

  // ─── Régénération du mot de passe avec envoi par e-mail ──────────────────────
  const demanderRegenerationMdp = (user) => {
    const avecEmail = Boolean(user.email);
    setDialogueAction({
      ouvert: true,
      titre: 'Régénération du mot de passe',
      message: `Voulez-vous générer un nouveau mot de passe pour "${user.nom_utilisateur}" ? L'ancien mot de passe deviendra immédiatement invalide.${
        avecEmail
          ? `\nLe nouveau mot de passe sera transmis directement à l'adresse e-mail : ${user.email}.`
          : "\n(Aucune adresse e-mail n'est renseignée pour cet utilisateur)."
      }`,
      type: 'warning',
      texteConfirmer: 'Générer nouveau mot de passe',
      onConfirmer: async () => {
        try {
          const data = await utilisateurService.regenererMotDePasse(user.id_utilisateur, true);
          setResultat({
            utilisateur: user,
            mot_de_passe_clair: data.mot_de_passe_clair,
            qr_code_base64: null,
            email_envoye: Boolean(data.email_statut?.succes),
          });
          setModalResultat(true);
          afficherToast(
            data.email_statut?.succes
              ? `Mot de passe régénéré et transmis par e-mail à ${user.email}`
              : 'Mot de passe régénéré avec succès.'
          );
        } catch (err) {
          afficherToast(err.response?.data?.detail || 'Erreur lors de la régénération', 'error');
        } finally {
          setDialogueAction((prev) => ({ ...prev, ouvert: false }));
        }
      },
    });
  };

  // ─── Visualisation du QR code ────────────────────────────────────────────────
  const voirQR = async (user) => {
    try {
      const data = await utilisateurService.regenererQR(user.id_utilisateur);
      setQrData({ user, qr: data.qr_code_base64, expire: data.expire_le });
      setModalQR(true);
      chargerUtilisateurs();
    } catch (err) {
      afficherToast('Erreur lors de la génération du QR code', 'error');
    }
  };

  // ─── Suppression d'un compte avec confirmation ───────────────────────────────
  const demanderSuppression = (user) => {
    setDialogueAction({
      ouvert: true,
      titre: 'Supprimer définitivement cet utilisateur',
      message: `Êtes-vous sûr de vouloir supprimer définitivement le compte "${user.nom_utilisateur}" (${user.login}) ? Cette action est irréversible.`,
      type: 'danger',
      texteConfirmer: 'Supprimer le compte',
      onConfirmer: async () => {
        try {
          await utilisateurService.supprimer(user.id_utilisateur);
          afficherToast('Utilisateur supprimé avec succès');
          chargerUtilisateurs();
        } catch (err) {
          afficherToast(err.response?.data?.detail || 'Erreur lors de la suppression', 'error');
        } finally {
          setDialogueAction((prev) => ({ ...prev, ouvert: false }));
        }
      },
    });
  };

  // ─── Utilitaires ─────────────────────────────────────────────────────────────
  const copierMotDePasse = () => {
    if (resultat?.mot_de_passe_clair) {
      navigator.clipboard.writeText(resultat.mot_de_passe_clair);
      afficherToast('Mot de passe copié dans le presse-papiers !');
    }
  };

  const telechargerQR = () => {
    const source = resultat?.qr_code_base64 || qrData?.qr;
    if (!source) return;
    const link = document.createElement('a');
    link.href = source;
    link.download = `qrcode_${resultat?.utilisateur?.login || qrData?.user?.login || 'jirama'}.png`;
    link.click();
  };

  // ─── Filtres d'affichage ─────────────────────────────────────────────────────
  const utilisateursFiltres = utilisateurs.filter((u) => {
    const q = recherche.toLowerCase();
    return (
      u.login.toLowerCase().includes(q) ||
      u.nom_utilisateur.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  return (
    <PageLayout title="Administration des utilisateurs et traçabilité" toast={toast} setToast={setToast}>
      {/* ─── Barre d'onglets principale ────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 mb-6 gap-3">
        <button
          type="button"
          onClick={() => setOngletActif('utilisateurs')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold transition border-b-2 ${
            ongletActif === 'utilisateurs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <IconUsers className="w-4 h-4" />
          <span>Comptes utilisateurs ({utilisateurs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setOngletActif('audit')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold transition border-b-2 ${
            ongletActif === 'audit'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <IconHistory className="w-4 h-4" />
          <span>Journal d'audit & Activités</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          ONGLET 1 : GESTION DES UTILISATEURS
         ═══════════════════════════════════════════════════════════════════════════ */}
      {ongletActif === 'utilisateurs' && (
        <>
          {/* Barre d'actions supérieure */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Rechercher par login, nom ou email..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white shadow-xs"
              />
              <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>

            <button
              onClick={() => {
                setFormData({ login: '', nom_utilisateur: '', email: '', role: 'USER' });
                setModalCreation(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-bold shadow-xs"
            >
              <IconPlus className="w-4 h-4" />
              <span>Nouvel utilisateur</span>
            </button>
          </div>

          {/* Tableau des utilisateurs */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-xs border border-gray-200 dark:border-slate-700 overflow-hidden">
            {chargement ? (
              <LoadingProgress message="Chargement des utilisateurs en cours..." />
            ) : utilisateursFiltres.length === 0 ? (
              <div className="p-16 text-center text-gray-500 dark:text-slate-400 text-xs">
                {recherche ? 'Aucun utilisateur ne correspond à votre recherche.' : 'Aucun utilisateur enregistré.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Utilisateur</th>
                      <th className="px-5 py-3.5">Adresse E-mail</th>
                      <th className="px-5 py-3.5">Rôle</th>
                      <th className="px-5 py-3.5">Sécurité & Statut</th>
                      <th className="px-5 py-3.5">Date création</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 font-medium">
                    {utilisateursFiltres.map((u) => {
                      const estMoi = u.id_utilisateur === currentUser?.id_utilisateur;
                      const estBloque = Boolean(u.bloque_jusqu_a && new Date(u.bloque_jusqu_a) > new Date());

                      return (
                        <tr
                          key={u.id_utilisateur}
                          className={`hover:bg-gray-50/70 dark:hover:bg-slate-700/40 transition ${
                            estBloque ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          {/* Identifiant & Nom */}
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.nom_utilisateur}</span>
                              {estMoi && (
                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                                  Vous
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-gray-400 dark:text-slate-400">{u.login}</div>
                          </td>

                          {/* Email */}
                          <td className="px-5 py-3.5">
                            {u.email ? (
                              <div className="flex items-center gap-1.5 text-gray-700 dark:text-slate-300">
                                <IconMail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate max-w-[180px]">{u.email}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-slate-500 italic text-[11px]">Non renseigné</span>
                            )}
                          </td>

                          {/* Rôle */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          {/* Sécurité & Statut */}
                          <td className="px-5 py-3.5">
                            {estBloque ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  <IconLock className="w-3 h-3 text-rose-600" />
                                  <span>Compte bloqué (5 échecs)</span>
                                </span>
                                <p className="text-[10px] text-rose-600 dark:text-rose-400">
                                  Jusqu'au {new Date(u.bloque_jusqu_a).toLocaleDateString('fr-FR')}{' '}
                                  {new Date(u.bloque_jusqu_a).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.actif
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {u.actif ? (
                                  <>
                                    <IconCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Actif</span>
                                  </>
                                ) : (
                                  <>
                                    <IconClose className="w-3 h-3 text-gray-500" />
                                    <span>Désactivé</span>
                                  </>
                                )}
                              </span>
                            )}
                          </td>

                          {/* Date de création */}
                          <td className="px-5 py-3.5 text-gray-500 dark:text-slate-400 text-[11px]">
                            {u.date_creation ? new Date(u.date_creation).toLocaleDateString('fr-FR') : '—'}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                            {/* Déblocage si le compte est verrouillé */}
                            {estBloque && (
                              <button
                                onClick={() => demanderDeblocageCompte(u)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition inline-flex items-center gap-1 text-[11px] font-bold border border-emerald-300 dark:border-emerald-800 px-2"
                                title="Lever le blocage de sécurité"
                              >
                                <IconUnlock className="w-3.5 h-3.5" />
                                <span>Débloquer</span>
                              </button>
                            )}

                            {/* Voir/Régénérer QR code */}
                            <button
                              onClick={() => voirQR(u)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition"
                              title="Afficher le QR code de connexion"
                            >
                              <IconQr className="w-4 h-4" />
                            </button>

                            {/* Régénérer mot de passe et envoyer par e-mail */}
                            <button
                              onClick={() => demanderRegenerationMdp(u)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg transition"
                              title="Régénérer mot de passe et envoyer par e-mail"
                            >
                              <IconKey className="w-4 h-4" />
                            </button>

                            {/* Activer / Désactiver */}
                            {!estMoi && (
                              <button
                                onClick={() => demanderChangementStatut(u)}
                                className={`p-1.5 rounded-lg transition ${
                                  u.actif
                                    ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950'
                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                                }`}
                                title={u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                              >
                                {u.actif ? <IconClose className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
                              </button>
                            )}

                            {/* Supprimer */}
                            {!estMoi && (
                              <button
                                onClick={() => demanderSuppression(u)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition"
                                title="Supprimer définitivement l'utilisateur"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          ONGLET 2 : JOURNAL D'AUDIT ET HISTORIQUE DES ACTIONS CRUD
         ═══════════════════════════════════════════════════════════════════════════ */}
      {ongletActif === 'audit' && (
        <>
          {/* Barre de filtres pour l'audit */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <input
                  type="text"
                  placeholder="Rechercher par identifiant, action, détails..."
                  value={rechercheAudit}
                  onChange={(e) => setRechercheAudit(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && chargerJournalAudit()}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white shadow-xs"
                />
                <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              </div>

              <select
                value={filtreActionAudit}
                onChange={(e) => setFiltreActionAudit(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">Toutes les actions</option>
                <option value="CONNEXION">Connexions réussies</option>
                <option value="CONNEXION_ECHOUEE">Tentatives échouées</option>
                <option value="BLOCAGE_COMPTE">Blocages de compte</option>
                <option value="DEBLOCAGE">Déblocages</option>
                <option value="DECONNEXION">Déconnexions</option>
                <option value="CREATION">Créations </option>
                <option value="MODIFICATION">Modifications </option>
                <option value="SUPPRESSION">Suppressions </option>
                <option value="ENVOI_EMAIL_COLLECTEUR">Alertes e-mail collecteurs</option>
              </select>
            </div>

            <button
              onClick={chargerJournalAudit}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              Actualiser le journal
            </button>
          </div>

          {/* Tableau d'audit */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-xs border border-gray-200 dark:border-slate-700 overflow-hidden">
            {chargementAudit ? (
              <LoadingProgress message="Chargement du journal d'audit..." />
            ) : journalAudit.length === 0 ? (
              <div className="p-16 text-center text-gray-500 dark:text-slate-400 text-xs">
                Aucune entrée trouvée dans le journal d'audit.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Date & Heure</th>
                      <th className="px-5 py-3.5">Utilisateur</th>
                      <th className="px-5 py-3.5">Action</th>
                      <th className="px-5 py-3.5">Domaine</th>
                      <th className="px-5 py-3.5">Description de l'activité</th>
                      <th className="px-5 py-3.5">Adresse IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 font-medium">
                    {journalAudit.map((log) => {
                      // Stylisation du badge selon le type d'action
                      let badgeBg = 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200';
                      if (log.action.includes('CONNEXION') && !log.action.includes('ECHOUEE')) {
                        badgeBg = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                      } else if (log.action.includes('ECHOUEE') || log.action.includes('BLOCAGE')) {
                        badgeBg = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
                      } else if (log.action === 'CREATION') {
                        badgeBg = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                      } else if (log.action === 'MODIFICATION') {
                        badgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                      } else if (log.action === 'SUPPRESSION') {
                        badgeBg = 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
                      } else if (log.action.includes('EMAIL')) {
                        badgeBg = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
                      }

                      return (
                        <tr key={log.id_journal} className="hover:bg-gray-50/70 dark:hover:bg-slate-700/40 transition">
                          <td className="px-5 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(log.date_action).toLocaleDateString('fr-FR')}{' '}
                            <span className="font-mono text-[11px] text-gray-400 dark:text-slate-500">
                              {new Date(log.date_action).toLocaleTimeString('fr-FR')}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-bold text-gray-800 dark:text-white font-mono">
                            {log.login}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badgeBg}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 dark:text-slate-400 font-semibold text-[11px]">
                            {log.entite}
                          </td>
                          <td className="px-5 py-3 text-gray-700 dark:text-slate-300 max-w-md">
                            {log.details}
                          </td>
                          <td className="px-5 py-3 text-gray-400 dark:text-slate-500 font-mono text-[11px]">
                            {log.adresse_ip || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Modale de création d'utilisateur ──────────────────────────────────── */}
      <Modal
        isOpen={modalCreation}
        onClose={() => setModalCreation(false)}
        title="Créer un nouveau compte utilisateur"
        size="md"
      >
        <form onSubmit={handleCreation} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
              Identifiant de connexion (Login) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: agent_releve"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
              Nom complet de l'utilisateur <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Jean RAKOTO"
              value={formData.nom_utilisateur}
              onChange={(e) => setFormData({ ...formData, nom_utilisateur: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
              Adresse e-mail (pour envoi direct du mot de passe)
            </label>
            <input
              type="email"
              placeholder="Ex: jean.rakoto@jirama.mg"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Si renseignée, le mot de passe généré automatiquement lui sera transmis par e-mail.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
              Rôle d'accès <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="USER">USER — Consultation, imports et analyse des relevés</option>
              <option value="ADMIN">ADMIN — Accès complet (utilisateurs, référentiels, audit)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModalCreation(false)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
            >
              Créer l'utilisateur
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Modale de résultat après création ou régénération de mot de passe ─── */}
      <Modal
        isOpen={modalResultat}
        onClose={() => setModalResultat(false)}
        title="Accès utilisateur généré avec succès"
        size="md"
      >
        <div className="space-y-4">
          {resultat?.email_envoye ? (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
              <p className="font-bold">Compte configuré pour {resultat?.utilisateur?.nom_utilisateur}</p>
              <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                Un e-mail contenant les identifiants a été transmis à l'adresse {resultat?.utilisateur?.email}.
              </p>
            </div>
          ) : resultat?.utilisateur?.email ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
              <p className="font-bold">Compte configuré pour {resultat?.utilisateur?.nom_utilisateur}</p>
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                Adresse e-mail enregistrée ({resultat?.utilisateur?.email}), mais l'e-mail n'a pas pu être transmis car le serveur SMTP d'envoi n'est pas encore configuré dans le fichier .env du backend.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 text-xs">
              <p className="font-bold">Compte configuré pour {resultat?.utilisateur?.nom_utilisateur}</p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                Aucune adresse e-mail renseignée. Transmettez les identifiants ci-dessous directement à l'utilisateur.
              </p>
            </div>
          )}


          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 border border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-slate-400 font-semibold">Identifiant (Login) :</span>
              <span className="font-mono font-bold text-gray-800 dark:text-white">{resultat?.utilisateur?.login}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-slate-400 font-semibold">Mot de passe généré :</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm tracking-wider">
                  {resultat?.mot_de_passe_clair}
                </span>
                <button
                  onClick={copierMotDePasse}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                  title="Copier le mot de passe"
                >
                  <IconCopy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {resultat?.qr_code_base64 && (
            <div className="text-center pt-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">
                QR Code de connexion automatique :
              </p>
              <img
                src={resultat.qr_code_base64}
                alt="QR Code"
                className="w-40 h-40 mx-auto rounded-lg border border-gray-200 shadow-xs p-2 bg-white"
              />
              <button
                onClick={telechargerQR}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
              >
                <IconDownload className="w-3.5 h-3.5" />
                <span>Télécharger le QR code</span>
              </button>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={() => setModalResultat(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Modale d'affichage du QR Code seul ───────────────────────────────── */}
      <Modal
        isOpen={modalQR}
        onClose={() => setModalQR(false)}
        title={`QR code de connexion — ${qrData?.user?.nom_utilisateur}`}
        size="sm"
      >
        <div className="text-center space-y-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Scannez ce code depuis un appareil mobile pour une connexion directe sans saisir de mot de passe.
          </p>

          {qrData?.qr && (
            <img
              src={qrData.qr}
              alt="QR Code"
              className="w-48 h-48 mx-auto rounded-xl border border-gray-200 shadow-sm p-2 bg-white"
            />
          )}

          <div className="flex justify-center gap-2">
            <button
              onClick={telechargerQR}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
            >
              <IconDownload className="w-3.5 h-3.5" />
              <span>Télécharger l'image</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Dialogue de confirmation générique pour toute action sensible ─────── */}
      <ConfirmDialog
        isOpen={dialogueAction.ouvert}
        onClose={() => setDialogueAction((prev) => ({ ...prev, ouvert: false }))}
        onConfirm={dialogueAction.onConfirmer}
        title={dialogueAction.titre}
        message={dialogueAction.message}
        type={dialogueAction.type}
        confirmText={dialogueAction.texteConfirmer}
        cancelText="Annuler"
      />
    </PageLayout>
  );
}

export default Utilisateurs;