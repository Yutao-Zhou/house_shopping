import { InfoPopover } from './info-popover';

export function Field({ label, name, value, onChange, prefix, suffix, help, min = 0, max, step = 'any', type = 'number' }: { label: string; name: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; help?: string; min?: number; max?: number; step?: string; type?: string }) {
  return <div className="field"><div className="field-label"><label htmlFor={name}>{label}</label>{help && <InfoPopover label={label} description={help} />}</div><div className="input-shell">{prefix && <span className="prefix">{prefix}</span>}<input id={name} name={name} type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" />{suffix && <span className="suffix">{suffix}</span>}</div></div>;
}
