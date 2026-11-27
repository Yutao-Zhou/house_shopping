import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { calculateSchoolComparison, schoolDefaults, schoolFields, type SchoolComparison, type SchoolField, type SchoolSettings } from '@/lib/school-comparison';
import { restoreCostModes } from '@/lib/annual-housing-cost';
import { Field } from './field';
import { HousingCostInputs } from './annual-housing-cost-input';
import { InfoPopover } from './info-popover';
import { useLanguage } from './language-provider';

const storageKey = 'nestwise-school-comparison-v1';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const dollars = (amount: number) => usd.format(Math.round(amount) || 0);
const monthDollars = (amount: number) => usdCents.format(Math.round(amount * 100) / 100 || 0);
const labels: Record<SchoolField, string> = {
  horizon: '比较年数', tuition: '每孩首年私校费用', children: '同时就读人数', schoolYears: '就读年数',
  tuitionGrowth: '私校费用年涨幅', publicSchool: '每孩每年公校相关费用',
  currentPrice: '现住房估值', currentBalance: '现有贷款余额', currentRate: '固定年利率',
  currentMonths: '剩余贷款月数', currentOther: '其他住房支出 / 月', currentGrowth: '现住房年涨幅',
  districtPrice: '学区房价格', districtDown: '首付比例', districtRate: '固定年利率',
  districtTerm: '贷款期限', districtOther: '其他住房支出 / 月', districtGrowth: '学区房年涨幅',
  savings: '起始可用现金', sellRate: '卖现住房费用比例', buyingCosts: '买学区房过户费用', movingCosts: '搬家与重叠支出',
  holdingGrowth: '持有支出年涨幅', investmentReturn: '投资年回报假设', exitRate: '期末卖房费用比例',
};
const paths = ['留现住房 · 私校', '换学区房 · 公校'] as const;

function restoreSettings(): SchoolSettings {
  const values = { ...schoolDefaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!saved || typeof saved !== 'object') return values;
    for (const key of Object.keys(schoolFields) as SchoolField[]) {
      if (typeof saved[key] === 'string') values[key] = saved[key];
    }
    for (const key of ['currentCosts', 'districtCosts'] as const) {
      if (!saved[key] || typeof saved[key] !== 'object') continue;
      const item = { ...values[key], ...restoreCostModes(saved[key]) };
      for (const field of ['tax', 'taxRate', 'insurance', 'insuranceRate'] as const) {
        if (typeof saved[key][field] === 'string') item[field] = saved[key][field];
      }
      values[key] = item;
    }
  } catch { /* Storage is optional. */ }
  return values;
}

function ResultsChart({ data }: { data: SchoolComparison }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  const year = Math.min(selected ?? data.final.year, data.final.year);
  const active = data.yearly[year];
  const amounts = data.yearly.flatMap(row => [row.private.netWorth, row.district.netWorth]);
  const min = Math.min(...amounts), max = Math.max(...amounts);
  const pad = Math.max((max - min) * .1, 1);
  const low = min - pad, high = max + pad;
  const x = (offset: number) => 82 + offset / data.final.year * 590;
  const y = (amount: number) => 178 - (amount - low) / (high - low) * 154;
  const points = (path: 'private' | 'district') => data.yearly.map(row => `${x(row.year)},${y(row[path].netWorth)}`).join(' ');

  return <section className="card school-chart">
    <h2>{t('净值随时间变化')}</h2>
    <div className="school-chart-legend">
      <span><i className="school-stay-line" />{t(paths[0])}</span>
      <span><i className="school-move-line" />{t(paths[1])}</span>
    </div>
    <svg viewBox="0 0 700 203" role="img" aria-label={t('净值随时间变化')}>
      {[0, .33, .67, 1].map(fraction => {
        const amount = low + (high - low) * fraction;
        return <g key={fraction}>
          <line x1={82} x2={672} y1={y(amount)} y2={y(amount)} className="school-chart-rule" />
          <text x={70} y={y(amount) + 5} textAnchor="end">{compactUsd.format(amount)}</text>
        </g>;
      })}
      <polyline points={points('private')} fill="none" className="school-stay-line" />
      <polyline points={points('district')} fill="none" className="school-move-line" />
      <line x1={x(year)} x2={x(year)} y1={24} y2={178} className="school-chart-marker" />
      <circle cx={x(year)} cy={y(active.private.netWorth)} r={5} className="school-stay-point" />
      <circle cx={x(year)} cy={y(active.district.netWorth)} r={5} className="school-move-point" />
      <text x={82} y={199}>{t('起点')}</text>
      <text x={672} y={199} textAnchor="end">{t('第 {0} 年末', { 0: data.final.year })}</text>
    </svg>
    <label htmlFor="school-chart-year">{t('查看某一年的净值')}</label>
    <input id="school-chart-year" type="range" min={0} max={data.final.year} value={year}
      aria-valuetext={year === 0 ? t('起点') : t('第 {0} 年末', { 0: year })}
      onChange={event => setSelected(Number(event.target.value))} />
    <div className="school-chart-values">
      <span>{year === 0 ? t('起点') : t('第 {0} 年末', { 0: year })}</span>
      <strong className="school-stay-value"><span className="sr-only">{t(paths[0])} </span>{dollars(active.private.netWorth)}</strong>
      <strong className="school-move-value"><span className="sr-only">{t(paths[1])} </span>{dollars(active.district.netWorth)}</strong>
    </div>
  </section>;
}

export function SchoolComparisonCalculator() {
  const { t } = useLanguage();
  const [values, setValues] = useState<SchoolSettings>(restoreSettings);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* Storage is optional. */ }
  }, [values]);
  const result = useMemo(() => {
    try { return { data: calculateSchoolComparison(values), error: '' }; }
    catch (cause) { return { data: null, error: cause instanceof Error ? cause.message : '' }; }
  }, [values]);

  function field(key: SchoolField, suffix = '$', help?: string) {
    const [, min, max, whole] = schoolFields[key];
    return <Field name={`school-${key}`} label={t(labels[key])} value={values[key]}
      prefix={suffix === '$' ? '$' : undefined} suffix={suffix === '$' ? undefined : suffix}
      min={min} max={max} step={whole ? '1' : undefined} help={help && t(help)}
      onChange={value => setValues(current => ({ ...current, [key]: value }))} />;
  }
  function ownership(key: 'currentCosts' | 'districtCosts', price: string, other: 'currentOther' | 'districtOther') {
    return <details className="school-disclosure">
      <summary>{t('房产税、保险与其他支出')}<ChevronDown size={16} /></summary>
      <div className="school-field-pair">
        <HousingCostInputs prefix={`school-${key}`} price={price} values={values[key]} max={100_000_000}
          onChange={costs => setValues(current => ({ ...current, [key]: costs }))} />
      </div>
      {field(other, '$', '计入 HOA、日常维护或其他持续支出。税费、保险和本息已有单独输入。')}
    </details>;
  }

  const data = result.data;
  const error = result.error as SchoolField;
  const limits = Object.hasOwn(schoolFields, error) ? schoolFields[error] : undefined;
  const errorMessage = limits
    ? `${t('请检查「{0}」，有效范围为 {1} 到 {2}。', { 0: t(labels[error]), 1: limits[1], 2: limits[2] })}${limits[3] ? ` ${t('请输入整数。')}` : ''}`
    : t(result.error === 'currentTerm' ? '现有房贷有余额时，剩余月数至少为 1。'
      : result.error === 'housingCosts' ? '请检查房价及房产税、房屋保险的金额或比例。' : '先检查输入范围。');

  return <section className="school-page">
    <div className="school-grid">
      <aside className="school-controls">
        <section className="card school-input-card">
          <h2>{t('就读与比较年限')}</h2>
          <p className="school-example">{t('算例参数可按实际报价修改。')}</p>
          {field('tuition', '$', '可合计学费、注册费、校车和课后照护，并扣除预计奖助学金。')}
          <div className="school-field-pair">
            {field('children', '')}
            {field('schoolYears', t('年'), '从第一年起，所有孩子按同一就读年限计算。到期后两条路径都停止计入学校费用。')}
            {field('tuitionGrowth', '%')}
            {field('horizon', t('年'))}
          </div>
          {field('publicSchool', '$', '可填校车、课后照护等支出。此金额在就读期间按年保持固定。')}
        </section>
        <section className="card school-input-card">
          <h2>{t('现住房与现有房贷')}</h2>
          {field('currentPrice')}
          {field('currentBalance')}
          <div className="school-field-pair">
            {field('currentRate', '%')}
            {field('currentMonths', t('个月'), '按剩余本金、固定年利率和剩余月数重新估算本金与利息。已还清可填 0。')}
          </div>
          {field('currentGrowth', '%', '填入你想比较的名义年涨跌幅。两套房可以用不同的假设，也可以填负值。')}
          {ownership('currentCosts', values.currentPrice, 'currentOther')}
        </section>
        <section className="card school-input-card">
          <h2>{t('学区房与新房贷')}</h2>
          {field('districtPrice')}
          <div className="school-field-pair">
            {field('districtDown', '%')}
            {field('districtRate', '%')}
            {field('districtTerm', t('年'))}
            {field('districtGrowth', '%', '填入你想比较的名义年涨跌幅。两套房可以用不同的假设，也可以填负值。')}
          </div>
          {ownership('districtCosts', values.districtPrice, 'districtOther')}
        </section>
        <section className="card school-input-card">
          <h2>{t('换房现金与交易费用')}</h2>
          {field('savings', '$', '两种方案使用同一笔起始现金。卖掉现住房后的净售款可用于首付和换房费用。')}
          {field('sellRate', '%')}
          {field('buyingCosts', '$', '计入买方净过户费用。首付单列，已填入月支出的税费和保费请避免重复计入。')}
          {field('movingCosts', '$', '可合计搬家、临时住宿和两套房重叠期间的额外支出。')}
          <details className="school-disclosure">
            <summary>{t('长期比较假设')}<ChevronDown size={16} /></summary>
            {field('holdingGrowth', '%', '房产税和保险以所选比例或固定年额计算首年费用，之后与其他住房费用一起按这个涨幅逐年调整。')}
            {field('investmentReturn', '%', '双方投资账户采用同一有效年回报率，按等效月收益复利，每月末投入差额。请填写已扣投资费用的假设回报，不代表保证收益。')}
            {field('exitRate', '%', '两套房在比较期末都扣除按估值计算的此项费用。现金流表仅列实际模拟支出，期末卖房费用计入净值。')}
          </details>
        </section>
      </aside>
      <div className="school-results" id="school-results">
        {data ? <SchoolResults data={data} /> : <section className="card"><p role="alert">{errorMessage}</p></section>}
      </div>
    </div>
    {data && <AnnualComparison data={data} />}
    <div className="mobile-estimate school-mobile">
      <div><span>{t(data ? '换房路径首月支出' : '先检查输入范围。')}</span><strong>{data && monthDollars(data.firstMonth.districtHousing + data.firstMonth.publicSchool)}</strong></div>
      <button type="button" onClick={() => document.getElementById('school-results')?.scrollIntoView({ block: 'start' })}>{t('查看结果')}</button>
    </div>
  </section>;
}

function SchoolResults({ data }: { data: SchoolComparison }) {
  const { t } = useLanguage();
  const { final, firstMonth, move } = data;
  const privateCash = firstMonth.privateHousing + firstMonth.tuition;
  const districtCash = firstMonth.districtHousing + firstMonth.publicSchool;
  const monthlyDelta = Math.round((districtCash - privateCash) * 100) / 100;
  const wealthDelta = Math.round(final.district.netWorth - final.private.netWorth);
  const summary = (title: string, details: [string, number][], value: number, className: string) => <article className={`school-outcome ${className}`}>
    <h3>{t(title)}</h3><strong className="school-outcome-value">{dollars(value)}</strong>
    <dl className="school-ledger">{details.map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd>{dollars(amount)}</dd></div>)}</dl>
  </article>;

  return <>
    <section className="card school-wealth">
      <h2>{t('两条路径的期末净值')} <small>{t('第 {0} 年末', { 0: final.year })}</small></h2>
      <div className="school-outcomes">
        {summary(paths[0], [
          ['房屋估值', final.private.homeValue], ['房价变化', final.private.appreciation], ['剩余贷款', final.private.mortgageBalance],
          ['卖房可得权益', final.private.homeEquity], ['剩余现金及投资', final.private.portfolio],
        ], final.private.netWorth, 'school-stay')}
        {summary(paths[1], [
          ['房屋估值', final.district.homeValue], ['房价变化', final.district.appreciation], ['剩余贷款', final.district.mortgageBalance],
          ['卖房可得权益', final.district.homeEquity], ['剩余现金及投资', final.district.portfolio],
        ], final.district.netWorth, 'school-move')}
      </div>
      <p className="school-lead" aria-live="polite">{t(wealthDelta > 0 ? '换学区房净值高 {0}' : wealthDelta < 0 ? '留现住房读私校净值高 {0}' : '两条路径期末净值相同', { 0: dollars(Math.abs(wealthDelta)) })}</p>
    </section>
    <section className="card">
      <h2>{t('首月现金流')}</h2>
      <table className="school-small-table">
        <caption className="sr-only">{t('首月现金流')}</caption>
        <thead><tr><td /><th scope="col">{t(paths[0])}</th><th scope="col">{t(paths[1])}</th></tr></thead>
        <tbody>{([
          ['住房支出 / 月', firstMonth.privateHousing, firstMonth.districtHousing],
          ['学校支出 / 月', firstMonth.tuition, firstMonth.publicSchool],
          ['合计 / 月', privateCash, districtCash],
        ] as const).map(([label, stay, district]) => <tr key={label}><th scope="row">{t(label)}</th><td>{monthDollars(stay)}</td><td>{monthDollars(district)}</td></tr>)}</tbody>
      </table>
      <p className="school-cash-difference">{t(monthlyDelta > 0 ? '换房路径首月多支出 {0}。' : monthlyDelta < 0 ? '私校路径首月多支出 {0}。' : '两种路径首月支出相同。', { 0: monthDollars(Math.abs(monthlyDelta)) })}</p>
      <p>{t('学校费用按 12 个月平均，以便比较每月预算。')}</p>
    </section>
    <section className="card">
      <h2>{t('换房一次性现金')}</h2>
      <dl className="school-ledger">
        {([
          ['现住房净售款', move.netSale], ['学区房首付', move.downPayment], ['买学区房过户费用', move.purchaseCash - move.downPayment],
          ['搬家与重叠支出', move.transitionCosts], ['换房费用合计', move.moveCosts], ['学区房新贷款', move.principal],
          [data.netMoveCash < 0 ? '换房后释放现金' : '需动用现金', Math.abs(data.netMoveCash)],
          [data.cashGap > 0 ? '换房资金缺口' : '换房后现金余额', Math.abs(move.cashAfterMove)],
        ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd>{dollars(amount)}</dd></div>)}
      </dl>
      {data.cashGap > 0 && <p className="school-warning">{t('净值对比假设两条路径都从 {0} 现金开始，以补足换房缺口。', { 0: dollars(data.openingCash) })}</p>}
    </section>
    <ResultsChart data={data} />
    <section className="card">
      <h2>{t('现金和净值如何计算')}</h2>
      <table className="school-small-table">
        <caption className="sr-only">{t('第 {0} 年末', { 0: final.year })}</caption>
        <thead><tr><td /><th scope="col">{t(paths[0])}</th><th scope="col">{t(paths[1])}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{t('累计净现金支出')} <InfoPopover label={t('累计净现金支出')} description={t('从换房开始到比较期末的现金净流出，含贷款本息、学校与住房支出。换房路径的首付与交易支出扣除现住房净售款后计入。')} /></th><td>{dollars(final.totalPrivateCash)}</td><td>{dollars(final.totalDistrictCash)}</td></tr>
          <tr><th scope="row">{t('累计费用（不含本金）')} <InfoPopover label={t('累计费用（不含本金）')} description={t('累计已付利息、学校与持有支出，换房路径含买卖和搬家费用。')} /></th><td>{dollars(final.totalPrivateExpense)}</td><td>{dollars(final.totalDistrictExpense)}</td></tr>
        </tbody>
      </table>
      <p>{t('每月给两条路径相同的预算，支出较少的一方投资当月差额。换房后剩余现金也按填写的投资回报率增长。')}</p>
      <p>{t('期末净值 = 房屋估值 − 剩余贷款 − 预计卖房费用 + 现金与投资。结果为名义美元，未计所得税、投资税和其他资产负债。')}</p>
    </section>
  </>;
}

function AnnualComparison({ data }: { data: SchoolComparison }) {
  const { t } = useLanguage();
  return <section className="card school-annual">
    <h2>{t('逐年现金流与净值')}</h2>
    <p>{t('当年支出含住房和学校费用，换房时的一次性现金在上方单列。')}</p>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={t('逐年现金流与净值')}>
      <table><caption className="sr-only">{t('逐年现金流与净值')}</caption>
        <thead><tr>{['比较年份', '私校费用', '私校路径当年支出', '换房路径当年支出', '当年多花（换房减私校）', '私校路径净值', '换房路径净值'].map(label => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead>
        <tbody>{data.yearly.slice(1).map(row => <tr key={row.year}>
          <th scope="row">{t('第 {0} 年', { 0: row.year })}</th>
          <td>{dollars(row.tuition)}</td><td>{dollars(row.privateOutflow)}</td><td>{dollars(row.districtOutflow)}</td>
          <td>{dollars(row.districtOutflow - row.privateOutflow)}</td><td>{dollars(row.private.netWorth)}</td><td>{dollars(row.district.netWorth)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
