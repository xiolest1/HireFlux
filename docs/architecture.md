# Architecture documentation

The canonical end-to-end architecture overview is
[ARCHITECTURE.md](../ARCHITECTURE.md). It documents the implemented local
system, dependency boundaries, authentication and authorization flow, DynamoDB
model, read/write flows, planned AWS staging architecture, service-selection
rationale, security posture, and deferred services.

Detailed supporting contracts remain in this directory:

- [DynamoDB access patterns](dynamodb-access-patterns.md)
- [Domain model](domain-model.md)
- [Application status transitions](status-transitions.md)
- [Dashboard and analytics](dashboard-and-analytics.md)
- [Deployment environments](deployment-environments.md)
- [Roadmap](roadmap.md)
- [Production account readiness and Phase 2/3A–3G handoffs](production-account-readiness.md)
- [Final combined AWS review and Phase 4 conditions](production-account-readiness.md#46-phase-3g-final-synthesized-review-and-handoff)
- [Phase 4A source checkpoint and remote CI qualification](production-account-readiness.md#47-phase-4a-source-control-and-remote-ci-qualification)
- [Phase 4B read-only AWS preflight and blocked bootstrap](production-account-readiness.md#48-phase-4b-read-only-aws-preflight-and-blocked-bootstrap)
- [Local CDK environment foundation](../infra/README.md)
- [CDK environment decision](adr/0008-aws-cdk-environment-foundation.md)
- [Backend Lambda packaging and runtime contract](../backend/README.md)
- [Lambda runtime and packaging decision](adr/0009-lambda-runtime-and-deterministic-packaging.md)
- [DynamoDB cloud schema and lifecycle decision](adr/0010-dynamodb-cloud-lifecycle.md)
- [Lambda, IAM, secrets and HTTP API boundary](adr/0011-lambda-http-api-security-boundary.md)
- [Static Amplify hosting and origin wiring](adr/0012-amplify-hosting-origin-wiring.md)
- [Operational logs, alarms, scaling and cost guardrails](adr/0013-operational-guardrails.md)
- [Frontend hosting/build validation](../frontend/README.md)
- [Durable local workspace bootstrap decision](adr/0005-durable-local-workspace-bootstrap.md)
- [Frontend workspace session boundary](adr/0006-frontend-workspace-session-boundary.md)
- [Durable manifest, write guards, and erasure](adr/0007-durable-workspace-manifest-and-erasure.md)
- [Architecture decision records](adr/)
