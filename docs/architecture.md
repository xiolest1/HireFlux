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
- [Architecture decision records](adr/)
