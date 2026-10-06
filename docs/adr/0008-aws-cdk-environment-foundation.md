# ADR 0008: Local CDK foundation and explicit deployment environments

- Status: Accepted for Phase 3A
- Date: 2026-10-06

## Context

Phase 2 provides the local product and durable workspace safety. Infrastructure
needs a deterministic composition/configuration boundary before real resource
definitions and Lambda packaging are introduced.

## Decision

Use a standalone `infra/` TypeScript AWS CDK v2 package with exact direct pins,
a lockfile, strict TypeScript, Node's built-in tests, and CDK assertions. The
repository-local CLI is canonical; no monorepo migration is needed.

Support only explicit `environment=staging|production` context. Both instantiate
one shared `HireFluxStack`, with separate stack identities, namespaces, and tags.
Retain the repository's `us-east-1` region. Leave the account unbound for local
synthesis, with optional validated environment-specific account context for
future explicit binding. Never infer selection/binding from branches or profiles.

Normal synthesis uses no AWS discovery. A local CLI wrapper isolates credentials,
disables metadata/telemetry/notices/lookups, and rejects mutation commands. Tests
block network attempts and compare repeated template bytes. Generated assemblies
and compiled code are ignored. The stack contains environment metadata and no
application resources; default synthesizer bootstrap references remain references.

Prefer generated physical names. Explicit names use the environment namespace,
validated suffixes, and a conservative project length limit; service-specific
checks are added with resources. Keep semantic construct IDs and paths stable
independently of physical/display names. Apply Project, Environment, and ManagedBy
tags. Future lifecycle settings and public/secret contracts are added only with
their implementing slices.

## Consequences and boundary

CI can install, typecheck, test, and synthesize both environments without AWS
credentials. No deployment CI, bootstrap, application resources, or AWS mutation
is part of Phase 3A. Lambda packaging begins in 3B; resources follow in 3C–3G;
actual staging deployment is Phase 4 and Cognito remains Phase 5.

The initial CDK graph has an open bundled dependency advisory recorded in
[infra/README.md](../../infra/README.md#dependency-review). Recheck upstream before
asset packaging; local synth success does not assert a clean security audit.
