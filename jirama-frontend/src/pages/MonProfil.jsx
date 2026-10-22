/**
 * Page de gestion du Profil Utilisateur pour l'application JIRAMA.
 * 
 * Fonctionnalités complètes :
 *  - Visualisation des informations personnelles et statistiques d'activité
 *  - Modification des coordonnées (nom complet, identifiant login, adresse e-mail)
 *  - Changement sécurisé du mot de passe avec jauge de force et notification par e-mail
 *  - Gestion et régénération du QR Code d'authentification mobile / rapide avec téléchargement PNG
 *  - Consultation du journal d'activité personnel avec filtres de recherche et pagination
 *  - Raccourci vers le basculement Mode Clair / Mode Sombre
 *  - Validation stricte de chaque action sensible via ConfirmDialog
 *  - Zéro émoticône (icônes vectorielles SVG exclusivement) et support complet du mode sombre
 */

import React, { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingProgress from '../components/LoadingProgress';
import {
  IconUserProfile,
  IconKey,
  IconQr,
  IconHistory,
  IconCheck,
  IconClose,
  IconCopy,
  IconDownload,
  IconRefresh,
  IconShield,
  IconMail,
  IconLock,
  IconAlertCircle,
  IconSun,
  IconMoon,
  IconSearch,
  IconFilter,
} from '../components/Icons';
import { profilService } from '../services/profilService';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

function MonProfil() {
  // ─── État général ─────────────────────────────────────────────────────────────
  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);
  const [ongletActif, setOngletActif] = useState('infos'); // 'infos' | 'securite' | 'qrcode' | 'historique'
  const { toggleTheme, estSombre } = useTheme();

  // ─── Formulaire Informations Personnelles ─────────────────────────────────────
  const [formInfos, setFormInfos] = useState({
    nom_utilisateur: '',
    login: '',
    email: '',
  });
  const [chargementSauvegardeInfos, setChargementSauvegardeInfos] = useState(false);

  // ─── Formulaire Mot de Passe ─────────────────────────────────────────────────
  const [formMdp, setFormMdp] = useState({
    ancien_mot_de_passe: '',
    nouveau_mot_de_passe: '',
    confirmation_mot_de_passe: '',
  });
  const [chargementMdp, setChargementMdp] = useState(false);

  // ─── État QR Code ─────────────────────────────────────────────────────────────
  const [copieLienReussie, setCopieLienReussie] = useState(false);
  const [chargementRegenQR, setChargementRegenQR] = useState(false);

  // ─── Historique Personnel ─────────────────────────────────────────────────────
  const [historique, setHistorique] = useState([]);
  const [chargementHistorique, setChargementHistorique] = useState(false);
  const [filtreRecherche, setFiltreRecherche] = useState('');
  const [filtreAction, setFiltreAction] = useState('');

  // ─── Boîtes de Dialogue de Confirmation ───────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    chargement: false,
    messageChargement: '',
    onConfirm: () => {},
  });

  // ─── Chargement initial du profil ─────────────────────────────────────────────
  const chargerDonneesProfil = async () => {
    try {
      setChargement(true);
      const data = await profilService.getProfil();
      setProfil(data);
      setFormInfos({
        nom_utilisateur: data.nom_utilisateur || '',
        login: data.login || '',
        email: data.email || '',
      });
    } catch (err) {
      console.error('Erreur chargement profil :', err);
      setToast({
        type: 'error',
        message: err.response?.data?.detail || 'Impossible de charger les données du profil.',
      });
    } finally {
      setChargement(false);
    }
  };

  // ─── Chargement de l'historique ───────────────────────────────────────────────
  const chargerHistorique = async () => {
    try {
      setChargementHistorique(true);
      const params = {};
      if (filtreAction) params.action = filtreAction;
      if (filtreRecherche) params.recherche = filtreRecherche;
      const data = await profilService.getMonHistorique(params);
      setHistorique(data);
    } catch (err) {
      console.error('Erreur chargement historique :', err);
      setToast({
        type: 'error',
        message: 'Impossible de charger votre historique d\'activité.',
      });
    } finally {
      setChargementHistorique(false);
    }
  };

  useEffect(() => {
    chargerDonneesProfil();
  }, []);

  useEffect(() => {
    if (ongletActif === 'historique') {
      chargerHistorique();
    }
  }, [ongletActif, filtreAction]);

  // ─── Gestion de la soumission des infos personnelles ──────────────────────────
  const declencherSauvegardeInfos = (e) => {
    e.preventDefault();
    if (!formInfos.nom_utilisateur.trim() || !formInfos.login.trim()) {
      setToast({
        type: 'warning',
        message: 'Le nom complet et l\'identifiant de connexion sont obligatoires.',
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Enregistrer les modifications',
      message: `Voulez-vous enregistrer les modifications de votre profil ?\n\nNom : ${formInfos.nom_utilisateur}\nIdentifiant : ${formInfos.login}\nE-mail : ${formInfos.email || 'Non renseigné'}`,
      chargement: false,
      messageChargement: 'Mise à jour en cours...',
      onConfirm: executerSauvegardeInfos,
    });
  };

  const executerSauvegardeInfos = async () => {
    try {
      setConfirmDialog((prev) => ({ ...prev, chargement: true }));
      setChargementSauvegardeInfos(true);
      const res = await profilService.updateProfil(formInfos);

      // Mise à jour de l'utilisateur stocké dans le navigateur
      authService.updateStoredUser?.({
        nom_utilisateur: res.utilisateur.nom_utilisateur,
        login: res.utilisateur.login,
        email: res.utilisateur.email,
      });

      // Mettre à jour l'état local
      setProfil((prev) => ({
        ...prev,
        ...res.utilisateur,
      }));

      setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} });
      setToast({
        type: 'success',
        message: 'Votre profil a été mis à jour avec succès.',
      });
    } catch (err) {
      console.error('Erreur mise à jour profil :', err);
      setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} });
      setToast({
        type: 'error',
        message: err.response?.data?.detail || 'Erreur lors de la mise à jour du profil.',
      });
    } finally {
      setChargementSauvegardeInfos(false);
    }
  };

  // ─── Gestion du changement de mot de passe ────────────────────────────────────
  const evaluerForceMotDePasse = (mdp) => {
    if (!mdp) return { niveau: 0, label: 'Inexistant', couleur: 'bg-gray-200 text-gray-500' };
    let score = 0;
    if (mdp.length >= 6) score += 1;
    if (mdp.length >= 10) score += 1;
    if (/[0-9]/.test(mdp)) score += 1;
    if (/[A-Z]/.test(mdp) && /[a-z]/.test(mdp)) score += 1;
    if (/[^A-Za-z0-9]/.test(mdp)) score += 1;

    if (score <= 2) return { niveau: 1, label: 'Faible', couleur: 'bg-rose-500 text-rose-700' };
    if (score <= 3) return { niveau: 2, label: 'Moyen', couleur: 'bg-amber-500 text-amber-700' };
    return { niveau: 3, label: 'Fort', couleur: 'bg-emerald-500 text-emerald-700' };
  };

  const forceMdp = evaluerForceMotDePasse(formMdp.nouveau_mot_de_passe);

  const declencherChangementMdp = (e) => {
    e.preventDefault();
    if (!formMdp.ancien_mot_de_passe) {
      setToast({ type: 'warning', message: 'Veuillez saisir votre mot de passe actuel.' });
      return;
    }
    if (!formMdp.nouveau_mot_de_passe || formMdp.nouveau_mot_de_passe.length < 6) {
      setToast({ type: 'warning', message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (formMdp.nouveau_mot_de_passe !== formMdp.confirmation_mot_de_passe) {
      setToast({ type: 'warning', message: 'La confirmation ne correspond pas au nouveau mot de passe.' });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Modifier le mot de passe',
      message: 'Êtes-vous certain de vouloir modifier votre mot de passe ?\n\nVous devrez utiliser ce nouveau mot de passe lors de votre prochaine connexion.',
      chargement: false,
      messageChargement: 'Modification du mot de passe...',
      onConfirm: executerChangementMdp,
    });
  };

  const executerChangementMdp = async () => {
    try {
      setConfirmDialog((prev) => ({ ...prev, chargement: true }));
      setChargementMdp(true);
      const res = await profilService.changerMotDePasse(
        formMdp.ancien_mot_de_passe,
        formMdp.nouveau_mot_de_passe
      );

      setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} });
      setFormMdp({
        ancien_mot_de_passe: '',
        nouveau_mot_de_passe: '',
        confirmation_mot_de_passe: '',
      });
      setToast({
        type: 'success',
        message: res.message || 'Votre mot de passe a été modifié avec succès.',
      });
    } catch (err) {
      console.error('Erreur changement mot de passe :', err);
      setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} });
      setToast({
        type: 'error',
        message: err.response?.data?.detail || 'Erreur lors du changement de mot de passe.',
      });
    } finally {
      setChargementMdp(false);
    }
  };

  // ─── Gestion du QR Code ───────────────────────────────────────────────────────
  const copierLienConnexion = () => {
    if (!profil?.qr_code?.url_connexion) return;
    navigator.clipboard.writeText(profil.qr_code.url_connexion);
    setCopieLienReussie(true);
    setTimeout(() => setCopieLienReussie(false), 2500);
  };

  const telechargerQRCode = () => {
    if (!profil?.qr_code?.image_base64) return;
    const a = document.createElement('a');
    a.href = profil.qr_code.image_base64;
    a.download = `qrcode-jirama-${profil.login}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const declencherRegenerationQR = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Régénérer le QR Code',
      message: 'Attention : la régénération d\'un nouveau QR code rendra l\'ancien QR code immédiatement invalide.\n\nSouhaitez-vous continuer ?',
      chargement: false,
      messageChargement: 'Génération du nouveau jeton sécurisé...',
      onConfirm: executerRegenerationQR,
    });
  };

  const executerRegenerationQR = async () => {
    try {
      setConfirmDialog((prev) => ({ ...prev, chargement: true }));
      setChargementRegenQR(true);
      const res = await profilService.regenererQR();

      setProfil((prev) => ({
        ...prev,
        qr_code: {
          image_base64: res.image_base64,
          url_connexion: res.url_connexion,
          token_expires_at: res.token_expires_at,
        },
      }));

      setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} });
      setToast({
        type: 'success',
        message: 'Nouveau QR Code généré avec succès.',
      });
    } catch (err) {
      console.error('Erreur régénération QR :', err);
      setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} });
      setToast({
        type: 'error',
        message: err.response?.data?.detail || 'Erreur lors de la régénération du QR Code.',
      });
    } finally {
      setChargementRegenQR(false);
    }
  };

  // ─── Formatage dates ──────────────────────────────────────────────────────────
  const formaterDate = (dateIso) => {
    if (!dateIso) return 'Jamais';
    try {
      const d = new Date(dateIso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateIso;
    }
  };

  // Obtenir les initiales du nom
  const getInitiales = (nom) => {
    if (!nom) return 'U';
    const parties = nom.trim().split(/\s+/);
    if (parties.length === 1) return parties[0].substring(0, 2).toUpperCase();
    return (parties[0][0] + parties[1][0]).toUpperCase();
  };

  // ─── Rendu de la page ─────────────────────────────────────────────────────────
  if (chargement) {
    return (
      <PageLayout title="Mon Profil" toast={toast} setToast={setToast}>
        <div className="py-20">
          <LoadingProgress message="Chargement des données de votre profil..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Mon Profil" toast={toast} setToast={setToast}>
      <div className="space-y-6">
        {/* ─── CARTE D'EN-TÊTE RÉCAPITULATIVE DU PROFIL ──────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 sm:p-8 text-white relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
              {/* Avatar Initiales */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-xl flex-shrink-0">
                {getInitiales(profil?.nom_utilisateur)}
              </div>

              {/* Détails Utilisateur */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                    {profil?.nom_utilisateur}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                      profil?.role === 'ADMIN'
                        ? 'bg-amber-400/20 text-amber-200 border-amber-300/30'
                        : 'bg-emerald-400/20 text-emerald-200 border-emerald-300/30'
                    }`}
                  >
                    {profil?.role === 'ADMIN' ? 'Administrateur JIRAMA' : 'Utilisateur'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-blue-100 border border-white/20">
                    Compte actif
                  </span>
                </div>

                <p className="text-blue-100 text-xs sm:text-sm mb-3">
                  Identifiant : <span className="font-semibold text-white">@{profil?.login}</span>
                  {profil?.email && (
                    <span className="ml-3 text-blue-200">
                      • {profil.email}
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-[11px] text-blue-200/90">
                  <span>Créé le : {formaterDate(profil?.date_creation)}</span>
                  <span>•</span>
                  <span>
                    Dernière connexion : {formaterDate(profil?.derniere_connexion)}
                    {profil?.derniere_ip && ` (${profil.derniere_ip})`}
                  </span>
                </div>
              </div>

              {/* Raccourci bascule Thème Clair / Sombre */}
              <div className="flex-shrink-0">
                <button
                  onClick={toggleTheme}
                  type="button"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium backdrop-blur-xs transition shadow-xs"
                  title={estSombre ? 'Passer en mode clair' : 'Passer en mode sombre'}
                >
                  {estSombre ? (
                    <>
                      <IconSun className="w-4 h-4 text-amber-300" />
                      <span>Mode clair</span>
                    </>
                  ) : (
                    <>
                      <IconMoon className="w-4 h-4 text-blue-200" />
                      <span>Mode sombre</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Grille de métriques personnelles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-4 sm:p-5">
            <div className="flex items-center gap-3.5 px-4 py-2 sm:py-0">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <IconShield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Niveau d'accès</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {profil?.role === 'ADMIN' ? 'Accès complet (Admin)' : 'Consultation & Saisie'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 px-4 py-2 sm:py-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <IconHistory className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Actions enregistrées</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {profil?.stats?.nb_actions_journal || 0} opérations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 px-4 py-2 sm:py-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <IconCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Imports de relevés réalisés</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {profil?.stats?.nb_imports || 0} fichiers
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── BARRE D'ONGLETS ────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200 dark:border-slate-800 gap-2 sm:gap-4 overflow-x-auto pb-1">
          <button
            onClick={() => setOngletActif('infos')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              ongletActif === 'infos'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <IconUserProfile className="w-4 h-4" />
            <span>Informations personnelles</span>
          </button>

          <button
            onClick={() => setOngletActif('securite')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              ongletActif === 'securite'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <IconLock className="w-4 h-4" />
            <span>Sécurité & Mot de passe</span>
          </button>

          <button
            onClick={() => setOngletActif('qrcode')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              ongletActif === 'qrcode'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <IconQr className="w-4 h-4" />
            <span>Mon QR Code</span>
          </button>

          <button
            onClick={() => setOngletActif('historique')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              ongletActif === 'historique'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <IconHistory className="w-4 h-4" />
            <span>Mon Historique ({profil?.stats?.nb_actions_journal || 0})</span>
          </button>
        </div>

        {/* ─── ONGLET 1 : INFORMATIONS PERSONNELLES ─────────────────────────── */}
        {ongletActif === 'infos' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="max-w-2xl">
              <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1">
                Modifier mes informations
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Mettez à jour vos informations de profil. Les modifications seront appliquées immédiatement.
              </p>

              <form onSubmit={declencherSauvegardeInfos} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nom complet <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formInfos.nom_utilisateur}
                    onChange={(e) => setFormInfos({ ...formInfos, nom_utilisateur: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Ex: Rakoto Jean"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Identifiant de connexion (Login) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formInfos.login}
                    onChange={(e) => setFormInfos({ ...formInfos, login: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Ex: jean.rakoto"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Cet identifiant est utilisé pour vous connecter à l'application.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Adresse e-mail
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formInfos.email}
                      onChange={(e) => setFormInfos({ ...formInfos, email: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                      placeholder="Ex: jean.rakoto@jirama.mg"
                    />
                    <IconMail className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Requis pour la réception des notifications de sécurité et des réinitialisations de mot de passe.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Rôle & Privilèges
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {profil?.role === 'ADMIN' ? 'Rôle Administrateur' : 'Rôle Utilisateur Standard'}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {profil?.role === 'ADMIN'
                          ? 'Accès total à la gestion des utilisateurs, à l\'audit et aux configurations.'
                          : 'Accès opérationnel à la consultation, saisie et analyse des relevés.'}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-[10px] font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Fixé par la direction
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={chargementSauvegardeInfos}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    <IconCheck className="w-4 h-4" />
                    <span>Enregistrer les modifications</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── ONGLET 2 : SÉCURITÉ & MOT DE PASSE ────────────────────────────── */}
        {ongletActif === 'securite' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="max-w-2xl">
              <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1">
                Changer de mot de passe
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Pour garantir la sécurité de votre compte JIRAMA, choisissez un mot de passe robuste d'au moins 6 caractères.
              </p>

              <form onSubmit={declencherChangementMdp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Mot de passe actuel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formMdp.ancien_mot_de_passe}
                    onChange={(e) => setFormMdp({ ...formMdp, ancien_mot_de_passe: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Saisissez votre mot de passe actuel"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nouveau mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formMdp.nouveau_mot_de_passe}
                    onChange={(e) => setFormMdp({ ...formMdp, nouveau_mot_de_passe: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Au moins 6 caractères"
                  />

                  {/* Indicateur de force */}
                  {formMdp.nouveau_mot_de_passe && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Robustesse :</span>
                        <span className="font-bold">{forceMdp.label}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            forceMdp.niveau === 1
                              ? 'w-1/3 bg-rose-500'
                              : forceMdp.niveau === 2
                              ? 'w-2/3 bg-amber-500'
                              : 'w-full bg-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirmer le nouveau mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formMdp.confirmation_mot_de_passe}
                    onChange={(e) =>
                      setFormMdp({ ...formMdp, confirmation_mot_de_passe: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Répétez le nouveau mot de passe"
                  />
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
                  <IconShield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 dark:text-blue-300 space-y-1">
                    <p className="font-bold">Politique de sécurité JIRAMA</p>
                    <p className="text-[11px] text-blue-800 dark:text-blue-400">
                      Un e-mail de confirmation sera automatiquement envoyé à votre adresse e-mail ({profil?.email || 'si renseignée'}) après validation.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={chargementMdp}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    <IconKey className="w-4 h-4" />
                    <span>Modifier mon mot de passe</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── ONGLET 3 : QR CODE D'AUTHENTIFICATION ────────────────────────── */}
        {ongletActif === 'qrcode' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="max-w-2xl">
              <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1">
                Connexion rapide par QR Code
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Scannez ce QR code avec votre appareil photo ou smartphone pour vous connecter instantanément à votre session sans ressaisir vos identifiants.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 mb-6">
                {/* Image du QR Code */}
                <div className="bg-white p-3 rounded-2xl shadow-md border border-gray-200 flex-shrink-0">
                  {profil?.qr_code?.image_base64 ? (
                    <img
                      src={profil.qr_code.image_base64}
                      alt="QR Code d'authentification"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-xs">
                      Aucun QR code généré
                    </div>
                  )}
                </div>

                {/* Explications & Actions */}
                <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Jeton actif et sécurisé</span>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Ce QR Code intègre votre jeton d'authentification unique. Conservez-le confidentiellement.
                  </p>

                  {profil?.qr_code?.token_expires_at && (
                    <p className="text-[11px] text-gray-400">
                      Expire le :{' '}
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formaterDate(profil.qr_code.token_expires_at)}
                      </span>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
                    <button
                      onClick={telechargerQRCode}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      <IconDownload className="w-4 h-4" />
                      <span>Télécharger PNG</span>
                    </button>

                    <button
                      onClick={copierLienConnexion}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition"
                    >
                      {copieLienReussie ? (
                        <>
                          <IconCheck className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600">Lien copié !</span>
                        </>
                      ) : (
                        <>
                          <IconCopy className="w-4 h-4" />
                          <span>Copier le lien</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={declencherRegenerationQR}
                      disabled={chargementRegenQR}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 hover:bg-amber-100 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                      <IconRefresh className="w-4 h-4" />
                      <span>Régénérer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ONGLET 4 : MON HISTORIQUE PERSONNEL ─────────────────────────── */}
        {ongletActif === 'historique' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-white">
                  Historique de mes activités
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Journal complet retraçant vos connexions et opérations effectuées dans l'application.
                </p>
              </div>

              {/* Bouton d'actualisation */}
              <button
                onClick={chargerHistorique}
                disabled={chargementHistorique}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition"
              >
                <IconRefresh className={`w-4 h-4 ${chargementHistorique ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>

            {/* Barre de filtrage */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Rechercher dans mes opérations (action, table, détails)..."
                  value={filtreRecherche}
                  onChange={(e) => setFiltreRecherche(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && chargerHistorique()}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>

              <select
                value={filtreAction}
                onChange={(e) => setFiltreAction(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">Toutes les actions</option>
                <option value="CONNEXION">Connexions</option>
                <option value="DECONNEXION">Déconnexions</option>
                <option value="CREATE">Créations (CREATE)</option>
                <option value="UPDATE">Modifications (UPDATE)</option>
                <option value="DELETE">Suppressions (DELETE)</option>
                <option value="IMPORT">Imports</option>
              </select>

              <button
                onClick={chargerHistorique}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <IconFilter className="w-4 h-4" />
                <span>Filtrer</span>
              </button>
            </div>

            {/* Tableau de l'historique */}
            {chargementHistorique ? (
              <div className="py-12">
                <LoadingProgress message="Chargement de votre historique personnel..." />
              </div>
            ) : historique.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                Aucune action enregistrée pour le moment avec ces critères.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                  <thead className="bg-gray-50 dark:bg-slate-800/70 text-gray-700 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Date & Heure</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Ressource</th>
                      <th className="px-4 py-3">Détails</th>
                      <th className="px-4 py-3">Adresse IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {historique.map((entree) => {
                      const estConnexion = entree.type_action === 'CONNEXION';
                      const estSuppression = entree.type_action === 'DELETE';
                      const estModif = entree.type_action === 'UPDATE';
                      const estCreation = entree.type_action === 'CREATE';

                      return (
                        <tr
                          key={entree.id_journal}
                          className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition"
                        >
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formaterDate(entree.date_action)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                estConnexion
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : estSuppression
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : estModif
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : estCreation
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300'
                              }`}
                            >
                              {entree.type_action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">
                            {entree.nom_table || 'Général'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-md truncate" title={entree.details}>
                            {entree.details || '-'}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                            {entree.adresse_ip || '127.0.0.1'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODALE DE CONFIRMATION SÉCURISÉE ───────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          !confirmDialog.chargement &&
          setConfirmDialog({ isOpen: false, title: '', message: '', chargement: false, onConfirm: () => {} })
        }
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        chargement={confirmDialog.chargement}
        messageChargement={confirmDialog.messageChargement}
      />
    </PageLayout>
  );
}

export default MonProfil;
