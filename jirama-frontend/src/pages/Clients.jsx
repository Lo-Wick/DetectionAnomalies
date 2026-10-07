import CRUDPage from '../components/CRUDPage';
import { clientsConfig } from '../configs/crudConfigs';

function Clients() {
  return <CRUDPage title="Gestion des clients" config={clientsConfig} />;
}

export default Clients;