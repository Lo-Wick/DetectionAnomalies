/**
 * Page de gestion des clients JIRAMA.
 *
 * Permet de :
 *  - Lister tous les clients avec recherche par numéro ou nom
 *  - Créer un nouveau client
 *  - Modifier les informations d'un client existant
 *  - Supprimer un client (impossible s'il a des installations associées)
 *
 * Utilise le composant générique CRUDPage avec la configuration clientsConfig.
 */

import CRUDPage from '../components/CRUDPage';
import { clientsConfig } from '../configs/crudConfigs';

function Clients() {
  return <CRUDPage title="Clients JIRAMA" config={clientsConfig} />;
}

export default Clients;