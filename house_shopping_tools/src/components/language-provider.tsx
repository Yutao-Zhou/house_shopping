import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language, type Translator } from '@/lib/i18n';

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: Translator } | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  useEffect(() => {
    try { const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (stored === 'en' || stored === 'zh') setCurrentLanguage(stored); } catch { /* English still works without storage. */ }
  }, []);
  const setLanguage = useCallback((next: Language) => {
    setCurrentLanguage(next);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* A choice still applies for this visit. */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = language === 'en' ? 'Nestwise · A clearer path to your next home' : '栖算 Nestwise · 让家的每一笔，清晰一点';
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', language === 'en' ? 'Plan your fixed-rate mortgage, compare homebuying scenarios, simulate recasting and refinancing, compare buying with renting and investing, and export schedules.' : '清晰易用的美元房贷规划工具：计算本息月供与住房支出、对比购房方案、试算提前还款、Recast、Refinance，比较买房与租房投资净值，并导出完整明细。');
  }, [language]);
  const t = useMemo(() => createTranslator(language), [language]);
  const context = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required');
  return context;
}
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switch" role="group" aria-label="Language / 语言"><button lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button><button lang="zh-CN" aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button></div>;
}
