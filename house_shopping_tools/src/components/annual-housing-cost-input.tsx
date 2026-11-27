import { annualHousingCost, changeCostMode, housingCostItem, type AnnualCost, type HousingCostSettings } from '@/lib/annual-housing-cost';
import { Field } from './field';
import { useLanguage } from './language-provider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function AnnualHousingCostInput({ kind, name, price, cost, max, onChange }: {
  kind: 'tax' | 'insurance'; name: string; price: string; cost: AnnualCost; max?: number;
  onChange: (value: AnnualCost) => void;
}) {
  const { t } = useLanguage();
  const tax = kind === 'tax';
  const label = t(tax ? '房产税 / 年' : '房屋保险 / 年');
  const help = tax
    ? t('比例模式用房价乘以你填写的年比例。实际房产税取决于当地计税评估值、税率和减免，有税单时可填写固定年额。')
    : t('比例模式用房价乘以你填写的年比例，方便比较预算。保险报价还取决于重建成本、所在地和保障范围，有报价时可填写固定年额。');
  const amount = annualHousingCost(price, cost, max);
  const linked = cost.mode === 'price';

  return <div className="annual-cost">
    <Field label={label} name={name} value={linked ? cost.rate : cost.amount}
      prefix={linked ? undefined : '$'} suffix={linked ? '%' : undefined}
      max={linked ? undefined : max ?? 10_000_000} help={help}
      onChange={value => onChange(linked ? { ...cost, rate: value } : { ...cost, amount: value })} />
    <div className="segmented annual-cost-mode" role="group" aria-label={t('{0} 的估算方式', { 0: label })}>
      <button type="button" className={linked ? 'selected' : ''} aria-pressed={linked}
        onClick={() => onChange(changeCostMode(price, cost, 'price', max))}>{t('按房价 %')}</button>
      <button type="button" className={!linked ? 'selected' : ''} aria-pressed={!linked}
        onClick={() => onChange(changeCostMode(price, cost, 'fixed', max))}>{t('固定金额')}</button>
    </div>
    {amount !== null && <p className="annual-cost-estimate">
      {linked ? t('{0} / 年 · {1} / 月', { 0: currency.format(amount), 1: currency.format(amount / 12) })
        : t('{0} / 月（已锁定）', { 0: currency.format(amount / 12) })}
    </p>}
  </div>;
}

export function HousingCostInputs({ prefix, price, values, max, onChange }: {
  prefix: string; price: string; values: HousingCostSettings; max?: number;
  onChange: (values: HousingCostSettings) => void;
}) {
  return <>{(['tax', 'insurance'] as const).map(kind => (
    <AnnualHousingCostInput key={kind} kind={kind} name={`${prefix}-${kind}`} price={price}
      cost={housingCostItem(values, kind)} max={max}
      onChange={cost => onChange({
        tax: values.tax, taxMode: values.taxMode, taxRate: values.taxRate,
        insurance: values.insurance, insuranceMode: values.insuranceMode, insuranceRate: values.insuranceRate,
        [kind]: cost.amount, [`${kind}Mode`]: cost.mode, [`${kind}Rate`]: cost.rate,
      })} />
  ))}</>;
}
