/**
 * Service API pour la gestion des utilisateurs et du journal d'audit JIRAMA.
 */

import api from './api';

export const utilisateurService = {
  async lister() {
    const response = await api.get('/utilisateurs/');
    return response.data;
  },

  async creer(data) {
    const response = await api.post('/utilisateurs/', data);
    return response.data;
  },

  async modifier(id, data) {
    const response = await api.put(`/utilisateurs/${id}`, data);
    return response.data;
  },

  async changerStatut(id, actif) {
    const response = await api.patch(`/utilisateurs/${id}/statut`, { actif });
    return response.data;
  },

  async debloquer(id) {
    const response = await api.post(`/utilisateurs/${id}/debloquer`);
    return response.data;
  },

  async regenererMotDePasse(id, envoyerEmail = true) {
    const response = await api.post(`/utilisateurs/${id}/regenerer-mot-de-passe`, null, {
      params: { envoyer_email: envoyerEmail },
    });
    return response.data;
  },

  async regenererQR(id) {
    const response = await api.post(`/utilisateurs/${id}/regenerer-qr`);
    return response.data;
  },

  async supprimer(id) {
    const response = await api.delete(`/utilisateurs/${id}`);
    return response.data;
  },

  async listerJournalAudit(params = {}) {
    const response = await api.get('/utilisateurs/audit-journal', { params });
    return response.data;
  },
};