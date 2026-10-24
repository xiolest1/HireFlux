/** Offline registration review only. The historical Cognito-introduction contract stays intact. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { FUNCTION_ID, type OfflineTemplate } from './update-contract';

export const PHASE5E_TEMPLATE_SHA256 = '65431c46065237d875cc3015cdc1c9bb81136fe331898d2906773bcd50b9526b';
export const POOL_ID = 'CognitoAuthUserPoolAF093846';
type Options = { qualifiedBackendSha256?: string };

/** Semantic delta check; this alone makes no claim about baseline provenance. */
export function reviewRegistrationTemplateDelta(previous: OfflineTemplate, proposed: OfflineTemplate, options: Options = {}) {
  const rest = (t: OfflineTemplate) => Object.fromEntries(Object.entries(t).filter(([key]) => key !== 'Resources'));
  assert.deepEqual(rest(proposed), rest(previous), 'Template sections/parameters must remain unchanged.');
  assert.deepEqual(Object.keys(proposed.Resources).sort(), Object.keys(previous.Resources).sort(), 'No resource additions or deletions.');
  const beforePool = previous.Resources[POOL_ID];
  assert.equal(beforePool.Type, 'AWS::Cognito::UserPool');
  assert.equal(beforePool.DeletionPolicy, 'Retain');
  assert.equal(beforePool.UpdateReplacePolicy, 'Retain');
  assert.deepEqual(beforePool.Properties.UsernameAttributes, ['email']);
  assert.equal(beforePool.Properties.AliasAttributes, undefined);
  assert.deepEqual(beforePool.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: true });
  assert.equal(previous.Resources[FUNCTION_ID].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED, 'false');
  const modifications: string[] = [];
  for (const [id, before] of Object.entries(previous.Resources)) {
    const after = proposed.Resources[id];
    if (isDeepStrictEqual(before, after)) continue;
    assert.ok([POOL_ID, FUNCTION_ID].includes(id), `Unrelated resource changed: ${id}`);
    const scrubbed = structuredClone(after);
    if (id === POOL_ID) {
      assert.deepEqual(scrubbed.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: false });
      scrubbed.Properties.AdminCreateUserConfig = before.Properties.AdminCreateUserConfig;
    } else {
      assert.equal(scrubbed.Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED, 'true');
      scrubbed.Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED = 'false';
      if (!isDeepStrictEqual(before.Properties.Code, after.Properties.Code)) {
        assert.match(options.qualifiedBackendSha256 ?? '', /^[a-f0-9]{64}$/, 'A separately qualified backend hash is required.');
        // Code.fromAsset uses CUSTOM hashing: CDK fingerprints the qualified hex
        // digest text again. The raw ZIP digest is not its destination key.
        const assetHash = createHash('sha256').update(options.qualifiedBackendSha256!).digest('hex');
        assert.deepEqual(after.Properties.Code, { ...before.Properties.Code, S3Key: `${assetHash}.zip` });
        scrubbed.Properties.Code = before.Properties.Code;
        const metadata = { ...(scrubbed.Metadata ?? {}) };
        if (before.Metadata?.['aws:asset:path'] === undefined) delete metadata['aws:asset:path'];
        else metadata['aws:asset:path'] = before.Metadata['aws:asset:path'];
        if (before.Metadata === undefined && Object.keys(metadata).length === 0) delete scrubbed.Metadata;
        else scrubbed.Metadata = metadata;
      }
    }
    assert.deepEqual(scrubbed, before, `Unapproved property change: ${id}`);
    modifications.push(id);
  }
  assert.deepEqual(modifications.sort(), [POOL_ID, FUNCTION_ID].sort(), 'Pool policy and advertised capability must change together.');
  return { modifications, additions: 0, deletions: 0, replacements_allowed: false };
}

/** Operator entry point pins the exact original qualified 5E template bytes. No AWS access. */
export function reviewRegistrationUpdate(acceptedTemplateJson: string, proposed: OfflineTemplate, options: Options = {}) {
  assert.equal(createHash('sha256').update(acceptedTemplateJson).digest('hex'), PHASE5E_TEMPLATE_SHA256, 'Accepted Phase 5E baseline template hash mismatch.');
  return reviewRegistrationTemplateDelta(JSON.parse(acceptedTemplateJson), proposed, options);
}

export function reviewRegistrationChangeSet(changes: readonly any[], qualifiedBackendChange = false): void {
  const remaining = new Set([POOL_ID, FUNCTION_ID]);
  assert.equal(changes.length, 2);
  for (const change of changes) {
    const r = change.ResourceChange;
    assert.ok(r && remaining.delete(r.LogicalResourceId), 'Unexpected/duplicate change.');
    assert.equal(r.Action, 'Modify');
    assert.equal(r.Replacement, 'False');
    assert.equal(r.ResourceType, r.LogicalResourceId === POOL_ID ? 'AWS::Cognito::UserPool' : 'AWS::Lambda::Function');
    const allowed = r.LogicalResourceId === POOL_ID ? ['AdminCreateUserConfig'] : ['Environment', ...(qualifiedBackendChange ? ['Code'] : [])];
    assert.ok(r.Details?.length > 0);
    for (const d of r.Details) assert.ok(d.Target?.Attribute === 'Properties' && allowed.includes(d.Target.Name), 'Unexpected changed property.');
  }
  assert.equal(remaining.size, 0);
}
