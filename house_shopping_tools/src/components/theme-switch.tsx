import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from './language-provider';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'nestwise-theme-v1';
const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

export function ThemeSwitch() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
      setTheme(isTheme(saved) ? saved : system.matches ? 'dark' : 'light');
    };
    const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) sync(); };
    system.addEventListener('change', sync);
    window.addEventListener('storage', storage);
    return () => { system.removeEventListener('change', sync); window.removeEventListener('storage', storage); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111c17' : '#254e3c');
  }, [theme]);

  const dark = theme === 'dark';
  const label = dark ? t('切换到浅色模式') : t('切换到深色模式');
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* The switch still works for this visit. */ }
  };
  return <button className="theme-toggle" type="button" aria-label={label} aria-pressed={dark} title={label} onClick={toggle}>
    {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
  </button>;
}
