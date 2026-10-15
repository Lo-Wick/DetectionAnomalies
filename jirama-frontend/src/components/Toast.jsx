/**
 * Composant Toast de notification pour l'application JIRAMA.
 *
 * Affiche des messages d'information, de succès ou d'erreur temporaires.
 * Sécurisé pour accepter tout type de message (chaîne, tableau d'erreurs Pydantic/FastAPI,
 * objet d'erreur) sans jamais faire planter le rendu React.
 */

import React, { useEffect } from 'react';
import { IconCheck, IconAlertCircle, IconInfo, IconClose } from './Icons';

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
    warning: 'bg-amber-600 text-white',
  };

  const IconComponent =
    type === 'success' ? IconCheck : type === 'error' ? IconAlertCircle : IconInfo;

  // Sécurisation absolue : formatage du message en chaîne de caractères
  let texteMessage = '';
  if (typeof message === 'string') {
    texteMessage = message;
  } else if (Array.isArray(message)) {
    texteMessage = message.map((m) => m?.msg || m?.message || JSON.stringify(m)).join(' ; ');
  } else if (message && typeof message === 'object') {
    if (typeof message.detail === 'string') {
      texteMessage = message.detail;
    } else if (Array.isArray(message.detail)) {
      texteMessage = message.detail.map((m) => m?.msg || JSON.stringify(m)).join(' ; ');
    } else {
      texteMessage = message.msg || message.message || JSON.stringify(message);
    }
  } else {
    texteMessage = String(message || 'Notification');
  }

  return (
    <div className="fixed top-5 right-5 z-[9999] animate-slide-in max-w-md">
      <div
        className={`${
          styles[type] || styles.info
        } px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/20 text-sm font-medium`}
      >
        <div className="p-1 rounded-full bg-white/20 flex-shrink-0">
          <IconComponent className="w-4 h-4" />
        </div>
        <span className="flex-1 break-words leading-snug">{texteMessage}</span>
        <button
          onClick={onClose}
          className="ml-2 p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition flex-shrink-0"
          title="Fermer"
        >
          <IconClose className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default Toast;