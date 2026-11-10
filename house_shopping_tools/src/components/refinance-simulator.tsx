import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { simulateRefinance, type RefinanceResult } from '@/lib/refinance';
import { formatDuration, formatMonth } from '@/lib/i18n';
import { useLanguage } from './language-provider';
import { Field } from './field';
import { InfoPopover } from './info-popover';
import '../recast.css';
import '../refinance.css';

export type RefinanceSettings = {
  refinanceAfter: string; refinanceRate: string; refinanceTerm: string;
  refinanceCosts: string; refinanceFinanceCosts: boolean; refinanceHorizon: string;
};
type Loan = { principal: number; rate: number; years: number; extra: number; costs: number; pmi: number; start: string };
type Props = {
  loan: Loan; settings: RefinanceSettings;
  onChange: (key: keyof RefinanceSettings, value: string | boolean) => void;
  onEdit: () => void; onShare: () => void; onNotice: (message: string) => void;
};
const money = (amount: number, digits = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
const signed = (amount: number, digits = 0) => Math.abs(amount) < 1e-7 ? money(0, digits) : `${amount > 0 ? '+' : ''}${money(amount, digits)}`;

function RefinanceChart({ data }: { data: RefinanceResult }) {
  const { t } = useLanguage();
  const left = 64, right = 696, top = 16, bottom = 207;
  const maxBalance = Math.max(data.balance, data.newPrincipal), months = data.comparison.length - 1;
  const x = (month: number) => left + month / months * (right - left);
  const y = (balance: number) => bottom - balance / maxBalance * (bottom - top);
  const path = (key: 'currentBalance' | 'newBalance') => data.comparison.map((row, i) => `${i ? 'L' : 'M'}${x(row.month)},${y(row[key])}`).join(' ');
  const compact = (amount: number) => amount >= 1000000 ? `$${+(amount / 1000000).toFixed(2)}M` : amount >= 1000 ? `$${Math.round(amount / 1000)}k` : money(amount);
  return <section className="chart-card card recast-chart"><div className="section-top"><div><h2>{t('再融资后的贷款余额')}</h2><p>{t('横轴从再融资时点起算；融资费用会使新贷款的起始余额增加。')}</p></div></div>
    <div className="chart-key"><span><i className="dot gray" />{t('保留原贷款')}</span><span><i className="dot forest" />{t('换为新贷款')}</span></div>
    <svg className="balance-chart" viewBox="0 0 720 245" role="img" aria-label={t('再融资后的贷款余额')}>
      {[0, .25, .5, .75, 1].map(p => <g key={p}><line x1={left} x2={right} y1={top + p * (bottom - top)} y2={top + p * (bottom - top)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={left - 12} y={top + p * (bottom - top) + 4} textAnchor="end" className="axis">{compact(maxBalance * (1 - p))}</text></g>)}
      <path d={path('currentBalance')} fill="none" stroke="var(--chart-comparison)" strokeWidth="2.5" strokeDasharray="5 5" />
      <path d={path('newBalance')} fill="none" stroke="var(--chart-main)" strokeWidth="3" />
      {[0, .2, .4, .6, .8, 1].map(p => <text key={p} x={x(p * months)} y="235" textAnchor="middle" className="axis">{+(p * months / 12).toFixed(1)} {t('年')}</text>)}
    </svg>
  </section>;
}

export function RefinanceSimulator({ loan, settings, onChange, onEdit, onShare, onNotice }: Props) {
  const { language, t } = useLanguage();
  const [page, setPage] = useState(0);
  const after = Number(settings.refinanceAfter), newRate = Number(settings.refinanceRate), term = Number(settings.refinanceTerm);
  const closingCosts = Number(settings.refinanceCosts), horizonMonths = Number(settings.refinanceHorizon);
  const calculation = useMemo(() => {
    const invalid = '请填写有效的再融资参数：利率 0–30%，新期限及持有期为 1–600 的整数月，费用为 0–10,000,000。';
    if ([settings.refinanceAfter, settings.refinanceRate, settings.refinanceTerm, settings.refinanceCosts, settings.refinanceHorizon].some(value => !value.trim())) return { data: null, error: t(invalid) };
    try {
      return { data: simulateRefinance({ principal: loan.principal, annualRate: loan.rate, years: loan.years, extra: loan.extra, afterMonth: after, newRate, newTermMonths: term, closingCosts, financeCosts: settings.refinanceFinanceCosts, horizonMonths }), error: '' };
    } catch (error) {
      const messages: Record<string, string> = { invalid_refinance_month: '再融资时间必须在首次还款前或原合同到期前。', refinance_after_payoff: '按当前额外还款计划，贷款已在该时点前结清，请提前再融资时间。' };
      return { data: null, error: t(messages[(error as Error).message] ?? invalid) };
    }
  }, [loan.principal, loan.rate, loan.years, loan.extra, settings, after, newRate, term, closingCosts, horizonMonths, t]);
  const data = calculation.data;
  useEffect(() => setPage(0), [loan.principal, loan.rate, loan.years, loan.extra, after, newRate, term, closingCosts, settings.refinanceFinanceCosts]);
  const date = (month: number) => formatMonth(loan.start, after + month - 1, language);
  const duration = (months: number) => formatDuration(months, language);
  const eventDate = after ? formatMonth(loan.start, after - 1, language) : t('首次还款前');
  const exportCsv = () => {
    if (!data) return;
    const content = '\uFEFF' + [t('再融资后期数,还款月份,原贷款还款,原贷款利息,新贷款还款,新贷款利息,新贷款本金还款（含额外本金）,其中额外本金,现金费用,原贷款余额,新贷款余额,累计现金差额,累计净节省'), ...data.comparison.map(row => [row.month, row.month ? date(row.month) : eventDate, row.currentPayment.toFixed(2), row.currentInterest.toFixed(2), row.newPayment.toFixed(2), row.newInterest.toFixed(2), row.newPrincipal.toFixed(2), row.newExtra.toFixed(2), row.cashFee.toFixed(2), row.currentBalance.toFixed(2), row.newBalance.toFixed(2), row.cashSavings.toFixed(2), row.netSavings.toFixed(2)].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'nestwise-refinance.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); onNotice(t('Refinance 明细已导出。'));
  };
  return <section className="recast-page refinance-page">
    <div className="recast-loan-strip card"><div><span>{t('沿用计算器中的贷款参数')}</span><strong>{money(loan.principal)} <i>·</i> {loan.rate}% <i>·</i> {duration(loan.years * 12)}</strong></div><div><span>{t('每月额外本金')}</span><strong>{money(loan.extra)}</strong></div><button className="text-action" onClick={onEdit}>{t('修改贷款参数')} <ArrowUpRight size={15} /></button></div>
    <div className="recast-grid"><aside className="recast-controls card"><div className="card-title"><h2><RefreshCw size={17} />{t('Refinance 计划')}</h2><InfoPopover label={t('Refinance 模拟')} description={t('Refinance 用一笔新贷款结清现有贷款，可以改变利率和期限。本页独立比较原贷款与再融资，不叠加 Recast。')} /></div>
      <Field label={t('再融资前已还期数')} name="refinance-after" value={settings.refinanceAfter} suffix={t('个月')} step="1" max={loan.years * 12 - 1} onChange={value => onChange('refinanceAfter', value)} help={t('所选期数的正常还款及每月额外还本完成后，再融资剩余本金。填 0 表示首次还款前。新贷款从下一期开始还款。')} />
      <div className="loan-note recast-balance"><span>{t('预计再融资前余额')}</span><strong>{data ? money(data.balance, 2) : '—'}</strong></div>
      <Field label={t('新贷款年利率')} name="refinance-rate" value={settings.refinanceRate} suffix="%" max={30} onChange={value => onChange('refinanceRate', value)} help={t('按贷款方报价填写固定名义年利率，不是 APR；示例利率不是实时市场报价。')} />
      <Field label={t('新贷款期限')} name="refinance-term" value={settings.refinanceTerm} suffix={t('个月')} step="1" min={1} max={600} onChange={value => onChange('refinanceTerm', value)} help={t('从再融资时点重新起算的还款月数，范围为 1–600 个月。匹配原剩余期限可以保持原合同到期日。')} />
      <div className="term-presets recast-presets">{[180, 240, 360].map(months => <button key={months} className={term === months ? 'chosen' : ''} onClick={() => onChange('refinanceTerm', String(months))}>{months / 12} {t('年')}</button>)}</div>
      <button className="text-action refinance-match" disabled={!Number.isInteger(after) || after < 0 || after >= loan.years * 12} onClick={() => onChange('refinanceTerm', String(loan.years * 12 - after))}>{t('匹配原剩余期限')} <ArrowRight size={13} /></button>
      <Field label={t('再融资费用')} name="refinance-costs" value={settings.refinanceCosts} prefix="$" max={10000000} onChange={value => onChange('refinanceCosts', value)} help={t('填写再融资的净费用，包括点数及贷款方费用，扣除贷款方抵扣。不含预付税费、保险或新托管账户存款，这些不是借款成本。')} />
      <div className="toggle-row refinance-fee-toggle"><span><label htmlFor="refinance-finance-costs">{t('费用并入新贷款')}</label><InfoPopover label={t('费用并入新贷款')} description={t('开启后，费用加入新贷款本金并产生利息；关闭后，费用在再融资时现金支付。两种方式都计入净节省，不会重复计算。')} /></span><input id="refinance-finance-costs" type="checkbox" className="switch" checked={settings.refinanceFinanceCosts} onChange={e => onChange('refinanceFinanceCosts', e.target.checked)} /></div>
      <Field label={t('计划持有新贷款')} name="refinance-horizon" value={settings.refinanceHorizon} suffix={t('个月')} min={1} max={600} step="1" onChange={value => onChange('refinanceHorizon', value)} help={t('在再融资后多少个月卖房、结清或再次再融资。净节省同时比较累计贷款支出与届时剩余欠款，不只看月供差额。')} />
      <div className="recast-control-actions"><button className="outline-btn" disabled={!data} onClick={onShare}><LinkIcon size={14} />{t('分享 Refinance 计划')}</button></div>
    </aside><div className="recast-outcome">{data ? <>
      <section className="recast-summary refinance-summary"><span className="recast-overline">{t('再融资后本息月供')}</span><strong className="recast-payment refinance-payment" aria-live="polite">{money(data.refinanced.scheduledPayment, 2)}<small>{t('/ 月')}</small></strong><p>{t('新贷款从 {0} 开始还款', { 0: date(1) })}</p><div className="recast-summary-details"><div><span>{t('新合同期限')}</span><strong>{duration(term)}</strong></div><div><span>{t('新贷款预计结清')}</span><strong>{date(data.refinanced.months)}</strong></div><div><span>{t('新贷款本金')}</span><strong>{money(data.newPrincipal, 2)}</strong></div><div><span>{t('再融资当期现金费用')}</span><strong>{money(data.cashCosts, 2)}</strong></div></div><div className="recast-summary-footer">{t('从再融资时点比较，已支付的利息不计入结果。')}</div></section>
      <div className="recast-metrics refinance-metrics"><div className="card"><span>{t('本息月供变化')}</span><strong className={data.monthlyReduction < 0 ? 'cost-increase' : ''}>{signed(-data.monthlyReduction, 2)}</strong><small>{data.monthlyReduction > 0 ? t('月供减少 {0}', { 0: money(data.monthlyReduction, 2) }) : data.monthlyReduction < 0 ? t('月供增加 {0}', { 0: money(-data.monthlyReduction, 2) }) : t('本息月供不变')}</small></div>
        <div className="card"><span className="recast-metric-label">{t('费用回本时间')}<InfoPopover label={t('费用回本时间')} description={t('首个累计支出加剩余欠款不高于原贷款的月份，已计入现金或融资费用。回本后也可能再次转为负节省，请结合持有期和全期结果。')} /></span><strong className="refinance-break-even">{data.breakEvenMonth === 0 ? t('无需回收费用') : data.breakEvenMonth === null ? '—' : duration(data.breakEvenMonth)}</strong><small>{data.breakEvenMonth === null ? t('全期内未回本') : data.breakEvenMonth ? t('再融资后第 {0} 个月', { 0: data.breakEvenMonth }) : money(0)}</small></div>
        <div className="card"><span className="recast-metric-label">{t('预计持有期净节省')}<InfoPopover label={t('预计持有期净节省')} description={t('负数表示再融资成本更高。净节省 = 原贷款累计支出及剩余本金 − 新贷款累计支出、现金费用及剩余本金。融资费用已在新本金中计入。')} /></span><strong className={`refinance-horizon-savings ${data.horizon.netSavings < 0 ? 'cost-increase' : ''}`}>{signed(data.horizon.netSavings)}</strong><small>{t('{0} 后，含剩余欠款差额', { 0: duration(horizonMonths) })}</small></div>
      </div>
      <div className="refinance-horizon-balances card"><div><span>{t('预计持有期后原贷款余额')}</span><strong>{money(data.horizon.currentBalance, 2)}</strong></div><div><span>{t('预计持有期后新贷款余额')}</span><strong>{money(data.horizon.newBalance, 2)}</strong></div></div>
      {term > data.remainingMonths && <p className="recast-context-note">{t('新期限比原合同剩余期限更长。较低月供可能增加全期成本，请同时比较总利息和结清日期。')}</p>}
      {loan.extra > 0 && <p className="recast-context-note">{t('每月额外本金 {0} 在两条路径中继续。图表及明细包含额外还款；主结果为合同要求的本息月供。', { 0: money(loan.extra) })}</p>}
    </> : <div className="empty-result card"><RefreshCw size={30} /><h2>{t('先调整左侧参数')}</h2><p role="alert">{calculation.error}</p><span>{t('结果将随输入自动更新。')}</span></div>}</div></div>
    {data && <><div className="recast-section-heading"><h2>{t('两条贷款路径')}</h2><p>{t('所有合计只比较再融资时点之后，费用按所选支付方式计入。')}</p></div>
      <div className="recast-options refinance-options">{[{ key: 'current', title: '保留原贷款', detail: '继续原利率、月供及每月额外还本。', plan: data.current, rate: loan.rate, cashCosts: 0 }, { key: 'new', title: '换为新贷款', detail: '使用新利率及期限，每月额外还本金额沿用。', plan: data.refinanced, rate: newRate, cashCosts: data.cashCosts }].map(scenario => <article key={scenario.key} className={`recast-option card ${scenario.key === 'new' ? 'recast-selected' : ''}`}><h3>{t(scenario.title)}</h3><p>{t(scenario.detail)}</p><span className="recast-option-label">{t('后续本息月供')}</span><strong className="recast-option-price">{money(scenario.plan.scheduledPayment, 2)}<small>{t('/ 月')}</small></strong><dl>{[
        [t('固定年利率'), `${scenario.rate}%`],
        [t('下一期住房支出'), money((scenario.plan.rows[0]?.payment ?? 0) + loan.costs, 2)],
        [t('后续贷款利息'), money(scenario.plan.totalInterest, 2)],
        [t('后续本息及现金费用'), money(scenario.plan.totalPaid + scenario.cashCosts, 2)],
        [t('从再融资起的预计还款时间'), duration(scenario.plan.months)],
        [t('预计结清'), date(scenario.plan.months)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>)}</div>
      <div className="refinance-total card"><span>{t('全期净节省')}<InfoPopover label={t('全期净节省')} description={t('所有合计只比较再融资时点之后，费用按所选支付方式计入。')} /></span><strong className={data.totalSavings < 0 ? 'cost-increase' : ''}>{signed(data.totalSavings, 2)}</strong></div>
      <RefinanceChart data={data} />
      <section className="schedule-table-card card recast-table"><div className="section-top"><div><h2>{t('Refinance 对比明细')}</h2><p>{t('净节省计入剩余欠款差额，负数表示再融资更贵。')}</p></div><button className="outline-btn" onClick={exportCsv}><Download size={15} />{t('导出 Refinance CSV')}</button></div>
        <div className="table-scroll"><table><caption className="sr-only">{t('Refinance 对比明细')}</caption><thead><tr>{['还款月份', '原贷款实付', '新贷款实付', '现金费用', '原贷款余额', '新贷款余额', '累计净节省'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{data.comparison.slice(page * 12, page * 12 + 12).map(row => <tr key={row.month} className={row.month === 0 ? 'recast-event-row' : ''}><th scope="row">{row.month ? date(row.month) : t('再融资当期')}</th><td>{money(row.currentPayment, 2)}</td><td>{money(row.newPayment, 2)}</td><td>{money(row.cashFee, 2)}</td><td>{money(row.currentBalance, 2)}</td><td>{money(row.newBalance, 2)}</td><td className="balance-cell">{signed(row.netSavings, 2)}</td></tr>)}</tbody></table></div>
        <div className="pagination"><span>{t('· 第')} {page + 1} / {Math.ceil(data.comparison.length / 12)} {t('页')}</span><div><button className="icon-btn" aria-label={t('上一页')} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><button className="icon-btn" aria-label={t('下一页')} disabled={(page + 1) * 12 >= data.comparison.length} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div>
      </section></>}
    <section className="recast-methods card"><h2>{t('计算假设')}</h2><p>{t('Refinance 用一笔新贷款结清现有贷款，可以改变利率和期限。本页独立比较原贷款与再融资，不叠加 Recast。')}</p><p>{t('固定利率按月计息，不模拟套现、额外现金还本、提前还款罚金、每日应计利息或贷款审批。费用由你填写，不自动估计点数或贷款方抵扣。')}</p><p>{t('税费、保险及 HOA 沿用计算器输入。PMI 沿用当前固定月费，直到各自贷款结清；不自动模拟再融资后取消。回本及净节省仅比较贷款本息和费用，不含税收或资金机会成本。')}</p><a href="https://www.consumerfinance.gov/consumer-tools/mortgages/answers/key-terms/#refinance" target="_blank" rel="noopener noreferrer">{t('了解再融资（CFPB）')} <ArrowUpRight size={13} /></a></section>
    {data && <div className="mobile-estimate recast-mobile-result"><div><span>{t('再融资后本息月供')}</span><strong>{money(data.refinanced.scheduledPayment, 2)}</strong></div><button onClick={() => document.querySelector('.refinance-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('查看结果')} <ArrowRight size={15} /></button></div>}
  </section>;
}
