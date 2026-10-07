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
  readonly operations: Readonly<{
    lambdaLogRetentionDays: 14 | 30;
    apiLogRetentionDays: 14 | 30;
    logRemovalPolicy: 'DESTROY' | 'RETAIN';
    apiThrottleRate: number;
    apiThrottleBurst: number;
    lambdaReservedConcurrency: number;
    monthlyBudgetUsd: number;
  }>;
  readonly backend: Readonly<{
    authMode: 'demo' | 'cognito';
    secretRemovalPolicy: 'DESTROY' | 'RETAIN';
    cors: DeployedCorsPolicy;
  }>;
  readonly hosting: Readonly<{
    repositoryUrl: string;
    sourceBranch: string;
    stage: 'BETA' | 'PRODUCTION';
    autoBuild: boolean;
    appRoot: 'frontend';
    workspaceMode: 'demo';
  }>;
  readonly tags: Readonly<{
    Project: 'HireFlux';
    Environment: EnvironmentName;
    ManagedBy: 'AWS-CDK';
  }>;
}

export interface DeployedCorsPolicy {
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
      allowMethods: CORS_METHODS, allowHeaders: CORS_HEADERS, exposeHeaders: CORS_EXPOSE,
      allowCredentials: false,
    }),
  });
}

export const AWS_REGION = 'us-east-1';

function operationsConfig(environment: EnvironmentName): HireFluxEnvironmentConfig['operations'] {
  return Object.freeze(environment === 'staging' ? {
    lambdaLogRetentionDays: 14, apiLogRetentionDays: 14, logRemovalPolicy: 'DESTROY',
    apiThrottleRate: 10, apiThrottleBurst: 20, lambdaReservedConcurrency: 5, monthlyBudgetUsd: 10,
  } : {
    lambdaLogRetentionDays: 30, apiLogRetentionDays: 30, logRemovalPolicy: 'RETAIN',
    apiThrottleRate: 20, apiThrottleBurst: 40, lambdaReservedConcurrency: 10, monthlyBudgetUsd: 30,
  });
}

function hostingConfig(environment: EnvironmentName): HireFluxEnvironmentConfig['hosting'] {
  return Object.freeze({
    repositoryUrl: 'https://github.com/xiolest1/HireFlux', sourceBranch: 'main',
    stage: environment === 'staging' ? 'BETA' : 'PRODUCTION',
    autoBuild: environment === 'staging', appRoot: 'frontend', workspaceMode: 'demo',
  });
}

export function validateSourceBranch(branch: string): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(branch) || branch.length > 63) {
    throw new Error('Hosting source branch must be a lowercase DNS-safe label of at most 63 characters.');
  }
}

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
    operations: operationsConfig(environmentName),
    backend: backendConfig(environmentName),
    hosting: hostingConfig(environmentName),
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
  if (!isDeepStrictEqual(config.operations, operationsConfig(environmentName))) {
    throw new Error('Operational retention, lifecycle, throttle, concurrency and budget policy must match the selected environment.');
  }
  if (!isDeepStrictEqual(config.backend, backendConfig(environmentName))) {
    throw new Error('Backend auth, secret lifecycle and CORS policy must match the selected environment.');
  }
  if (!isDeepStrictEqual(config.hosting, hostingConfig(environmentName))) {
    throw new Error('Hosting repository, branch, stage and build policy must match the selected environment.');
  }
  validateSourceBranch(config.hosting.sourceBranch);
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
