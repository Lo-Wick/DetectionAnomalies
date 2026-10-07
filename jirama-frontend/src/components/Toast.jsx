import { useEffect } from 'react';

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
      <div className={`${styles[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
        <span className="text-lg">
          {type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
        </span>
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-75">✕</button>
      </div>
    </div>
  );
}

export default Toast;