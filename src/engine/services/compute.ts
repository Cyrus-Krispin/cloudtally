import { HOURS_PER_MONTH, prices } from '../prices'
import type { ServiceDef } from '../types'
import { num, options, str } from './util'

const arch = [
  { value: 'x86', label: 'x86_64' },
  { value: 'arm', label: 'Arm (Graviton)' },
]

export const lambda: ServiceDef = {
  type: 'lambda',
  label: 'Lambda',
  color: '#ED7100',
  category: 'Compute',
  description: 'Serverless functions billed per request and per GB-second.',
  defaults: { memoryMB: 512, durationMs: 120, arch: 'arm' },
  fields: [
    { key: 'memoryMB', label: 'Memory', type: 'number', min: 128, max: 10240, step: 64, unit: 'MB' },
    { key: 'durationMs', label: 'Average duration', type: 'number', min: 1, step: 10, unit: 'ms' },
    { key: 'arch', label: 'Architecture', type: 'select', options: arch },
  ],
  lineItems: (c, u) => {
    const gbSeconds = u.requests * (num(c, 'durationMs') / 1000) * (num(c, 'memoryMB') / 1024)
    const a = str(c, 'arch') === 'x86' ? 'x86' : 'arm'
    return [
      { label: 'Requests', quantity: u.requests, unit: 'requests', unitPrice: prices.lambda.perRequest, freeTierKey: 'lambda.requests' },
      { label: 'Compute', quantity: gbSeconds, unit: 'GB-seconds', unitPrice: prices.lambda.perGbSecond[a], freeTierKey: 'lambda.gbSeconds' },
    ]
  },
}

export const fargate: ServiceDef = {
  type: 'fargate',
  label: 'ECS Fargate',
  color: '#ED7100',
  category: 'Compute',
  description: 'Containers billed per vCPU-hour and GB-hour while tasks run.',
  defaults: { vcpu: '0.5', memoryGB: 1, minTasks: 2, rpsPerTask: 100, arch: 'x86' },
  fields: [
    { key: 'vcpu', label: 'vCPU per task', type: 'select', options: options(['0.25', '0.5', '1', '2', '4', '8', '16']) },
    { key: 'memoryGB', label: 'Memory per task', type: 'number', min: 0.5, step: 0.5, unit: 'GB' },
    { key: 'minTasks', label: 'Minimum tasks', type: 'number', min: 0, step: 1 },
    {
      key: 'rpsPerTask',
      label: 'Requests/sec one task handles',
      type: 'number',
      min: 0,
      step: 10,
      help: 'Tasks scale out to handle peak traffic. Set to 0 to always run the minimum.',
    },
    { key: 'arch', label: 'Architecture', type: 'select', options: arch },
  ],
  assumptions: () => ['Runs enough tasks for peak traffic all month (conservative).'],
  lineItems: (c, u) => {
    const capacity = num(c, 'rpsPerTask')
    const tasks = Math.max(num(c, 'minTasks'), capacity > 0 ? Math.ceil(u.peakRps / capacity) : 0)
    const a = str(c, 'arch') === 'arm' ? 'arm' : 'x86'
    const taskHours = tasks * HOURS_PER_MONTH
    return [
      { label: `vCPU (${tasks} tasks)`, quantity: taskHours * num(c, 'vcpu'), unit: 'vCPU-hours', unitPrice: prices.fargate.perVcpuHour[a] },
      { label: `Memory (${tasks} tasks)`, quantity: taskHours * num(c, 'memoryGB'), unit: 'GB-hours', unitPrice: prices.fargate.perGbHour[a] },
    ]
  },
}

export const ec2: ServiceDef = {
  type: 'ec2',
  label: 'EC2',
  color: '#ED7100',
  category: 'Compute',
  description: 'Virtual machines billed per instance-hour, plus EBS storage.',
  defaults: { instanceType: 't3.medium', count: 2, ebsGB: 30 },
  fields: [
    { key: 'instanceType', label: 'Instance type', type: 'select', options: options(Object.keys(prices.ec2.perHour)) },
    { key: 'count', label: 'Instances', type: 'number', min: 0, step: 1 },
    { key: 'ebsGB', label: 'EBS gp3 per instance', type: 'number', min: 0, step: 10, unit: 'GB' },
  ],
  assumptions: () => ['Linux, on-demand, running all month.'],
  lineItems: (c) => {
    const count = num(c, 'count')
    const type = str(c, 'instanceType')
    return [
      { label: `${count} × ${type}`, quantity: count * HOURS_PER_MONTH, unit: 'instance-hours', unitPrice: prices.ec2.perHour[type] ?? 0 },
      { label: 'EBS gp3 storage', quantity: count * num(c, 'ebsGB'), unit: 'GB-months', unitPrice: prices.ec2.ebsGp3PerGbMonth },
    ]
  },
}
