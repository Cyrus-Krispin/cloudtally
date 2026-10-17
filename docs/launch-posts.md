# Launch posts (drafts)

Not posted yet. Links: https://cloudtally-one.vercel.app and https://github.com/Cyrus-Krispin/cloudtally

## Show HN

**Title**

Show HN: Cloudtally – Draw an AWS architecture and see its monthly cost live

**First comment**

I built cloudtally because architecture diagrams show what talks to what, but not what it costs. That usually shows up after launch, as a NAT Gateway or egress line nobody planned for.

You set your traffic (daily users, requests per user), drag in services and connect them. Traffic flows along each connection, and every service and connection is priced, including internet egress and cross-AZ transfer. A Scale view charts cost from 1k to 10M users.

- 18 AWS services, an LLM API, and a custom service with your own prices
- us-east-1 on-demand list prices from the AWS Price List API, refreshed weekly by a GitHub Action
- Runs in the browser, no sign-up. Share a design as a link or export a PNG

It's an estimate for comparing designs, not a quote: no free tier, savings plans or reserved pricing. MIT licensed, React + TypeScript.

I'd like to hear which services or pricing details you'd want next.

https://cloudtally-one.vercel.app
https://github.com/Cyrus-Krispin/cloudtally

## LinkedIn

I built cloudtally, a free tool for seeing what an AWS architecture costs while you draw it.

Drag services onto a canvas, connect them, set your traffic, and the monthly bill updates live, down to each service and connection. It also catches the usual surprises, like data transfer and NAT Gateway costs, and shows how the bill grows from 1k to 10M users.

Prices come from the AWS Price List API and refresh weekly. It's open source and runs in your browser, no sign-up.

Try it: https://cloudtally-one.vercel.app
Code: https://github.com/Cyrus-Krispin/cloudtally

Feedback welcome, especially on which services to add next.

## r/aws

**Title**

I made a free, open-source tool that prices an AWS architecture as you draw it

**Body**

cloudtally is a diagram tool where cost is part of the design. Set daily users and requests per user, drag in services, connect them, and the monthly cost updates live.

What it covers:

- Lambda, Fargate, EC2, API Gateway, CloudFront, ALB, NAT Gateway, RDS, Aurora Serverless v2, DynamoDB, ElastiCache, S3, SQS, SNS, EventBridge, Kinesis, Step Functions, Cognito
- Data transfer on each connection (internet egress, cross-AZ)
- A Scale view from 1k to 10M daily users, so you can see where options like Lambda and Fargate cross over

Prices are us-east-1 on-demand list prices from the Price List API, refreshed weekly. Free tiers, savings plans and reserved pricing aren't included, so treat it as a way to compare designs, not a quote.

No sign-up, runs in the browser, MIT licensed. If a price looks wrong or a service is missing, issues and PRs are welcome.

https://cloudtally-one.vercel.app
https://github.com/Cyrus-Krispin/cloudtally
