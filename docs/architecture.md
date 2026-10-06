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
- [Production account readiness and Phase 2/3A/3B/3C/3D handoffs](production-account-readiness.md)
- [Local CDK environment foundation](../infra/README.md)
- [CDK environment decision](adr/0008-aws-cdk-environment-foundation.md)
- [Backend Lambda packaging and runtime contract](../backend/README.md)
- [Lambda runtime and packaging decision](adr/0009-lambda-runtime-and-deterministic-packaging.md)
- [DynamoDB cloud schema and lifecycle decision](adr/0010-dynamodb-cloud-lifecycle.md)
- [Lambda, IAM, secrets and HTTP API boundary](adr/0011-lambda-http-api-security-boundary.md)
- [Durable local workspace bootstrap decision](adr/0005-durable-local-workspace-bootstrap.md)
- [Frontend workspace session boundary](adr/0006-frontend-workspace-session-boundary.md)
- [Durable manifest, write guards, and erasure](adr/0007-durable-workspace-manifest-and-erasure.md)
- [Architecture decision records](adr/)
