# Data export

HireFlux has two export capabilities with different audiences. Both are scoped
to the verified identity on the server; the browser cannot choose another
owner or upgrade a demo session.

## Application CSV

`GET /api/v1/me/applications/export` returns one application per CSV row with
the user-facing fields Company, Job Title, Status, Preparation Role Family,
Applied Date, Source, Source Detail, Location, Work Mode, Follow-up Date,
Next-step Responsibility, Next-step Note, Job URL, Salary, Description, Created
At, and Updated At. Optional values are blank, and a standard CSV
writer escapes commas, quotes, line breaks, and Unicode safely. User-controlled
text whose first non-whitespace character is `=`, `+`, `-`, or `@` is prefixed
with an apostrophe before serialization so spreadsheet software treats it as
text rather than a formula. The response
uses an attachment filename such as
`hireflux-applications-2026-08-23.csv`, plus `Cache-Control: no-store`.

Demo sessions can use this export to inspect their fictional sample data. The
application service still performs the owner-scoped repository query; no
DynamoDB scan is introduced.

## Full account data

`GET /api/v1/me/export` remains the machine-readable JSON export for backup and
data portability. It includes the existing versioned profile, settings,
applications (including role family and next-step fields), activities, notes,
interviews (including compatible reflection fields), and counts, and retains
the synchronous record limit and `no-store` response headers. Preparation and
reflection remain candidate-owned private export data; they are not promoted
into Analytics or activity summaries.

Temporary demo identities receive `403 FORBIDDEN` for this endpoint. The
frontend therefore presents sample CSV export in a demo workspace and does
not frame fictional, expiring data as an account archive. A future persistent
account can expose the JSON portability action without changing the endpoint
contract.

## Future production path

Large production exports should become asynchronous: create an export job, read
resources in bounded pages, write a complete artifact to S3, and return a
short-lived download URL. Import/restore, ZIP archives, and separate notes or
interviews CSV files are not part of the local demo.
