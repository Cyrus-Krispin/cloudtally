# Contributing to cloudtally

Thanks for helping. Bug reports, new services, pricing fixes and design ideas are all welcome.

## Ways to help

- **Report a bug or a wrong price.** [Open an issue](https://github.com/Cyrus-Krispin/cloudtally/issues/new/choose) with the design (a share link is ideal) and what you expected.
- **Request a service.** Use the *Service request* issue form and say how it's billed.
- **Send a pull request.** For anything bigger than a small fix, open an issue first so we can agree on the approach.

Please be kind and constructive in issues and reviews.

## Development

You need Node.js 22 or later.

```bash
git clone https://github.com/Cyrus-Krispin/cloudtally.git
cd cloudtally
npm install
npm run dev        # app at http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the unit tests (Vitest) |
| `npx oxlint src` | Lints the code |
| `npm run build` | Type-checks and builds for production |
| `npm run prices` | Downloads current AWS prices into `src/engine/prices.generated.json` |

### Project layout

```
src/engine/              Cost engine, with no UI code
  prices.generated.json  AWS prices, written by scripts/fetch-prices.mjs
  compute.ts             Traffic flow through the diagram, and pricing
  scaling.ts             The same diagram priced from 1k to 10M users
  services/              One definition per service
src/components/          Canvas, sidebar, side panel, header, scaling view
src/store.ts             Diagram state, undo history and clipboard (zustand)
src/diagram.ts           Saved diagram format, used for files and share links
src/templates.ts         Starter designs
src/About.tsx            The /about page
src/assets/aws/          Official AWS service icons, named by service type
scripts/fetch-prices.mjs Reads the AWS Price List API
```

## Adding a service

1. **Prices.** Add the prices you need to `scripts/fetch-prices.mjs`, matching rows from the [AWS Price List Bulk API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api.html). Run `npm run prices` and check the new values against the AWS pricing page.
2. **Definition.** Add a `ServiceDef` in `src/engine/services/`. It needs a `type`, a label and category, `defaults` and `fields` for its settings, and a `lineItems(config, usage)` function that returns what it bills for. `usage` holds the requests, reads, writes and GB the service receives each month.
3. **Register it** in `src/engine/services/index.ts`. It then appears in the sidebar.
4. **Icon.** Copy the 48px SVG from the [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) package to `src/assets/aws/<type>.svg`.
5. **Tests.** Add a case to `src/engine/services.test.ts` that checks the cost against a value you worked out by hand.

Keep the side panel short: a few settings that change the price, with any explanation in the field's `help` text, which shows as a tooltip.

## Prices

Prices are never edited by hand. The weekly **Update prices** workflow runs `scripts/fetch-prices.mjs` and opens a pull request when a price changes. If the script can't find a price it fails rather than writing a zero, so a failed run usually means AWS changed a field name in its price files.

## Pull requests

- `main` is protected. Every change goes through a pull request, and the **Build and test** check (lint, tests and build) must pass.
- Pull requests are squash-merged, so the PR title becomes the commit message. Write it as a short summary in the imperative, such as "Add Kinesis Data Firehose".
- Each merge to `main` deploys to [cloudtally-one.vercel.app](https://cloudtally-one.vercel.app). Pull requests get a Vercel preview link you can share.
- For UI changes, include a screenshot.

## Design principles

- **Clean over clever.** No explanatory paragraphs in the UI; help lives in tooltips.
- **Show your working.** Every cost line can be traced to a quantity and a unit price.
- **Estimates, honestly labelled.** Simplify where it doesn't change the answer much, and say so in the docs.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
