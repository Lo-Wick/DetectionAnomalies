/**
 * Composant indicateur de chargement et de progression visuelle.
 * 
 * Remplace tous les textes statiques 'Chargement...' par un indicateur
 * moderne avec animation fluide, barre de progression et messages d'étapes.
 */

import React from 'react';

function LoadingProgress({
  message = "Chargement des données...",
  progression = null,
  sousTitre = null,
  compact = false,
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 py-3 px-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <div className="flex-1">
          <span className="font-medium">{message}</span>
          {sousTitre && <span className="text-xs text-blue-500 ml-2">({sousTitre})</span>}
        </div>
        {progression !== null && (
          <span className="text-xs font-bold text-blue-800">{Math.round(progression)}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
      {/* Animation d'anneau ou pulsation */}
      <div className="relative mb-4 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-100 rounded-full" />
        <div className="absolute w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      {/* Titre principal */}
      <p className="text-sm font-semibold text-gray-800 mb-1">{message}</p>

      {/* Sous-titre ou tâche en cours */}
      {sousTitre && (
        <p className="text-xs text-gray-500 max-w-md mb-3">{sousTitre}</p>
      )}

      {/* Barre de progression si spécifiée */}
      {progression !== null && (
        <div className="w-full max-w-xs mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1 font-mono">
            <span>Progression</span>
            <span className="font-semibold text-blue-700">{Math.round(progression)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progression))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default LoadingProgress;
