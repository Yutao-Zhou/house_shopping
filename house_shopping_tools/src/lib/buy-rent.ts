import { amortize } from './mortgage.ts';

export type BuyRentInput = {
  price: number; downPercent: number; annualRate: number; loanYears: number; extra: number;
  annualTax: number; annualInsurance: number; monthlyHoa: number; monthlyPmi: number;
  monthlyRent: number; monthlyRenterInsurance: number; rentGrowth: number;
  homeGrowth: number; investmentReturn: number; costGrowth: number;
  maintenancePercent: number; purchaseCostPercent: number; sellingCostPercent: number; years: number;
};
export type BuyRentMonth = {
  month: number; homeValue: number; mortgageBalance: number; homeEquity: number; sellingCosts: number;
  buyerPortfolio: number; renterPortfolio: number; buyerNetWorth: number; renterNetWorth: number; difference: number;
  buyerHousingCost: number; renterHousingCost: number; buyerContribution: number; renterContribution: number;
  buyerContributed: number; renterContributed: number; buyerHousingPaid: number; renterHousingPaid: number;
  mortgagePayment: number; mortgagePrincipal: number; mortgageInterest: number;
};
export type BuyRentYear = BuyRentMonth & {
  year: number; annualBuyCost: number; annualRentCost: number; annualBuyInvestment: number; annualRentInvestment: number;
};

export function simulateBuyRent(input: BuyRentInput) {
  const { price, downPercent, annualRate, loanYears, extra, annualTax, annualInsurance, monthlyHoa, monthlyPmi, monthlyRent, monthlyRenterInsurance,
    rentGrowth, homeGrowth, investmentReturn, costGrowth, maintenancePercent, purchaseCostPercent, sellingCostPercent, years } = input;
  if (![price, downPercent, annualRate, loanYears, extra, annualTax, annualInsurance, monthlyHoa, monthlyPmi, monthlyRent, monthlyRenterInsurance, rentGrowth, homeGrowth, investmentReturn, costGrowth, maintenancePercent, purchaseCostPercent, sellingCostPercent, years].every(Number.isFinite)) throw new Error('invalid_buy_rent_inputs');
  if (price <= 0 || price > 100000000 || downPercent < 0 || downPercent > 100 || annualRate < 0 || annualRate > 30 || !Number.isInteger(loanYears) || loanYears < 1 || loanYears > 50) throw new Error('invalid_buy_rent_purchase');
  if ([extra, annualTax, annualInsurance, monthlyHoa, monthlyPmi, monthlyRent, monthlyRenterInsurance].some(value => value < 0 || value > 10000000) || [maintenancePercent, purchaseCostPercent, sellingCostPercent].some(value => value < 0 || value > 20)) throw new Error('invalid_buy_rent_costs');
  if ([rentGrowth, homeGrowth, costGrowth].some(value => value < -20 || value > 20) || investmentReturn < -99 || investmentReturn > 30) throw new Error('invalid_buy_rent_growth');
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new Error('invalid_buy_rent_horizon');

  const principal = price * (1 - downPercent / 100), downPayment = price - principal;
  const purchaseCosts = price * purchaseCostPercent / 100, initialCapital = downPayment + purchaseCosts;
  const mortgage = amortize({ principal, annualRate, years: loanYears, extra });
  const homeMonthly = Math.expm1(Math.log1p(homeGrowth / 100) / 12);
  const investmentMonthly = Math.expm1(Math.log1p(investmentReturn / 100) / 12);
  let homeValue = price, buyerPortfolio = 0, renterPortfolio = initialCapital;
  let buyerContributed = 0, renterContributed = initialCapital, buyerHousingPaid = 0, renterHousingPaid = 0;
  const clean = (value: number) => Math.abs(value) < 1e-7 ? 0 : value;
  const initialSaleCosts = price * sellingCostPercent / 100;
  const monthly: BuyRentMonth[] = [{ month: 0, homeValue: price, mortgageBalance: principal, homeEquity: downPayment, sellingCosts: initialSaleCosts,
    buyerPortfolio: 0, renterPortfolio, buyerNetWorth: downPayment - initialSaleCosts, renterNetWorth: renterPortfolio,
    difference: clean(downPayment - initialSaleCosts - renterPortfolio), buyerHousingCost: 0, renterHousingCost: 0,
    buyerContribution: 0, renterContribution: 0, buyerContributed, renterContributed, buyerHousingPaid: 0, renterHousingPaid: 0,
    mortgagePayment: 0, mortgagePrincipal: 0, mortgageInterest: 0 }];

  for (let month = 1; month <= years * 12; month++) {
    const elapsedYears = Math.floor((month - 1) / 12);
    const costMultiplier = (1 + costGrowth / 100) ** elapsedYears;
    const mortgageRow = mortgage.rows[month - 1];
    const maintenance = homeValue * maintenancePercent / 1200;
    const buyerHousingCost = (mortgageRow?.payment ?? 0) + (annualTax / 12 + annualInsurance / 12 + monthlyHoa) * costMultiplier + maintenance + (mortgageRow ? monthlyPmi : 0);
    const renterHousingCost = monthlyRent * (1 + rentGrowth / 100) ** elapsedYears + monthlyRenterInsurance * costMultiplier;
    // Both households have the same cash budget each month. Whichever spends
    // less on housing invests the difference; neither portfolio funds a deficit.
    const buyerContribution = Math.max(0, renterHousingCost - buyerHousingCost);
    const renterContribution = Math.max(0, buyerHousingCost - renterHousingCost);
    buyerPortfolio = buyerPortfolio * (1 + investmentMonthly) + buyerContribution;
    renterPortfolio = renterPortfolio * (1 + investmentMonthly) + renterContribution;
    buyerContributed += buyerContribution; renterContributed += renterContribution;
    buyerHousingPaid += buyerHousingCost; renterHousingPaid += renterHousingCost;
    homeValue *= 1 + homeMonthly;
    const mortgageBalance = mortgageRow?.balance ?? 0;
    const homeEquity = homeValue - mortgageBalance, sellingCosts = homeValue * sellingCostPercent / 100;
    const buyerNetWorth = homeEquity - sellingCosts + buyerPortfolio;
    monthly.push({ month, homeValue, mortgageBalance, homeEquity, sellingCosts, buyerPortfolio, renterPortfolio, buyerNetWorth,
      renterNetWorth: renterPortfolio, difference: clean(buyerNetWorth - renterPortfolio), buyerHousingCost, renterHousingCost,
      buyerContribution, renterContribution, buyerContributed, renterContributed, buyerHousingPaid, renterHousingPaid,
      mortgagePayment: mortgageRow?.payment ?? 0, mortgagePrincipal: mortgageRow?.principal ?? 0, mortgageInterest: mortgageRow?.interest ?? 0 });
  }
  const yearly: BuyRentYear[] = [];
  for (let year = 0; year <= years; year++) {
    const rows = year ? monthly.slice((year - 1) * 12 + 1, year * 12 + 1) : [];
    const sum = (key: 'buyerHousingCost' | 'renterHousingCost' | 'buyerContribution' | 'renterContribution') => rows.reduce((total, row) => total + row[key], 0);
    yearly.push({ ...monthly[year * 12], year, annualBuyCost: sum('buyerHousingCost'), annualRentCost: sum('renterHousingCost'), annualBuyInvestment: sum('buyerContribution'), annualRentInvestment: sum('renterContribution') });
  }
  return { monthly, yearly, final: yearly.at(-1)!, initialCapital, downPayment, purchaseCosts, principal, mortgage,
    firstMonth: monthly[1], buyerInvestmentGain: clean(buyerPortfolio - buyerContributed), renterInvestmentGain: clean(renterPortfolio - renterContributed) };
}
export type BuyRentResult = ReturnType<typeof simulateBuyRent>;
