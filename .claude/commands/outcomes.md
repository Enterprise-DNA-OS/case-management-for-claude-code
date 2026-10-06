---
description: Outcome scores (SCORE: circumstances, goals, satisfaction on a 1 to 5 scale) - record pre, review and post scores, see change by programme, and find files missing a score the funder expects.
---

1. Run `node scripts/cases.mjs outcomes --json` (add `--program=CODE` for one programme).
2. Show per programme and domain: pairs, average start, average end, share improved. Then the files missing a score.
3. To record scores: `node scripts/cases.mjs score <file> --kind=pre|review|post --circumstances=N --goals=N [--satisfaction=N]`. Satisfaction belongs on the post score.
4. Never present an improvement percentage built on fewer than five pairs as a finding. Say how many pairs it rests on.
