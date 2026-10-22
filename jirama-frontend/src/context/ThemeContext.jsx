/**
 * Contexte de gestion du thème (Mode Clair / Mode Sombre).
 * 
 * Permet de basculer dynamiquement l'apparence de l'application
 * entre le mode clair standard et le mode sombre (dark mode).
 * L'état est persisté dans le localStorage du navigateur et synchronisé
 * avec la classe 'dark' sur l'élément racine <html>.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  estSombre: false,
});

export function ThemeProvider({ children }) {
  // Récupération de la préférence stockée ou détection automatique du système
  const [theme, setTheme] = useState(() => {
    const preferenceEnregistree = localStorage.getItem('jirama_theme');
    if (preferenceEnregistree) {
      return preferenceEnregistree;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Application de la classe Tailwind sur <html> et <body>
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
    localStorage.setItem('jirama_theme', theme);
  }, [theme]);


  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const estSombre = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, estSombre }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme doit être utilisé à l'intérieur d'un ThemeProvider");
  }
  return context;
}
