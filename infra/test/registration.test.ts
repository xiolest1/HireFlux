import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { composeEnvironment } from '../lib/app';
import { loadEnvironmentConfig, validateEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';
import { FUNCTION_ID, type OfflineTemplate } from '../lib/release/update-contract';
import { POOL_ID, reviewRegistrationChangeSet, reviewRegistrationTemplateDelta, reviewRegistrationUpdate } from '../lib/release/registration-update-contract';
import { fixtureArtifact } from './fixture';

function template(enabled = false): OfflineTemplate {
  return Template.fromStack(new HireFluxStack(new App(), 'HireFlux-staging', loadEnvironmentConfig('staging', '111111119465', enabled), fixtureArtifact)).toJSON() as OfflineTemplate;
}

test('registration is default-closed, explicitly typed and production cannot open', () => {
  for (const env of ['staging', 'production']) assert.equal(loadEnvironmentConfig(env).selfRegistrationEnabled, false);
  for (const value of [null, 1, {}, '', 'TRUE', ' false']) assert.throws(() => loadEnvironmentConfig('staging', undefined, value));
  assert.equal(loadEnvironmentConfig('staging', undefined, 'true').selfRegistrationEnabled, true);
  assert.equal(loadEnvironmentConfig('staging', undefined, 'false').selfRegistrationEnabled, false);
  assert.throws(() => loadEnvironmentConfig('production', undefined, true), /production registration remains closed/);
  assert.throws(() => validateEnvironmentConfig({ ...loadEnvironmentConfig('staging'), selfRegistrationEnabled: undefined as any }));
});

test('local context reaches the same unified pool policy and advertised capability', () => {
  const app = new App({ context: { environment: 'staging', selfRegistrationEnabled: 'true' } });
  const json = Template.fromStack(composeEnvironment(app, fixtureArtifact)).toJSON();
  assert.equal(json.Resources[POOL_ID].Properties.AdminCreateUserConfig.AllowAdminCreateUserOnly, false);
  assert.equal(json.Resources[FUNCTION_ID].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED, 'true');
});

test('both registration states preserve all other resources, IAM, identity attributes and token settings', () => {
  const before = template();
  const after = template(true);
  assert.deepEqual(reviewRegistrationTemplateDelta(before, after).modifications.sort(), [POOL_ID, FUNCTION_ID].sort());
  assert.throws(() => reviewRegistrationUpdate(JSON.stringify(before), after), /baseline template hash mismatch/);
});

for (const fault of ['addition', 'deletion', 'iam', 'username', 'schema', 'case', 'domain', 'callback', 'retention', 'lambda', 'parameter', 'one-toggle']) {
  test(`registration review rejects ${fault} drift`, () => {
    const before = template();
    const after = template(true);
    if (fault === 'addition') after.Resources.Extra = { Type: 'AWS::S3::Bucket' };
    if (fault === 'deletion') delete after.Resources.WorkspaceTable68AC2584;
    if (fault === 'iam') after.Resources.BackendApiExecutionRoleDefaultPolicyDE57D6A3.Properties.PolicyDocument.Statement.push({ Effect: 'Allow', Action: '*', Resource: '*' });
    if (fault === 'username') after.Resources[POOL_ID].Properties.UsernameAttributes = ['phone_number'];
    if (fault === 'schema') after.Resources[POOL_ID].Properties.Schema = [];
    if (fault === 'case') after.Resources[POOL_ID].Properties.UsernameConfiguration.CaseSensitive = true;
    if (fault === 'domain') after.Resources.CognitoAuthDomain0075BD90.Properties.Domain = 'other';
    if (fault === 'callback') after.Resources.CognitoAuthPublicClient5A05A7D7.Properties.CallbackURLs = ['https://other.invalid'];
    if (fault === 'retention') after.Resources[POOL_ID].DeletionPolicy = 'Delete';
    if (fault === 'lambda') after.Resources[FUNCTION_ID].Properties.Timeout++;
    if (fault === 'parameter') after.Parameters.Extra = { Type: 'String' };
    if (fault === 'one-toggle') after.Resources[FUNCTION_ID].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED = 'false';
    assert.throws(() => reviewRegistrationTemplateDelta(before, after));
  });
}

test('backend release change requires a separately qualified exact hash without bucket or policy drift', () => {
  const before = template(), after = template(true), hash = 'a'.repeat(64);
  after.Resources[FUNCTION_ID].Properties.Code.S3Key = createHash('sha256').update(hash).digest('hex') + '.zip';
  assert.throws(() => reviewRegistrationTemplateDelta(before, after));
  assert.doesNotThrow(() => reviewRegistrationTemplateDelta(before, after, { qualifiedBackendSha256: hash }));
  const rawHashKey = structuredClone(after);
  rawHashKey.Resources[FUNCTION_ID].Properties.Code.S3Key = hash + '.zip';
  assert.throws(() => reviewRegistrationTemplateDelta(before, rawHashKey, { qualifiedBackendSha256: hash }));
  after.Resources[FUNCTION_ID].Properties.Code.S3Bucket = 'other';
  assert.throws(() => reviewRegistrationTemplateDelta(before, after, { qualifiedBackendSha256: hash }));
});

test('change-set reviewer rejects conditional replacements, extra resources and unrelated properties', () => {
  const changes = [
    { ResourceChange: { LogicalResourceId: POOL_ID, ResourceType: 'AWS::Cognito::UserPool', Action: 'Modify', Replacement: 'False', Details: [{ Target: { Attribute: 'Properties', Name: 'AdminCreateUserConfig' } }] } },
    { ResourceChange: { LogicalResourceId: FUNCTION_ID, ResourceType: 'AWS::Lambda::Function', Action: 'Modify', Replacement: 'False', Details: [{ Target: { Attribute: 'Properties', Name: 'Environment' } }] } },
  ];
  assert.doesNotThrow(() => reviewRegistrationChangeSet(changes));
  for (const value of ['True', 'Conditional']) {
    const bad = structuredClone(changes); bad[0]!.ResourceChange.Replacement = value;
    assert.throws(() => reviewRegistrationChangeSet(bad));
  }
  const bad = structuredClone(changes); bad[0]!.ResourceChange.Details[0]!.Target.Name = 'UsernameAttributes';
  assert.throws(() => reviewRegistrationChangeSet(bad));
  assert.throws(() => reviewRegistrationChangeSet([...changes, changes[0]]));
});
