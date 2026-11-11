import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Download, Home, Link as LinkIcon } from 'lucide-react';
import { simulateBuyRent, type BuyRentResult } from '@/lib/buy-rent';
import { formatMonth } from '@/lib/i18n';
import { useLanguage } from './language-provider';
import { Field } from './field';
import { InfoPopover } from './info-popover';
import '../recast.css';

export type BuyRentSettings = {
  buyRentRent: string; buyRentRenterInsurance: string; buyRentReturn: string; buyRentHomeGrowth: string;
  buyRentRentGrowth: string; buyRentCostGrowth: string; buyRentMaintenance: string; buyRentBuyCosts: string;
  buyRentSellCosts: string; buyRentYears: string;
};
type Purchase = { price: string; down: string; rate: string; years: string; extra: string; tax: string; insurance: string; hoa: string; pmi: string; start: string };
type Values = BuyRentSettings & Purchase;
type Props = { values: Values; onChange: (key: keyof Values, value: string) => void; onShare: () => void; onNotice: (message: string) => void };
const money = (value: number, digits = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value) < 1e-7 ? 0 : value);
const signed = (value: number) => `${value > 1e-7 ? '+' : ''}${money(value)}`;

function WealthChart({ data }: { data: BuyRentResult }) {
  const { t } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const left = 76, right = 697, top = 20, bottom = 216, years = data.final.year;
  const values = data.yearly.flatMap(row => [row.buyerNetWorth, row.renterNetWorth]);
  const min = Math.min(0, ...values), max = Math.max(1, ...values), range = max - min;
  const x = (year: number) => left + year / years * (right - left);
  const y = (value: number) => bottom - (value - min) / range * (bottom - top);
  const path = (key: 'buyerNetWorth' | 'renterNetWorth') => data.yearly.map((row, i) => `${i ? 'L' : 'M'}${x(row.year)},${y(row[key])}`).join(' ');
  const compact = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value) >= 1000000 ? `${+(Math.abs(value) / 1000000).toFixed(1)}M` : Math.abs(value) >= 1000 ? `${Math.round(Math.abs(value) / 1000)}k` : Math.round(Math.abs(value))}`;
  const active = hover === null ? null : data.yearly[Math.min(hover, years)];
  return <section className="chart-card card buy-rent-chart"><div className="section-top"><div><h2>{t('净值随时间变化')}</h2><p>{t('买房净值已扣预计卖房费用和剩余贷款，并加上买房方投资账户。')}</p></div></div>
    <div className="chart-key"><span><i className="dot forest" />{t('买房 + 投资差额')}</span><span><i className="dot buy-rent-rent-dot" />{t('租房 + 投资')}</span></div>
    <svg className="balance-chart" viewBox="0 0 720 255" role="img" aria-label={t('净值随时间变化')} onMouseLeave={() => setHover(null)}>
      {[0, .25, .5, .75, 1].map(p => <g key={p}><line x1={left} x2={right} y1={y(min + range * p)} y2={y(min + range * p)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={left - 12} y={y(min + range * p) + 4} textAnchor="end" className="axis">{compact(min + range * p)}</text></g>)}
      {min < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="var(--chart-event)" />}
      <path d={path('buyerNetWorth')} fill="none" stroke="var(--chart-main)" strokeWidth="3" />
      <path d={path('renterNetWorth')} fill="none" stroke="var(--buy-rent-rent)" strokeWidth="3" strokeDasharray="6 4" />
      {data.yearly.map(row => <rect key={row.year} x={Math.max(left, x(row.year) - (right - left) / years / 2)} y={top} width={(right - left) / years} height={bottom - top} fill="transparent" onMouseEnter={() => setHover(row.year)}><title>{t('第 {0} 年', { 0: row.year })}: {t('买房净值')} {money(row.buyerNetWorth)}; {t('租房投资净值')} {money(row.renterNetWorth)}</title></rect>)}
      {active && <><line x1={x(active.year)} x2={x(active.year)} y1={top} y2={bottom} stroke="var(--chart-event)" strokeDasharray="3 4" /><circle cx={x(active.year)} cy={y(active.buyerNetWorth)} r="4" fill="var(--chart-main)" /><circle cx={x(active.year)} cy={y(active.renterNetWorth)} r="4" fill="var(--buy-rent-rent)" /></>}
      {[0, .2, .4, .6, .8, 1].map(p => <text key={p} x={x(p * years)} y="245" textAnchor="middle" className="axis">{+(p * years).toFixed(1)} {t('年')}</text>)}
    </svg><div className="buy-rent-chart-readout">{active ? <>{t('第 {0} 年', { 0: active.year })} · {t('买房净值')} {money(active.buyerNetWorth)} · {t('租房投资净值')} {money(active.renterNetWorth)}</> : t('假设期末卖房，税前估算')}</div>
  </section>;
}

export function BuyRentSimulator({ values, onChange, onShare, onNotice }: Props) {
  const { language, t } = useLanguage();
  const [page, setPage] = useState(0);
  const calculation = useMemo(() => {
    const keys: (keyof Values)[] = ['price', 'down', 'rate', 'years', 'extra', 'tax', 'insurance', 'hoa', 'pmi', 'buyRentRent', 'buyRentRenterInsurance', 'buyRentReturn', 'buyRentHomeGrowth', 'buyRentRentGrowth', 'buyRentCostGrowth', 'buyRentMaintenance', 'buyRentBuyCosts', 'buyRentSellCosts', 'buyRentYears'];
    if (keys.some(key => !values[key].trim())) return { data: null, error: t('请填写完整有效的购房、租房及投资参数。') };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(values.start) || Number(values.start.slice(0, 4)) < 1900 || Number(values.start.slice(0, 4)) > 2200) return { data: null, error: t('请选择 1900–2200 年之间的首次还款月份。') };
    try {
      return { data: simulateBuyRent({ price: Number(values.price), downPercent: Number(values.down), annualRate: Number(values.rate), loanYears: Number(values.years), extra: Number(values.extra), annualTax: Number(values.tax), annualInsurance: Number(values.insurance), monthlyHoa: Number(values.hoa), monthlyPmi: Number(values.pmi), monthlyRent: Number(values.buyRentRent), monthlyRenterInsurance: Number(values.buyRentRenterInsurance), rentGrowth: Number(values.buyRentRentGrowth), homeGrowth: Number(values.buyRentHomeGrowth), investmentReturn: Number(values.buyRentReturn), costGrowth: Number(values.buyRentCostGrowth), maintenancePercent: Number(values.buyRentMaintenance), purchaseCostPercent: Number(values.buyRentBuyCosts), sellingCostPercent: Number(values.buyRentSellCosts), years: Number(values.buyRentYears) }), error: '' };
    } catch (error) {
      const messages: Record<string, string> = {
        invalid_buy_rent_purchase: '房价需为 0–100,000,000 之间的正数，首付 0–100%，贷款利率 0–30%，贷款期限为 1–50 的整数年。',
        invalid_buy_rent_costs: '费用金额需为 0–10,000,000，维护及买卖费用比例需为 0–20%。',
        invalid_buy_rent_growth: '房价、租金及费用涨幅需为 -20–20%，投资回报需为 -99–30%。',
        invalid_buy_rent_horizon: '比较年数需为 1–50 的整数。',
      };
      return { data: null, error: t(messages[(error as Error).message] ?? '请填写完整有效的购房、租房及投资参数。') };
    }
  }, [values, t]);
  const data = calculation.data;
  useEffect(() => setPage(0), [values]);
  const endDate = (year: number) => year ? formatMonth(values.start, year * 12 - 1, language) : t('起始时点');
  const exportCsv = () => {
    if (!data) return;
    const content = '\uFEFF' + [t('年数,期末月份,房屋估值,剩余贷款,房屋权益（卖出费用前）,预计卖出费用,买房方投资账户,买房净值（扣卖出费用）,租房投资净值,买房减租房,当年买房住房支出,当年租房住房支出,当年买房方投资,当年租房方投资,买房方累计投资本金,租房方累计投资本金'), ...data.yearly.map(row => [row.year, endDate(row.year), ...[row.homeValue, row.mortgageBalance, row.homeEquity, row.sellingCosts, row.buyerPortfolio, row.buyerNetWorth, row.renterNetWorth, row.difference, row.annualBuyCost, row.annualRentCost, row.annualBuyInvestment, row.annualRentInvestment, row.buyerContributed, row.renterContributed].map(value => value.toFixed(2))].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'nestwise-buy-vs-rent.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); onNotice(t('买房租房明细已导出。'));
  };
  return <section className="recast-page buy-rent-page"><div className="buy-rent-grid"><aside className="recast-controls card buy-rent-controls">
    <div className="card-title"><h2><Home size={17} />{t('买房与租房假设')}</h2><InfoPopover label={t('买房 vs 租房')} description={t('此页按房价和首付计算购房贷款，直接贷款金额模式不用于此对比。买房与租房使用相同初始资金，每月支出更低的一方投资差额。')} /></div>
    <Field label={t('比较年数')} name="buy-rent-horizon" value={values.buyRentYears} suffix={t('年')} min={1} max={50} step="1" onChange={value => onChange('buyRentYears', value)} help={t('从首次还款月份起比较 1–50 个整年，结果以未来美元显示，不做通胀折算。')} />
    <div className="term-presets recast-presets">{[5, 10, 30].map(year => <button key={year} className={values.buyRentYears === String(year) ? 'chosen' : ''} onClick={() => onChange('buyRentYears', String(year))}>{year} {t('年')}</button>)}</div>
    <h3 className="buy-rent-input-heading">{t('购房与贷款')}</h3>
    <div className="field-pair"><Field label={t('房价')} name="buy-rent-price" value={values.price} prefix="$" max={100000000} onChange={value => onChange('price', value)} /><Field label={t('首付比例')} name="buy-rent-down" value={values.down} suffix="%" max={100} onChange={value => onChange('down', value)} /></div>
    <div className="field-pair"><Field label={t('固定年利率')} name="buy-rent-rate" value={values.rate} suffix="%" max={30} onChange={value => onChange('rate', value)} /><Field label={t('贷款期限')} name="buy-rent-term" value={values.years} suffix={t('年')} min={1} max={50} step="1" onChange={value => onChange('years', value)} /></div>
    <h3 className="buy-rent-input-heading">{t('租房与投资')}</h3>
    <Field label={t('当前每月租金')} name="buy-rent-rent" value={values.buyRentRent} prefix="$" max={10000000} onChange={value => onChange('buyRentRent', value)} help={t('可比住房的起始月租；每满一年按租金涨幅调整。')} />
    <Field label={t('投资年回报假设')} name="buy-rent-return" value={values.buyRentReturn} suffix="%" min={-99} max={30} onChange={value => onChange('buyRentReturn', value)} help={t('双方投资账户采用同一有效年回报率，按等效月收益复利，每月末投入差额。请填写已扣投资费用的假设回报，不代表保证收益。')} />
    <div className="field-pair"><Field label={t('房价年涨幅')} name="buy-rent-home-growth" value={values.buyRentHomeGrowth} suffix="%" min={-20} max={20} onChange={value => onChange('buyRentHomeGrowth', value)} help={t('房屋估值按等效月增长复利，可以为负数；不会自动提高房产税。')} /><Field label={t('租金年涨幅')} name="buy-rent-rent-growth" value={values.buyRentRentGrowth} suffix="%" min={-20} max={20} onChange={value => onChange('buyRentRentGrowth', value)} /></div>
    <details className="buy-rent-advanced"><summary>{t('持有及交易费用')}<ChevronDown size={16} /></summary><div className="buy-rent-advanced-fields">
      <div className="field-pair"><Field label={t('买入费用比例')} name="buy-rent-buy-costs" value={values.buyRentBuyCosts} suffix="%" max={20} onChange={value => onChange('buyRentBuyCosts', value)} help={t('房价的百分比，在买入时现金支付；租房方把这笔费用和首付一起投入投资账户。不包含首付或重复计算托管存款。')} /><Field label={t('卖出费用比例')} name="buy-rent-sell-costs" value={values.buyRentSellCosts} suffix="%" max={20} onChange={value => onChange('buyRentSellCosts', value)} help={t('预计房屋出售价格的百分比。各年买房净值都假设当年末卖房，并扣除这项费用及剩余贷款；不会每年实际卖房。')} /></div>
      <Field label={t('维护费用 / 年')} name="buy-rent-maintenance" value={values.buyRentMaintenance} suffix="%" max={20} onChange={value => onChange('buyRentMaintenance', value)} help={t('按每月期初房屋估值乘以此年比例，再除以 12 估算维修维护现金支出；不计入房屋增值。')} />
      <div className="field-pair"><Field label={t('房产税 / 年')} name="buy-rent-tax" value={values.tax} prefix="$" onChange={value => onChange('tax', value)} /><Field label={t('房屋保险 / 年')} name="buy-rent-insurance" value={values.insurance} prefix="$" onChange={value => onChange('insurance', value)} /><Field label={t('HOA / 月')} name="buy-rent-hoa" value={values.hoa} prefix="$" onChange={value => onChange('hoa', value)} /><Field label={t('PMI / 月')} name="buy-rent-pmi" value={values.pmi} prefix="$" onChange={value => onChange('pmi', value)} /></div>
      <Field label={t('持有费用年涨幅')} name="buy-rent-cost-growth" value={values.buyRentCostGrowth} suffix="%" min={-20} max={20} onChange={value => onChange('buyRentCostGrowth', value)} help={t('房产税、房屋保险、HOA 和租客保险在每个周年按此比例调整；PMI 保持输入的月费直到贷款结清。')} />
      <Field label={t('租客保险 / 月')} name="buy-rent-renter-insurance" value={values.buyRentRenterInsurance} prefix="$" onChange={value => onChange('buyRentRenterInsurance', value)} />
      <Field label={t('每月额外偿还本金')} name="buy-rent-extra" value={values.extra} prefix="$" onChange={value => onChange('extra', value)} />
      <Field label={t('首次还款月份')} type="month" name="buy-rent-start" value={values.start} onChange={value => onChange('start', value)} />
      <p className="buy-rent-note">{t('所有费用都按本页输入计入，不受房贷计算页税费开关影响。')}</p>
    </div></details>
    <p className="buy-rent-note">{t('共享房价、首付及贷款参数；此页不叠加 Recast 或 Refinance。')}</p>
    <div className="recast-control-actions"><button className="outline-btn" disabled={!data} onClick={onShare}><LinkIcon size={14} />{t('分享买房租房对比')}</button></div>
  </aside><div className="buy-rent-results">{data ? <>
    <div className="buy-rent-result-heading"><span>{t('未来净值对比')}</span><h2>{t('{0} 年后 · {1}', { 0: data.final.year, 1: endDate(data.final.year) })}</h2><p>{t('假设期末卖房，税前估算')}</p></div>
    <div className="buy-rent-outcomes"><article className="card buy-rent-outcome buy-rent-owner"><span className="buy-rent-kicker">BUY</span><h3>{t('买房 + 投资差额')}</h3><strong className="buy-rent-net-worth buy-rent-buyer-value">{money(data.final.buyerNetWorth)}</strong><dl>{[
      [t('房屋估值'), money(data.final.homeValue)], [t('扣除剩余贷款'), money(data.final.mortgageBalance)], [t('扣除预计卖房费用'), money(data.final.sellingCosts)], [t('加上买房方投资账户'), money(data.final.buyerPortfolio)],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>
    <article className="card buy-rent-outcome buy-rent-renter"><span className="buy-rent-kicker">RENT + INVEST</span><h3>{t('租房 + 投资')}</h3><strong className="buy-rent-net-worth buy-rent-renter-value">{money(data.final.renterNetWorth)}</strong><dl>{[
      [t('初始投入本金'), money(data.initialCapital)], [t('后续差额投入'), money(data.final.renterContributed - data.initialCapital)], [t('投资收益或亏损'), signed(data.renterInvestmentGain)],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article></div>
    <div className={`buy-rent-lead card ${data.final.difference < 0 ? 'rent-ahead' : ''}`} aria-live="polite"><span>{t('净值差额')}</span><strong>{data.final.difference > 0 ? t('买房净值领先 {0}', { 0: money(data.final.difference) }) : data.final.difference < 0 ? t('租房投资净值领先 {0}', { 0: money(-data.final.difference) }) : t('两种路径净值相同')}</strong><p>{t('只比较本次住房决策产生的净值，不包含你已有的其他资产或负债。')}</p></div>
    <WealthChart data={data} />
    <section className="card buy-rent-budget"><h2>{t('同一预算，差额自动投资')}<InfoPopover label={t('同一预算，差额自动投资')} description={t('每月总预算等于两种住房支出中的较高值；较低的一方把差额投入投资账户。预算可随时间变化，这不是收入或可负担能力测算。')} /></h2><div className="buy-rent-starting-capital"><span>{t('相同初始资金')}</span><strong>{money(data.initialCapital)}</strong><p>{t('首付 {0} + 买入费用 {1}', { 0: money(data.downPayment), 1: money(data.purchaseCosts) })}</p></div><div className="buy-rent-monthly-budget">{[
      [t('首月买房支出'), money(data.firstMonth.buyerHousingCost, 2)], [t('首月租房支出'), money(data.firstMonth.renterHousingCost, 2)], [t('买房方当月投资差额'), money(data.firstMonth.buyerContribution, 2)], [t('租房方当月投资差额'), money(data.firstMonth.renterContribution, 2)],
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
  </> : <section className="empty-result card"><Home size={32} /><h2>{t('先调整左侧参数')}</h2><p role="alert">{calculation.error}</p><span>{t('结果将随输入自动更新。')}</span></section>}</div></div>
  {data && <section className="schedule-table-card card recast-table buy-rent-table"><div className="section-top"><div><h2>{t('年度净值与现金流')}</h2><p>{t('每行假设在该年末结束比较；住房支出不包含当初的首付及买入费用。')}</p></div><button className="outline-btn" onClick={exportCsv}><Download size={15} />{t('导出买房租房 CSV')}</button></div><div className="table-scroll"><table><caption className="sr-only">{t('年度净值与现金流')}</caption><thead><tr>{['比较年份', '房屋估值', '剩余本金', '买房方投资', '买房净值', '租房投资净值', '买房减租房', '当年买房支出', '当年租房支出'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{data.yearly.slice(page * 12, page * 12 + 12).map(row => <tr key={row.year}><th scope="row">{row.year ? t('第 {0} 年', { 0: row.year }) : t('起始时点')}</th><td>{money(row.homeValue)}</td><td>{money(row.mortgageBalance)}</td><td>{money(row.buyerPortfolio)}</td><td className="balance-cell">{money(row.buyerNetWorth)}</td><td>{money(row.renterNetWorth)}</td><td className="balance-cell">{signed(row.difference)}</td><td>{money(row.annualBuyCost)}</td><td>{money(row.annualRentCost)}</td></tr>)}</tbody></table></div><div className="pagination"><span>{t('· 第')} {page + 1} / {Math.ceil(data.yearly.length / 12)} {t('页')}</span><div><button className="icon-btn" aria-label={t('上一页')} disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><button className="icon-btn" aria-label={t('下一页')} disabled={(page + 1) * 12 >= data.yearly.length} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button></div></div></section>}
  <section className="recast-methods card buy-rent-methods"><h2>{t('相同资金如何分配？')}</h2><p>{t('买房方在起始时支付首付及买入费用，租房方投资同样金额。此后每个月，住房支出较低的一方投资差额；双方投资回报假设相同。贷款还清后，本息与 PMI 停止，其余持有费用继续。')}</p><h2>{t('这些结果代表什么？')}</h2><p>{t('房价和投资回报按有效年增长折算为月复利，投资差额在每月末投入。租金及持有费用在周年调整，维护费按当月期初房价比例计算。结果是未来名义美元，不代表实际收益保证。')}</p><p>{t('净值按税前计算，未计抵税优惠、资本利得税、投资税、押金、搬家、装修或水电差额。投资回报请自行扣除投资费用。PMI 不自动提前取消。')}</p><p>{t('每年只是对期末出售的估算，卖房费用只在当年净值中扣一次，不从房屋价值逐年累扣。')}</p><div className="buy-rent-sources"><a href="https://www.consumerfinance.gov/ask-cfpb/what-are-some-of-the-financial-considerations-of-buying-a-home-en-119/" target="_blank" rel="noopener noreferrer">{t('了解买房持有成本（CFPB）')}<ArrowUpRight size={13} /></a><a href="https://www.investor.gov/introduction-investing" target="_blank" rel="noopener noreferrer">{t('了解复利与投资风险（Investor.gov）')}<ArrowUpRight size={13} /></a></div></section>
  {data && <div className="mobile-estimate recast-mobile-result"><div><span>{t('买房减租房')}</span><strong>{signed(data.final.difference)}</strong></div><button onClick={() => document.querySelector('.buy-rent-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('查看结果')}<ArrowRight size={15} /></button></div>}
  </section>;
}
