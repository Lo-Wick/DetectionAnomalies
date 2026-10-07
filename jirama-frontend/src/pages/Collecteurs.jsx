import CRUDPage from '../components/CRUDPage';
import { collecteursConfig } from '../configs/crudConfigs';

function Collecteurs() {
  return <CRUDPage title="Gestion des collecteurs" config={collecteursConfig} />;
}

export default Collecteurs;