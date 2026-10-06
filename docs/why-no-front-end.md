# Why there is no front end

Penelope is a database with a subscription. The records underneath it are ordinary: clients,
service files, sessions, goals, outcome scores, referrals, funders. What you pay for is the
layer on top that lets people who do not write SQL get at them. Screens, forms, the waitlist
page, a hundred and thirty standard reports.

That layer used to be the whole product, because talking to a database was hard. It is not
hard any more. Open this folder in Claude Code, describe what you want, and it runs the query
and explains the answer. Ask a question no standard report covers and you still get an answer.

## What you gain

- **Better answers.** "Which families have waited longest, and who has room this week?" is one
  question, not two reports and a spreadsheet.
- **No per-user licences.** The intake worker, the counsellors, the team leader and the
  finance person can all look. The bill does not grow with headcount.
- **Your records in your Postgres.** Plain tables. Back them up, query them from anything,
  leave any time. No paid extraction project when you move on.
- **Rules that match your contracts.** When a funder changes what it counts, you change a
  query in plain language. You do not wait for a vendor release.

## What you give up

- **Forms on a screen.** Workers type or say a session note into Claude Code instead of filling
  a form. Some teams want a form: that is a front end Enterprise DNA builds on top.
- **A phone app and offline use.** It runs where Claude Code runs. Outreach workers without a
  laptop need a mobile front end.
- **Client and referrer portals.** None here. Nothing faces the public.
- **A direct Data Exchange connection.** Penelope uploads automatically. Here a person uploads
  the file and records it; a connection is a customisation.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version
  for organisations that want someone to call.

## Who this fits

Small and mid-sized community services organisations whose managers want answers more than
screens, or who would rather own the record than rent it. If your whole team needs a screen
all day, keep the screen and let us build it on a database you own.

Installed and run for you: https://enterprisedna.co/omni/instead-of/penelope
