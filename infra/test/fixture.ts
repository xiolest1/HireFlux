import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { after } from 'node:test';
import type { BackendArtifact } from '../lib/backend/artifact';

// Deliberately injected only at the typed construct boundary; the CLI has no fixture switch.
const directory = mkdtempSync(join(tmpdir(), 'hireflux-unit-asset-'));
export const fixtureZip = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
const path = join(directory, 'fixture.zip');
writeFileSync(path, fixtureZip);
export const fixtureArtifact: BackendArtifact = Object.freeze({
  path, sha256: createHash('sha256').update(fixtureZip).digest('hex'),
});
after(() => {
  const within = relative(tmpdir(), directory);
  assert.ok(within && !within.startsWith('..') && !isAbsolute(within));
  rmSync(directory, { recursive: true, force: true });
});
