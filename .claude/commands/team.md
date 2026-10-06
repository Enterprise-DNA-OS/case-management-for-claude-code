---
description: The workers - safety check state, supervision, caseload against cap and bookings next week. Record a renewed check or a supervision session.
---

1. Run `node scripts/cases.mjs team --json`.
2. Show it with EXPIRED, NONE and OVERDUE loud. A worker on an expired check with sessions booked is today's problem: name the sessions (`/sessions`).
3. Record changes:
   - renewed check: `node scripts/cases.mjs check "<name>" --expires=YYYY-MM-DD --ref=...`
   - supervision held: `node scripts/cases.mjs supervision "<name>" [--on=YYYY-MM-DD]`
   - move a file: `node scripts/cases.mjs file assign <file> --worker="<name>"`
4. `npm run docs -- worker-file` renders each worker's file for an auditor.
