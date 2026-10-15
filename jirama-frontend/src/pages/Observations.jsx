/**
 * Page de gestion des observations JIRAMA.
 *
 * Une observation justifie une situation particulière lors d'un relevé.
 * Exemples : MF (mauvais fonctionnement), A (arrêté), etc.
 *
 * La présence d'une observation sur un relevé avec lecture_nouvelle < lecture_précédente
 * ANNULE l'anomalie R2 (le collecteur a signalé la situation).
 *
 * Permet de :
 *  - Lister toutes les observations avec recherche par code ou description
 *  - Créer une nouvelle observation
 *  - Modifier une observation existante
 *  - Supprimer une observation
 *
 * Utilise le composant générique CRUDPage avec la configuration observationsConfig.
 */

import CRUDPage from '../components/CRUDPage';
import { observationsConfig } from '../configs/crudConfigs';

function Observations() {
  return <CRUDPage title="Observations" config={observationsConfig} />;
}

export default Observations;