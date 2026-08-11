# ADR 0002: Local identity now, Cognito later

- Status: Superseded for the recruiter demo by ADR 0004; retained for local fixed-identity mode
- Date: 2026-08-10

## Context

Milestone 1 had to work without an AWS account. At the time, the target assumed every deployed user would use Cognito.

## Decision

Define an authenticated-identity dependency. In `AUTH_MODE=local`, it returns one configured development identity and ensures its profile exists. Configuration rejects local auth outside `ENVIRONMENT=local` or `test`.

ADR 0004 later selected signed temporary identities for the deployed recruiter demo. A future Cognito implementation remains compatible with the same identity dependency if persistent accounts are added.

Passwords and password hashes are never stored in HireFlux.

## Consequences

Local development remains free and deterministic, routes and services do not care how identity was established, and deployed misconfiguration fails at startup. Cognito integration remains real later work rather than a hidden stub.
