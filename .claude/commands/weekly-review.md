---
description: The Monday review, written from three commands - what needs a decision, how each programme sits against its funding agreement, and whether the team and the week ahead are safe.
---

1. Run, `--json` each: `node scripts/cases.mjs attention`, `node scripts/cases.mjs programs`, `node scripts/cases.mjs team`.
2. Write four short sections, prose plus small tables, nothing invented:
   - **Today's decisions.** The attention list, worst first, one action each. An unreported mandatory concern or a worker booked on an expired check is the first line of the whole review.
   - **Funders.** Delivery against target and the share of the period gone, reports due in the next 30 days, Data Exchange sessions due before the period closes.
   - **Intake.** New referrals and their age, the waitlist and its longest wait.
   - **The team.** Checks expiring inside 30 days, supervision overdue, caseloads over cap.
3. End with at most five actions for the week, each one doable with a single command or phone call.
4. On paper: `npm run view` renders the week and funders pages in the organisation's brand.
