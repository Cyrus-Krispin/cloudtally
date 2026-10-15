import type { ServiceDef } from '../types'
import { ec2, fargate, lambda } from './compute'
import { aurora, dynamodb, elasticache, rds, s3 } from './data'
import { eventbridge, kinesis, sns, stepFunctions } from './integration'
import { alb, apiGateway, clients, cloudfront, natGateway } from './network'
import { cognito, custom, llm, sqs } from './other'

// To add a service, define a ServiceDef and list it here.
export const services: ServiceDef[] = [
  clients,
  cloudfront,
  apiGateway,
  alb,
  lambda,
  fargate,
  ec2,
  stepFunctions,
  rds,
  aurora,
  dynamodb,
  elasticache,
  s3,
  sqs,
  sns,
  eventbridge,
  kinesis,
  natGateway,
  cognito,
  llm,
  custom,
]

export const serviceByType: Record<string, ServiceDef> = Object.fromEntries(services.map((s) => [s.type, s]))
