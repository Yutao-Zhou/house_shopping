# Nestwise · 栖算

A bilingual fixed-rate mortgage planner, published at **https://yutaozhou.com/house_shopping/**.

The app lives in [`house_shopping_tools`](./house_shopping_tools). English is the default language; the language switch remembers your preference in this browser.

## Develop

Requires Node.js 22.13 or newer.

```sh
cd house_shopping_tools
npm ci
npm run dev
```

Open the printed local URL at `/house_shopping/`.

## Validate and publish

```sh
cd house_shopping_tools
npm test
npm run build
npm run deploy
```

`npm run deploy` builds the app and publishes the static `build/` folder to the existing `gh-pages` branch. A GitHub login with write access to this repository is required. GitHub Pages continues to publish from `gh-pages` at `/`, using the account's existing custom domain. The Vite base path is `/house_shopping/`.

## Features

- Home price and down payment, or a direct loan amount
- Fixed-rate principal and interest, optional tax, insurance, HOA and PMI estimates
- Extra monthly principal payments and estimated interest savings
- Balance and annual payment mix charts
- Up to three locally saved plans for comparison
- Yearly and monthly amortization schedules and CSV export
- English / 中文 throughout, including dates, help and CSV headers
- Light/dark mode with a bilingual header toggle, system preference on first visit, and a locally remembered manual choice
- Responsive layout with an always-visible estimate on mobile

## Data and assumptions

This is a static website. The calculator has no application server, account, database or third-party analytics. Inputs and saved plans stay in localStorage in the current browser. Sharing places calculation inputs after the `#` in the URL; anyone holding the link can inspect and restore them.

The model uses a fixed nominal annual interest rate with monthly payments. Tax, insurance, HOA and PMI inputs remain fixed; automatic PMI cancellation is not modeled. Extra payments start with the first payment and reduce principal, with the last payment capped at the outstanding balance plus interest. Daily interest, prepayment penalties, adjustable rates and tax deductions are not modeled. Recast and refinance are independent simulations. Example inputs are not market quotes; actual terms depend on lender documents.

The previous calculator remains available in Git history.

## Recast simulator

Open **Recast** in the navigation. Using the calculator's loan details, choose how many payments occur before the event (0 means before the first payment), a one-time principal reduction and a cash-paid recast fee. The simulator compares the unchanged plan, the same principal reduction without recasting, and recasting over the original remaining contractual term at the same rate.

Existing monthly extra principal continues in all scenarios. The selected month's regular payment and extra principal occur before the lump sum. The recalculated payment starts the following month. Fees are not financed. Interest and total cash outflow include the complete loan history; principal is counted once. Recast has a separate comparison chart, monthly ledger and CSV export, and its inputs persist locally and in share links.

The model assumes servicer approval and does not enforce lender-specific minimum reductions or processing delays. Recurring homeownership costs stay fixed; PMI is not canceled before the modeled loan payoff. Full-payoff cases retain any fee the user entered, as explicitly labeled in the interface.

## Refinance simulator

Open **Refinance** or `#view=refinance`. Choose the number of original payments before refinancing (0 means before the first payment), a new fixed annual rate, a new term in months, net closing costs, whether to finance those costs, and a loan holding period. The balance after the selected original payment and extra principal becomes the new starting balance. The new loan's first payment occurs the following month. The same monthly extra principal continues on both paths. Match remaining term preserves the original contractual maturity when there are no extra payments.

All refinance totals exclude interest and payments before the event. Cash-paid costs are paid at closing; financed costs increase the new principal and accrue interest, with no duplicate charge. Net savings at a holding period compare cumulative cash outflows **plus remaining debt** on both paths. This prevents a term extension from being mistaken for savings just because it lowers the monthly payment. Debt-adjusted break-even is the first post-refinance month with nonnegative net savings; savings can later reverse. With zero fees, the UI reports that there are no fees to recover, regardless of whether refinancing has a long-term benefit.

The comparison schedule includes a closing row, both loans' payments and balances, and cumulative net savings. CSV additionally separates new-loan interest, principal, extra principal and cash fees. Share links and local storage retain refinance inputs. The model excludes cash-out, additional cash-in, daily payoff interest, escrow/prepaid deposits, tax effects and opportunity cost. It retains the calculator's monthly homeownership costs and PMI assumption. Eligibility and actual closing terms are determined by the lender.

## Buy vs Rent simulator

Open **Buy vs Rent** or `#view=buy-rent`. The page shares purchase-price, down-payment, fixed-rate loan, extra-principal and running-cost inputs with the mortgage calculator, but always includes its displayed cost inputs independently of the calculator's cost toggle. It uses purchase price and down payment rather than the direct loan-amount mode. The comparison does not combine recast or refinance events.

Both households start with cash equal to the down payment plus cash-paid purchase closing costs. The buyer spends it on the purchase; the renter invests it. Each month, a common budget equals the greater of the two housing cash outflows, and the lower-cost household invests the difference at month-end. This is a comparison with equal cash budgets, not an income or affordability estimate. Both portfolios use the same assumed effective annual return, converted to a monthly compound rate. Enter returns after investment fees.

Owning cash outflows include the actual mortgage payment and extra principal, property tax, home insurance, HOA, maintenance, and fixed monthly PMI while the loan remains payable. Maintenance is an annual percentage of each month's opening home value, divided by 12. Rent grows at annual anniversaries; tax, insurance, HOA and renters insurance use a separate annual running-cost growth rate. Home appreciation compounds monthly. Mortgage payments and PMI stop after payoff, while other ownership costs continue.

At every annual horizon, buyer net worth is the projected home value minus remaining debt and one hypothetical sale cost, plus the buyer's investment portfolio. Renter net worth is the renter portfolio. Selling costs do not repeatedly reduce the home value. Only wealth attributable to this decision is compared, in nominal future dollars and before taxes. Tax deductions, capital-gains or investment taxes, deposits, moving, renovations and utility differences are excluded. Values are assumptions, not market quotes or guaranteed returns. Annual CSV includes costs, contributions, mortgage balance, both portfolios and sale-adjusted net worth; inputs persist in local storage and share links.
