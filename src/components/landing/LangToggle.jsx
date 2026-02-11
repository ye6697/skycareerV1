import React from 'react';
import { Globe } from 'lucide-react';

export default function LangToggle({ lang, setLang }) {
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-500 text-sm text-slate-300 hover:text-white transition-all"
    >
      <Globe className="w-3.5 h-3.5" />
      <span className="font-medium">{lang === 'en' ? 'DE' : 'EN'}</span>
    </button>
  );
}