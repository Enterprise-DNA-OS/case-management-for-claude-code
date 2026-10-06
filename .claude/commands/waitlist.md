---
description: Who is waiting for a service, longest first, and opening a file when a worker is free - consent and a current safety check first.
---

1. Run `node scripts/cases.mjs waitlist --json` and `node scripts/cases.mjs team --json`.
2. Show the waitlist longest first with who referred each family, and next to it which workers have room (open files against their caseload cap) and a current safety check.
3. Suggest a match. When the operator agrees:
   - no consent yet: `node scripts/cases.mjs consent "<client>" --on=YYYY-MM-DD` once the collection notice has been given
   - then `node scripts/cases.mjs file open F-xxxx --worker="<name>"`
4. Anyone waiting past 30 days gets a check-in call: offer `node scripts/cases.mjs log "<client>" --kind=call --body="..."` to record it.
