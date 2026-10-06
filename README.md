<h1 align="center">Case Management for Claude Code</h1>

<p align="center">
  <strong>The open-source community services case management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Penelope data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=penelope">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/penelope?utm_source=github&utm_medium=readme&utm_campaign=penelope">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#compliance-checked-against-the-data">Compliance</a> &bull;
  <a href="#ten-questions-penelope-cannot-answer">Ten questions</a> &bull;
  <a href="#instead-of-penelope">Instead of Penelope</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Case Management for Claude Code does the job you pay Penelope for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and run the service in plain language. It runs the right query, and it can answer questions Penelope's standard reports cannot.

Bonterra does not publish Penelope's price. Software directories list it per named user per year, aimed at organisations with 25 or more users, and reviewers report the bill growing as users and modules are added and a paid project to get a full data extract out. What a counselling, family or youth service actually needs to hold is ordinary: funders and the programmes they fund, workers with their safety checks, clients with consent, referrals, service files, sessions with notes, goals, outcome scores and safety concerns. That is eleven Postgres tables, and the reporting layer the licence pays for is a handful of SQL views over them.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=penelope).

It is built for community services organisations in Australia and New Zealand: family and relationship services, parenting support, youth counselling, family violence case management, financial counselling. It carries the work those services repeat every week:

```
/attention        everything that wants a decision this morning, worst first
/intake           new referrals, answered inside five days
/waitlist         who is waiting longest, and who has room
/caseload         open files by worker, quiet and overdue ones loud
/sessions         the week's diary, unresolved and unnoted sessions first
/outcomes         SCORE pre and post, change by programme
/programs         delivery against each funding agreement
/funder-report    the numbers a funder asks for
/dex              Data Exchange sessions not yet reported, by period
/compliance       nine rules from the Acts, the Protocols and your own standards
```

The sharp edges are deliberate, because in this sector a soft edge is a child at risk or a funder finding:

- **A worker whose safety check has expired does not take a session.** Booking, logging, opening and reassigning a file all refuse, and there is no force flag.
- **A file does not open without privacy consent on record.** APP 5 in Australia, IPP 3 in New Zealand.
- **An attended session without a note cannot be recorded.** The note is the record of the service.
- **An outcomes programme file does not close without a closing score**, or a recorded reason it could not be collected.
- **A mandatory safety concern does not close until its report to the statutory agency is on record.** Whether to report is the worker's call; the record of it is not optional.

**Nothing here connects to the Data Exchange, a funder or an agency, and nothing sends.** Reports and letters draft to files in your brand; a person submits and sends them. There are no clinical records by design: no diagnoses, no medications. Nothing here is legal advice.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your client records sit in plain Postgres tables you own. Any tool can read them. No extraction fee when you leave.
- No per-user licences, no modules. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/case-management-for-claude-code.git
cd case-management-for-claude-code
npm install
npm run demo
```

`npm run demo` creates the database, loads Harbourside Family Services (a fictional Newcastle NSW provider with four funded programmes and a month going quietly wrong: a child protection disclosure two days old with no report on record, a family worker booked next week on a Working with Children Check that expired twelve days ago, a referral from the hospital unanswered for eight days, two sessions that missed a closed Data Exchange period, a youth session with no note, a client seen three times with no consent recorded, a family waiting 41 days, a file gone quiet, a review overdue, supervision overdue and a funder report due in nine days), then prints the attention list and the compliance check.

Then open the folder in Claude Code and type:

```
/attention
```

Try `/waitlist`, `/team`, `/outcomes`, `/funder-report FRS`, `/weekly-review`. When you are ready for real data, delete `.data/` and start with `/import`.

Fill in the "Who this is for" block in [CLAUDE.md](CLAUDE.md), especially your funders and who reports safety concerns, and put your name and colours in [brand.json](brand.json) so every report carries them.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-user fee. The intake worker, the counsellors and the team leader each clone the repo, point at the same `DATABASE_URL`, and work in their own Claude Code. Hosted, choose an Australian or New Zealand region for client records.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that wants a decision, worst first: an unreported mandatory concern outranks all. |
| `/intake` | New referrals and their age; accept onto the waitlist or decline with a reason. |
| `/waitlist` | Longest wait first, matched against who has room and a current check; open the file. |
| `/caseload` | Open files by worker: last contact, next booking, QUIET and REVIEW OVERDUE loud. |
| `/client` | One client's whole card: alert, consent, files, sessions, goals, concerns, notes. |
| `/sessions` | The diary: book, log, resolve, add the missing note, through the gates. |
| `/log` | A call, email or meeting on the file. In an audit, the record. |
| `/goals` | Case plan goals in the client's words, progress at each review. |
| `/outcomes` | SCORE pre, review and post; change by programme; files missing a score. |
| `/team` | Safety checks, supervision, caseload against cap; record renewals. |
| `/concerns` | Raise a safety concern, record the report, close it. |
| `/programs` | Delivery against each funding agreement, against the share of the period gone. |
| `/funder-report` | Clients, sessions, hours, outcomes, who was served, referral sources, for a period. |
| `/dex` | Data Exchange sessions not yet reported, by period and close-off date. |
| `/weekly-review` | The Monday review, written from three commands. |
| `/compliance` | Nine rules, each with its source, run against your records. |
| `/close-file` | Closing scores, goals, bookings cancelled, reason recorded. |
| `/draft-referral-response` | The reply to a referrer. Drafts only. |
| `/draft-funder-report` | The written narrative for a funder report. Drafts only. |
| `/draft-closure-letter` | The letter to a client when their file closes. Drafts only. |
| `/import` | Bring the service across from Penelope. The import is the first audit. |
| `/customise` | Add a field, change a rule, rename things, in plain language. |
| `/new-view` | Add a read-only HTML dashboard from a description. |

Everything the commands do, the CLI does: `npm run cases -- help`. Any read command takes `--json`.

### Documents and views, in your brand

```bash
npm run docs    # funder reports, case summaries, worker files
npm run view    # the week and the funders, as read-only HTML dashboards
```

Both read [brand.json](brand.json). Documents land in `docs-out/`, views in `views/`. Print either to PDF from the browser. `/new-view` adds a view, `documents.json` adds a document.

## Compliance, checked against the data

`/compliance` runs the rules in [docs/compliance.md](docs/compliance.md) against your records and reports what is breached, each rule citing its source:

1. Mandatory safety concerns are reported to the statutory agency (Children and Young Persons (Care and Protection) Act 1998 (NSW) s27; NZ Children's Act 2014 child protection policy).
2. Every worker taking sessions holds a current safety check on the session date (Child Protection (Working with Children) Act 2012 (NSW); NZ Children's Worker safety check regulations 2015).
3. Every open file has privacy consent on record (Privacy Act 1988 APP 5; NZ Privacy Act 2020 IPP 3).
4. Data Exchange sessions are reported before the period's 30 day close-off (DSS Data Exchange Protocols).
5. Every attended session has a note within two days (your records standard).
6. Outcome programmes score every file at the start and at closing (Data Exchange SCORE; your funding agreement).
7. Practitioners receive supervision on schedule (AASW Supervision Standards; your policy).
8. Every referral gets a response within five days (your service standard).
9. Open files are reviewed on schedule (your case review standard).

Nothing there is legal advice. It is the rule book you point the system at, and you change it to match your state, country and contracts.

## Ten questions Penelope cannot answer

Every one of these is answered by the demo data today. Yours will be different, and that is the point.

1. Which mandatory concerns are open with no report on record, and for how many days?
2. Which workers are booked in the next week on a safety check that has already expired?
3. Which families have waited longest, and which worker with a current check has room to take them this week?
4. Which referrals have had no answer for more than five days, and who sent them?
5. Which Data Exchange sessions missed a period that has already closed?
6. Which open files have had no contact in three weeks and nothing booked?
7. Which files in an outcomes programme are two sessions in with no starting score, and which closed with no closing score?
8. For each programme, how does delivery compare with the share of the funding period already gone?
9. Which clients are being seen with no privacy consent on record?
10. Which practitioners are overdue supervision, and how many open files does each carry against their cap?

## Your first hour: ten things to ask for

Open the folder in Claude Code and say these in your own words. Each one changes the system to fit your organisation.

1. "Put our real programmes in, with each funder, contract number, period and targets."
2. "Load our workers with their Working with Children Check numbers and expiry dates."
3. "Import our Penelope roster and attendance reports, then show me what the old system never told us."
4. "Our referral standard is three working days, not five. Change the rule."
5. "Add a field for the client's iwi and report it in the funder report."
6. "Add group programmes: a group, its sessions, and who attended each."
7. "We are in New Zealand. Swap the NSW rules for the Children's Act and Oranga Tamariki reporting."
8. "Put our logo and colours on the funder report and the case summary."
9. "Every Friday, draft a note to each worker listing their unnoted sessions and quiet files."
10. "Write a command that drafts the quarterly report for our state contract in their template's order."

`/customise` writes the migration, applies it, updates every command that touches the change, and runs the tests.

## Instead of Penelope

Run Penelope's Worker Service Participant Roster and a service event report, copy them into Excel as the Penelope help centre describes, save as CSV, and run one command. Step by step, with what maps and what deliberately does not carry over: [docs/replace-penelope.md](docs/replace-penelope.md).

```bash
npm run cases -- import penelope --roster=roster.csv --events=events.csv --dry-run
npm run cases -- import penelope --roster=roster.csv --events=events.csv
```

The import is the first audit: every imported client arrives without consent on record, every new worker without a safety check, and both are loud the moment the import finishes.

## Architecture

```
case-management-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  brand.json                your name and colours on every document and view
  views.json                the HTML dashboards npm run view renders
  documents.json            the paperwork npm run docs renders
  .claude/commands/         the slash commands
  scripts/cases.mjs         the CLI the commands drive
  scripts/view.mjs          read-only HTML dashboards from the SQL views
  scripts/docs.mjs          the documents, one HTML file per record
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema, tables and views
  supabase/seed.sql         demo data
  docs/compliance.md        the rules /compliance checks, each with its source
  docs/replace-penelope.md  moving off Penelope
  docs/why-no-front-end.md  the honest trade-offs
  drafts/                   anything written for a person to send
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end, no clinical records, nothing that sends, and the safety check, consent, note, score and concern gates stay.

## Want it installed and run for you?

Enterprise DNA installs Case Management for Claude Code for your business, migrates your Penelope data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=penelope)
- Read more: [enterprisedna.co/omni/instead-of/penelope](https://enterprisedna.co/omni/instead-of/penelope?utm_source=github&utm_medium=readme&utm_campaign=penelope)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
