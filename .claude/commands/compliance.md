---
description: Check the records against the rules this organisation works under (listed with sources in docs/compliance.md) and report what is breached, with the rule and source cited.
---

1. Run `node scripts/cases.mjs compliance --json`.
2. Present a table: rule, breaches, the worst example, the source. Breached rules first, clean ones in one line at the end.
3. For each breach, give the action that clears it (the same actions `/attention` uses). Draft any letter to `drafts/`; never send.
4. If a rule in `docs/compliance.md` is out of date or does not apply to this organisation (NZ rather than NSW, a different funder), say so and stop. The operator confirms the rule; then update the doc and the `RULES` list in `scripts/cases.mjs` together and run `npm test`.

Nothing here is legal advice. The doc records the rules the operator has told the system to enforce, with sources, and this command checks the data against them.
