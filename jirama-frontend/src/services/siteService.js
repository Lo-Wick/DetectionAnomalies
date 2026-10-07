import api from './api';

export const siteService = {
  async lister() {
    const response = await api.get('/sites/');
    return response.data;
  },

  async obtenir(id) {
    const response = await api.get(`/sites/${id}`);
    return response.data;
  },

  async creer(site) {
    const response = await api.post('/sites/', site);
    return response.data;
  },

  async modifier(id, site) {
    const response = await api.put(`/sites/${id}`, site);
    return response.data;
  },

  async supprimer(id) {
    const response = await api.delete(`/sites/${id}`);
    return response.data;
  },
};