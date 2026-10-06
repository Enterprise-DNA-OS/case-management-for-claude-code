---
description: Safety concerns - child protection, family violence, self-harm, adults at risk. Raise one, record the report to the statutory agency, close it. Mandatory concerns cannot close unreported.
---

1. Run `node scripts/cases.mjs concerns --json`. Any mandatory concern with no report is the first line, with how many days it has been open.
2. To raise one: `node scripts/cases.mjs concerns add "<client>" --kind="child protection" --detail="what was disclosed or seen, in plain words" [--mandatory]`.
3. Once a person has made the report: `node scripts/cases.mjs concerns report K-xx --to="<agency>" --ref=<their reference> [--on=]`.
4. Close with `node scripts/cases.mjs concerns close K-xx` when the safety plan no longer needs active work.
5. You do not decide whether a concern meets the reporting threshold, and you never contact an agency. The worker and their supervisor decide and report; you keep the record straight.
