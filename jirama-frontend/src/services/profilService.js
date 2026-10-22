/**
 * Service API pour la gestion du profil personnel et de l'historique de l'utilisateur.
 */

import api from './api';

export const profilService = {
  /**
   * Récupère les données complètes du profil de l'utilisateur connecté
   * ainsi que ses statistiques d'activité et son QR code.
   */
  async getProfil() {
    const response = await api.get('/profil/moi');
    return response.data;
  },

  /**
   * Met à jour les informations d'identité (nom, login, email) de l'utilisateur connecté.
   */
  async updateProfil(data) {
    const response = await api.put('/profil/moi', data);
    return response.data;
  },

  /**
   * Modifie le mot de passe de l'utilisateur après vérification de l'ancien.
   */
  async changerMotDePasse(ancienMotDePasse, nouveauMotDePasse) {
    const response = await api.put('/profil/mot-de-passe', {
      ancien_mot_de_passe: ancienMotDePasse,
      nouveau_mot_de_passe: nouveauMotDePasse,
    });
    return response.data;
  },

  /**
   * Régénère le jeton QR code personnel de l'utilisateur avec expiration renouvelée.
   */
  async regenererQR() {
    const response = await api.post('/profil/regenerer-qr');
    return response.data;
  },

  /**
   * Récupère l'historique des activités et connexions de l'utilisateur connecté.
   */
  async getMonHistorique(params = {}) {
    const response = await api.get('/profil/mon-historique', { params });
    return response.data;
  },
};
