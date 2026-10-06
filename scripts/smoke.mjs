#!/usr/bin/env node
// End-to-end smoke test on a throwaway database.
// Runs migrate, seed, then every CLI command that matters, and asserts on the JSON.
// Embedded PGlite by default; set TEST_DATABASE_URL to run the same checks on a
// disposable Postgres. Passes on Windows and Linux. No network.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'cases-smoke-'));
const env = { ...process.env, DATA_DIR: path.join(dataDir, 'db'), OUTPUT_DIR: dataDir };
if (process.env.TEST_DATABASE_URL) env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete env.DATABASE_URL;

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try {
    return JSON.parse(res.stdout);
  } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\nFAIL assertion: ${msg}`);
    process.exit(1);
  }
}

const n = (v) => Number(v ?? 0);
const cases = (...a) => ['cases.mjs', ...a];
const reasons = (rows) => new Set(rows.map((r) => r.reason));

console.log(`smoke: ${env.DATABASE_URL ? 'Postgres at TEST_DATABASE_URL' : 'embedded database'}, output ${dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the organisation -----------------------------------------------------

  const stats = run('stats', cases('stats'));
  assert(stats.active_clients === 13, `13 active clients (${stats.active_clients})`);
  assert(stats.open_files === 9 && stats.waitlist === 2, `9 open files, 2 waiting (${stats.open_files}, ${stats.waitlist})`);
  assert(stats.new_referrals === 2, `two new referrals (${stats.new_referrals})`);

  const attention = run('attention', cases('attention'));
  const why = reasons(attention);
  for (const r of ['CONCERN NOT REPORTED', 'CHECK EXPIRED, STILL BOOKED', 'REFERRAL UNANSWERED', 'NO CONSENT', 'DEX LATE', 'NO NOTE',
    'UNRESOLVED SESSION', 'FUNDER REPORT DUE', 'QUIET', 'WAITING', 'REVIEW OVERDUE', 'NO PRE SCORE', 'SUPERVISION OVERDUE', 'CHECK EXPIRING']) {
    assert(why.has(r), `attention shows ${r}`);
  }
  assert(attention[0].reason === 'CONCERN NOT REPORTED', 'the unreported child protection concern is first');

  const clients = run('clients', cases('clients'));
  assert(clients.length === 13, `active clients list (${clients.length})`);
  assert(run('clients --all includes the inactive', cases('clients', '--all')).length === 14, 'all clients');

  const card = run('client card by partial name', cases('client', 'hannah'));
  assert(card.client.ref === 'C-1007' && card.client.safety_alert, 'Hannah, with her safety alert');
  assert(card.concerns.some((k) => k.ref === 'K-01' && !k.reported_on), 'her open concern is on the card');
  run('ambiguous name lists and fails', cases('client', 'a'), { json: false, expectFail: true });

  const files = run('files', cases('files'));
  assert(files.length === 9, `open files (${files.length})`);
  assert(files.find((f) => f.ref === 'F-3002').state === 'QUIET', 'Jordan has gone quiet');
  assert(files.find((f) => f.ref === 'F-3008').state === 'REVIEW OVERDUE', 'Olivia is overdue a review');
  assert(run('files by worker', cases('files', '--worker=tom')).length === 2, 'Tom holds two files');

  const waitlist = run('waitlist', cases('waitlist'));
  assert(waitlist[0].ref === 'F-3009' && n(waitlist[0].days_waiting) === 41, 'Ethan has waited longest, 41 days');

  const team = run('team', cases('team'));
  assert(team.find((w) => w.name === 'Tom Avery').check_state === 'EXPIRED', 'Tom is on an expired check');
  assert(/^OVERDUE/.test(team.find((w) => w.name === 'Leilani Fonoti').supervision_state), 'Leilani is overdue supervision');

  const dex = run('dex', cases('dex'));
  assert(dex.some((p) => p.late && n(p.sessions) === 2), 'two sessions missed a closed Data Exchange period');

  const programs = run('programs', cases('programs'));
  assert(programs.length === 4, `four programmes (${programs.length})`);
  const frs = run('funder report', cases('funder-report', 'FRS'));
  assert(frs.delivery.clients_served > 0 && frs.delivery.sessions_attended > 0, 'the FRS report counts delivery');
  assert(frs.demographics.cultural_identity.length > 0, 'and who was served');

  const outcomes = run('outcomes', cases('outcomes'));
  assert(outcomes.outcomes.some((o) => o.program === 'FRS' && n(o.improved_pct) === 100), 'FRS pairs improved');
  assert(outcomes.missing.map((m) => m.ref).sort().join() === 'F-3006,F-3012', 'missing scores: Kai (no pre), Chloe (no post)');

  const compliance = run('compliance', cases('compliance'));
  assert(compliance.length === 9, `nine rules (${compliance.length})`);
  const breached = Object.fromEntries(compliance.map((r) => [r.rule, r.count]));
  for (const rule of Object.keys(breached)) assert(breached[rule] > 0, `the demo breaches ${rule}`);

  // ---- the gates --------------------------------------------------------------

  const expired = run('no booking on an expired safety check', cases('session', 'book', 'F-3003', '--on=+3'), { json: false, expectFail: true });
  assert(/expired/.test(expired.stderr), 'refused because the check expired');
  const noNote = run('no attended session without a note', cases('session', 'log', 'kai'), { json: false, expectFail: true });
  assert(/note/.test(noNote.stderr), 'refused for want of a note');
  const noConsent = run('no file opens without consent', cases('file', 'open', 'F-3010', '--worker=priya'), { json: false, expectFail: true });
  assert(/consent/.test(noConsent.stderr), 'refused for want of consent');
  const noPost = run('no closing an outcomes file without a post score', cases('file', 'close', 'F-3001', '--reason=Goals achieved'), { json: false, expectFail: true });
  assert(/closing outcome score/.test(noPost.stderr), 'refused for want of a post score');
  run('no closing without a reason', cases('file', 'close', 'F-3001'), { json: false, expectFail: true });
  const noReport = run('no closing a mandatory concern unreported', cases('concerns', 'close', 'K-01'), { json: false, expectFail: true });
  assert(/no report on record/.test(noReport.stderr), 'refused until the report is recorded');
  run('no sessions on a waitlisted file', cases('session', 'log', 'F-3009', '--note=x'), { json: false, expectFail: true });
  run('no expired check accepted as a renewal', cases('check', 'tom', '--expires=2020-01-01'), { json: false, expectFail: true });
  run('a score outside 1 to 5 fails', cases('score', 'F-3006', '--circumstances=7'), { json: false, expectFail: true });

  // ---- the week's work clears the list ----------------------------------------

  run('report the concern', cases('concerns', 'report', 'K-01', '--to=NSW Child Protection Helpline', '--ref=CP-55102'));
  run('close the concern', cases('concerns', 'close', 'K-01'));
  run('renew Tom\'s check', cases('check', 'tom', '--expires=+1000', '--ref=WWC0391184E'));
  const booked = run('book Sarah now Tom is cleared', cases('session', 'book', 'F-3003', '--on=+3'));
  assert(booked.worker === 'Tom Avery', 'booked with Tom');
  run('resolve the unresolved session', cases('session', 'done', 'F-3004-U1', '--note=Home visit, bedtime plan reviewed with both parents.'));
  run('add the missing note', cases('note', 'F-3005-S06', '--note=Checked in on the safety plan first. Practised breathing for exams.'));
  run('a note cannot be overwritten', cases('note', 'F-3005-S06', '--note=again'), { json: false, expectFail: true });
  run('starting score for Kai', cases('score', 'kai', '--kind=pre', '--circumstances=2', '--goals=2'));
  run('log a session for Kai', cases('session', 'log', 'kai', '--note=Back at training once this week. Talked about the coach.'));
  run('consent for Noah', cases('consent', 'noah'));
  run('consent for Zara', cases('consent', 'zara', '--research'));
  const opened = run('open Zara\'s file', cases('file', 'open', 'F-3010', '--worker=priya'));
  assert(opened.worker === 'Priya Raman', 'with Priya');
  run('review Olivia\'s file', cases('file', 'review', 'F-3008', '--note=Budget goal nearly there.'));
  run('supervision for Leilani', cases('supervision', 'leilani'));
  const accepted = run('accept the perinatal referral', cases('referrals', 'accept', 'R-2001'));
  assert(/^F-/.test(accepted.file), 'it becomes a waitlisted file');
  run('decline the web referral with a reason', cases('referrals', 'decline', 'R-2002', '--reason=Referred to the Port Stephens service with a warm handover.'));
  run('record the late Data Exchange upload', cases('dex', 'mark', '--through=-100'));
  run('a case note', cases('log', 'jordan', '--body=Rang twice, texted. Will try again Thursday.', '--kind=call'));
  run('book Jordan back in', cases('session', 'book', 'jordan', '--on=+2'));
  const goal = run('a goal for Kai', cases('goals', 'add', 'kai', '--goal=Play a full game by the end of term'));
  const done = run('goal progress', cases('goals', 'update', goal.ref, '--progress=100'));
  assert(done.status === 'achieved', '100% marks it achieved');
  run('post scores for Mia', cases('score', 'mia', '--kind=post', '--circumstances=4', '--goals=4', '--satisfaction=5'));
  const closed = run('close Mia\'s file', cases('file', 'close', 'mia', '--reason=Goals achieved'));
  assert(n(closed.cancelled_bookings) === 1, 'her booked session is cancelled');
  run('close Chloe\'s legacy file properly', cases('score', 'F-3012', '--kind=post', '--circumstances=3', '--goals=3'));
  const newRef = run('a new referral', cases('referrals', 'add', '--name=Ava Singh', '--source=Self-referral (phone)', '--program=FRS'));
  assert(/^R-\d+$/.test(newRef.ref), 'numbered');

  const after = run('attention after the week', cases('attention'));
  const left = reasons(after);
  for (const r of ['CONCERN NOT REPORTED', 'CHECK EXPIRED, STILL BOOKED', 'REFERRAL UNANSWERED', 'NO CONSENT', 'DEX LATE', 'NO NOTE', 'UNRESOLVED SESSION', 'QUIET', 'REVIEW OVERDUE', 'NO PRE SCORE', 'SUPERVISION OVERDUE']) {
    assert(!left.has(r), `${r} is cleared`);
  }
  const clean = run('compliance after the week', cases('compliance'));
  const stillBreached = clean.filter((r) => r.count && r.rule !== 'safety-check').map((r) => r.rule);
  assert(stillBreached.length === 0, `only the historical safety check record remains (${stillBreached.join(', ')})`);

  const mia = run('Mia\'s outcome pair counts', cases('outcomes', '--program=FRS'));
  assert(mia.outcomes.find((o) => o.domain === 'goals' && n(o.pairs) === 3), 'three FRS pairs now');

  // ---- import from Penelope ---------------------------------------------------

  const roster = path.join(dataDir, 'roster.csv');
  const events = path.join(dataDir, 'events.csv');
  writeFileSync(roster, [
    'Service File ID,Service,Opened Date,Assigned Worker Role,Worker,Case Name,Case ID,Client,Client Date of Birth,Client Phone Number,Client Relationship',
    '88101,Family and Relationship Services,03/08/2026,Primary,Priya Raman,Patel Family,5512,Anika Patel,14/02/1990,0411 000 111,Self',
    '88102,Financial Counselling,17/08/2026,Primary,Sam Lee,"Brooks, Family",5513,Dylan Brooks,02/11/1985,0411 000 222,Self',
  ].join('\r\n'));
  writeFileSync(events, [
    'Service File ID,Event ID,Event Date,Duration (minutes),Attendance,Worker',
    '88101,900001,10/08/2026,60,Attended,Priya Raman',
    '88101,900002,17/08/2026,60,No Show,Priya Raman',
    '88102,900003,24/08/2026,90,Attended,Sam Lee',
    '99999,900004,24/08/2026,60,Attended,Sam Lee',
  ].join('\r\n'));
  const dry = run('import dry run writes nothing', cases('import', 'penelope', `--roster=${roster}`, `--events=${events}`, '--dry-run'));
  assert(dry.files_created === 2 && dry.sessions_created === 3 && dry.problems.length === 1, 'two files, three sessions, one orphan event');
  assert(run('the dry run wrote nothing', cases('files', '--all')).filter((f) => f.ref.startsWith('PEN-')).length === 0, 'nothing written');
  const imp = run('import for real', cases('import', 'penelope', `--roster=${roster}`, `--events=${events}`));
  assert(imp.clients_created === 2 && imp.programs_created.length === 1 && imp.workers_created.includes('Sam Lee'), 'new clients, the new programme and worker are created');
  assert(imp.no_consent.length === 2, 'the import is the first audit: no consent on either file');
  const again = run('re-import creates nothing', cases('import', 'penelope', `--roster=${roster}`, `--events=${events}`));
  assert(again.files_created === 0 && again.files_skipped === 2 && again.sessions_skipped === 3, 'idempotent');
  run('a missing import file fails loudly', cases('import', 'penelope', `--roster=${path.join(dataDir, 'nope.csv')}`), { json: false, expectFail: true });

  // ---- export, views, documents ----------------------------------------------

  const exp = run('export', cases('export', `--out=${path.join(dataDir, 'export')}`));
  assert(n(exp.counts.sessions) > 90 && existsSync(path.join(dataDir, 'export', 'clients.csv')), 'every record exported');
  run('npm run view', ['view.mjs'], { json: false });
  assert(existsSync(path.join(dataDir, 'views', 'week.html')) && existsSync(path.join(dataDir, 'views', 'funders.html')), 'both views rendered');
  run('npm run docs', ['docs.mjs'], { json: false });
  for (const d of ['funder-report', 'case-summary', 'worker-file']) assert(readdirSync(path.join(dataDir, 'docs-out', d)).length > 0, `${d} rendered`);
  run('help', ['cases.mjs', 'help'], { json: false });

  console.log(`\nPASS: ${step} checks`);
} finally {
  if (existsSync(dataDir)) {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the handle briefly; a leftover temp dir is harmless.
    }
  }
}
