import { useEffect, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import PageLayout from './PageLayout';
import LoadingProgress from './LoadingProgress';
import { IconSearch, IconPlus, IconEdit, IconTrash } from './Icons';

function CRUDPage({ title, config }) {
  const [items, setItems] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [itemEnEdition, setItemEnEdition] = useState(null);
  const [formData, setFormData] = useState({});
  const [confirmOuvert, setConfirmOuvert] = useState(false);
  const [itemASupprimer, setItemASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const afficherToast = (message, type = 'success') => setToast({ message, type });

  const charger = async () => {
    try {
      setChargement(true);
      const data = await config.service.lister();
      setItems(data);
    } catch (err) {
      afficherToast('Erreur lors du chargement des données', 'error');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const ouvrirCreation = () => {
    setItemEnEdition(null);
    const vide = {};
    config.fields.forEach((f) => (vide[f.name] = ''));
    setFormData(vide);
    setModalOuvert(true);
  };

  const ouvrirEdition = (item) => {
    setItemEnEdition(item);
    const data = {};
    config.fields.forEach((f) => (data[f.name] = item[f.name] || ''));
    setFormData(data);
    setModalOuvert(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (itemEnEdition) {
        await config.service.modifier(itemEnEdition[config.idField], formData);
        afficherToast(`${config.labelSingulier} modifié(e) avec succès`);
      } else {
        await config.service.creer(formData);
        afficherToast(`${config.labelSingulier} créé(e) avec succès`);
      }
      setModalOuvert(false);
      charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur lors de l\'enregistrement', 'error');
    }
  };

  const confirmerSuppression = async () => {
    try {
      await config.service.supprimer(itemASupprimer[config.idField]);
      afficherToast(`${config.labelSingulier} supprimé(e) avec succès`);
      setConfirmOuvert(false);
      setItemASupprimer(null);
      charger();
    } catch (err) {
      afficherToast(err.response?.data?.detail || 'Erreur lors de la suppression', 'error');
    }
  };

  const itemsFiltres = items.filter((item) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return config.searchFields.some((champ) => {
      const val = item[champ];
      return val && val.toString().toLowerCase().includes(q);
    });
  });

  return (
    <PageLayout title={title} toast={toast} setToast={setToast}>
      {/* Barre d'actions */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <IconSearch className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Rechercher..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <button
          onClick={ouvrirCreation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
        >
          <IconPlus className="w-4 h-4" />
          <span>Nouveau {config.labelSingulier.toLowerCase()}</span>
        </button>
      </div>

      {/* Tableau ou état de chargement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {chargement ? (
          <LoadingProgress message={`Chargement des ${config.labelSingulier.toLowerCase()}s...`} />
        ) : itemsFiltres.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {recherche ? 'Aucun résultat trouvé pour votre recherche' : `Aucun(e) ${config.labelSingulier.toLowerCase()} enregistré(e)`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  {config.columns.map((col, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsFiltres.map((item) => (
                  <tr key={item[config.idField]} className="hover:bg-gray-50/80 transition">
                    {config.columns.map((col, i) => (
                      <td key={i} className="px-6 py-4 text-gray-700">
                        {col.render ? col.render(item) : item[col.field]}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => ouvrirEdition(item)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
                          title="Modifier"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => {
                            setItemASupprimer(item);
                            setConfirmOuvert(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                          title="Supprimer"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale d'ajout / modification */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={itemEnEdition ? `Modifier ${config.labelSingulier.toLowerCase()}` : `Nouveau ${config.labelSingulier.toLowerCase()}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  required={field.required}
                  rows={3}
                  maxLength={field.maxLength}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  required={field.required}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalOuvert(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de suppression */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title={`Supprimer ${config.labelSingulier.toLowerCase()}`}
        message={`Êtes-vous certain de vouloir supprimer ${config.displayName(itemASupprimer)} ? Cette action est irréversible.`}
      />
    </PageLayout>
  );
}

export default CRUDPage;