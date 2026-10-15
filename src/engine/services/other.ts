import { prices } from '../prices'
import type { ServiceDef } from '../types'
import { num, str } from './util'

export const sqs: ServiceDef = {
  type: 'sqs',
  label: 'SQS',
  color: '#E7157B',
  category: 'Messaging',
  description: 'Message queue billed per request.',
  defaults: { queueType: 'standard', requestsPerMessage: 3 },
  fields: [
    {
      key: 'queueType',
      label: 'Queue type',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'fifo', label: 'FIFO' },
      ],
    },
    {
      key: 'requestsPerMessage',
      label: 'API requests per message',
      type: 'number',
      min: 1,
      step: 1,
      help: 'Usually 3: send, receive and delete.',
    },
  ],
  lineItems: (c, u) => [
    {
      label: 'Requests',
      quantity: u.requests * num(c, 'requestsPerMessage'),
      unit: 'requests',
      unitPrice: prices.sqs.perRequest[str(c, 'queueType') === 'fifo' ? 'fifo' : 'standard'],
    },
  ],
}

export const cognito: ServiceDef = {
  type: 'cognito',
  label: 'Cognito',
  color: '#DD344C',
  category: 'Security',
  description: 'User sign-up and sign-in billed per monthly active user.',
  defaults: { tier: 'essentials', monthlyActiveUsers: 10_000 },
  fields: [
    {
      key: 'tier',
      label: 'Tier',
      type: 'select',
      options: [
        { value: 'lite', label: 'Lite' },
        { value: 'essentials', label: 'Essentials' },
        { value: 'plus', label: 'Plus' },
      ],
    },
    { key: 'monthlyActiveUsers', label: 'Monthly active users', type: 'number', min: 0, step: 1000 },
  ],
  lineItems: (c) => {
    const tier = str(c, 'tier') as keyof typeof prices.cognito.perMau
    return [
      { label: 'Active users', quantity: num(c, 'monthlyActiveUsers'), unit: 'MAU', unitPrice: prices.cognito.perMau[tier] ?? prices.cognito.perMau.essentials },
    ]
  },
}

export const llm: ServiceDef = {
  type: 'llm',
  label: 'LLM API',
  color: '#232F3E',
  category: 'AI',
  description: 'A hosted language model billed per input and output token.',
  defaults: { inputTokens: 1000, outputTokens: 300, inputPricePerM: 3, outputPricePerM: 15 },
  fields: [
    { key: 'inputTokens', label: 'Input tokens per call', type: 'number', min: 0, step: 100 },
    { key: 'outputTokens', label: 'Output tokens per call', type: 'number', min: 0, step: 50 },
    { key: 'inputPricePerM', label: 'Input price per million tokens', type: 'number', min: 0, step: 0.05, unit: '$', help: "Use your model's current list price." },
    { key: 'outputPricePerM', label: 'Output price per million tokens', type: 'number', min: 0, step: 0.05, unit: '$', help: "Use your model's current list price." },
  ],
  lineItems: (c, u) => [
    { label: 'Input tokens', quantity: u.requests * num(c, 'inputTokens'), unit: 'tokens', unitPrice: num(c, 'inputPricePerM') / 1e6 },
    { label: 'Output tokens', quantity: u.requests * num(c, 'outputTokens'), unit: 'tokens', unitPrice: num(c, 'outputPricePerM') / 1e6 },
  ],
}

export const custom: ServiceDef = {
  type: 'custom',
  label: 'Custom service',
  color: '#232F3E',
  category: 'Other',
  description: 'Anything else, such as a SaaS API. Set a fixed monthly price and a per-request price.',
  defaults: { monthlyFixed: 0, perMillionRequests: 0 },
  fields: [
    { key: 'monthlyFixed', label: 'Fixed monthly cost', type: 'number', min: 0, step: 5, unit: '$' },
    { key: 'perMillionRequests', label: 'Price per million requests', type: 'number', min: 0, step: 0.1, unit: '$' },
  ],
  lineItems: (c, u) => [
    { label: 'Fixed', quantity: 1, unit: 'month', unitPrice: num(c, 'monthlyFixed') },
    { label: 'Requests', quantity: u.requests, unit: 'requests', unitPrice: num(c, 'perMillionRequests') / 1e6 },
  ],
}
