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
- Responsive layout with an always-visible estimate on mobile

## Data and assumptions

This is a static website. The calculator has no application server, account, database or third-party analytics. Inputs and saved plans stay in localStorage in the current browser. Sharing places calculation inputs after the `#` in the URL; anyone holding the link can inspect and restore them.

The model uses a fixed nominal annual interest rate with monthly payments. Tax, insurance, HOA and PMI inputs remain fixed; automatic PMI cancellation is not modeled. Extra payments start with the first payment and reduce principal, with the last payment capped at the outstanding balance plus interest. Daily interest, prepayment penalties, adjustable rates, tax deductions and refinancing are not modeled. Example inputs are not market quotes; actual terms depend on lender documents.

The previous calculator remains available in Git history.

## Recast simulator

Open **Recast** in the navigation. Using the calculator's loan details, choose how many payments occur before the event (0 means before the first payment), a one-time principal reduction and a cash-paid recast fee. The simulator compares the unchanged plan, the same principal reduction without recasting, and recasting over the original remaining contractual term at the same rate.

Existing monthly extra principal continues in all scenarios. The selected month's regular payment and extra principal occur before the lump sum. The recalculated payment starts the following month. Fees are not financed. Interest and total cash outflow include the complete loan history; principal is counted once. Recast has a separate comparison chart, monthly ledger and CSV export, and its inputs persist locally and in share links.

The model assumes servicer approval and does not enforce lender-specific minimum reductions or processing delays. Recurring homeownership costs stay fixed; PMI is not canceled before the modeled loan payoff. Full-payoff cases retain any fee the user entered, as explicitly labeled in the interface.
