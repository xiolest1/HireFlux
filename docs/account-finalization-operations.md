# Account finalization reconciliation

This is a future, separately owner-authorized operator procedure, implemented
and tested locally in [Phase 5D](phase5d-account-lifecycle-handoff.md). It grants
no permission to access AWS. Phase 5D made no provider call or deployed change.

## Normal behavior

Persistent account DELETE requires a verified access token, fresh uncached
userInfo admission, signed `auth_time` within 300 seconds and the exact
`DELETE_MY_ACCOUNT` confirmation. The server derives ownership from the verified
subject. The existing erasure service freezes ACTIVE to DELETING, processes its
existing bounded work, and strongly proves DELETED before provider finalization.

The minimal non-TTL WORKSPACE tombstone adds `provider_finalization` and, only
on confirmed completion, `provider_finalized_at`. No email, credential, provider
profile or application payload is retained. PENDING means no ambiguous dispatch
is outstanding. REVIEW_REQUIRED is written conditionally **before** the one
AdminDeleteUser attempt. COMPLETE means confirmed absence/deletion plus the
conditional tombstone completion. A lost response, timeout or completion-write
failure therefore cannot cause a later browser request to repeat the delete.
Explicit provider rejection can return to PENDING; another attempt still requires
a new confirmed recent-authentication flow. No automatic retry occurs.

The runtime's only Cognito administrative permission is `cognito-idp:AdminDeleteUser`
on its own pool ARN. It has no user-listing, creation, read-administration or
general user-management permissions. Client status remains authenticated and
owner-scoped. If the user can no longer authenticate, use operator evidence;
there is no public ownership/status lookup or browser bypass.

## Operator review after an uncertain outcome

1. Obtain separate owner approval for the exact pool, table, subject and operations.
   Use the existing temporary non-root `hireflux-operator` profile in us-east-1.
   Verify the full account against the reviewed release, ending 9465. Never use an
   email address as the deletion/reconciliation target.
2. Independently establish pool ID/ARN, table ARN and trusted original subject
   from the qualified release and owner-approved evidence. Do not accept an
   unauthenticated requester's subject. If provenance is uncertain, STOP.
3. Review a strongly consistent exact WORKSPACE item. It must be PERSISTENT,
   bootstrap version 1, DELETED with start/completion timestamps, no TTL, and
   PENDING or REVIEW_REQUIRED. Missing/replaced tables or tombstones are a STOP;
   do not reconstruct ownership or resurrect the workspace.
4. Review the exact pool metadata: email username attributes, no alias attributes,
   exact pool ID/ARN. Read AdminGetUser using the canonical subject. A found user
   must have matching Username and exactly one matching sub. A denied request,
   malformed response or mismatched user/pool does not prove absence.
5. If the canonical user is absent, first review without applying. Only after
   accepting that evidence, authorize the exact conditional completion update.
   Recheck absence and the tombstone at apply time. The helper cannot delete a
   provider identity or erase data.
6. If the canonical user still exists, leave REVIEW_REQUIRED unchanged. Separately
   approve any manual canonical-user deletion after rechecking terminal erasure.
   Then independently verify absence and conditionally finalize. Do not rearm the
   public deletion path or blindly repeat a dispatch.

`backend/scripts/reconcile_account_finalization.py` is inert without `--live`:

```bat
backend\.venv\Scripts\python.exe backend\scripts\reconcile_account_finalization.py
```

It prints OFFLINE_ONLY before creating a boto3 session. Future approved use needs
`--live --account <exact-account> --pool-id <exact-pool> --table-arn <exact-arn>
--owner-sub <verified-sub>`. Without `--apply`, this is a metadata/strong-read
review; with `--apply`, only verified provider absence permits one conditional
terminal-item update. **Neither live mode is authorized by Phase 5D.**

The future operator needs STS identity, exact-pool DescribeUserPool/AdminGetUser
and exact-table/item GetItem/UpdateItem access. The script checks temporary
credentials, non-root STS identity, regional endpoints and pool configuration;
it uses one SDK attempt and fixed safe error output. AdminGetUser can count the
user as monthly active; include the review in the approved cost budget.
[AWS cost behavior](https://docs.aws.amazon.com/cognito/latest/developerguide/tracking-cost.html).

## Retained identities and staging loss

The proposed pool is protected and RETAIN. The existing staging table remains
disposable: no PITR, no deletion protection and destructive stack removal policy.
Retained Cognito users do not restore application records or lost tombstones.
If the table is lost, preserve identity evidence and STOP; separately decide
whether to retire the exact test identities. Do not treat an empty recreated
table as proof that erasure completed.

Use fictional job records and owner-controlled test identities. Real emails are
personal identity data even when applications are fictional. At the end of an
approved 5E window, record each identity's final disposition; do not leave test
identities or an open registration window unattended. Disabling registration or
pausing requests does not delete retained identities or stop existing AWS costs.
Irreplaceable personal records require a separate storage/recovery/cost decision.
