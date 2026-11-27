import { useEffect, useMemo, useState } from 'react';
import { Download, Link as LinkIcon, Wallet } from 'lucide-react';
import { simulateManagement, type ManagementPlan, type ManagementResult, type ManagementSettings } from '@/lib/management';
import { formatDuration, formatMonth } from '@/lib/i18n';
import { useLanguage } from './language-provider';
import { Field } from './field';
import { Pagination, ResultJump, ScrollTable } from './calculator-controls';
import { InfoPopover } from './info-popover';

type Props = { values: ManagementSettings; onChange: (key: keyof ManagementSettings, value: string) => void; onShare: () => void; onNotice: (message: string) => void };
const money = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value) < 1e-7 ? 0 : value);
const colors = ['var(--chart-comparison)', 'var(--chart-secondary)', 'var(--management-monthly)', 'var(--chart-main)'];
const labels = ['维持当前还款', '仅一次性还本', '仅每月追加', '一次性 + 每月追加'];

function ManagementChart({ data, balance }: { data: ManagementResult; balance: number }) {
  const { t } = useLanguage();
  const plans = [data.current, data.lumpOnly, data.monthlyOnly, data.combined];
  const maxMonth = Math.max(data.remainingMonths, ...plans.map(plan => plan.rows.at(-1)?.month ?? 0));
  const left = 76, right = 696, top = 20, bottom = 218;
  const x = (month: number) => left + month / maxMonth * (right - left);
  const y = (value: number) => bottom - value / Math.max(1, balance) * (bottom - top);
  const compact = (value: number) => value >= 1000000 ? `$${+(value / 1000000).toFixed(1)}M` : value >= 1000 ? `$${Math.round(value / 1000)}k` : money(value, 0);
  if (!plans.some(plan => plan.rows.length > 1)) return null;
  return <section className="card management-chart"><h2>{t('房贷管理余额对比')}</h2><p>{t('从下一期还款起按月测算，原到期日仅作参照。')}</p><div className="management-chart-key">{plans.map((plan, i) => <span key={i}><i style={{ background: colors[i] }} />{t(labels[i])}{plan.status === 'non-amortizing' ? ' —' : ''}</span>)}</div>
    <svg viewBox="0 0 720 260" role="img" aria-label={t('房贷管理余额对比')}>
      {[0, .25, .5, .75, 1].map(p => <g key={p}><line x1={left} x2={right} y1={y(balance * p)} y2={y(balance * p)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={left - 10} y={y(balance * p) + 5} textAnchor="end">{compact(balance * p)}</text></g>)}
      <line x1={x(data.remainingMonths)} x2={x(data.remainingMonths)} y1={top} y2={bottom} stroke="var(--chart-event)" strokeDasharray="3 5" />
      {plans.map((plan, i) => plan.status !== 'non-amortizing' && <path key={i} d={plan.rows.map((row, n) => `${n ? 'L' : 'M'}${x(row.month)},${y(row.balance)}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth={i === 3 ? 3.5 : 2.5} strokeDasharray={i === 0 ? '6 4' : undefined} />)}
      {[0, .25, .5, .75, 1].map(p => <text key={p} x={x(maxMonth * p)} y="249" textAnchor="middle">{+(maxMonth * p / 12).toFixed(1)} {t('年')}</text>)}
    </svg>{plans.some(plan => plan.status !== 'paid') && <p>{t('不能摊还的路径不绘制余额曲线；超过测算范围的路径只显示前 100 年。')}</p>}
  </section>;
}

export function ManagementCalculator({ values, onChange, onShare, onNotice }: Props) {
  const { language, t } = useLanguage();
  const [page, setPage] = useState(0);
  const calculation = useMemo(() => {
    if (Object.values({ manageBalance: values.manageBalance, managePayment: values.managePayment, manageRate: values.manageRate, manageNext: values.manageNext, manageMaturity: values.manageMaturity, manageLump: values.manageLump, manageExtra: values.manageExtra }).some(value => !value.trim())) return { data: null, error: t('请填写完整的房贷管理参数。') };
    try {
      return { data: simulateManagement({ balance: Number(values.manageBalance), payment: Number(values.managePayment), annualRate: Number(values.manageRate), nextPayment: values.manageNext, maturity: values.manageMaturity, lumpSum: Number(values.manageLump), extra: Number(values.manageExtra) }), error: '' };
    } catch (error) {
      const errors: Record<string, string> = { management_lump_exceeds_balance: '一次性还本不能超过剩余本金。', invalid_management_date: '请选择 1900–2300 年之间有效的还款及到期月份。', invalid_management_maturity: '原到期月不能早于下一次还款月，且相隔不超过 100 年。' };
      return { data: null, error: t(errors[(error as Error).message] ?? '请填写有效金额：本金 0–100,000,000，月供及追加款 0–10,000,000，利率 0–30%。') };
    }
  }, [values, t]);
  useEffect(() => setPage(0), [values]);
  const data = calculation.data;
  const duration = (months: number) => formatDuration(months, language);
  const date = (month: number) => month === 0 ? t('立即结清') : formatMonth(values.manageNext, month - 1, language);
  const payoff = (plan: ManagementPlan) => plan.months !== null ? date(plan.months) : plan.status === 'non-amortizing' ? t('当前月供不足以摊还贷款') : t('超过 100 年测算范围');
  const relative = (plan: ManagementPlan) => !data || plan.months === null ? '' : plan.months < data.remainingMonths ? t('比原到期日提前 {0}', { 0: duration(data.remainingMonths - plan.months) }) : plan.months > data.remainingMonths ? t('比原到期日晚 {0}', { 0: duration(plan.months - data.remainingMonths) }) : t('与原到期月份一致');
  const statusMessage = (plan: ManagementPlan) => plan.status === 'non-amortizing' ? t('月供不高于首月利息 {0}，按此金额无法逐步还清。可以增加月供或先偿还一笔本金，再查看新的结清时间。', { 0: money(plan.firstInterest) }) : t('当前金额仍在摊还本金，但未在 100 年内结清。请提高还款额以查看完整结清明细。');
  const exportCsv = () => {
    if (!data || data.combined.status !== 'paid') return;
    const content = '\uFEFF' + [t('期数,还款月份,当前月供部分,每月追加部分,一次性本金,偿还本金,支付利息,总贷款支付,剩余本金,累计利息'), ...data.combined.rows.map(row => [row.month, row.month ? date(row.month) : t('下一期还款前'), ...[row.regular, row.additional, row.lumpSum, row.principal, row.interest, row.payment, row.balance, row.totalInterest].map(value => value.toFixed(2))].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'nestwise-mortgage-management.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); onNotice(t('房贷管理明细已导出。'));
  };
  const resultCard = (plan: ManagementPlan, title: string, current: boolean) => <article className={`card management-result ${current ? 'management-current' : 'management-new'}`}><h2>{t(title)}</h2><span>{t('预计结清月份')}</span><strong className={current ? 'management-current-payoff' : 'management-new-payoff'} aria-live="polite">{payoff(plan)}</strong>{plan.status === 'paid' ? <><p className="management-relative">{relative(plan)}</p><dl><div><dt>{t('预计剩余时间')}</dt><dd>{duration(plan.months!)}</dd></div><div><dt>{t('剩余利息估算')}</dt><dd>{money(plan.totalInterest!, 0)}</dd></div><div><dt>{t('剩余本息合计')}</dt><dd>{money(plan.totalPaid!, 0)}</dd></div></dl></> : <p className="management-status" role="status">{statusMessage(plan)}</p>}</article>;

  return <section className="management-page"><div className="management-grid"><aside className="card management-controls"><h2><Wallet size={20} />{t('当前贷款情况')}</h2>
    <Field label={t('剩余贷款本金')} name="manage-balance" value={values.manageBalance} prefix="$" increment={1000} max={100000000} onChange={value => onChange('manageBalance', value)} help={t('填写最近一次还款后的本金余额，按下一次还款前还会产生一个月利息模拟；不包括将来的利息或托管账户余额。')} />
    <Field label={t('当前每月本息还款')} name="manage-payment" value={values.managePayment} prefix="$" increment={50} max={10000000} onChange={value => onChange('managePayment', value)} help={t('填写实际用于本息的每月金额，不包括房产税、保险、HOA、PMI 或手续费。如果目前已固定多还一笔本金，可以计入此金额；下方每月追加款会在此基础上再增加。')} />
    <Field label={t('当前贷款年利率')} name="manage-rate" value={values.manageRate} suffix="%" max={30} onChange={value => onChange('manageRate', value)} help={t('必须使用当前固定名义年利率，不是 APR。仅凭月供、余额和原到期日，无法独立判断当前还款速度。')} />
    <Field label={t('下一次还款月份')} name="manage-next" type="month" value={values.manageNext} onChange={value => onChange('manageNext', value)} help={t('剩余本金以最近一次还款后的余额为准；此月份是下一期正常还款发生的月份。')} />
    <Field label={t('原合同到期月份')} name="manage-maturity" type="month" value={values.manageMaturity} onChange={value => onChange('manageMaturity', value)} help={t('仅作为对照和估算按原期限结清所需的月供，不会强制在该月份结清剩余本金。')} />
    <h3>{t('额外还款计划')}</h3>
    <Field label={t('一次性额外还本')} name="manage-lump" value={values.manageLump} prefix="$" increment={1000} max={Number(values.manageBalance)} onChange={value => onChange('manageLump', value)} help={t('这笔本金在下一期计息前立即支付，不能超过剩余本金。模型保持当前月供，不会自动 Recast。')} />
    <Field label={t('每月追加还款')} name="manage-extra" value={values.manageExtra} prefix="$" increment={50} max={10000000} onChange={value => onChange('manageExtra', value)} help={t('从下一期开始，叠加在当前月供之上。先支付当月利息，剩余款项冲减本金；如果当前月供不足以付息，追加款会先补足利息。')} />
    <div className="management-presets">{[0, 100, 300, 500].map(value => <button key={value} aria-pressed={Number(values.manageExtra) === value} onClick={() => onChange('manageExtra', String(value))}>{value ? `+$${value}` : '$0'}</button>)}</div>
    <button className="outline-btn management-share" disabled={!data} onClick={onShare}><LinkIcon size={16} />{t('分享房贷管理计划')}</button><p className="management-note">{t('本页独立管理当前贷款，不修改购房计算器，也不叠加 Recast 或 Refinance。')}</p>
  </aside><div className="management-results" id="management-results" tabIndex={-1} data-result-target role="region" aria-label={t('按新计划')}>{data ? <>
    <section className="card management-contract"><div><span>{t('原合同到期')}</span><strong>{formatMonth(values.manageMaturity, 0, language)}</strong></div><div><span>{t('原合同剩余期限')}</span><strong>{duration(data.remainingMonths)}</strong></div><div><span>{t('按原到期日还清所需月供')}<InfoPopover label={t('按原到期日还清所需月供')} description={t('根据当前余额、利率及下一还款月至原到期月的期数计算；这是本息估算，不是贷款方重新核定的最低还款额。')} /></span><strong>{money(data.requiredPayment)}</strong></div></section>
    <div className="management-summary">{resultCard(data.current, '按当前速度', true)}{resultCard(data.combined, '按新计划', false)}</div>
    <div className="management-metrics"><div className="card"><span>{t('相对当前速度节省时间')}</span><strong>{data.monthsSaved === null ? '—' : duration(data.monthsSaved)}</strong></div><div className="card"><span>{t('相对当前速度节省利息')}</span><strong>{data.interestSaved === null ? '—' : money(data.interestSaved, 0)}</strong></div></div>{data.monthsSaved === null && <p className="management-note">{t('当前速度尚不能完整结清，无法计算相对节省。')}</p>}
    <ManagementChart data={data} balance={Number(values.manageBalance)} />
  </> : <section className="card management-empty"><Wallet size={32} /><h2>{t('请填写完整的房贷管理参数。')}</h2><p role="alert">{calculation.error}</p></section>}</div></div>
  {data && <><section className="management-paths"><h2>{t('四种还款路径')}</h2><p>{t('独立比较一次性还本、每月追加和两者同时使用，月供不会因还本自动降低。')}</p><div className="management-path-grid">{[data.current, data.lumpOnly, data.monthlyOnly, data.combined].map((plan, index) => <article className={`card management-path ${index === 3 ? 'management-path-selected' : ''}`} key={index}><h3>{t(labels[index])}</h3><strong>{payoff(plan)}</strong><dl>{[
    [t('每月计划还款'), money(plan.startingBalance === 0 ? 0 : plan.monthlyPayment)], [t('即刻还本金额'), money(plan.lumpSum)], [t('新计划剩余本金'), money(plan.startingBalance)], [t('剩余利息估算'), plan.totalInterest === null ? '—' : money(plan.totalInterest, 0)],
  ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>)}</div></section>
  {data.combined.status === 'paid' && <section className="card management-table"><div className="management-table-heading"><div><h2>{t('新计划逐月还款明细')}</h2><p>{t('立即还本与每月追加分列，最后一期按剩余本金及利息封顶。')}</p></div><button className="outline-btn" onClick={exportCsv}><Download size={16} />{t('导出房贷管理 CSV')}</button></div><ScrollTable label={t('新计划逐月还款明细')}><table><caption className="sr-only">{t('新计划逐月还款明细')}</caption><thead><tr>{['还款月份', '当前月供部分', '每月追加部分', '一次性本金还款', '支付利息', '总贷款支付', '剩余本金'].map(label => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead><tbody>{data.combined.rows.slice(page * 12, page * 12 + 12).map(row => <tr key={row.month}><th scope="row">{row.month ? date(row.month) : t('下一期还款前')}</th>{[row.regular, row.additional, row.lumpSum, row.interest, row.payment, row.balance].map((value, index) => <td key={index}>{money(value)}</td>)}</tr>)}</tbody><tfoot><tr><th colSpan={5}>{t('总计 / 期末')}</th><td>{money(data.combined.totalPaid!)}</td><td>$0.00</td></tr></tfoot></table></ScrollTable><Pagination page={page} pages={Math.ceil(data.combined.rows.length / 12)} onChange={setPage} /></section>}
  </>}
  <section className="card management-methods"><h2>{t('计算假设')}</h2><p>{t('按固定利率、每月一次还款模拟。一次性本金立即冲减余额，每月追加从下一期开始；税费、保险、PMI、手续费和提前还款罚金不计入。')}</p><p>{t('不模拟每日应计利息、逾期或未付利息资本化。内部保留计算精度，银行舍入方式和实际结清报价可能不同。不能摊还的路径不提供总利息或虚假的结清日期。')}</p><a href="https://www.consumerfinance.gov/ask-cfpb/how-does-paying-down-a-mortgage-work-en-1943/" target="_blank" rel="noopener noreferrer">{t('了解本金与利息（CFPB）')}</a></section>
  {data && <ResultJump target="management-results" label={t('按新计划')} value={data.combined.months === null ? '—' : payoff(data.combined)} />}
  </section>;
}
