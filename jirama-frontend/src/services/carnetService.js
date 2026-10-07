import api from './api';

export const carnetService = {
  async lister() {
    const response = await api.get('/carnets/');
    return response.data;
  },

  async listerParTournee(idTournee) {
    const response = await api.get(`/carnets/par-tournee/${idTournee}`);
    return response.data;
  },

  async creer(carnet) {
    const response = await api.post('/carnets/', carnet);
    return response.data;
  },

  async modifier(id, carnet) {
    const response = await api.put(`/carnets/${id}`, carnet);
    return response.data;
  },

  async supprimer(id) {
    const response = await api.delete(`/carnets/${id}`);
    return response.data;
  },
};