# Moving off Penelope

Penelope (Bonterra Penelope, formerly Athena Software) holds your cases, individuals,
service files, service events, groups, waitlists and funder setup. This guide moves the
working record across: programmes, clients, open service files and session history.

## What to export

Penelope has more than 130 standard reports. Most have no CSV button; the Penelope help
centre's documented route is to run the report, select the on-screen rows, copy, and paste
into Excel, which keeps the columns. Save each as CSV (UTF-8).

1. **The roster.** The *Worker Service Participant Roster* report (View All Reports, Case
   Service Reports). It lists every service file assigned to a worker with Service File ID,
   Service, Opened Date, Assigned Worker Role, Case Name, Case ID, Client, Client Date of
   Birth, Client Phone Number and Client Relationship. Run it per worker and add a `Worker`
   column with their name, or pass `--worker="Name"` per file.
2. **The session history.** A service event or attendance report for the period you want to
   keep, saved with these columns: `Service File ID`, `Event ID`, `Event Date`,
   `Duration (minutes)`, `Attendance`, `Worker`. Column names match without regard to case,
   and `Date`, `Duration`, `Status` and `Staff` are accepted too.
3. **Anything else** (goals, SCORE history, group attendance, documents): keep the Penelope
   exports in your records. Bringing those across is mapping work that depends on how your
   Penelope was configured; Enterprise DNA does it as part of a customised version.

If you subscribe to Penelope's Tableau online reports, those can download full data as text
files too. If you need a bulk extract of everything, ask Bonterra early, in writing, what
format and fee applies.

## Run it

```bash
npm run cases -- import penelope --roster=roster.csv --events=events.csv --dry-run
npm run cases -- import penelope --roster=roster.csv --events=events.csv
```

The dry run writes nothing and prints what would land: files, clients, sessions, the
programmes and workers it would create, and every row it cannot place. Re-running for real is
safe: files match on the Penelope Service File ID and sessions on the Event ID, so a second run
skips what is already there.

## What maps

| Penelope | Here |
|---|---|
| Service (on the roster) | a programme, matched by name or code; created if new |
| Client, Date of Birth, Phone, Case ID | a client, matched by name and date of birth; Case ID kept as `external_ref` |
| Service File ID, Opened Date, worker | an open service file `PEN-<id>`, review due in 30 days |
| Service event: date, duration, attendance, worker | a session; No Show becomes did not attend, Cancelled stays cancelled |
| Dates written DD/MM/YYYY | read as day first, as Australian and New Zealand exports write them |

## What does not carry over, on purpose

- **Session note text.** The roster and attendance reports do not include notes. Imported
  attended sessions carry the line "Imported from Penelope. The session note stays in the
  Penelope record." Keep Penelope read-only access (or a full export) for the retention period.
- **Consent.** Nothing in these reports proves consent was collected, so every imported client
  arrives without it and shows in `/attention`. Record it as you confirm each one. That list is
  the first audit.
- **Data Exchange state.** Penelope uploads to the Data Exchange itself, so imported attended
  sessions are marked reported on the import date. Pass `--dex-unreported` to leave them open
  instead, if your last upload is behind.
- **Funders, contracts, targets and periods.** New programmes arrive with no funder and a
  one-year period from today. Set each one before relying on `/programs` or `/funder-report`.
- **Workers' safety checks.** New workers arrive with none recorded, so the gate holds their
  sessions until you record each check.

## After the import

1. `/programs`: set funder, contract, period and targets for each programme.
2. `/team`: record each worker's safety check and last supervision.
3. `/attention`: consent, quiet files and missing scores, worst first.
4. Run both systems side by side for a reporting cycle, compare one funder report, then retire Penelope.
