---
description: Close a service file properly - closing scores, goals reviewed, bookings cancelled, the reason recorded, and a closure letter drafted.
---

1. Run `node scripts/cases.mjs client "<client>" --json` and read the file's goals, scores and bookings.
2. If the programme needs outcome scores and there is no post score: collect it (`node scripts/cases.mjs score <file> --kind=post --circumstances=N --goals=N --satisfaction=N`) or record why it could not be (`--no-post-reason="..."` on the close).
3. Update each active goal: `goals update G-xx --status=achieved|discontinued`.
4. Close: `node scripts/cases.mjs file close <file> --reason="Goals achieved|Client disengaged|Referred on|Moved away"`. Any booked sessions are cancelled.
5. Offer `/draft-closure-letter`.
