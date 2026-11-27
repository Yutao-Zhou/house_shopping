import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLanguage } from './language-provider';

export function ResultJump({ target, label, value }: { target: string; label: string; value?: ReactNode }) {
  const { t } = useLanguage();
  return <div className="mobile-estimate">
    <div><span>{label}</span>{value !== undefined && <strong>{value}</strong>}</div>
    <button type="button" aria-controls={target} onClick={() => {
      const result = document.getElementById(target);
      result?.focus({ preventScroll: true });
      result?.scrollIntoView({ block: 'start' });
    }}>{t('查看结果')}<ArrowRight size={15} aria-hidden="true" /></button>
  </div>;
}

export function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>{children}</div>;
}

export function ChartYearPicker({ id, year, min = 1, max, onChange, children }: {
  id: string; year: number; min?: number; max: number; onChange: (year: number) => void; children: ReactNode;
}) {
  const { t } = useLanguage();
  return <div className="chart-year-picker">
    <label htmlFor={id}>{t('查看图表年份')}</label>
    <input id={id} type="range" min={min} max={max} value={year}
      aria-valuetext={year === 0 ? t('起点') : t('查看第 {0} 年的数据', { 0: year })}
      onChange={event => onChange(Number(event.target.value))} />
    <div>{children}</div>
  </div>;
}

export function Pagination({ page, pages, onChange, summary }: {
  page: number; pages: number; onChange: (page: number) => void; summary?: string;
}) {
  const { t } = useLanguage();
  const lastPage = Math.max(0, pages - 1);
  const current = Math.min(page, lastPage);
  const step = (direction: 1 | -1) => {
    const next = Math.max(0, Math.min(lastPage, current + direction));
    if (next !== current) onChange(next);
  };
  return <div className="pagination calculator-pagination">
    <span aria-live="polite">{summary && `${summary} · `}{t('第 {0} / {1} 页', { 0: current + 1, 1: lastPage + 1 })}</span>
    <div>
      <button type="button" className="icon-btn" aria-label={t('上一页')} aria-disabled={current === 0}
        onClick={() => step(-1)}><ChevronLeft size={17} aria-hidden="true" /></button>
      <button type="button" className="icon-btn" aria-label={t('下一页')} aria-disabled={current === lastPage}
        onClick={() => step(1)}><ChevronRight size={17} aria-hidden="true" /></button>
    </div>
  </div>;
}
