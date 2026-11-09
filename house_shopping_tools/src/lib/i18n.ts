import { translations } from './translations.ts';

export type Language = 'en' | 'zh';
export type Parameters = Record<string, string | number>;
export type Translator = (key: string, parameters?: Parameters) => string;
export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'nestwise-language-v1';
export function createTranslator(language: Language): Translator {
  return (key, parameters = {}) => {
    const message = language === 'zh' ? key : (translations[key] ?? key);
    return message.replace(/\{(\w+)\}/g, (match, name) => String(parameters[name] ?? match));
  };
}
export function formatDuration(months: number, language: Language): string {
  const years = Math.floor(months / 12), remainder = months % 12;
  if (language === 'zh') return `${years ? `${years} 年` : ''}${remainder ? ` ${remainder} 个月` : ''}`.trim() || '0 个月';
  return [years ? `${years} ${years === 1 ? 'year' : 'years'}` : '', remainder || !years ? `${remainder} ${remainder === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(' ');
}
export function formatMonth(start: string, offset: number, language: Language): string {
  const [year, month] = start.split('-').map(Number), total = year * 12 + month - 1 + offset;
  const y = Math.floor(total / 12), m = total % 12;
  if (language === 'zh') return `${y} 年 ${m + 1} 月`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));
}
