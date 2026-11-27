import { costModeDefaults, resolveHousingCosts, type HousingCostSettings } from './annual-housing-cost.ts';
import { calculateHomeMove } from './home-move.ts';
import { amortize, type PaymentRow } from './mortgage.ts';

const maxDollars = 100_000_000;
export const schoolFields = {
  horizon: ['12', 1, 50, true],
  tuition: ['32000', 0, maxDollars],
  children: ['1', 1, 20, true],
  schoolYears: ['8', 0, 50, true],
  tuitionGrowth: ['4', -20, 30],
  publicSchool: ['1500', 0, maxDollars],
  currentPrice: ['1000000', .01, maxDollars],
  currentBalance: ['600000', 0, maxDollars],
  currentRate: ['3.25', 0, 30],
  currentMonths: ['300', 0, 600, true],
  currentOther: ['350', 0, maxDollars],
  currentGrowth: ['3', -20, 20],
  districtPrice: ['1350000', .01, maxDollars],
  districtDown: ['30', 0, 100],
  districtRate: ['6.25', 0, 30],
  districtTerm: ['30', 1, 50, true],
  districtOther: ['450', 0, maxDollars],
  districtGrowth: ['4', -20, 20],
  savings: ['150000', 0, maxDollars],
  sellRate: ['5', 0, 100],
  buyingCosts: ['25000', 0, maxDollars],
  movingCosts: ['8000', 0, maxDollars],
  holdingGrowth: ['2', -20, 20],
  investmentReturn: ['5', -99, 30],
  exitRate: ['5', 0, 100],
} satisfies Record<string, [string, number, number, boolean?]>;

export type SchoolField = keyof typeof schoolFields;
type SchoolNumbers = Record<SchoolField, number>;
export type SchoolSettings = Record<SchoolField, string> & {
  currentCosts: HousingCostSettings;
  districtCosts: HousingCostSettings;
};

export const schoolDefaults: SchoolSettings = {
  ...Object.fromEntries(Object.entries(schoolFields).map(([key, [value]]) => [key, value])) as Record<SchoolField, string>,
  currentCosts: { ...costModeDefaults, tax: '11000', insurance: '1800' },
  districtCosts: { ...costModeDefaults, tax: '14850', insurance: '2430' },
};

type Home = { price: number; balance: number; growth: number; operating: number; payments: PaymentRow[] };

function yearEnd(home: Home, year: number, exitRate: number, portfolio: number) {
  const homeValue = home.price * (1 + home.growth / 100) ** year;
  const mortgageBalance = year === 0 ? home.balance : home.payments[year * 12 - 1]?.balance ?? 0;
  const saleCosts = homeValue * exitRate / 100;
  const homeEquity = homeValue - mortgageBalance - saleCosts;
  return { homeValue, appreciation: homeValue - home.price, mortgageBalance, saleCosts, homeEquity,
    portfolio, netWorth: homeEquity + portfolio };
}

export function calculateSchoolComparison(values: SchoolSettings) {
  const input = {} as SchoolNumbers;
  for (const key of Object.keys(schoolFields) as SchoolField[]) {
    const [, min, max, whole] = schoolFields[key];
    const raw = values[key];
    const number = Number(raw);
    if (!raw.trim() || !Number.isFinite(number) || number < min || number > max || (whole && !Number.isInteger(number))) {
      throw new Error(key);
    }
    input[key] = number;
  }
  if (input.currentBalance > 0 && input.currentMonths === 0) throw new Error('currentTerm');
  const currentCosts = resolveHousingCosts(values.currentPrice, values.currentCosts, maxDollars);
  const districtCosts = resolveHousingCosts(values.districtPrice, values.districtCosts, maxDollars);
  if (!currentCosts || !districtCosts) throw new Error('housingCosts');

  const move = calculateHomeMove({
    salePrice: input.currentPrice, payoff: input.currentBalance, saleFeeRate: input.sellRate, otherSaleCosts: 0,
    buyPrice: input.districtPrice, closingCosts: input.buyingCosts, prepaids: 0, movers: input.movingCosts,
    repairs: 0, overlapMonths: 0, overlapMonthly: 0, savings: input.savings, reserve: 0,
    downMode: 'target', downPercent: input.districtDown, annualRate: input.districtRate,
    years: input.districtTerm, annualTax: districtCosts.tax, annualInsurance: districtCosts.insurance,
    monthlyHoa: input.districtOther, monthlyPmi: 0,
  });
  const currentMortgage = amortize({
    principal: input.currentBalance, annualRate: input.currentRate, years: (input.currentMonths || 1) / 12, extra: 0,
  });
  const districtMortgage = amortize({
    principal: move.principal, annualRate: input.districtRate, years: input.districtTerm, extra: 0,
  });
  const current: Home = { price: input.currentPrice, balance: input.currentBalance, growth: input.currentGrowth,
    operating: (currentCosts.tax + currentCosts.insurance) / 12 + input.currentOther, payments: currentMortgage.rows };
  const district: Home = { price: input.districtPrice, balance: move.principal, growth: input.districtGrowth,
    operating: (districtCosts.tax + districtCosts.insurance) / 12 + input.districtOther, payments: districtMortgage.rows };

  const netMoveCash = move.purchaseCash + move.transitionCosts - move.netSale;
  const cashGap = Math.max(0, -move.cashAfterMove);
  // If the move needs more cash, compare both branches with the same funded starting balance.
  const openingCash = input.savings + cashGap;
  let privatePortfolio = openingCash;
  let districtPortfolio = Math.max(0, move.cashAfterMove);
  let totalPrivateCash = 0, totalDistrictCash = netMoveCash;
  let totalPrivateExpense = 0, totalDistrictExpense = move.moveCosts;
  const monthlyReturn = (1 + input.investmentReturn / 100) ** (1 / 12);
  const yearly = [{
    year: 0, privateOutflow: 0, districtOutflow: 0, tuition: 0, publicSchool: 0,
    totalPrivateCash, totalDistrictCash, totalPrivateExpense, totalDistrictExpense,
    private: yearEnd(current, 0, input.exitRate, privatePortfolio),
    district: yearEnd(district, 0, input.exitRate, districtPortfolio),
  }];
  let firstMonth = { privateHousing: 0, districtHousing: 0, tuition: 0, publicSchool: 0 };
  for (let year = 1; year <= input.horizon; year++) {
    const enrolled = year <= input.schoolYears;
    const tuition = enrolled ? input.tuition * input.children * (1 + input.tuitionGrowth / 100) ** (year - 1) : 0;
    const publicSchool = enrolled ? input.publicSchool * input.children : 0;
    const costGrowth = (1 + input.holdingGrowth / 100) ** (year - 1);
    const privateOperating = current.operating * costGrowth + tuition / 12;
    const districtOperating = district.operating * costGrowth + publicSchool / 12;
    let privateOutflow = 0, districtOutflow = 0;

    for (let month = (year - 1) * 12; month < year * 12; month++) {
      const privatePayment = current.payments[month], districtPayment = district.payments[month];
      const privateCash = privateOperating + (privatePayment?.payment ?? 0);
      const districtCash = districtOperating + (districtPayment?.payment ?? 0);
      privateOutflow += privateCash;
      districtOutflow += districtCash;
      totalPrivateExpense += privateOperating + (privatePayment?.interest ?? 0);
      totalDistrictExpense += districtOperating + (districtPayment?.interest ?? 0);
      // Equal monthly budgets let the side with lower outflow invest the difference.
      privatePortfolio = privatePortfolio * monthlyReturn + Math.max(0, districtCash - privateCash);
      districtPortfolio = districtPortfolio * monthlyReturn + Math.max(0, privateCash - districtCash);
      if (month === 0) firstMonth = { privateHousing: privateCash - tuition / 12,
        districtHousing: districtCash - publicSchool / 12, tuition: tuition / 12, publicSchool: publicSchool / 12 };
    }
    totalPrivateCash += privateOutflow;
    totalDistrictCash += districtOutflow;
    yearly.push({ year, privateOutflow, districtOutflow, tuition, publicSchool,
      totalPrivateCash, totalDistrictCash, totalPrivateExpense, totalDistrictExpense,
      private: yearEnd(current, year, input.exitRate, privatePortfolio),
      district: yearEnd(district, year, input.exitRate, districtPortfolio) });
  }
  return { yearly, final: yearly[yearly.length - 1], firstMonth, move, netMoveCash, cashGap, openingCash };
}

export type SchoolComparison = ReturnType<typeof calculateSchoolComparison>;
