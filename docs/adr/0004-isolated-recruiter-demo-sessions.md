# ADR 0004: Isolated temporary recruiter demo workspaces

- Status: Accepted
- Date: 2026-08-11

## Context

A literal shared demo account would give every recruiter the same owner identity and therefore the same applications. Creating a Cognito account for every anonymous visit would add account lifecycle, quota, cleanup, and user-interface complexity to a demo that intentionally has no signup.

## Decision

The public landing page creates an isolated temporary workspace. The backend generates a random owner UUID, seeds fictional data through the ordinary application services, and returns an HMAC-signed 24-hour bearer token. Protected routes derive ownership only from that verified token. The browser stores it in tab-scoped session storage, clears user-specific query data when identity changes, and never sends ownership in a request body.

Profile, application, activity, and quota items carry the workspace expiry as the DynamoDB `expires_at` TTL attribute. Each workspace has an atomic lifetime application limit. Authorization ends at token expiry; it never depends on DynamoDB's asynchronous physical deletion. Reset creates a new identity before switching the browser to the fresh workspace.

The local fixed identity remains available for deterministic backend tests. Cognito is deferred until HireFlux needs persistent personal accounts.

## Consequences

Simultaneous recruiters can safely use the same one-click entry point without sharing data. The demo has no passwords, signup, recovery, or email cost. Production still requires edge throttling, constrained compute, workspace record limits, monitoring, and budget alerts because a public button can be automated.
