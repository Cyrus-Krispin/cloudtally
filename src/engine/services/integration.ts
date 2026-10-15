import { HOURS_PER_MONTH, prices } from '../prices'
import type { ServiceDef, Usage } from '../types'
import { num, str } from './util'

/** Average payload in KB across the traffic a service receives. */
const avgKB = (u: Usage) => (u.requests > 0 ? (u.gb * 1024 * 1024) / u.requests : 0)

/** Number of 64 KB chunks each message is billed as. */
const chunks64 = (u: Usage) => Math.max(1, Math.ceil(avgKB(u) / 64))

export const sns: ServiceDef = {
  type: 'sns',
  label: 'SNS',
  color: '#E7157B',
  category: 'Messaging',
  description: 'Pub/sub topics billed per publish and per HTTP or email delivery.',
  defaults: { httpSubscribers: 0, emailSubscribers: 0 },
  fields: [
    { key: 'httpSubscribers', label: 'HTTP/S subscribers', type: 'number', min: 0, step: 1, help: 'Deliveries to SQS and Lambda are free. Draw those as connections.' },
    { key: 'emailSubscribers', label: 'Email subscribers', type: 'number', min: 0, step: 1 },
  ],
  lineItems: (c, u) => [
    { label: 'Publishes', quantity: u.requests * chunks64(u), unit: 'requests', unitPrice: prices.sns.perRequest },
    { label: 'HTTP deliveries', quantity: u.requests * num(c, 'httpSubscribers'), unit: 'deliveries', unitPrice: prices.sns.perHttpDelivery },
    { label: 'Email deliveries', quantity: u.requests * num(c, 'emailSubscribers'), unit: 'deliveries', unitPrice: prices.sns.perEmailDelivery },
  ],
}

export const eventbridge: ServiceDef = {
  type: 'eventbridge',
  label: 'EventBridge',
  color: '#E7157B',
  category: 'Messaging',
  description: 'Event bus billed per custom event, in 64 KB chunks.',
  defaults: {},
  fields: [],
  lineItems: (_c, u) => [{ label: 'Custom events', quantity: u.requests * chunks64(u), unit: 'events', unitPrice: prices.eventbridge.perEvent }],
}

export const kinesis: ServiceDef = {
  type: 'kinesis',
  label: 'Kinesis Data Streams',
  color: '#8C4FFF',
  category: 'Messaging',
  description: 'On-demand data streams billed per stream-hour and per GB in and out.',
  defaults: { streams: 1, consumers: 1 },
  fields: [
    { key: 'streams', label: 'Streams', type: 'number', min: 1, step: 1 },
    { key: 'consumers', label: 'Consumers', type: 'number', min: 0, step: 1, help: 'Each consumer reads every record once.' },
  ],
  lineItems: (c, u) => [
    { label: 'Stream hours', quantity: num(c, 'streams') * HOURS_PER_MONTH, unit: 'stream-hours', unitPrice: prices.kinesis.perStreamHour },
    { label: 'Data in', quantity: u.gb, unit: 'GB', unitPrice: prices.kinesis.perGbIn },
    { label: 'Data out', quantity: u.gb * num(c, 'consumers'), unit: 'GB', unitPrice: prices.kinesis.perGbOut },
  ],
}

export const stepFunctions: ServiceDef = {
  type: 'stepfunctions',
  label: 'Step Functions',
  color: '#E7157B',
  category: 'Compute',
  description: 'Workflows billed per state transition (Standard) or per request and duration (Express).',
  defaults: { workflowType: 'standard', transitions: 5, durationMs: 500, memoryMB: 64 },
  fields: [
    {
      key: 'workflowType',
      label: 'Workflow type',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'express', label: 'Express' },
      ],
    },
    { key: 'transitions', label: 'State transitions per run', type: 'number', min: 1, step: 1, help: 'Standard workflows only.' },
    { key: 'durationMs', label: 'Average duration', type: 'number', min: 1, step: 100, unit: 'ms', help: 'Express workflows only.' },
    { key: 'memoryMB', label: 'Memory', type: 'number', min: 64, step: 64, unit: 'MB', help: 'Express workflows only. Billed in 64 MB steps.' },
  ],
  lineItems: (c, u) => {
    if (str(c, 'workflowType') === 'express') {
      const memoryGB = (Math.ceil(Math.max(num(c, 'memoryMB'), 64) / 64) * 64) / 1024
      return [
        { label: 'Requests', quantity: u.requests, unit: 'requests', unitPrice: prices.stepFunctions.expressPerRequest },
        { label: 'Duration', quantity: u.requests * (num(c, 'durationMs') / 1000) * memoryGB, unit: 'GB-seconds', unitPrice: prices.stepFunctions.expressPerGbSecond },
      ]
    }
    return [{ label: 'State transitions', quantity: u.requests * num(c, 'transitions'), unit: 'transitions', unitPrice: prices.stepFunctions.perStateTransition }]
  },
}
