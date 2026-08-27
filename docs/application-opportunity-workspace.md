# Applications opportunity workspace

The unfiltered Active Applications route is an operational workspace rather than a
chronological card collection. The server classifies every active application into
exactly one group: `needs_action`, `moving_forward`, or `waiting`. React maps the
returned reason and action codes to candidate-facing copy; it does not reimplement
classification or lifecycle policy.

Search, narrowing filters, All, Archived, and an explicit sort use the existing flat,
cursor-paginated application list. Removing those parameters returns Active to the
grouped workspace. Legacy `layout=cards|list` parameters are removed with route
replacement because there is now one compact flat-row presentation.

## Classification

The classifier evaluates missed interviews, overdue and today follow-ups, incomplete
preparation within 24 hours, offers, candidate-owned actions, future interviews,
process progress, and employer-owned waiting in that order. A prepared interview is
Moving forward even when it is less than 24 hours away. Application age and generic
`updated_at` recency never create urgency. Draft and terminal applications do not
enter the classifier.

The classifier uses the workspace's validated IANA time zone for calendar-day
boundaries. Instants remain UTC. The server returns semantic codes and relevant
dates/times, not final display sentences.

## Read model and API

`GET /api/v1/applications/workspace?preview_limit=4` queries the four active GSI2
status partitions plus the owner's opportunity-context partition on GSI1. It returns
bounded previews and exact group counts. Group expansion uses
`GET /api/v1/applications/workspace/groups/{group}` with a signed cursor scoped to
the owner, group, and classifier version.

The read path performs no Scan and no per-application interview query. A
`WORKSPACE_CONTEXT` item in each application partition stores only the earliest
scheduled interview ID/time and whether its preparation essentials are complete.
Interview mutations recompute that projection from the bounded application interview
partition and include the projection write in the canonical transaction. An
independent projection version prevents two interview-round mutations from silently
overwriting one another.

Existing local data must be rebuilt with the guarded local projection reconciliation
command or by resetting/reseeding the disposable local demo table. Reconciliation is
the only intentional Scan path.

## Performance validation

The bounded initial response contained 5 items for a five-record workspace and no
more than 12 items at 20, 75, 150, and 500 records. Serialized payloads ranged from
5.2 KiB to 12.9 KiB. Pure classification at 500 records measured 1.07 ms median and
1.21 ms p95 on the local validation host.

Warm Moto-backed endpoint measurements were 140 ms p50 / 152 ms p95 at 150 records
and 891 ms p50 / 950 ms p95 at 500 records. The 500-record result exceeds the 300 ms
investigation threshold. Profiling isolated that cost to Moto's in-process GSI query
emulation rather than classification or response serialization. AWS staging must
repeat the endpoint measurement against DynamoDB before the maximum-bound workload
is considered performance-qualified; the read contract remains four independent
status queries plus one context query with no N+1.

## Product boundaries

- Home summarizes today's cross-workspace action center.
- Applications organizes opportunity-level work and retrieval.
- Interviews owns full preparation, round resolution, and debriefing.
- Analytics explains aggregate search patterns.

The Applications collection never mutates follow-ups, interviews, or status directly.
It routes the candidate to the authoritative opportunity or interview workspace.
