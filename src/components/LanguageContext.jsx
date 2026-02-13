import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('skycareer_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('skycareer_lang', lang);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// Translation helper
export function useT() {
  const { lang } = useLanguage();
  return (en, de) => lang === 'de' ? de : en;
}