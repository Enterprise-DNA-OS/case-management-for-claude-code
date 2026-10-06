---
description: Record a call, email, meeting or note on a client's file. In an audit or a subpoena, the file note is the record.
---

1. Confirm the client with `node scripts/cases.mjs client "<name>" --json` if the name is not exact.
2. Write the note in plain, factual language: who, what was said or done, what happens next. Opinions marked as opinions. No diagnoses.
3. Run `node scripts/cases.mjs log "<client>" --kind=call|email|meeting|note --body="..." [--worker="<name>"]`.
4. If the note describes harm or risk to a child or an adult, stop and ask whether a safety concern needs raising: `/concerns`.
