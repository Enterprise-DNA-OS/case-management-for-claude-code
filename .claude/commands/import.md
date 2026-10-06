---
description: Bring the organisation across from Penelope (or any case system that exports CSV) - programmes, clients, service files and session history. The import is the first audit.
---

1. Read `docs/replace-penelope.md` first: which Penelope reports to export, how to save them as CSV, what maps and what stays behind.
2. Always dry-run first: `node scripts/cases.mjs import penelope --roster=<roster.csv> --events=<events.csv> --dry-run --json`. Walk the operator through the counts, every programme and worker it would create, and every problem row.
3. Then for real, without `--dry-run`. Re-running is safe: files and sessions match on their Penelope ids and are skipped the second time.
4. After it lands:
   - set each created programme's funder, contract and period (ask; `/customise` if a field is missing)
   - record each created worker's safety check (`/team`)
   - record consent for each imported client as the collection notice is confirmed
5. Then run `/attention` and show the operator what the old system never told them.
