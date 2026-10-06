---
description: The session diary - what is booked in the next week, what was booked and never resolved, which attended sessions have no note - and booking, logging and resolving sessions through the gates.
---

1. Run `node scripts/cases.mjs sessions --json` (add `--days=14` for a longer look).
2. Show the unresolved and unnoted ones first, then the week ahead by day.
3. The operator says what happened; you run one of:
   - `node scripts/cases.mjs session log <file or client> --note="..." [--on= --minutes= --mode=]`
   - `node scripts/cases.mjs session done <S-ref> --note="..."`, `session dna <S-ref>`, `session cancel <S-ref>`
   - `node scripts/cases.mjs session book <file or client> --on=YYYY-MM-DD [--worker=]`
   - `node scripts/cases.mjs note <S-ref> --note="..."` for an attended session missing its note
4. The gates refuse a worker on an expired safety check, a file that is not open, and an attended session with no note. Say why, then fix the cause. There is no override.
5. If a file has no starting outcome score after the session, say so and offer `/outcomes`.
