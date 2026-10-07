import { AssetHashType, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, PayloadFormatVersion } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import type { HireFluxEnvironmentConfig } from '../config/environment';
import type { BackendArtifact } from './artifact';

export class BackendApi extends Construct {
  public readonly backendFunction: Function;
  public readonly httpApi: HttpApi;
  public readonly executionRole: Role;
  public readonly cursorSecret: Secret;
  public readonly demoSessionSecret: Secret;

  constructor(scope: Construct, id: string, table: Table, config: HireFluxEnvironmentConfig, artifact: BackendArtifact, frontendOrigin: string) {
    super(scope, id);
    const secretProperties = {
      generateSecretString: { passwordLength: 64, excludePunctuation: true, includeSpace: false },
      removalPolicy: RemovalPolicy[config.backend.secretRemovalPolicy],
    };
    this.cursorSecret = new Secret(this, 'CursorSigningSecret', secretProperties);
    this.demoSessionSecret = new Secret(this, 'DemoSessionSigningSecret', secretProperties);
    this.executionRole = new Role(this, 'ExecutionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });
    // Audit: repository transactions require their underlying item actions, including ACTIVE guards.
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem',
        'dynamodb:BatchWriteItem', 'dynamodb:ConditionCheckItem'],
      resources: [table.tableArn],
    }));
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [table.tableArn, ...['GSI1', 'GSI2', 'GSI3'].map((index) => `${table.tableArn}/index/${index}`)],
    }));
    this.executionRole.addToPolicy(new PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [this.cursorSecret.secretArn, this.demoSessionSecret.secretArn],
    }));
    const cors = { ...config.backend.cors, allowOrigins: [frontendOrigin] };
    this.backendFunction = new Function(this, 'BackendFunction', {
      runtime: Runtime.PYTHON_3_14, architecture: Architecture.X86_64,
      handler: 'hireflux_backend.lambda_handler.handler',
      code: Code.fromAsset(artifact.path, { assetHash: artifact.sha256, assetHashType: AssetHashType.CUSTOM }),
      role: this.executionRole, memorySize: 1024, timeout: Duration.seconds(15),
      environment: {
        ENVIRONMENT: config.environmentName, AUTH_MODE: config.backend.authMode,
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
  }
}
