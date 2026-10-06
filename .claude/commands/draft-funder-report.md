---
description: Draft the written narrative for a funder report from the programme's numbers - delivery, outcomes, who was served, what changed, what is next. Drafts to drafts/; a person sends.
---

1. Run `node scripts/cases.mjs funder-report <CODE> --json` for the period, and `node scripts/cases.mjs programs --json` for the target pace.
2. Write `drafts/funder-report-<CODE>-<to-date>.md` in four short sections: delivery against target (numbers exactly as output), outcomes (with the number of pairs), who we served (from the demographics), and what we will do differently next period.
3. One de-identified case story only if the operator supplies it and confirms the client consented. Never write one from the file notes yourself.
4. Do not claim a trend from fewer than five outcome pairs. Do not round up.
5. `npm run docs -- funder-report` renders the numbers page to attach. A person submits.
