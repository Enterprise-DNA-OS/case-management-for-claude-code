---
description: Draft the reply to a referrer - accepted, waitlisted with the expected wait, or declined with where to go instead. Drafts to drafts/; a person sends.
---

1. Run `node scripts/cases.mjs referrals --all --json` and `node scripts/cases.mjs waitlist --json` for the referral and the current wait.
2. Write to `drafts/referral-response-R-xx.md`: who it is to (the referrer and contact from the record), the client's first name only, the decision, and the next step. Waitlisted: the current longest wait in weeks, and who to call if risk rises. Declined: the reason exactly as recorded and the service suggested instead.
3. No clinical detail, no detail of the disclosure, nothing the client has not consented to share.
4. A person reads it, checks consent to share, and sends. Nothing sends from here.
