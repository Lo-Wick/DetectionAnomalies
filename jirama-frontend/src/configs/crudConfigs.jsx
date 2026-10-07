import api from '../services/api';

// ============ CLIENTS ============
const clientService = {
  lister: async () => (await api.get('/referentiels/clients')).data,
  creer: async (data) => (await api.post('/referentiels/clients', data)).data,
  modifier: async (id, data) => (await api.put(`/referentiels/clients/${id}`, data)).data,
  supprimer: async (id) => (await api.delete(`/referentiels/clients/${id}`)).data,
};

export const clientsConfig = {
  service: clientService,
  idField: 'id_client',
  labelSingulier: 'Client',
  searchFields: ['numero_client', 'nom_client'],
  displayName: (item) => item?.nom_client || '',
  columns: [
    { label: 'Numéro client', field: 'numero_client' },
    { label: 'Nom', field: 'nom_client' },
  ],
  fields: [
    { name: 'numero_client', label: 'Numéro client', required: true, maxLength: 50, placeholder: 'Ex: 1035605' },
    { name: 'nom_client', label: 'Nom du client', required: true, maxLength: 200, placeholder: 'Ex: Rakoto Jean' },
  ],
};

// ============ COLLECTEURS ============
const collecteurService = {
  lister: async () => (await api.get('/referentiels/collecteurs')).data,
  creer: async (data) => (await api.post('/referentiels/collecteurs', data)).data,
  modifier: async (id, data) => (await api.put(`/referentiels/collecteurs/${id}`, data)).data,
  supprimer: async (id) => (await api.delete(`/referentiels/collecteurs/${id}`)).data,
};

export const collecteursConfig = {
  service: collecteurService,
  idField: 'id_collecteur',
  labelSingulier: 'Collecteur',
  searchFields: ['nom_collecteur'],
  displayName: (item) => item?.nom_collecteur || '',
  columns: [{ label: 'Nom', field: 'nom_collecteur' }],
  fields: [
    { name: 'nom_collecteur', label: 'Nom du collecteur', required: true, maxLength: 100, placeholder: 'Ex: Rakoto' },
  ],
};

// ============ OBSERVATIONS ============
const observationService = {
  lister: async () => (await api.get('/referentiels/observations')).data,
  creer: async (data) => (await api.post('/referentiels/observations', data)).data,
  modifier: async (id, data) => (await api.put(`/referentiels/observations/${id}`, data)).data,
  supprimer: async (id) => (await api.delete(`/referentiels/observations/${id}`)).data,
};

export const observationsConfig = {
  service: observationService,
  idField: 'id_observation',
  labelSingulier: 'Observation',
  searchFields: ['code_observation', 'description'],
  displayName: (item) => item?.code_observation || '',
  columns: [
    { label: 'Code', field: 'code_observation' },
    { label: 'Description', field: 'description' },
  ],
  fields: [
    { name: 'code_observation', label: 'Code', required: true, maxLength: 10, placeholder: 'Ex: A' },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 200, placeholder: 'Ex: Arrêt de compteur' },
  ],
};

// ============ PROFILS CLIENTS ============
const profilService = {
  lister: async () => (await api.get('/referentiels/profils')).data,
  creer: async (data) => (await api.post('/referentiels/profils', data)).data,
  modifier: async (id, data) => (await api.put(`/referentiels/profils/${id}`, data)).data,
  supprimer: async (id) => (await api.delete(`/referentiels/profils/${id}`)).data,
};

export const profilsConfig = {
  service: profilService,
  idField: 'id_profil',
  labelSingulier: 'Profil client',
  searchFields: ['code_profil', 'description'],
  displayName: (item) => item?.code_profil || '',
  columns: [
    { label: 'Code', field: 'code_profil' },
    { label: 'Description', field: 'description' },
  ],
  fields: [
    { name: 'code_profil', label: 'Code profil', required: true, maxLength: 10, placeholder: 'Ex: 7' },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 200, placeholder: 'Ex: Administration' },
  ],
};

// ============ TYPES DE LECTURE ============
const typeService = {
  lister: async () => (await api.get('/referentiels/types-lecture')).data,
  creer: async (data) => (await api.post('/referentiels/types-lecture', data)).data,
  modifier: async (id, data) => (await api.put(`/referentiels/types-lecture/${id}`, data)).data,
  supprimer: async (id) => (await api.delete(`/referentiels/types-lecture/${id}`)).data,
};

export const typesLectureConfig = {
  service: typeService,
  idField: 'id_type_lecture',
  labelSingulier: 'Type de lecture',
  searchFields: ['code_type', 'description'],
  displayName: (item) => item?.code_type || '',
  columns: [
    { label: 'Code', field: 'code_type' },
    { label: 'Description', field: 'description' },
  ],
  fields: [
    { name: 'code_type', label: 'Code type', required: true, maxLength: 10, placeholder: 'Ex: 3' },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 200, placeholder: 'Ex: Estimation' },
  ],
};