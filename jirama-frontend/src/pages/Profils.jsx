import CRUDPage from '../components/CRUDPage';
import { profilsConfig } from '../configs/crudConfigs';

function Profils() {
  return <CRUDPage title="Gestion des profils clients" config={profilsConfig} />;
}

export default Profils;