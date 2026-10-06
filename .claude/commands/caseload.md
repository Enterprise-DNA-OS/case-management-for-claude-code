---
description: Open files by worker or programme, with when each client was last seen, what is booked next and which files have gone quiet or are overdue a review.
---

1. Run `node scripts/cases.mjs files --json`, adding `--worker="<name>"` or `--program=CODE` if the operator named one.
2. Group by worker. For each file: client, programme, sessions so far, last contact, next booking, state.
3. Call out the states that need action: QUIET (21 days, nothing booked), REVIEW OVERDUE, NO CONSENT.
4. Compare each worker's open files with their caseload cap from `node scripts/cases.mjs team --json` and say who has room and who is over.
