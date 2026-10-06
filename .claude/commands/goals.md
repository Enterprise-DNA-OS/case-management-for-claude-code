---
description: Case plan goals - set them in the client's words, record progress at each review, and see which have stalled.
---

1. Run `node scripts/cases.mjs goals --json` (or `goals <file>` for one file).
2. Show goals by client with progress and when each was last reviewed. Name the ones not reviewed in 30 days.
3. To change them:
   - `node scripts/cases.mjs goals add <file> --goal="in the client's words" [--target=YYYY-MM-DD]`
   - `node scripts/cases.mjs goals update G-xx --progress=60 [--status=achieved|discontinued]`
4. Goals are the client's, not the worker's. Keep their words.
