import { useEffect, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import PageLayout from './PageLayout';

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
      afficherToast('Erreur lors du chargement', 'error');
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
      const message = err.response?.data?.detail || 'Erreur lors de l\'opération';
      afficherToast(message, 'error');
    }
  };

  const confirmerSuppression = async () => {
    try {
      await config.service.supprimer(itemASupprimer[config.idField]);
      afficherToast(`${config.labelSingulier} supprimé(e)`);
      setConfirmOuvert(false);
      setItemASupprimer(null);
      charger();
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur lors de la suppression';
      afficherToast(message, 'error');
      setConfirmOuvert(false);
    }
  };

  const itemsFiltres = items.filter((item) =>
    config.searchFields.some((field) =>
      String(item[field] || '').toLowerCase().includes(recherche.toLowerCase())
    )
  );

  return (
    <PageLayout title={title} toast={toast} setToast={setToast}>
      {/* Barre d'actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder={`Rechercher un ${config.labelSingulier.toLowerCase()}...`}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">{itemsFiltres.length} résultat(s)</span>
        </div>
        <button
          onClick={ouvrirCreation}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          + Nouveau {config.labelSingulier.toLowerCase()}
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {chargement ? (
          <div className="p-12 text-center text-gray-500">Chargement...</div>
        ) : itemsFiltres.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {recherche ? 'Aucun résultat' : `Aucun ${config.labelSingulier.toLowerCase()} enregistré`}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {config.columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {itemsFiltres.map((item) => (
                <tr key={item[config.idField]} className="hover:bg-gray-50">
                  {config.columns.map((col, i) => (
                    <td key={i} className="px-6 py-4 text-sm text-gray-700">
                      {col.render ? col.render(item) : item[col.field]}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => ouvrirEdition(item)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 mr-2"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        setItemASupprimer(item);
                        setConfirmOuvert(true);
                      }}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        title={itemEnEdition ? `Modifier ${config.labelSingulier.toLowerCase()}` : `Nouveau ${config.labelSingulier.toLowerCase()}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label} {field.required && '*'}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  required={field.required}
                  rows={3}
                  maxLength={field.maxLength}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  required={field.required}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOuvert(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {itemEnEdition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation */}
      <ConfirmDialog
        isOpen={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={confirmerSuppression}
        title="Confirmer la suppression"
        message={`Voulez-vous vraiment supprimer "${config.displayName(itemASupprimer)}" ?`}
      />
    </PageLayout>
  );
}

export default CRUDPage;