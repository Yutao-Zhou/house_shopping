import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { numberBounds, stepNumber } from '@/lib/number-step';
import { InfoPopover } from './info-popover';
import { useLanguage } from './language-provider';

type InputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string;
  increment?: number;
};

export function NumberInput({ label, name, value, onChange, prefix, suffix, min = 0, max, step = 'any', increment }: InputProps) {
  const { t } = useLanguage();
  const [visited, setVisited] = useState(false);
  const bounds = numberBounds(min, max);
  const whole = step === '1';
  const nudge = increment ?? (prefix === '$' ? 100 : suffix === '%' ? .1 : 1);
  const number = Number(value);
  const hasValue = value.trim() !== '' && Number.isFinite(number);
  const limit = Number.isFinite(bounds.max) ? bounds.max : undefined;
  const errorId = `${name}-error`;
  const error = !visited ? '' : !hasValue ? t('请输入数字。')
    : limit !== undefined && (number < min || number > limit) ? t('请输入 {0} 到 {1} 之间的值。', { 0: min, 1: limit })
    : number < min ? t('请输入不小于 {0} 的值。', { 0: min })
    : whole && !Number.isInteger(number) ? t('请输入整数。') : '';
  const up = stepNumber(value, 1, nudge, bounds, whole);
  const down = stepNumber(value, -1, nudge, bounds, whole);
  const atTop = hasValue && number === Number(up);
  const atBottom = hasValue && number === Number(down);

  return <>
    <div className={`input-shell number-shell${error ? ' number-shell-invalid' : ''}`}>
      {prefix && <span className="prefix" aria-hidden="true">{prefix}</span>}
      <input id={name} name={name} type="number" inputMode={whole && min >= 0 ? 'numeric' : 'decimal'}
        aria-label={label} min={min} max={limit} step={step} value={value} autoComplete="off"
        aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
        onChange={event => onChange(event.currentTarget.value)} onBlur={() => setVisited(true)}
        onKeyDown={event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          if (event.key === 'ArrowUp' && !atTop) onChange(up);
          if (event.key === 'ArrowDown' && !atBottom) onChange(down);
        }} />
      {suffix && <span className="suffix" aria-hidden="true">{suffix}</span>}
      <div className="number-stepper">
        <button type="button" tabIndex={-1} aria-label={t('增加{0}', { 0: label })}
          title={t('增加{0}', { 0: label })} aria-controls={name} disabled={atTop}
          onMouseDown={event => event.preventDefault()} onClick={() => onChange(up)}>
          <ChevronUp size={15} aria-hidden="true" />
        </button>
        <button type="button" tabIndex={-1} aria-label={t('减少{0}', { 0: label })}
          title={t('减少{0}', { 0: label })} aria-controls={name} disabled={atBottom}
          onMouseDown={event => event.preventDefault()} onClick={() => onChange(down)}>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
    {error && <p className="field-validation" id={errorId}>{error}</p>}
  </>;
}

export function Field({ help, type = 'number', ...props }: InputProps & { help?: string; type?: 'number' | 'month' }) {
  const { label, name, value, onChange } = props;
  return <div className="field">
    <div className="field-label">
      <label htmlFor={name}>{label}</label>
      {help && <InfoPopover label={label} description={help} />}
    </div>
    {type === 'number' ? <NumberInput {...props} /> : <div className="input-shell">
      <input id={name} name={name} type={type} value={value} autoComplete="off"
        onInput={event => onChange(event.currentTarget.value)}
        onChange={event => onChange(event.currentTarget.value)} />
    </div>}
  </div>;
}
