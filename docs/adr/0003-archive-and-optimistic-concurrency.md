# ADR 0003: Reversible archive and optimistic concurrency

- Status: Accepted
- Date: 2026-08-10

## Context

Permanent deletion is risky in a tracker and complicates related activity. Concurrent browser tabs could also overwrite newer edits.

## Decision

The delete operation archives an application. The previous status is retained so restore can return only to that status. Updates and transitions carry an expected numeric version and use DynamoDB conditional writes. Status changes and activity appends are transactional in Milestone 1.

## Consequences

Users do not accidentally lose tracked history, restore cannot bypass the transition policy, and stale writes receive a conflict instead of silently winning. A future retention/erasure feature can implement deliberate permanent deletion separately.

