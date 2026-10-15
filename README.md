# cloudtally

Draw your AWS architecture and see what it costs, live, as you design it.

Drag services onto a canvas, connect them, and set your traffic (daily users and requests per user). Traffic flows through the diagram along the connections, and every service and connection is priced from it. Change the user count and the whole bill updates.

## Features

- Drag-and-drop canvas with 13 AWS services plus a custom service for anything else, such as a SaaS API
- A configuration panel for each service (memory, instance size, cache hit ratio, and more) with a line-by-line cost breakdown
- Connections that carry traffic: calls per request (fan-out), read or write, payload size, and network path (same AZ, cross-AZ, internet)
- Data transfer costs on connections, where surprise bills usually come from
- A live monthly total in the top bar, with a breakdown by service
- A scaling view (**Scale** in the top bar) that charts total and per-service cost from 1k to 10M daily users on a log scale, so you can see which services stay flat, which grow with traffic, and where options such as Lambda and Fargate cross over. Hover for the breakdown at any point, click to use that user count
- AWS always-free tier toggle, shared across services the way AWS applies it
- PNG export with the total and a per-service cost breakdown
- Autosave in the browser, plus JSON save and open

## How the cost model works

1. **Workload.** Monthly requests = daily users × requests per user per day × 30. This traffic starts at the **Users** node.
2. **Flow.** Each connection sends `calls per request × incoming requests` to the next service. CloudFront passes on only cache misses.
3. **Pricing.** Each service turns the traffic it receives into line items (requests, GB-seconds, instance-hours, and so on) priced from AWS list prices.
4. **Data transfer.** Connections charge for internet egress ($0.09/GB) and cross-AZ traffic ($0.02/GB). CloudFront prices its own egress.

Peak traffic (average × the peak multiplier) sizes autoscaling services like Fargate.

## Pricing data

Prices are us-east-1 on-demand list prices from the public [AWS Price List Bulk API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api.html), checked on 2026-10-15. They live in [`src/engine/prices.ts`](src/engine/prices.ts). Only the first pricing tier is used.

These are estimates for comparing designs, not a quote. Check the [AWS Pricing Calculator](https://calculator.aws/) before you commit to a budget.

## Development

```bash
npm install
npm run dev     # start the app at http://localhost:5173
npm test        # run cost engine tests
npm run build   # type-check and build for production
```

### Project layout

```
src/engine/            Cost engine with no UI dependencies
  prices.ts            AWS prices and free tier allowances
  compute.ts           Traffic flow through the graph, and pricing
  scaling.ts           The same diagram priced across a range of daily users
  services/            One definition per AWS service
src/components/        Canvas, palette, config panel, top bar
src/store.ts           Diagram state (zustand), autosaved to localStorage
src/exporting.ts       PNG and JSON export
```

### Adding a service

Create a `ServiceDef` in `src/engine/services/` with its settings (`fields`), defaults, and a `lineItems(config, usage)` function that returns what it bills for. Then add it to the list in `src/engine/services/index.ts`. It appears in the palette automatically.

## Built with

React, TypeScript, Vite, [React Flow](https://reactflow.dev), zustand, html-to-image, Vitest.

## License

MIT
