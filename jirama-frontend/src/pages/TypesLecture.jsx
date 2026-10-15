/**
 * Page de gestion des types de lecture JIRAMA.
 *
 * Le type de lecture indique la nature d'un relevé :
 *  - 01 : Lecture normale (index relevé sur place)
 *  - 02 : Estimation (calculée si compteur inaccessible)
 *  - 07 : Autre type spécifique
 *  - etc. (selon référentiel JIRAMA)
 *
 * IMPORTANT : L'import Excel utilise uniquement la colonne N du fichier
 * pour le code type de lecture (et ignore la colonne O qui est la description).
 *
 * Permet de :
 *  - Lister tous les types de lecture avec recherche par code ou description
 *  - Créer un nouveau type de lecture
 *  - Modifier un type existant
 *  - Supprimer un type
 *
 * Utilise le composant générique CRUDPage avec la configuration typesLectureConfig.
 */

import CRUDPage from '../components/CRUDPage';
import { typesLectureConfig } from '../configs/crudConfigs';

function TypesLecture() {
  return <CRUDPage title="Types de lecture" config={typesLectureConfig} />;
}

export default TypesLecture;