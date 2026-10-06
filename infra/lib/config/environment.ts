import { isDeepStrictEqual } from 'node:util';

export type EnvironmentName = 'staging' | 'production';

export interface DynamoDBLifecycleConfig {
  readonly pointInTimeRecovery: boolean;
  readonly deletionProtection: boolean;
  readonly removalPolicy: 'DESTROY' | 'RETAIN';
}

const DATA_LIFECYCLE: Readonly<Record<EnvironmentName, DynamoDBLifecycleConfig>> = Object.freeze({
  staging: Object.freeze({ pointInTimeRecovery: false, deletionProtection: false, removalPolicy: 'DESTROY' }),
  production: Object.freeze({ pointInTimeRecovery: true, deletionProtection: true, removalPolicy: 'RETAIN' }),
});

export interface HireFluxEnvironmentConfig {
  readonly environmentName: EnvironmentName;
  readonly stackName: string;
  readonly resourceNamePrefix: string;
  readonly awsRegion: string;
  readonly awsAccount: string | undefined;
  readonly data: DynamoDBLifecycleConfig;
  readonly backend: Readonly<{
    authMode: 'demo' | 'cognito';
    secretRemovalPolicy: 'DESTROY' | 'RETAIN';
    cors: DeployedCorsPolicy;
  }>;
  readonly tags: Readonly<{
    Project: 'HireFlux';
    Environment: EnvironmentName;
    ManagedBy: 'AWS-CDK';
  }>;
}

export interface DeployedCorsPolicy {
  readonly allowOrigins: readonly string[];
  readonly allowMethods: readonly ('GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS')[];
  readonly allowHeaders: readonly string[];
  readonly exposeHeaders: readonly string[];
  readonly allowCredentials: false;
}

const CORS_METHODS = Object.freeze(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] as const);
const CORS_HEADERS = Object.freeze(['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-ID']);
const CORS_EXPOSE = Object.freeze(['X-Request-ID', 'Content-Disposition']);

function backendConfig(environment: EnvironmentName): HireFluxEnvironmentConfig['backend'] {
  return Object.freeze({
    authMode: environment === 'staging' ? 'demo' : 'cognito',
    secretRemovalPolicy: environment === 'staging' ? 'DESTROY' : 'RETAIN',
    cors: Object.freeze({
      allowOrigins: Object.freeze([`https://${environment}.invalid`]),
      allowMethods: CORS_METHODS, allowHeaders: CORS_HEADERS, exposeHeaders: CORS_EXPOSE,
      allowCredentials: false,
    }),
  });
}

export const AWS_REGION = 'us-east-1';

export function resolveEnvironment(value: unknown): EnvironmentName {
  if (value !== 'staging' && value !== 'production') {
    throw new Error('Select an explicit environment: staging or production (-c environment=...).');
  }
  return value;
}

function resolveAccount(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{12}$/.test(value)) {
    throw new Error('An explicit AWS account binding must be a 12-digit string.');
  }
  return value;
}

export function loadEnvironmentConfig(
  selection: unknown,
  accountBinding: unknown = undefined,
): HireFluxEnvironmentConfig {
  const environmentName = resolveEnvironment(selection);
  const config: HireFluxEnvironmentConfig = Object.freeze({
    environmentName,
    stackName: `hireflux-${environmentName}`,
    resourceNamePrefix: `hireflux-${environmentName}`,
    awsRegion: AWS_REGION,
    awsAccount: resolveAccount(accountBinding),
    data: DATA_LIFECYCLE[environmentName],
    backend: backendConfig(environmentName),
    tags: Object.freeze({
      Project: 'HireFlux',
      Environment: environmentName,
      ManagedBy: 'AWS-CDK',
    }),
  });
  validateEnvironmentConfig(config);
  return config;
}

export function validateEnvironmentConfig(config: HireFluxEnvironmentConfig): void {
  const environmentName = resolveEnvironment(config.environmentName);
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(config.awsRegion)) {
    throw new Error('AWS region must be a valid region identifier.');
  }
  // Changing the canonical region is a reviewed source change, not a profile override.
  if (config.awsRegion !== AWS_REGION) {
    throw new Error(`HireFlux staging and production must use ${AWS_REGION}.`);
  }
  if (config.stackName !== `hireflux-${environmentName}`) {
    throw new Error('Stack name must match the selected HireFlux environment.');
  }
  if (config.resourceNamePrefix !== `hireflux-${environmentName}`) {
    throw new Error('Resource name prefix must match the selected HireFlux environment.');
  }
  resolveAccount(config.awsAccount);
  if (!isDeepStrictEqual(config.backend, backendConfig(environmentName))) {
    throw new Error('Backend auth, secret lifecycle and sentinel CORS must match the selected environment.');
  }
  const lifecycle = DATA_LIFECYCLE[environmentName];
  if (
    config.data === undefined ||
    config.data.pointInTimeRecovery !== lifecycle.pointInTimeRecovery ||
    config.data.deletionProtection !== lifecycle.deletionProtection ||
    config.data.removalPolicy !== lifecycle.removalPolicy
  ) {
    throw new Error('DynamoDB lifecycle must match the selected environment.');
  }
  if (
    config.tags.Project !== 'HireFlux' ||
    config.tags.Environment !== environmentName ||
    config.tags.ManagedBy !== 'AWS-CDK'
  ) {
    throw new Error('Common tags must match the project and selected environment.');
  }
}
