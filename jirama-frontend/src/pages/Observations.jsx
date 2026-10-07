import CRUDPage from '../components/CRUDPage';
import { observationsConfig } from '../configs/crudConfigs';

function Observations() {
  return <CRUDPage title="Gestion des observations" config={observationsConfig} />;
}

export default Observations;