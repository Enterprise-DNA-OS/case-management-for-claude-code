---
description: The intake desk - new referrals, how long each has waited for an answer, and accepting, waitlisting or declining them with a reason the referrer can act on.
---

1. Run `node scripts/cases.mjs referrals --json`. Lead with anything unanswered past five days.
2. For each new referral, say what it asks for and which programme fits. The operator decides; you run:
   - accept onto the waitlist: `node scripts/cases.mjs referrals accept R-xx --program=FRS`
   - decline: `node scripts/cases.mjs referrals decline R-xx --reason="..."` (the reason must tell the referrer where to go instead)
   - a new one by phone or email: `node scripts/cases.mjs referrals add --name="..." --source="..." --program=... --reason="..."`
3. After any decision, offer `/draft-referral-response` so the referrer hears back the same day.
4. An accepted referral sits on the waitlist until consent is recorded and a worker is free. Point at `/waitlist` for that.
