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
