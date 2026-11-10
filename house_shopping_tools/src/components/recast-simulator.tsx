import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Download, Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { amortize } from '@/lib/mortgage';
import { simulateRecast, type RecastPlan, type RecastResult } from '@/lib/recast';
import { formatDuration, formatMonth } from '@/lib/i18n';
import { useLanguage } from './language-provider';
import { Field } from './field';
import { InfoPopover } from './info-popover';
import '../recast.css';

export type RecastSettings = { recastAfter: string; recastAmount: string; recastFee: string };
type Loan = { principal: number; rate: number; years: number; extra: number; costs: number; pmi: number; start: string };
type Props = { loan: Loan; settings: RecastSettings; onChange: (key: keyof RecastSettings, value: string) => void; onEdit: () => void; onShare: () => void; onNotice: (message: string) => void };
const money = (amount: number, digits = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
const compact = (amount: number) => amount >= 1000000 ? `$${+(amount / 1000000).toFixed(2)}M` : amount >= 1000 ? `$${Math.round(amount / 1000)}k` : money(amount);

function RecastChart({ data, loan, after }: { data: RecastResult; loan: Loan; after: number }) {
  const { t } = useLanguage();
  const left = 64, right = 696, top = 16, bottom = 207, term = loan.years * 12;
  const x = (month: number) => left + month / term * (right - left);
  const y = (balance: number) => bottom - balance / loan.principal * (bottom - top);
  const path = (plan: RecastPlan) => `M${left},${top} ` + plan.rows.map(row => `${row.lumpSum ? `L${x(row.month)},${y(row.balance + row.lumpSum)} ` : ''}L${x(row.month)},${y(row.balance)}`).join(' ');
  return <section className="chart-card card recast-chart"><div className="section-top"><div><h2>{t('三种方案的贷款余额')}</h2><p>{t('竖线表示大额还本时间。')}</p></div></div>
    <div className="chart-key"><span><i className="dot gray" />{t('维持当前计划')}</span><span><i className="dot" style={{ background: 'var(--chart-secondary)' }} />{t('只大额还本')}</span><span><i className="dot forest" />{t('还本并 Recast')}</span></div>
    <svg className="balance-chart" viewBox="0 0 720 245" role="img" aria-label={t('三种方案的贷款余额')}>
      {[0, .25, .5, .75, 1].map(p => <g key={p}><line x1={left} x2={right} y1={top + p * (bottom - top)} y2={top + p * (bottom - top)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={left - 12} y={top + p * (bottom - top) + 4} textAnchor="end" className="axis">{compact(loan.principal * (1 - p))}</text></g>)}
      <line x1={x(after)} x2={x(after)} y1={top} y2={bottom} stroke="var(--chart-event)" strokeDasharray="3 4" />
      <path d={path(data.baseline)} fill="none" stroke="var(--chart-comparison)" strokeWidth="2" strokeDasharray="5 5" />
      <path d={path(data.lumpOnly)} fill="none" stroke="var(--chart-secondary)" strokeWidth="2.5" />
      <path d={path(data.recast)} fill="none" stroke="var(--chart-main)" strokeWidth="3" />
      {[0, .2, .4, .6, .8, 1].map(p => <text key={p} x={x(p * term)} y="235" textAnchor="middle" className="axis">{+(p * loan.years).toFixed(1)} {t('年')}</text>)}
    </svg>
  </section>;
}

export function RecastSimulator({ loan, settings, onChange, onEdit, onShare, onNotice }: Props) {
  const { language, t } = useLanguage();
  const [page, setPage] = useState(0);
  const month = Number(settings.recastAfter), amount = Number(settings.recastAmount), fee = Number(settings.recastFee);
  const baseline = useMemo(() => amortize({ principal: loan.principal, annualRate: loan.rate, years: loan.years, extra: loan.extra }), [loan.principal, loan.rate, loan.years, loan.extra]);
  const available = Number.isInteger(month) && month >= 0 ? (month === 0 ? loan.principal : baseline.rows[month - 1]?.balance) : undefined;
  const calculation = useMemo(() => {
    if ([settings.recastAfter, settings.recastAmount, settings.recastFee].some(value => !value.trim())) return { data: null, error: t('请填写有效的 Recast 金额、费用和整数期数。') };
    try {
      return { data: simulateRecast({ principal: loan.principal, annualRate: loan.rate, years: loan.years, extra: loan.extra, afterMonth: month, lumpSum: amount, fee }), error: '' };
    } catch (error) {
      const messages: Record<string, string> = {
        invalid_recast_month: 'Recast 时间必须在首次还款前或原合同到期前。',
        recast_after_payoff: '按当前额外还款计划，贷款已在这个时间前结清，请提前 Recast 时间。',
        recast_exceeds_balance: '一次性本金不能超过该时点的剩余贷款余额。',
      };
      return { data: null, error: t(messages[(error as Error).message] ?? '请填写有效的 Recast 金额、费用和整数期数。') };
    }
  }, [loan.principal, loan.rate, loan.years, loan.extra, month, amount, fee, settings, t]);
  const data = calculation.data;
  useEffect(() => setPage(0), [loan.principal, loan.rate, loan.years, loan.extra, month, amount, fee]);
  const date = (offset: number) => formatMonth(loan.start, offset, language);
  const payoff = (plan: RecastPlan) => plan.months > 0 ? date(plan.months - 1) : t('首次还款前');
  const change = (key: keyof RecastSettings, value: string) => onChange(key, value);
  const exportCsv = () => {
    if (!data) return;
    const content = '\uFEFF' + [t('期数,还款月份,当期要求本息,正常本息实付,每月额外本金,一次性本金,偿还本金,利息,手续费,贷款现金支出,剩余本金,累计利息'), ...data.recast.rows.map(row => [row.month, row.month ? date(row.month - 1) : t('首次还款前'), row.requiredPayment.toFixed(2), row.regularPayment.toFixed(2), row.extra.toFixed(2), row.lumpSum.toFixed(2), row.principal.toFixed(2), row.interest.toFixed(2), row.fee.toFixed(2), (row.payment + row.fee).toFixed(2), row.balance.toFixed(2), row.totalInterest.toFixed(2)].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'nestwise-recast.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); onNotice(t('Recast 明细已导出。'));
  };
  const scenarios = data ? [
    { key: 'current', name: '维持当前计划', detail: '不投入一次性本金，继续现有还款。', plan: data.baseline, payment: data.originalPayment, upfront: 0 },
    { key: 'lump', name: '只大额还本', detail: '投入同样本金，维持原本息月供。', plan: data.lumpOnly, payment: data.balanceAfter > 0 ? data.originalPayment : 0, upfront: data.appliedLumpSum },
    { key: 'recast', name: '还本并 Recast', detail: '投入同样本金，按原剩余期限重算月供。', plan: data.recast, payment: data.newPayment, upfront: data.upfront },
  ] : [];
  return <section className="recast-page">
    <div className="recast-loan-strip card"><div><span>{t('沿用计算器中的贷款参数')}</span><strong>{money(loan.principal)} <i>·</i> {loan.rate}% <i>·</i> {formatDuration(loan.years * 12, language)}</strong></div><div><span>{t('每月额外本金')}</span><strong>{money(loan.extra)}</strong></div><button className="text-action" onClick={onEdit}>{t('修改贷款参数')} <ArrowUpRight size={15} /></button></div>
    <div className="recast-grid"><aside className="recast-controls card"><div className="card-title"><h2><RefreshCcw size={17} />{t('Recast 计划')}</h2><InfoPopover label={t('Recast 模拟')} description={t('Recast 是在偿还额外本金后，按剩余余额和原剩余期限重新计算本息月供，利率与原到期日不变；它不是再融资。')} /></div>
      <Field label={t('已还款期数')} name="recast-after" value={settings.recastAfter} suffix={t('个月')} max={Math.max(0, baseline.months - 1)} step="1" onChange={value => change('recastAfter', value)} help={t('在第几次正常还款后投入大额本金并 recast。填 0 表示首次还款前，新月供从下一期开始。')} />
      <div className="term-presets recast-presets">{[[0, '首次还款前'], [12, '一年后'], [60, '五年后']].map(([number, label]) => <button key={number} disabled={Number(number) >= baseline.months} className={month === number ? 'chosen' : ''} onClick={() => change('recastAfter', String(number))}>{t(String(label))}</button>)}</div>
      <p className="recast-timing"><CalendarDays size={13} />{Number.isInteger(month) && month >= 0 && month < loan.years * 12 ? month ? t('还本发生于 {0} 还款后', { 0: date(month - 1) }) : t('首次还款前') : '—'}</p>
      <Field label={t('一次性还本金额')} name="recast-amount" value={settings.recastAmount} prefix="$" max={available} onChange={value => change('recastAmount', value)} help={t('这笔款项只用于冲减贷款本金，不是首付，也不包含手续费。金额不能超过选定时间的剩余本金。')} />
      <div className="loan-note recast-balance"><span>{t('预计还本前余额')}</span><strong>{available === undefined ? '—' : money(available, 2)}</strong></div>
      <Field label={t('Recast 手续费')} name="recast-fee" value={settings.recastFee} prefix="$" onChange={value => change('recastFee', value)} help={t('按贷款方报价填写，未知时可用 0 做假设。费用在 recast 当期现金支付，不计入贷款本金或新月供。')} />
      <div className="recast-control-actions"><button className="outline-btn" disabled={!data} onClick={onShare}><LinkIcon size={14} />{t('分享 Recast 计划')}</button></div>
    </aside><div className="recast-outcome">{data ? <><section className="recast-summary"><span className="recast-overline">{t('Recast 后本息月供')}</span><strong className="recast-payment" aria-live="polite">{money(data.newPayment, 2)}<small>{t('/ 月')}</small></strong><p>{t('新本息月供从 {0} 开始', { 0: date(month) })}</p><div className="recast-summary-details"><div><span>{t('剩余合同期限')}</span><strong>{formatDuration(data.remainingMonths, language)}</strong></div><div><span>{t('原合同到期日')}</span><strong>{date(loan.years * 12 - 1)}</strong></div></div><div className="recast-summary-footer">{t('利率与原到期日保持不变')}</div></section>
      <div className="recast-metrics"><div className="card"><span>{t('每月本息减少')}</span><strong>{money(data.monthlyReduction, 2)}</strong></div><div className="card"><span>{t('还本后贷款余额')}</span><strong>{money(data.balanceAfter, 2)}</strong></div><div className="card"><span className="recast-metric-label">{t('含手续费的净成本变化')}<InfoPopover label={t('含手续费的净成本变化')} description={t('Recast 本息与手续费合计减去维持现状的合计。负数表示成本降低，正数表示成本增加；一次性本金已计入合计，不会重复计算。')} /></span><strong className={data.netSavings < 0 ? 'cost-increase' : ''}>{data.netSavings < 0 ? '+' : ''}{money(-data.netSavings)}</strong><small>{data.netSavings > 0 ? t('比原计划节省 {0}', { 0: money(data.netSavings) }) : data.netSavings < 0 ? t('比原计划增加 {0}', { 0: money(-data.netSavings) }) : t('没有净成本变化')}</small></div></div>
      {loan.extra > 0 && data.balanceAfter > 0 && <p className="recast-context-note">{t('当前每月额外还本 {0} 将在 recast 前后继续。降低最低月供可能使实际还清时间比当前计划更晚。', { 0: money(loan.extra) })}</p>}
      {data.balanceAfter === 0 && <p className="recast-context-note">{t('这笔还款已结清贷款，无需再重新摊销；下方仍计入你填写的手续费。')}</p>}
    </> : <div className="empty-result card"><RefreshCcw size={30} /><h2>{t('先调整左侧参数')}</h2><p role="alert">{calculation.error}</p><span>{t('结果将随输入自动更新。')}</span></div>}</div></div>
    {data && <><div className="recast-section-heading"><h2>{t('三种还款路径')}</h2><p>{t('同一笔本金，比较降低月供和缩短还款时间的区别。')}</p></div><div className="recast-options">{scenarios.map(scenario => {
      const next = scenario.plan.rows.find(row => row.month === month + 1);
      return <article key={scenario.key} className={`recast-option card ${scenario.key === 'recast' ? 'recast-selected' : ''}`}><h3>{t(scenario.name)}</h3><p>{t(scenario.detail)}</p><span className="recast-option-label">{t('后续本息月供')}</span><strong className="recast-option-price">{money(scenario.payment, 2)}<small>{t('/ 月')}</small></strong><dl>{[
        [t('下一期住房支出'), money((next?.payment ?? 0) + loan.costs - (next ? 0 : loan.pmi), 2)],
        [t('当期一次性支出'), money(scenario.upfront, 2)],
        [t('总利息'), money(scenario.plan.totalInterest, 2)],
        [t('本息及手续费合计'), money(scenario.plan.totalOutflow, 2)],
        [t('预计结清'), payoff(scenario.plan)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>;
    })}</div><p className="recast-fine-print">{t('累计还本金额在三种方案中相同；合计包含一次性本金和所填手续费，不包含税费、保险及 HOA。')} {t('住房支出沿用计算器中的税费及每月额外还款设置，最后一期可能较少。')}</p>
      <RecastChart data={data} loan={loan} after={month} />
      <section className="schedule-table-card card recast-table" id="recast-schedule"><div className="section-top"><div><h2>{t('Recast 逐月明细')}</h2><p>{t('本息、每月额外本金、一次性还本和手续费分开列示。')}</p></div><div className="recast-table-actions"><button className="text-action" onClick={() => setPage(Math.floor(Math.max(0, data.recast.rows.findIndex(row => row.month === month)) / 12))}>{t('定位到还本当期')} <ArrowRight size={14} /></button><button className="outline-btn" onClick={exportCsv}><Download size={15} />{t('导出 Recast CSV')}</button></div></div>
        <div className="table-scroll"><table><caption className="sr-only">{t('Recast 逐月明细')}</caption><thead><tr>{['还款月份', '正常本息实付', '支付利息', '每月额外本金', '一次性本金', '手续费', '贷款现金支出', '剩余本金'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{data.recast.rows.slice(page * 12, page * 12 + 12).map(row => <tr key={row.month} className={row.month === month ? 'recast-event-row' : ''}><th scope="row">{row.month ? date(row.month - 1) : t('首次还款前')}</th><td>{money(row.regularPayment, 2)}</td><td>{money(row.interest, 2)}</td><td>{money(row.extra, 2)}</td><td>{money(row.lumpSum, 2)}</td><td>{money(row.fee, 2)}</td><td>{money(row.payment + row.fee, 2)}</td><td className="balance-cell">{money(row.balance, 2)}</td></tr>)}</tbody><tfoot><tr><th colSpan={6}>{t('总计（含手续费）')}</th><td>{money(data.recast.totalOutflow, 2)}</td><td>$0.00</td></tr></tfoot></table></div><div className="pagination"><span>{t('· 第')} {page + 1} / {Math.ceil(data.recast.rows.length / 12)} {t('页')}</span><div><button className="icon-btn" aria-label={t('上一页')} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><button className="icon-btn" aria-label={t('下一页')} disabled={(page + 1) * 12 >= data.recast.rows.length} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div>
      </section></>}
    <section className="recast-methods card"><h2>{t('计算假设')}</h2><p>{t('大额本金在所选期数的正常还款及每月额外还本之后支付，新月供从下一期开始。利率和原合同到期日不变，手续费当期现金支付。房产税、房屋保险和 HOA 沿用当前输入；PMI 在贷款结清前保持所填月费，不自动模拟更早取消。')}</p><p>{t('模拟假定贷款方允许 Recast，不模拟审批、最低还本要求或处理延迟；实际资格、费用和生效时间以贷款方为准。')}</p><a href="https://www.chase.com/personal/mortgage/education/managing-your-mortgage/what-is-mortgage-recast" target="_blank" rel="noopener noreferrer">{t('了解 Recast（Chase）')} <ArrowUpRight size={13} /></a></section>
    {data && <div className="mobile-estimate recast-mobile-result"><div><span>{t('Recast 后本息月供')}</span><strong>{money(data.newPayment, 2)}</strong></div><button onClick={() => document.querySelector('.recast-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('查看结果')} <ArrowRight size={15} /></button></div>}
  </section>;
}
