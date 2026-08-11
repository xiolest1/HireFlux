# ADR 0001: Use a single DynamoDB table

- Status: Accepted
- Date: 2026-08-10

## Context

HireFlux targets a very low-traffic serverless AWS demo. Its reads are predominantly scoped to one authenticated user or one owned application. The original design language mentioned relational modeling, but the required deployment stack and access patterns point to DynamoDB.

## Decision

Use one DynamoDB table with explicit item types, owner/application partitions, and sparse overloaded indexes documented before implementation. Do not use `Scan` in normal request paths. Keep persistence behind repository protocols so business rules are not coupled to DynamoDB expressions.

## Consequences

The design is inexpensive, operationally small, and maps directly to known queries. It requires deliberate denormalized projections, transactional maintenance for some aggregates, and migrations when indexes change. Ad hoc relational queries are intentionally not optimized.

