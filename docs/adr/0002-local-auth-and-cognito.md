# ADR 0002: Local identity now, Cognito later

- Status: Accepted
- Date: 2026-08-10

## Context

Milestone 1 must work without an AWS account, while the deployed app will use Cognito. Re-implementing password storage or a temporary session system would add risk and throwaway behavior.

## Decision

Define an authenticated-identity dependency. In `AUTH_MODE=local`, it returns one configured development identity and ensures its profile exists. Configuration rejects local auth outside `ENVIRONMENT=local` or `test`. A later Cognito implementation will verify JWT signature, issuer, client/audience, token use, and expiry before creating the same identity shape.

Passwords and password hashes are never stored in HireFlux.

## Consequences

Local development remains free and deterministic, routes and services do not care how identity was established, and deployed misconfiguration fails at startup. Cognito integration remains real later work rather than a hidden stub.

