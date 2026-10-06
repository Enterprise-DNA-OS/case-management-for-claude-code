---
description: The numbers a funder asks for, for one programme and period - clients, sessions, hours, files opened and closed, outcomes, who was served and where referrals came from.
---

1. Run `node scripts/cases.mjs funder-report <CODE> --json [--from=YYYY-MM-DD --to=YYYY-MM-DD]`. The default period is the programme's funding period to today.
2. Present the delivery numbers against target first, then outcomes (with the number of pairs), then who was served, then referral sources.
3. `npm run docs -- funder-report` renders it as a branded page to print or attach.
4. For the written narrative that goes with it, use `/draft-funder-report`.
5. Never round a number up or add a figure that is not in the output.
