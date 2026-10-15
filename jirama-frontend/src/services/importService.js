/**
 * Service API pour la gestion des imports de fichiers Excel JIRAMA.
 *
 * Fournit les fonctions d'analyse préliminaire, de validation / insertion
 * en base de données, de consultation de l'historique et de suppression en cascade.
 */

import api from './api';

export const importService = {
  /**
   * Envoie le classeur Excel au serveur pour analyse préliminaire et comptage des lignes.
   *
   * @param {File} fichier - Fichier .xlsx ou .xls sélectionné
   * @returns {Promise<Object>} Rapport d'analyse (total, valides, erreurs, anomalies)
   */
  async analyser(fichier) {
    const formData = new FormData();
    formData.append('fichier', fichier);
    const response = await api.post('/imports/analyser', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Valide et insère définitivement l'ensemble des relevés en base de données.
   *
   * L'ID du collecteur est optionnel : chaque relevé est automatiquement rattaché
   * au collecteur responsable du carnet / tournée de l'installation.
   *
   * @param {File} fichier - Fichier Excel à insérer
   * @param {number|null} idCollecteur - ID optionnel du collecteur
   * @returns {Promise<Object>} Statistiques d'insertion
   */
  async valider(fichier, idCollecteur = null) {
    const formData = new FormData();
    formData.append('fichier', fichier);

    // N'ajouter l'ID collecteur que s'il est strictement défini et non vide
    if (idCollecteur !== undefined && idCollecteur !== null && idCollecteur !== '' && idCollecteur !== 'undefined') {
      formData.append('id_collecteur', idCollecteur);
    }

    const response = await api.post('/imports/valider', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Récupère l'historique complet des fichiers Excel importés avec leurs métriques.
   *
   * @returns {Promise<Array>} Liste chronologique des imports
   */
  async historique() {
    const response = await api.get('/imports/historique');
    return response.data;
  },

  /**
   * Supprime un import et applique la suppression en cascade de toutes ses données
   * (relevés, compteurs et installations devenus orphelins, clients orphelins).
   *
   * @param {number} id - Identifiant unique de l'import
   * @returns {Promise<Object>} Message de confirmation
   */
  async supprimer(id) {
    const response = await api.delete(`/imports/${id}`);
    return response.data;
  },
};