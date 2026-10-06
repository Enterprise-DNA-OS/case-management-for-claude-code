---
description: Everything that wants a decision this morning, worst first. An unreported mandatory concern outranks everything, then a worker booked on an expired safety check, then unanswered referrals, missing consent and late Data Exchange sessions.
---

1. Run `node scripts/cases.mjs attention --json`.
2. Present it worst first, grouped by reason, in plain words. Anything rank 1 or 2 (an unreported child protection or family violence concern, a worker booked on an expired check) is today's first phone call: say so in the first line.
3. For each group, give the one action that clears it: `concerns report K-xx --to="..."`, `check "<worker>" --expires=` or `file assign <file> --worker=`, `referrals accept|decline R-xx`, `consent "<client>"`, `dex mark --through=` once a person has uploaded, `note <session> --note=`, `session done|dna|cancel <session>`, `file review <file>`, `score <file> --kind=pre`, `supervision "<worker>"`.
4. Never show safety alert text or concern detail beyond what the operator needs to act. If the list is empty, say so in one line and stop.
