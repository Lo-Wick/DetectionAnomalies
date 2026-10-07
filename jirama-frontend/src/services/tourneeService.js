import api from './api';

export const tourneeService = {
  async lister() {
    const response = await api.get('/tournees/');
    return response.data;
  },

  async listerParSite(idSite) {
    const response = await api.get(`/tournees/par-site/${idSite}`);
    return response.data;
  },

  async creer(tournee) {
    const response = await api.post('/tournees/', tournee);
    return response.data;
  },

  async modifier(id, tournee) {
    const response = await api.put(`/tournees/${id}`, tournee);
    return response.data;
  },

  async supprimer(id) {
    const response = await api.delete(`/tournees/${id}`);
    return response.data;
  },
};