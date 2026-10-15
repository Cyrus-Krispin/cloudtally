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
