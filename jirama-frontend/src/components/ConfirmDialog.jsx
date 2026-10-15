/**
 * Boîte de dialogue modale de confirmation.
 *
 * Utilisée pour valider les actions sensibles (suppressions, réinitialisations).
 * Supporte un état de chargement animé avec barre de progression afin d'indiquer
 * à l'utilisateur que l'opération est en cours d'exécution.
 */

import React from 'react';
import { IconRefresh, IconAlertTriangle } from './Icons';

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation requise',
  message,
  chargement = false,
  messageChargement = 'Suppression en cours...',
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fond semi-transparent avec fermeture au clic sauf pendant le chargement */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={chargement ? undefined : onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10 border border-gray-100 animate-fade-in">
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <IconAlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 leading-tight">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Action irréversible</p>
          </div>
        </div>

        {chargement ? (
          /* Indicateur visuel pendant le traitement en cours */
          <div className="my-5 p-4 rounded-xl bg-rose-50/80 border border-rose-100 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-semibold text-xs">
              <IconRefresh className="w-4 h-4 animate-spin text-rose-600 flex-shrink-0" />
              <span>{messageChargement}</span>
            </div>
            <div className="w-full h-2 bg-rose-200/60 rounded-full overflow-hidden">
              <div className="h-full bg-rose-600 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-[11px] text-rose-600 italic">
              Veuillez patienter pendant le nettoyage des données liées...
            </p>
          </div>
        ) : (
          <p className="text-gray-600 text-sm mb-6 whitespace-pre-line leading-relaxed">
            {message}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={chargement}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={chargement}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chargement && <IconRefresh className="w-3.5 h-3.5 animate-spin" />}
            <span>{chargement ? 'Traitement...' : 'Confirmer la suppression'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;