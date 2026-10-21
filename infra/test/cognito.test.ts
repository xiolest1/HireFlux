import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';
import { fixtureArtifact } from './fixture';
import { ACCOUNT_ADDITIONS, FUNCTION_ID, POLICY_ID, prepareUpdateRequest, reviewLiveChangeSet, reviewUpdate, type OfflineTemplate } from '../lib/release/update-contract';

function template(environment: 'staging' | 'production'): OfflineTemplate {
  const result = Template.fromStack(new HireFluxStack(new App(), `HireFlux-${environment}`, loadEnvironmentConfig(environment, '111111119465'), fixtureArtifact)).toJSON();
  assert.ok(result.Resources && result.Parameters);
  return result as OfflineTemplate;
}
for (const environment of ['staging', 'production'] as const) {
  test(`${environment} has exactly four pool/client/domain/branding resources with closed registration`, () => {
    const json = template(environment);
    const resources = json.Resources;
    assert.deepEqual(Object.fromEntries(Object.entries(resources).filter(([, r]: [string, any]) => r.Type.startsWith('AWS::Cognito::')).map(([id, r]: [string, any]) => [id, r.Type])), ACCOUNT_ADDITIONS);
    const pool = resources.CognitoAuthUserPoolAF093846;
    assert.equal(pool.Properties.UserPoolTier, 'ESSENTIALS');
    assert.equal(pool.Properties.DeletionProtection, 'ACTIVE');
    assert.equal(pool.DeletionPolicy, 'Retain'); assert.equal(pool.UpdateReplacePolicy, 'Retain');
    assert.deepEqual(pool.Properties.UsernameAttributes, ['email']);
    assert.deepEqual(pool.Properties.AutoVerifiedAttributes, ['email']);
    assert.equal(pool.Properties.UsernameConfiguration.CaseSensitive, false);
    assert.deepEqual(pool.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: true });
    assert.deepEqual(pool.Properties.AccountRecoverySetting, { RecoveryMechanisms: [{ Name: 'verified_email', Priority: 1 }] });
    assert.deepEqual(pool.Properties.UserAttributeUpdateSettings, { AttributesRequireVerificationBeforeUpdate: ['email'] });
    assert.equal(pool.Properties.EmailConfiguration.EmailSendingAccount, 'COGNITO_DEFAULT');
    assert.equal(pool.Properties.MfaConfiguration, 'OFF');
    assert.equal(pool.Properties.Policies.PasswordPolicy.MinimumLength, 12);
    for (const property of ['AliasAttributes', 'SmsConfiguration', 'LambdaConfig', 'UserPoolAddOns', 'DeviceConfiguration']) assert.equal(pool.Properties[property], undefined);
    const client = resources.CognitoAuthPublicClient5A05A7D7.Properties;
    assert.equal(client.GenerateSecret, false);
    assert.deepEqual(client.AllowedOAuthFlows, ['code']);
    assert.deepEqual(client.AllowedOAuthScopes, ['openid', 'email', 'profile']);
    assert.deepEqual(client.ExplicitAuthFlows, ['ALLOW_USER_SRP_AUTH']);
    assert.deepEqual(client.SupportedIdentityProviders, ['COGNITO']);
    assert.deepEqual(client.RefreshTokenRotation, { Feature: 'ENABLED', RetryGracePeriodSeconds: 10 });
    assert.equal(client.EnableTokenRevocation, true);
    assert.deepEqual([client.AccessTokenValidity, client.IdTokenValidity, client.RefreshTokenValidity], [60, 60, 1]);
    assert.deepEqual(client.TokenValidityUnits, { AccessToken: 'minutes', IdToken: 'minutes', RefreshToken: 'days' });
    assert.deepEqual(client.ReadAttributes, ['email', 'email_verified', 'name']);
    assert.deepEqual(client.WriteAttributes, ['email', 'name']);
    assert.equal(JSON.stringify(client.CallbackURLs).includes('/auth/callback'), true);
    assert.equal(JSON.stringify(client.LogoutURLs).includes('/auth/signed-out'), true);
    assert.equal(JSON.stringify(client.CallbackURLs).includes('*'), false);
    assert.equal(resources.CognitoAuthDomain0075BD90.Properties.ManagedLoginVersion, 2);
    assert.deepEqual(resources.CognitoAuthManagedLoginBranding8935A739.Properties, { UserPoolId: { Ref: 'CognitoAuthUserPoolAF093846' }, ClientId: { Ref: 'CognitoAuthPublicClient5A05A7D7' }, UseCognitoProvidedValues: true });
    assert.deepEqual(resources.CognitoAuthManagedLoginBranding8935A739.DependsOn, ['CognitoAuthDomain0075BD90']);
    const domain = resources.CognitoAuthDomain0075BD90.Properties.Domain;
    assert.equal(domain, environment === 'staging' ? 'hireflux-staging-9465-use1-20261020' : 'hireflux-production-111111119465-use1-20261020');
    const vars = resources[FUNCTION_ID].Properties.Environment.Variables;
    assert.equal(vars.AUTH_CAPABILITIES, environment === 'staging' ? 'demo,cognito' : 'cognito');
    assert.equal(vars.PERSISTENT_ACCOUNT_MANAGEMENT_ENABLED, 'true');
    assert.equal(vars.COGNITO_SELF_REGISTRATION_ENABLED, 'false');
    assert.equal(JSON.stringify(resources.BackendApiHttpApiB4B1202A.Properties.CorsConfiguration).includes('amazoncognito'), false);
  });
}

function priorShape(proposed: any) {
  const previous = structuredClone(proposed);
  for (const id of Object.keys(ACCOUNT_ADDITIONS)) delete previous.Resources[id];
  for (const key of ['AUTH_CAPABILITIES', 'COGNITO_USER_POOL_ID', 'COGNITO_APP_CLIENT_ID', 'COGNITO_DOMAIN', 'COGNITO_SELF_REGISTRATION_ENABLED', 'PERSISTENT_ACCOUNT_MANAGEMENT_ENABLED']) delete previous.Resources[FUNCTION_ID].Properties.Environment.Variables[key];
  previous.Resources[POLICY_ID].Properties.PolicyDocument.Statement.pop();
  previous.Resources[FUNCTION_ID].Properties.Code.S3Key = 'historical-qualified.zip';
  return previous;
}

test('offline update allows only four additions and Lambda code/config plus pool-scoped AdminDeleteUser', () => {
  const proposed = template('staging');
  const previous = priorShape(proposed);
  assert.equal(Object.keys(reviewUpdate(previous, proposed).additions).length, 4);
  for (const id of ['FrontendHostingApp3EC0FC15', 'FrontendHostingBranchB5734B41', 'WorkspaceTable68AC2584', 'BackendApiCursorSigningSecret5EF895FB']) {
    const changed = structuredClone(proposed);
    changed.Resources[id].Properties.Unreviewed = true;
    assert.throws(() => reviewUpdate(previous, changed), /Unapproved existing resource/);
  }
  const broad = structuredClone(proposed);
  broad.Resources[POLICY_ID].Properties.PolicyDocument.Statement.at(-1).Resource = '*';
  assert.throws(() => reviewUpdate(previous, broad));
  const opened = structuredClone(proposed);
  opened.Resources[FUNCTION_ID].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED = 'true';
  assert.throws(() => reviewUpdate(previous, opened));
  const topLevel = structuredClone(proposed);
  topLevel.Transform = 'Unreviewed';
  assert.throws(() => reviewUpdate(previous, topLevel), /Template sections/);
});

test('UPDATE request preserves NoEcho parameter references without a revoked token value', () => {
  const proposed = template('staging');
  const account = '111111119465';
  const request = prepareUpdateRequest(proposed, { account, executionRoleArn: `arn:aws:iam::${account}:role/cdk-hnb659fds-cfn-exec-role-${account}-us-east-1`, changeSetName: 'hireflux-staging-cognito-review' });
  assert.equal(request.ChangeSetType, 'UPDATE');
  assert.equal(request.StackName, 'hireflux-staging');
  assert.deepEqual(request.Parameters.find((p) => p.ParameterKey === 'AmplifyGitHubAccessToken'), { ParameterKey: 'AmplifyGitHubAccessToken', UsePreviousValue: true });
  assert.ok(request.Parameters.every((p) => !Object.hasOwn(p, 'ParameterValue')));
  assert.deepEqual(proposed.Resources.FrontendHostingApp3EC0FC15.Properties.AccessToken, { Ref: 'AmplifyGitHubAccessToken' });
  assert.equal(proposed.Parameters.AmplifyGitHubAccessToken.NoEcho, true);
  assert.throws(() => prepareUpdateRequest(proposed, { account, executionRoleArn: 'arn:aws:iam::111111119465:role/unreviewed', changeSetName: 'hireflux-staging-cognito-review' }));
});

test('future live review refuses replacements, missing detail, extra changes or Amplify mutations', () => {
  const changes: Parameters<typeof reviewLiveChangeSet>[0] = [
    ...Object.entries(ACCOUNT_ADDITIONS).map(([LogicalResourceId, ResourceType]) => ({ ResourceChange: { LogicalResourceId, ResourceType, Action: 'Add' } })),
    { ResourceChange: { LogicalResourceId: FUNCTION_ID, ResourceType: 'AWS::Lambda::Function', Action: 'Modify', Replacement: 'False', Details: [{ Target: { Attribute: 'Properties', Name: 'Code' } }, { Target: { Attribute: 'Properties', Name: 'Environment' } }] } },
    { ResourceChange: { LogicalResourceId: POLICY_ID, ResourceType: 'AWS::IAM::Policy', Action: 'Modify', Replacement: 'False', Details: [{ Target: { Attribute: 'Properties', Name: 'PolicyDocument' } }] } },
  ];
  reviewLiveChangeSet(changes);
  for (const replacement of ['True', 'Conditional']) {
    const changed = structuredClone(changes); changed.at(-1)!.ResourceChange.Replacement = replacement;
    assert.throws(() => reviewLiveChangeSet(changed), /replacement/);
  }
  const changed = structuredClone(changes); changed.at(-1)!.ResourceChange.LogicalResourceId = 'FrontendHostingApp3EC0FC15';
  assert.throws(() => reviewLiveChangeSet(changed));
  assert.throws(() => reviewLiveChangeSet(changes.slice(1)));
});
