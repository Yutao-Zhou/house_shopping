import { useEffect, useState } from 'react';
import { calculateMoveSettings, moveDefaults, moveLimits, moveMaxAmount, type MoveAmount, type MoveSettings } from '@/lib/home-move';
import { useLanguage } from './language-provider';
import { Field } from './field';
import { InfoPopover } from './info-popover';
import { HousingCostInputs } from './annual-housing-cost-input';
import { restoreCostModes } from '@/lib/annual-housing-cost';

const STORAGE_KEY = 'nestwise-home-move-v1';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (amount: number) => currency.format(amount === 0 ? 0 : amount);

function restoreSettings(): MoveSettings {
  const values = { ...moveDefaults };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(values) as (keyof MoveSettings)[]) {
        if (typeof saved[key] === 'string') Object.assign(values, { [key]: saved[key] });
      }
      Object.assign(values, restoreCostModes(saved));
    }
  } catch { /* Storage is optional. */ }
  if (values.downMode !== 'available') values.downMode = 'target';
  return values;
}

const errors: Record<string, string> = {
  blank: '请补齐所有显示的金额。无需计入的费用可填 0。',
  price: '旧房售价和新房价格都至少为 $0.01。',
  term: '贷款期限为 1–50 个整年，重叠持有为 0–36 个整月。',
  amount: '请检查各项金额及百分比是否在输入范围内。',
  housingCosts: '请检查房价及房产税、房屋保险的金额或比例。',
};

export function HomeMoveCalculator() {
  const { t } = useLanguage();
  const [values, setValues] = useState<MoveSettings>(restoreSettings);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch { /* Storage is optional. */ }
  }, [values]);

  const update = (key: keyof MoveSettings, value: string) => {
    setValues(current => ({ ...current, [key]: value }));
  };
  function field(key: MoveAmount, label: string, options: { suffix?: string; help?: string; integer?: boolean; min?: number } = {}) {
    return <Field name={`move-${key}`} value={values[key]} label={t(label)}
      prefix={options.suffix ? undefined : '$'} suffix={options.suffix}
      min={options.min} max={moveLimits[key] ?? moveMaxAmount} step={options.integer ? '1' : undefined}
      help={options.help ? t(options.help) : undefined} onChange={value => update(key, value)} />;
  }

  let result: ReturnType<typeof calculateMoveSettings> | undefined;
  let error = '';
  try { result = calculateMoveSettings(values); }
  catch (cause) { error = t(errors[(cause as Error).message] ?? errors.amount); }

  function breakdown(rows: [string, number][]) {
    return <dl className="move-breakdown">{rows.map(([label, value]) => <div key={label}>
      <dt>{t(label)}</dt><dd>{money(value)}</dd>
    </div>)}</dl>;
  }

  return <section className="move-page">
    <div className="move-grid">
      <div className="move-inputs">
        <section className="card move-input-card">
          <h2>{t('出售旧房')}</h2>
          <p className="move-example">{t('算例参数可按实际报价修改。')}</p>
          {field('salePrice', '预计旧房售价', { min: .01 })}
          {field('payoff', '旧房贷款结清额', { help: '使用预计成交日的贷款结清报价，合计需要在卖房时还清的贷款和房屋信用额度。' })}
          {field('saleFeeRate', '卖房按比例费用', { suffix: '%', help: '按售价估算的佣金及其他按比例收取的卖方费用。' })}
          {field('otherSaleCosts', '其他卖房费用', { help: '填写尚未计入比例费用的金额，例如转让税、给买家的补贴及卖房前整修。预计售房所得税也可在这里手动计入。' })}
        </section>
        <section className="card move-input-card">
          <h2>{t('购买新房')}</h2>
          {field('buyPrice', '新房价格', { min: .01 })}
          {field('closingCosts', '买房净过户费用', { help: '填写买方过户费用扣除卖方和贷款方抵扣后的金额。预付款和托管存款请填在下一项。' })}
          {field('prepaids', '预付款与托管存款', { help: '按贷款报价填写需提前支付的利息、税费、保险和初始托管存款。' })}
        </section>
        <section className="card move-input-card">
          <h2>{t('搬家与过渡')}</h2>
          {field('movers', '搬家及临时住宿')}
          {field('repairs', '新房整修预算')}
          {field('overlapMonths', '重叠持有月数', { suffix: t('个月'), integer: true })}
          {field('overlapMonthly', '每月额外重叠支出', { help: '填两套房或临时住处重叠期间的每月新增支出，例如多付的一套房贷款、税费和保险。已在其他项目列出的支出请扣除。' })}
        </section>
        <section className="card move-input-card">
          <h2>{t('可用现金与首付')}</h2>
          {field('savings', '可用于换房的存款')}
          {field('reserve', '换房后保留现金', { help: '把希望留下的现金作为预算目标。现金不足时，结果会显示达到该目标还需要多少钱。' })}
          <fieldset className="move-mode">
            <legend>{t('首付方式')}</legend>
            <label><input type="radio" name="move-down-mode" checked={values.downMode === 'target'} onChange={() => update('downMode', 'target')} />{t('指定首付比例')}</label>
            <label><input type="radio" name="move-down-mode" checked={values.downMode === 'available'} onChange={() => update('downMode', 'available')} />{t('用剩余资金做首付')}</label>
          </fieldset>
          {values.downMode === 'target'
            ? field('downPercent', '首付比例', { suffix: '%' })
            : <p>{t('先扣换房支出、预付款和保留现金，再用剩余金额付首付，最多付到房价全额。')}</p>}
        </section>
        <section className="card move-input-card">
          <h2>{t('新贷款与月度费用')}</h2>
          <div className="move-field-pair">
            {field('annualRate', '固定年利率', { suffix: '%' })}
            {field('years', '贷款期限', { suffix: t('年'), min: 1, integer: true })}
            <HousingCostInputs prefix="move" price={values.buyPrice} max={moveMaxAmount}
              values={{ ...values, tax: values.annualTax, insurance: values.annualInsurance }}
              onChange={({ tax, insurance, ...modes }) => {
                setValues(current => ({ ...current, ...modes, annualTax: tax, annualInsurance: insurance }));
              }} />
            {field('monthlyHoa', 'HOA / 月')}
            {field('monthlyPmi', 'PMI / 月')}
          </div>
        </section>
      </div>
      <div className="move-results" id="move-results">
        {!result ? <section className="card move-assumptions"><p role="alert">{error}</p></section> : <>
          <section className="card move-loan" aria-live="polite">
            <h2>{t('预计新贷款')}</h2>
            <strong className="move-principal">{money(result.principal)}</strong>
            <div className="move-loan-metrics">
              <div><span>{t('新房首付')}</span><strong>{money(result.downPayment)}</strong><small>{+result.downRatio.toFixed(2)}%</small></div>
              <div><span>{t('本息月供')}</span><strong>{money(result.payment)}</strong><small>{t('/ 月')}</small></div>
              <div><span>{t('新房每月支出')}</span><strong>{money(result.monthlyHousing)}</strong><small>{t('含输入的房产税、保险、HOA 和 PMI。')}</small></div>
            </div>
          </section>
          <div className="move-result-pair">
            <section className={`card move-stat ${result.netSale < 0 ? 'move-attention' : ''}`}>
              <h2>{t(result.netSale < 0 ? '卖房需补的金额' : '旧房净售款')}</h2>
              <strong className="move-net-sale">{money(Math.abs(result.netSale))}</strong>
              <p>{t('已扣旧贷款结清额和卖房费用。')}</p>
            </section>
            <section className={`card move-stat ${result.reserveGap > 0 ? 'move-attention' : ''}`}>
              <h2>{t(result.cashAfterMove < 0 ? '换房总资金缺口' : '交易后剩余现金')}</h2>
              <strong className="move-cash">{money(Math.abs(result.cashAfterMove))}</strong>
              {result.reserveGap > 0 && Number(values.reserve) > 0 && <p>{t('换房后还需补 {0} 才能达到设定的现金预留目标。', { 0: money(result.reserveGap) })}</p>}
            </section>
          </div>
          <section className="card move-stat move-total">
            <h2>{t('换房费用合计')}</h2>
            <strong className="move-total-cost">{money(result.moveCosts)}</strong>
            <p>{t('含卖房、买房过户、搬家、整修和重叠支出。预付款及托管存款另列。')}</p>
          </section>
          <section className="card move-ledger">
            <h2>{t('资金怎么分配')}</h2>
            <h3>{t('出售旧房')}</h3>
            {breakdown([
              ['预计旧房售价', Number(values.salePrice)], ['偿还旧贷款', -Number(values.payoff)],
              ['卖房按比例费用', -result.saleFees], ['其他卖房费用', -Number(values.otherSaleCosts)], ['旧房净售款', result.netSale],
            ])}
            <h3>{t('购买新房')}</h3>
            {breakdown([
              ['新房首付', result.downPayment], ['买房净过户费用', Number(values.closingCosts)],
              ['预付款与托管存款', Number(values.prepaids)], ['新房首付及过户用款', result.purchaseCash],
            ])}
            <h3>{t('搬家与过渡')}</h3>
            {breakdown([
              ['搬家及临时住宿', Number(values.movers)], ['新房整修预算', Number(values.repairs)],
              ['重叠持有费用', result.overlap], ['过渡支出合计', result.transitionCosts],
            ])}
            <h3>{t('可用现金与首付')}</h3>
            {breakdown([
              ['可用于换房的存款', Number(values.savings)], ['旧房净售款', result.netSale],
              ['新房首付及过户用款', -result.purchaseCash], ['过渡支出合计', -result.transitionCosts],
              ['交易后剩余现金', result.cashAfterMove], ['换房后保留现金', Number(values.reserve)],
              ['距离现金预留目标还差', result.reserveGap],
            ])}
          </section>
          <section className="card move-timing">
            <h2>{t('若先买后卖')}<InfoPopover label={t('若先买后卖')} description={t('假设首付、买房过户和全部过渡支出都在旧房款到账前支付，同时保留设定的现金。此金额用于估算资金时间差，已在换房预算内的费用只算一次。')} /></h2>
            <p>{t('卖房前额外资金需求')}</p>
            <strong className="move-pre-sale-gap">{money(result.preSaleGap)}</strong>
          </section>
        </>}
        <section className="card move-assumptions">
          <h2>{t('换房计算假设')}</h2>
          <p>{t('主结果假设旧房净售款可用于新房及换房支出。贷款按固定年利率和所选期限计算。请使用自己的买卖报价和贷款估算，过桥贷款利息可计入重叠支出。')}</p>
          <p>{t('贷款估算以页面显示的首付为前提。最低首付和 PMI 请按贷款方报价填写。')}</p>
          <a href="https://www.consumerfinance.gov/owning-a-home/loan-estimate/" target="_blank" rel="noopener noreferrer">{t('查看购房贷款费用说明')}</a>
        </section>
      </div>
    </div>
    {result && <div className="mobile-estimate move-mobile">
      <div><span>{t('预计新贷款')}</span><strong>{money(result.principal)}</strong></div>
      <button onClick={() => document.getElementById('move-results')?.scrollIntoView({ block: 'start' })}>{t('查看结果')}</button>
    </div>}
  </section>;
}
