import api from './api';

export const authService = {
  async login(login, motDePasse) {
    const response = await api.post('/auth/login', {
      login,
      mot_de_passe: motDePasse,
    });
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },
};