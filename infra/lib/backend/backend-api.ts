import { AssetHashType, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { CfnRoute, CfnStage, CorsHttpMethod, HttpApi, PayloadFormatVersion } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { ApplicationLogLevel, Architecture, Code, Function, LoggingFormat, Runtime, SystemLogLevel } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import type { HireFluxEnvironmentConfig } from '../config/environment';
import type { BackendArtifact } from './artifact';
import { HTTP_ACCESS_LOG_FORMAT, type OperationalLogs } from '../operations/operational-guardrails';

export class BackendApi extends Construct {
  public readonly backendFunction: Function;
  public readonly httpApi: HttpApi;
  public readonly executionRole: Role;
  public readonly cursorSecret: Secret;
  public readonly demoSessionSecret: Secret;

  constructor(scope: Construct, id: string, table: Table, config: HireFluxEnvironmentConfig, artifact: BackendArtifact, frontendOrigin: string, logs: OperationalLogs) {
    super(scope, id);
    const secretProperties = {
      generateSecretString: { passwordLength: 64, excludePunctuation: true, includeSpace: false },
      removalPolicy: RemovalPolicy[config.backend.secretRemovalPolicy],
    };
    this.cursorSecret = new Secret(this, 'CursorSigningSecret', secretProperties);
    this.demoSessionSecret = new Secret(this, 'DemoSessionSigningSecret', secretProperties);
    this.executionRole = new Role(this, 'ExecutionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    // Audit: repository transactions require their underlying item actions, including ACTIVE guards.
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:ConditionCheckItem'],
      resources: [table.tableArn],
    }));
    // IAM evaluates the underlying transaction actions. The public role can read
    // and condition-check policy but can mutate only user/replay/bucket partitions.
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:BatchWriteItem'],
      resources: [table.tableArn],
      conditions: {
        'ForAllValues:StringLike': { 'dynamodb:LeadingKeys': [
          'USER#*', 'DEMO_IDEMPOTENCY#*', 'DEMO_ADMISSION#DAY#*', 'DEMO_ADMISSION#MINUTE#*',
        ] },
        Null: { 'dynamodb:LeadingKeys': 'false' },
      },
    }));
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [table.tableArn, ...['GSI1', 'GSI2', 'GSI3'].map((index) => `${table.tableArn}/index/${index}`)],
    }));
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [this.cursorSecret.secretArn, this.demoSessionSecret.secretArn],
    }));
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [logs.backendFunctionLogs.logGroupArn],
    }));
    const cors = { ...config.backend.cors, allowOrigins: [frontendOrigin] };
    this.backendFunction = new Function(this, 'BackendFunction', {
      runtime: Runtime.PYTHON_3_14, architecture: Architecture.X86_64,
      handler: 'hireflux_backend.lambda_handler.handler',
      code: Code.fromAsset(artifact.path, { assetHash: artifact.sha256, assetHashType: AssetHashType.CUSTOM }),
      role: this.executionRole, memorySize: 1024, timeout: Duration.seconds(15),
      reservedConcurrentExecutions: config.operations.lambdaReservedConcurrency,
      logGroup: logs.backendFunctionLogs, loggingFormat: LoggingFormat.JSON,
      // Mangum INFO logs raw request paths; native access logs use only the safe route key.
      applicationLogLevelV2: ApplicationLogLevel.WARN, systemLogLevelV2: SystemLogLevel.WARN,
      environment: {
        ENVIRONMENT: config.environmentName, AUTH_MODE: config.backend.authMode,
        DEMO_SESSION_TTL_HOURS: String(config.backend.demoSessionTtlHours),
        DYNAMODB_TABLE_NAME: table.tableName, CORS_ALLOWED_ORIGINS: cors.allowOrigins.join(','),
        MAX_SYNC_EXPORT_BYTES: '4000000',
        MAX_SYNC_EXPORT_WORK_SECONDS: '5', ACCOUNT_ERASURE_MAX_SECONDS_PER_REQUEST: '2',
        CURSOR_SIGNING_SECRET_ARN: this.cursorSecret.secretArn,
        DEMO_SESSION_SIGNING_SECRET_ARN: this.demoSessionSecret.secretArn,
        LAMBDA_CORS_POLICY: JSON.stringify({
          allow_methods: cors.allowMethods, allow_headers: cors.allowHeaders,
          expose_headers: cors.exposeHeaders, allow_credentials: cors.allowCredentials,
        }),
      },
    });
    this.httpApi = new HttpApi(this, 'HttpApi', {
      createDefaultStage: true,
      defaultIntegration: new HttpLambdaIntegration('BackendIntegration', this.backendFunction, {
        payloadFormatVersion: PayloadFormatVersion.VERSION_2_0, timeout: Duration.seconds(20),
      }),
      corsPreflight: {
        allowOrigins: [...cors.allowOrigins], allowMethods: cors.allowMethods.map((method) => CorsHttpMethod[method]),
        allowHeaders: [...cors.allowHeaders], exposeHeaders: [...cors.exposeHeaders],
        allowCredentials: cors.allowCredentials,
      },
    });
    const stage = this.httpApi.defaultStage!.node.defaultChild as CfnStage;
    // Reuse the existing integration and its already-scoped API invocation grant.
    // The explicit POST outranks $default; API-managed CORS still handles OPTIONS.
    const defaultRoute = this.httpApi.node.findChild('DefaultRoute').node.defaultChild as CfnRoute;
    new CfnRoute(this, 'DemoIssuanceRoute', {
      apiId: this.httpApi.apiId, routeKey: 'POST /api/v1/demo-sessions',
      authorizationType: 'NONE', target: defaultRoute.target!,
    });
    stage.accessLogSettings = { destinationArn: logs.httpApiAccessLogs.logGroupArn, format: HTTP_ACCESS_LOG_FORMAT };
    stage.defaultRouteSettings = { detailedMetricsEnabled: false,
      throttlingRateLimit: config.operations.apiThrottleRate, throttlingBurstLimit: config.operations.apiThrottleBurst };
    stage.routeSettings = {
      'POST /api/v1/demo-sessions': {
        DetailedMetricsEnabled: false,
        ThrottlingRateLimit: config.operations.demoIssueThrottleRate,
        ThrottlingBurstLimit: config.operations.demoIssueThrottleBurst,
      },
    };
  }
}
