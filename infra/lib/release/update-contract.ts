/** Pure offline review helpers. This module never calls AWS or publishes assets. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const ACCOUNT_ADDITIONS = Object.freeze({
  CognitoAuthUserPoolAF093846: 'AWS::Cognito::UserPool',
  CognitoAuthPublicClient5A05A7D7: 'AWS::Cognito::UserPoolClient',
  CognitoAuthDomain0075BD90: 'AWS::Cognito::UserPoolDomain',
  CognitoAuthManagedLoginBranding8935A739: 'AWS::Cognito::ManagedLoginBranding',
});
export const FUNCTION_ID = 'BackendApiBackendFunctionFFB5248D';
export const POLICY_ID = 'BackendApiExecutionRoleDefaultPolicyDE57D6A3';
export type OfflineTemplate = { Resources: Record<string, any>; Parameters: Record<string, any>; [key: string]: any };
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function reviewUpdate(previous: OfflineTemplate, proposed: OfflineTemplate) {
  const sections = (template: OfflineTemplate) => Object.fromEntries(Object.entries(template).filter(([key]) => key !== 'Resources'));
  assert.deepEqual(sections(proposed), sections(previous), 'Template sections and prior parameter semantics must remain unchanged.');
  const added = Object.fromEntries(Object.entries(proposed.Resources).filter(([id]) => !previous.Resources[id]).map(([id, resource]) => [id, resource.Type]));
  assert.deepEqual(added, ACCOUNT_ADDITIONS, 'Exactly four reviewed Cognito additions are required.');
  const pool = proposed.Resources.CognitoAuthUserPoolAF093846;
  assert.equal(pool.DeletionPolicy, 'Retain'); assert.equal(pool.UpdateReplacePolicy, 'Retain');
  assert.equal(pool.Properties.DeletionProtection, 'ACTIVE');
  assert.deepEqual(pool.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: true });
  assert.deepEqual(pool.Properties.UsernameAttributes, ['email']);
  assert.equal(pool.Properties.AliasAttributes, undefined);
  const client = proposed.Resources.CognitoAuthPublicClient5A05A7D7.Properties;
  assert.equal(client.GenerateSecret, false); assert.deepEqual(client.AllowedOAuthFlows, ['code']);
  assert.deepEqual(client.AllowedOAuthScopes, ['openid', 'email', 'profile']);
  assert.deepEqual(client.RefreshTokenRotation, { Feature: 'ENABLED', RetryGracePeriodSeconds: 10 });
  assert.equal(proposed.Resources.CognitoAuthDomain0075BD90.Properties.Domain, 'hireflux-staging-9465-use1-20261020');
  assert.equal(proposed.Resources.CognitoAuthDomain0075BD90.Properties.ManagedLoginVersion, 2);
  const modifications: string[] = [];
  for (const [id, before] of Object.entries(previous.Resources)) {
    const after = proposed.Resources[id];
    assert.ok(after, `Existing resource removed: ${id}`);
    assert.equal(after.Type, before.Type, `Existing type changed: ${id}`);
    if (isDeepStrictEqual(before, after)) continue;
    assert.ok([FUNCTION_ID, POLICY_ID].includes(id), `Unapproved existing resource change: ${id}`);
    const scrubbed = structuredClone(after);
    if (id === FUNCTION_ID) {
      assert.ok(scrubbed.Properties.Code.S3Key?.endsWith('.zip'));
      assert.deepEqual(scrubbed.Properties.Code.S3Bucket, before.Properties.Code.S3Bucket);
      scrubbed.Properties.Code = before.Properties.Code;
      const vars = scrubbed.Properties.Environment.Variables;
      const extra = ['AUTH_CAPABILITIES', 'COGNITO_USER_POOL_ID', 'COGNITO_APP_CLIENT_ID', 'COGNITO_DOMAIN', 'COGNITO_SELF_REGISTRATION_ENABLED', 'PERSISTENT_ACCOUNT_MANAGEMENT_ENABLED'];
      assert.equal(vars.AUTH_CAPABILITIES, 'demo,cognito');
      assert.equal(vars.COGNITO_SELF_REGISTRATION_ENABLED, 'false');
      assert.equal(vars.PERSISTENT_ACCOUNT_MANAGEMENT_ENABLED, 'true');
      assert.deepEqual(vars.COGNITO_USER_POOL_ID, { Ref: 'CognitoAuthUserPoolAF093846' });
      assert.deepEqual(vars.COGNITO_APP_CLIENT_ID, { Ref: 'CognitoAuthPublicClient5A05A7D7' });
      assert.equal(vars.COGNITO_DOMAIN, 'https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com');
      for (const key of extra) delete vars[key];
      // Only local asset metadata may change with a qualified new ZIP.
      for (const key of new Set([...Object.keys(before.Metadata ?? {}), ...Object.keys(scrubbed.Metadata ?? {})])) {
        if (key !== 'aws:asset:path') assert.deepEqual(scrubbed.Metadata?.[key], before.Metadata?.[key], 'Unexpected Lambda metadata change.');
      }
      if (before.Metadata === undefined) delete scrubbed.Metadata;
      else scrubbed.Metadata = before.Metadata;
    } else {
      const statements = scrubbed.Properties.PolicyDocument.Statement;
      const last = statements.pop();
      assert.deepEqual(last, { Effect: 'Allow', Action: 'cognito-idp:AdminDeleteUser', Resource: { 'Fn::GetAtt': ['CognitoAuthUserPoolAF093846', 'Arn'] } });
    }
    assert.deepEqual(scrubbed, before, `Existing configuration changed beyond the allowlist: ${id}`);
    modifications.push(id);
  }
  assert.deepEqual(modifications.sort(), [FUNCTION_ID, POLICY_ID].sort());
  return { additions: added, modifications, replacements_allowed: false, proposed_sha256: fingerprint(proposed) };
}

export function prepareUpdateRequest(template: OfflineTemplate, options: { account: string; executionRoleArn: string; changeSetName: string }) {
  assert.match(options.account, /^\d{12}$/);
  assert.ok(options.account.endsWith('9465'), 'This fixture targets the accepted staging account only.');
  assert.match(options.changeSetName, /^hireflux-staging-cognito-[a-z0-9-]+$/);
  assert.equal(options.executionRoleArn, `arn:aws:iam::${options.account}:role/cdk-hnb659fds-cfn-exec-role-${options.account}-us-east-1`);
  assert.deepEqual(Object.keys(template.Parameters).sort(), ['AmplifyGitHubAccessToken', 'BootstrapVersion', 'OperationalAlertEmail']);
  return {
    StackName: 'hireflux-staging', TemplateBody: JSON.stringify(template),
    ChangeSetName: options.changeSetName, ChangeSetType: 'UPDATE', RoleARN: options.executionRoleArn,
    Parameters: Object.keys(template.Parameters).sort().map((ParameterKey) => ({ ParameterKey, UsePreviousValue: true })),
    Capabilities: ['CAPABILITY_IAM'],
    Description: 'INERT OFFLINE REVIEW ONLY: requires separate Phase 5E authorization and exact live stack ARN/template URL.',
  };
}

export function reviewLiveChangeSet(changes: readonly any[]): void {
  const expected = new Set([...Object.keys(ACCOUNT_ADDITIONS), FUNCTION_ID, POLICY_ID]);
  assert.equal(changes.length, expected.size);
  for (const change of changes) {
    const resource = change.ResourceChange;
    assert.ok(resource && expected.delete(resource.LogicalResourceId), 'Unexpected/duplicate resource in change set.');
    if (Object.hasOwn(ACCOUNT_ADDITIONS, resource.LogicalResourceId)) {
      assert.equal(resource.Action, 'Add');
      assert.equal(resource.ResourceType, ACCOUNT_ADDITIONS[resource.LogicalResourceId as keyof typeof ACCOUNT_ADDITIONS]);
    } else {
      assert.equal(resource.Action, 'Modify');
      assert.equal(resource.Replacement, 'False', 'Any conditional/required replacement is a STOP.');
      const allowed = resource.LogicalResourceId === FUNCTION_ID ? ['Code', 'Environment'] : ['PolicyDocument'];
      assert.equal(resource.ResourceType, resource.LogicalResourceId === FUNCTION_ID ? 'AWS::Lambda::Function' : 'AWS::IAM::Policy');
      assert.ok(resource.Details?.length > 0, 'Property-level change details required.');
      for (const detail of resource.Details) assert.ok(detail.Target?.Attribute === 'Properties' && allowed.includes(detail.Target.Name), 'Unapproved property change.');
    }
  }
  assert.equal(expected.size, 0);
}
