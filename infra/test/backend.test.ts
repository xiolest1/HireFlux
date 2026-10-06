import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';
import { fixtureArtifact } from './fixture';

const ids = {
  table: 'WorkspaceTable68AC2584', cursor: 'BackendApiCursorSigningSecret5EF895FB',
  demo: 'BackendApiDemoSessionSigningSecretB7E1C367', role: 'BackendApiExecutionRoleF9E94D3B',
  policy: 'BackendApiExecutionRoleDefaultPolicyDE57D6A3', function: 'BackendApiBackendFunctionFFB5248D',
  api: 'BackendApiHttpApiB4B1202A', integration: 'BackendApiHttpApiDefaultRouteBackendIntegrationC791C627',
  permission: 'BackendApiHttpApiDefaultRouteBackendIntegrationPermission521AD465',
  route: 'BackendApiHttpApiDefaultRoute408A2CCF', stage: 'BackendApiHttpApiDefaultStage89B5186D',
};
const getAtt = (id: string) => ({ 'Fn::GetAtt': [id, 'Arn'] });
const ref = (id: string) => ({ Ref: id });
const itemActions = ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem',
  'dynamodb:BatchWriteItem', 'dynamodb:ConditionCheckItem'];
const inventory = ['AWS::DynamoDB::Table', 'AWS::SecretsManager::Secret', 'AWS::SecretsManager::Secret',
  'AWS::IAM::Role', 'AWS::IAM::Policy', 'AWS::Lambda::Function', 'AWS::ApiGatewayV2::Api',
  'AWS::ApiGatewayV2::Integration', 'AWS::Lambda::Permission', 'AWS::ApiGatewayV2::Route', 'AWS::ApiGatewayV2::Stage'];

for (const environment of ['staging', 'production'] as const) {
  const config = loadEnvironmentConfig(environment);
  const stack = new HireFluxStack(new App(), `HireFlux-${environment}`, config, fixtureArtifact);
  const json = Template.fromStack(stack).toJSON();
  const resources = json.Resources;
  test(`${environment} contains only the reviewed resource families and stable logical identities`, () => {
    assert.deepEqual(Object.keys(resources).sort(), Object.values(ids).sort());
    assert.deepEqual(Object.values(resources).map((resource: any) => resource.Type), inventory);
    assert.deepEqual(json.Outputs ?? {}, {});
    for (const construct of [stack.backendFunction, stack.httpApi, stack.backend.executionRole,
      stack.backend.cursorSecret, stack.backend.demoSessionSecret]) {
      assert.equal(construct.stack, stack);
      assert.ok(!construct.node.id.includes(environment));
    }
  });
  test(`${environment} Lambda preserves the ZIP runtime, compute and safe environment contract`, () => {
    const properties = resources[ids.function].Properties;
    assert.equal(properties.Runtime, 'python3.14');
    assert.deepEqual(properties.Architectures, ['x86_64']);
    assert.equal(properties.Handler, 'hireflux_backend.lambda_handler.handler');
    assert.equal(properties.MemorySize, 1024);
    assert.equal(properties.Timeout, 15);
    assert.equal(properties.PackageType ?? 'Zip', 'Zip');
    assert.equal(properties.Code.ZipFile, undefined);
    assert.ok(properties.Code.S3Bucket && properties.Code.S3Key.endsWith('.zip'));
    assert.deepEqual(properties.Role, getAtt(ids.role));
    for (const property of ['FunctionName', 'VpcConfig', 'ReservedConcurrentExecutions', 'TracingConfig',
      'Layers', 'SnapStart', 'DeadLetterConfig', 'EphemeralStorage', 'LoggingConfig']) assert.equal(properties[property], undefined);
    const variables = properties.Environment.Variables;
    assert.deepEqual(Object.keys(variables).sort(), ['ENVIRONMENT', 'AUTH_MODE', 'DYNAMODB_TABLE_NAME',
      'CORS_ALLOWED_ORIGINS', 'CURSOR_SIGNING_SECRET_ARN', 'DEMO_SESSION_SIGNING_SECRET_ARN', 'LAMBDA_CORS_POLICY',
      'MAX_SYNC_EXPORT_BYTES', 'MAX_SYNC_EXPORT_WORK_SECONDS', 'ACCOUNT_ERASURE_MAX_SECONDS_PER_REQUEST'].sort());
    assert.equal(variables.ENVIRONMENT, environment);
    assert.equal(variables.AUTH_MODE, environment === 'staging' ? 'demo' : 'cognito');
    assert.deepEqual(variables.DYNAMODB_TABLE_NAME, ref(ids.table));
    assert.deepEqual(variables.CURSOR_SIGNING_SECRET_ARN, ref(ids.cursor));
    assert.deepEqual(variables.DEMO_SESSION_SIGNING_SECRET_ARN, ref(ids.demo));
    // Resolve token values conservatively: 768 bytes/secret ARN and 255/table name.
    const bytes = Object.entries(variables).reduce((sum, [key, value]) => sum + Buffer.byteLength(key) +
      (typeof value === 'string' ? Buffer.byteLength(value) : key === 'DYNAMODB_TABLE_NAME' ? 255 : 768), 0);
    assert.ok(bytes < 3072, `Environment exceeds headroom budget: ${bytes}`);
    assert.equal(variables.MAX_SYNC_EXPORT_BYTES, '4000000');
    assert.ok(Number(variables.MAX_SYNC_EXPORT_BYTES) < 6 * 1024 * 1024);
    assert.ok(Number(variables.MAX_SYNC_EXPORT_BYTES) < 10 * 1024 * 1024);
    assert.ok(Number(variables.MAX_SYNC_EXPORT_WORK_SECONDS) < properties.Timeout);
    assert.ok(Number(variables.ACCOUNT_ERASURE_MAX_SECONDS_PER_REQUEST) < properties.Timeout);
  });
  test(`${environment} effective execution-role policy is exactly least privilege`, () => {
    const role = resources[ids.role].Properties;
    assert.deepEqual(role.AssumeRolePolicyDocument, { Version: '2012-10-17', Statement: [
      { Action: 'sts:AssumeRole', Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' } },
    ] });
    assert.equal(role.RoleName, undefined);
    assert.equal(role.Policies, undefined);
    assert.deepEqual(role.ManagedPolicyArns, [{ 'Fn::Join': ['', ['arn:', ref('AWS::Partition'),
      ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }]);
    const policy = resources[ids.policy].Properties;
    assert.deepEqual(policy.Roles, [ref(ids.role)]);
    assert.deepEqual(policy.PolicyDocument.Statement, [
      { Effect: 'Allow', Action: itemActions, Resource: getAtt(ids.table) },
      { Effect: 'Allow', Action: 'dynamodb:Query', Resource: [getAtt(ids.table),
        ...['GSI1', 'GSI2', 'GSI3'].map((index) => ({ 'Fn::Join': ['', [getAtt(ids.table), `/index/${index}`]] }))] },
      { Effect: 'Allow', Action: 'secretsmanager:GetSecretValue', Resource: [ref(ids.cursor), ref(ids.demo)] },
    ]);
    const text = JSON.stringify(policy.PolicyDocument);
    for (const forbidden of ['dynamodb:Scan', 'dynamodb:*', 'dynamodb:CreateTable', 'dynamodb:DeleteTable',
      'dynamodb:UpdateTable', 'dynamodb:ListTables', 'dynamodb:DescribeTable', 'dynamodb:BatchGetItem',
      'dynamodb:UpdateContinuousBackups', 'dynamodb:TagResource', 'dynamodb:UntagResource',
      'secretsmanager:*', 'secretsmanager:DescribeSecret', 'secretsmanager:ListSecrets',
      'secretsmanager:CreateSecret', 'secretsmanager:PutSecretValue', 'secretsmanager:DeleteSecret',
      'secretsmanager:UpdateSecret', 'secretsmanager:RotateSecret', 'kms:', 'xray:', 'sts:AssumeRole']) {
      assert.ok(!text.includes(forbidden), `Forbidden execution action ${forbidden}`);
    }
    for (const statement of policy.PolicyDocument.Statement) assert.ok(!JSON.stringify(statement.Resource).includes('*'));
  });
  test(`${environment} signing secrets are generated, scoped and lifecycle-protected`, () => {
    for (const id of [ids.cursor, ids.demo]) {
      const secret = resources[id];
      assert.deepEqual(secret.Properties.GenerateSecretString, {
        ExcludePunctuation: true, IncludeSpace: false, PasswordLength: 64,
      });
      for (const property of ['SecretString', 'Name', 'KmsKeyId']) assert.equal(secret.Properties[property], undefined);
      assert.equal(secret.DeletionPolicy, environment === 'production' ? 'Retain' : 'Delete');
      assert.equal(secret.UpdateReplacePolicy, environment === 'production' ? 'Retain' : 'Delete');
    }
    const text = JSON.stringify(json);
    for (const marker of ['synthetic-private', 'CURSOR_SIGNING_KEY', 'DEMO_SESSION_SIGNING_KEY',
      '{{resolve:secretsmanager:', 'AWS_SECRET_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SESSION_TOKEN', 'DYNAMODB_ENDPOINT_URL']) {
      assert.ok(!text.includes(marker));
    }
  });
  test(`${environment} HTTP API has one explicit payload-v2 default proxy and scoped invocation`, () => {
    const api = resources[ids.api].Properties;
    assert.equal(api.ProtocolType, 'HTTP');
    assert.deepEqual(resources[ids.integration].Properties, {
      ApiId: ref(ids.api), IntegrationType: 'AWS_PROXY', IntegrationUri: getAtt(ids.function),
      PayloadFormatVersion: '2.0', TimeoutInMillis: 20000,
    });
    assert.equal(resources[ids.route].Properties.RouteKey, '$default');
    assert.equal(resources[ids.route].Properties.AuthorizationType, 'NONE');
    assert.deepEqual(resources[ids.stage].Properties, {
      ApiId: ref(ids.api), AutoDeploy: true, StageName: '$default', Tags: config.tags,
    });
    assert.ok(resources[ids.function].Properties.Timeout * 1000 < resources[ids.integration].Properties.TimeoutInMillis);
    assert.deepEqual(resources[ids.permission].Properties, {
      Action: 'lambda:InvokeFunction', FunctionName: getAtt(ids.function), Principal: 'apigateway.amazonaws.com',
      SourceArn: { 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':execute-api:us-east-1:',
        ref('AWS::AccountId'), ':', ref(ids.api), '/*/*']] },
    });
  });
  test(`${environment} gateway and runtime CORS share the exact bearer-client contract`, () => {
    const gateway = resources[ids.api].Properties.CorsConfiguration;
    const variables = resources[ids.function].Properties.Environment.Variables;
    const runtime = JSON.parse(variables.LAMBDA_CORS_POLICY);
    assert.deepEqual(gateway, {
      AllowCredentials: false, AllowOrigins: [`https://${environment}.invalid`],
      AllowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      AllowHeaders: ['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-ID'],
      ExposeHeaders: ['X-Request-ID', 'Content-Disposition'],
    });
    assert.equal(variables.CORS_ALLOWED_ORIGINS, gateway.AllowOrigins.join(','));
    assert.deepEqual(runtime, { allow_methods: gateway.AllowMethods, allow_headers: gateway.AllowHeaders,
      expose_headers: gateway.ExposeHeaders, allow_credentials: gateway.AllowCredentials });
  });
}

test('staging and production are stack-local with identical asset content and no imports/exports', () => {
  const app = new App();
  const staging = new HireFluxStack(app, 'HireFlux-staging', loadEnvironmentConfig('staging', '111111111111'), fixtureArtifact);
  const production = new HireFluxStack(app, 'HireFlux-production', loadEnvironmentConfig('production', '222222222222'), fixtureArtifact);
  for (const property of ['workspaceTable', 'backendFunction', 'httpApi'] as const) {
    assert.notEqual(staging[property], production[property]);
    assert.equal(staging[property].stack, staging);
    assert.equal(production[property].stack, production);
  }
  assert.notEqual(staging.backend.cursorSecret.secretArn, production.backend.cursorSecret.secretArn);
  assert.notEqual(staging.backend.demoSessionSecret.secretArn, production.backend.demoSessionSecret.secretArn);
  assert.notEqual(staging.httpApi.apiEndpoint, production.httpApi.apiEndpoint);
  const first = Template.fromStack(staging).toJSON();
  const second = Template.fromStack(production).toJSON();
  assert.equal(first.Resources[ids.function].Properties.Code.S3Key, second.Resources[ids.function].Properties.Code.S3Key);
  for (const stack of [staging, production]) {
    const text = JSON.stringify(Template.fromStack(stack).toJSON());
    assert.ok(!text.includes('Fn::ImportValue'));
    assert.equal(stack.dependencies.length, 0);
    assert.deepEqual(stack.resolve(stack.backendFunction.role?.roleArn), getAtt(ids.role));
    assert.deepEqual(stack.resolve(stack.workspaceTable.tableArn), getAtt(ids.table));
    assert.deepEqual(stack.resolve(stack.backend.cursorSecret.secretArn), ref(ids.cursor));
  }
});

