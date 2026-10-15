/**
 * Page de gestion des profils clients JIRAMA.
 *
 * Un profil client classifie l'abonné selon son usage :
 *  - Profil 0 : Non défini (créé automatiquement à l'import)
 *  - Profil 7 : Domestique
 *  - Autres codes selon le référentiel JIRAMA
 *
 * Permet de :
 *  - Lister tous les profils avec recherche par code ou description
 *  - Créer un nouveau profil
 *  - Modifier un profil existant
 *  - Supprimer un profil
 *
 * Utilise le composant générique CRUDPage avec la configuration profilsConfig.
 */

import CRUDPage from '../components/CRUDPage';
import { profilsConfig } from '../configs/crudConfigs';

function Profils() {
  return <CRUDPage title="Profils clients" config={profilsConfig} />;
}

export default Profils;