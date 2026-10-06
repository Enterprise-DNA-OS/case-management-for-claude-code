# The rule book `/compliance` checks

Each rule names its source, what a breach looks like in the data, and how the
system finds it. `node scripts/cases.mjs compliance` runs them all. The sharpest
rules are also enforced at the gate, so the breach cannot be created from inside
this system in the first place: it can only arrive through imported history, a
clearance that expires after the booking, or direct database edits.

Nothing here is legal advice. These are the rules this organisation has told the
system to enforce, with their sources. The demo is set in New South Wales with
Commonwealth (DSS) funding; the New Zealand equivalent is named beside each rule
where there is one. When your state, country or funding agreement differs, change
the rule here and the matching entry in `RULES` in `scripts/cases.mjs` together,
then run `npm test`. Do not guess at law: check the source.

## 1. `concern-reported`: mandatory safety concerns are reported to the statutory agency

- **Source:** Children and Young Persons (Care and Protection) Act 1998 (NSW) s27: people who deliver welfare, health, education or other services to children in their professional work must report reasonable grounds to suspect a child is at risk of significant harm. NZ: the child protection policy every state-funded children's agency must hold under the Children's Act 2014, which sets how concerns are reported to Oranga Tamariki.
- **Breach in the data:** an open concern with `mandatory = true` and no `reported_on`.
- **The gate:** `concerns close` refuses a mandatory concern with no report on record, and the database check constraint refuses it too. Whether a concern meets the threshold is the worker's and supervisor's call, never this system's.

## 2. `safety-check`: every worker taking sessions holds a current safety check on the session date

- **Source:** Child Protection (Working with Children) Act 2012 (NSW): a Working with Children Check clearance for child-related work, valid for five years. NZ: Children's (Requirements for Safety Checks of Children's Workers) Regulations 2015: a safety check before starting and a re-check every three years.
- **Breach in the data:** a booked or attended session in the last 30 days or ahead, by a worker whose `safety_check_expires_on` is missing or earlier than the session date.
- **The gate:** `session book`, `session log`, `session done`, `file open` and `file assign` refuse a worker without a current check on the date. No force flag.

## 3. `consent`: every open file has privacy consent and a collection notice on record

- **Source:** Privacy Act 1988 (Cth), Australian Privacy Principle 5 (notification of collection). NZ: Privacy Act 2020, Information Privacy Principle 3.
- **Breach in the data:** an open file whose client has no `consent_recorded_on`.
- **The gate:** `file open` refuses a client with no consent on record. Imported files arrive without it on purpose: the import lists them as the first audit.

## 4. `dex`: Data Exchange sessions are reported before the reporting period closes

- **Source:** DSS Data Exchange Protocols (Version 11, March 2024), section 10: two six monthly reporting periods (1 January to 30 June, 1 July to 31 December), then a 30 day close-off period, after which the Data Exchange no longer accepts uploads for that period.
- **Breach in the data:** an attended session in a programme whose funder `reports_to_dex`, with no `dex_reported_on`, whose period closed more than 30 days ago.
- **The gate:** none. This system does not connect to the Data Exchange. A person uploads, then records it with `dex mark --through=`. The attention list shows unreported sessions while the period is still open.

## 5. `session-note`: every attended session has a note within two days

- **Source:** your own records standard and your funding agreement's records clause. Two days is the default; change it to match your practice standard.
- **Breach in the data:** an attended session with no `note` more than two days after the session.
- **The gate:** `session log` and `session done` refuse an attended session without `--note=`. Breaches come from history or a skipped step.

## 6. `outcome-scores`: outcome programmes score every file at the start and at closing

- **Source:** DSS Data Exchange Protocols, section 6 and 7 (the Partnership Approach and SCORE: a five point scale, an initial score near the start of service and a follow-up score near the end). For other funders, your funding agreement's outcome clause.
- **Breach in the data:** an open file in a programme with `outcomes_required` and two or more attended sessions but no `pre` score; or a closed file with no `post` score and no `outcome_exception`.
- **The gate:** `file close` refuses an outcomes programme file with no post score unless `--no-post-reason=` records why it was not collected.

## 7. `supervision`: practitioners receive supervision on schedule

- **Source:** AASW Supervision Standards (2014), and your own supervision policy. NZ: the Social Workers Registration Board's supervision expectations for registered social workers.
- **Breach in the data:** an active worker whose `last_supervision_on` is older than their `supervision_every_days` (30 by default), or never recorded.

## 8. `referral-response`: every referral gets a response within five days

- **Source:** your own service standard. Set the number to what your funding agreement or referral protocol says.
- **Breach in the data:** a referral still `new` more than five days after it was received.

## 9. `file-review`: open files are reviewed on schedule

- **Source:** your own case review standard: 90 days from opening by default, set per file at `file open` and `file review`.
- **Breach in the data:** an open file whose `review_due_on` has passed.

## Kept by design, not checked

- **Records are closed, never deleted.** Clients go inactive, files close, workers become former, concerns close. There is no delete command. Retention follows your funding agreement and APP 11 (NZ: IPP 9); destroying records is a decision a person makes outside this system.
- **No clinical records.** No diagnoses, medications or health assessments. Session notes are about the service delivered.
