import type { ServiceDef } from '../types'
import { ec2, fargate, lambda } from './compute'
import { dynamodb, elasticache, rds, s3 } from './data'
import { alb, apiGateway, clients, cloudfront, natGateway } from './network'
import { custom, sqs } from './other'

// To add a service, define a ServiceDef and list it here.
export const services: ServiceDef[] = [
  clients,
  cloudfront,
  apiGateway,
  alb,
  lambda,
  fargate,
  ec2,
  rds,
  dynamodb,
  elasticache,
  s3,
  sqs,
  natGateway,
  custom,
]

export const serviceByType: Record<string, ServiceDef> = Object.fromEntries(services.map((s) => [s.type, s]))
