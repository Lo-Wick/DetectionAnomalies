import CRUDPage from '../components/CRUDPage';
import { typesLectureConfig } from '../configs/crudConfigs';

function TypesLecture() {
  return <CRUDPage title="Gestion des types de lecture" config={typesLectureConfig} />;
}

export default TypesLecture;