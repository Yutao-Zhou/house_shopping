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
- Recast simulation with lump-sum timing, a cash-paid fee, three repayment paths, a balance chart and CSV export
- Refinance simulation with a new fixed rate and term, cash or financed fees, holding-period net savings, debt-adjusted break-even and comparison CSV
- Up to three locally saved plans for comparison
- Yearly and monthly amortization schedules and CSV export
- English / 中文 throughout, including dates, help and CSV headers
- Light/dark mode with a bilingual header toggle, system preference on first visit, and a locally remembered manual choice
- Responsive layout with an always-visible estimate on mobile

## Data and assumptions

This is a static website. The calculator has no application server, account, database or third-party analytics. Inputs and saved plans stay in localStorage in the current browser. Sharing places calculation inputs after the `#` in the URL; anyone holding the link can inspect and restore them.

The model uses a fixed nominal annual interest rate with monthly payments. Tax, insurance, HOA and PMI inputs remain fixed; automatic PMI cancellation is not modeled. Extra payments start with the first payment and reduce principal, with the last payment capped at the outstanding balance plus interest. Daily interest, prepayment penalties, adjustable rates and tax deductions are not modeled. Recast and refinance are independent simulations. Example inputs are not market quotes; actual terms depend on lender documents.

The previous calculator remains available in Git history.
