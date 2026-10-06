---
description: Data Exchange (Australian DSS funded programmes) - attended sessions not yet reported, by reporting period, and recording an upload a person has made.
---

1. Run `node scripts/cases.mjs dex --json` (add `--all` for every session).
2. Show each reporting period with its close-off date (30 days after 30 June and 31 December) and the count of unreported sessions. LATE means the period has closed with sessions missing: say so first.
3. This system does not connect to the Data Exchange. A person uploads (bulk file or the web portal). When they have: `node scripts/cases.mjs dex mark --through=YYYY-MM-DD`.
4. NZ organisations without DSS funding can ignore this command; their funder reporting is `/funder-report`.
