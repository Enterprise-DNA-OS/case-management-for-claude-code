#!/usr/bin/env node
// case-management-for-claude-code: the one CLI. The slash commands call this;
// so can you.
//
//   node scripts/cases.mjs <command> [args] [--flags] [--json]
//
// Run with no arguments (or `help`) for the command list.
//
// This is a community services organisation's case record the way Penelope
// sells it: funders and programmes, workers, clients with consent, referrals,
// service files, sessions with notes, goals, outcome scores, safety concerns
// and file notes. It sends nothing and connects to nothing: the Data Exchange
// upload and funder reports are files a person submits, letters draft to drafts/.
//
// The gates, and there are no force flags:
//   * no session booked or logged for a worker whose safety check is missing or
//     expired on the session date (Working with Children Check, Children's Act
//     safety checks)
//   * no file opened for a client with no privacy consent on record
//   * no session logged against a file that is not open
//   * no attended session without a note: the note is the record of the service
//   * no closing a file without a reason, and no closing a file in an outcomes
//     programme without a post score or the reason it was not collected
//   * no closing a mandatory safety concern without its report on record
//
// Deliberately NOT here: clinical records, diagnoses, medications.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, hours, isoDate, truncate, heading, bar } from './lib/format.mjs';

// ---------------------------------------------------------------- arguments

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run', 'mandatory', 'research', 'dex-unreported']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name, value;
      if (eq > -1) { name = a.slice(2, eq); value = a.slice(eq + 1); }
      else {
        name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) value = true;
        else value = argv[++i];
      }
      flags[name] = value;
    } else args.push(a);
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}

const num = (v) => Number(v ?? 0);
const str = (v) => (v === true || v === undefined || v === null ? '' : String(v));

// ---------------------------------------------------------------- dates

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Penelope and most AU/NZ exports write DD/MM/YYYY: the first number is the day
// unless the second is too big to be a month.
function parseDate(v, what = 'date') {
  if (!v || v === true) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const lower = s.toLowerCase();
  if (lower === 'today') return today();
  if (lower === 'yesterday') return addDays(today(), -1);
  if (lower === 'tomorrow') return addDays(today(), 1);
  const rel = lower.match(/^([+-]\d+)d?$/);
  if (rel) return addDays(today(), Number(rel[1]));
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const [day, month] = b > 12 ? [b, a] : [a, b];
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD, today, or +7.`);
}

function parseScore(v, what) {
  if (v === undefined || v === true) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new CliError(`${what} must be a whole number from 1 to 5 (SCORE scale).`);
  return n;
}

// ---------------------------------------------------------------- lookups

async function resolveRow(db, sql, params, label, term) {
  const rows = await db.query(sql, params);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No ${label} matches "${term}".`);
  const list = rows.slice(0, 10).map((r) => `  ${r.ref ? r.ref + '  ' : ''}${r.name || r.client || ''}${r.program ? '  ' + r.program : ''}`).join('\n');
  throw new CliError(`"${term}" matches ${rows.length} ${label} records. Which one?\n${list}`);
}

async function resolveClient(db, term) {
  if (!term) throw new CliError('Which client? Give a name (partial is fine) or a client ref like C-1001.');
  const t = String(term).trim();
  const exact = await db.query('select * from clients where lower(name) = lower($1) or upper(ref) = upper($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from clients where name ilike $1 order by name', [`%${t}%`], 'client', t);
}

async function resolveWorker(db, term) {
  if (!term) throw new CliError('Which worker? Give a name (partial is fine).');
  const t = String(term).trim();
  const exact = await db.query('select * from workers where lower(name) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from workers where name ilike $1 order by name', [`%${t}%`], 'worker', t);
}

async function resolveProgram(db, term) {
  if (!term) throw new CliError('Which programme? Give its code (FRS) or part of its name.');
  const t = String(term).trim();
  const exact = await db.query('select * from programs where upper(code) = upper($1) or lower(name) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from programs where name ilike $1 order by code', [`%${t}%`], 'programme', t);
}

// A file by its ref (F-3001, or 3001), or by client name when that client has one live file.
async function resolveFile(db, term) {
  if (!term) throw new CliError('Which file? Give its ref (F-3001) or the client name.');
  let t = String(term).trim();
  if (/^\d+$/.test(t)) t = `F-${t}`;
  const byRef = await db.query('select * from v_files where upper(ref) = upper($1)', [t]);
  if (byRef.length === 1) return byRef[0];
  const live = await db.query("select * from v_files where client ilike $1 and status <> 'closed' order by ref", [`%${t}%`]);
  if (live.length === 1) return live[0];
  if (live.length > 1) return resolveRow(db, "select * from v_files where client ilike $1 and status <> 'closed' order by ref", [`%${t}%`], 'file', t);
  return resolveRow(db, 'select * from v_files where client ilike $1 order by ref', [`%${t}%`], 'file', t);
}

async function resolveRef(db, tableName, ref, label) {
  if (!ref) throw new CliError(`Which ${label}? Give its ref.`);
  const rows = await db.query(`select * from ${tableName} where upper(ref) = upper($1)`, [String(ref).trim()]);
  if (rows.length === 1) return rows[0];
  throw new CliError(`No ${label} with ref "${ref}".`);
}

async function nextRef(db, tableName, prefix, start) {
  const [row] = await db.query(
    `select coalesce(max(substring(ref from '^${prefix}-(\\d+)$')::int), $1) + 1 as n from ${tableName}`,
    [start - 1],
  );
  return `${prefix}-${row.n}`;
}

// The safety check gate. Called before any session is booked or logged.
function assertCheck(worker, onDate) {
  if (worker.status !== 'active') throw new CliError(`${worker.name} is a former worker and cannot take sessions.`);
  const exp = worker.safety_check_expires_on ? isoDate(worker.safety_check_expires_on) : null;
  if (!exp) throw new CliError(`${worker.name} has no safety check on record. Record it first: check "${worker.name}" --expires=YYYY-MM-DD --ref=...`);
  if (exp < onDate) throw new CliError(`${worker.name}'s ${worker.safety_check || 'safety check'} expired ${exp}, before ${onDate}. Reassign the session or record the renewed check first.`);
}

// ---------------------------------------------------------------- output

function out(flags, value, textFn) {
  if (flags.json) console.log(JSON.stringify(value, null, 2));
  else textFn();
}
const d = (v) => (v ? isoDate(v) : '');
const yn = (v) => (v ? 'yes' : 'no');

// ---------------------------------------------------------------- the organisation

async function cmdStats(db, flags) {
  const [s] = await db.query(`
    select (select count(*) from clients where status = 'active') as active_clients,
           (select count(*) from workers where status = 'active') as active_workers,
           (select count(*) from programs where status = 'active') as programs,
           (select count(*) from service_files where status = 'open') as open_files,
           (select count(*) from service_files where status = 'waitlist') as waitlist,
           (select count(*) from referrals where status = 'new') as new_referrals,
           (select count(*) from sessions where attendance = 'attended') as sessions_attended,
           (select count(*) from sessions where attendance = 'booked' and session_on between current_date and current_date + 7) as booked_next_7d,
           (select count(*) from concerns where status = 'open') as open_concerns,
           (select count(*) from v_attention) as attention`);
  const stats = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, num(v)]));
  out(flags, stats, () => {
    console.log(heading('The organisation at a glance'));
    console.log(`  ${stats.active_clients} active clients, ${stats.open_files} open files, ${stats.waitlist} waiting, ${stats.new_referrals} new referral(s)`);
    console.log(`  ${stats.active_workers} workers across ${stats.programs} funded programmes`);
    console.log(`  ${stats.booked_next_7d} sessions booked in the next 7 days, ${stats.sessions_attended} attended on record`);
    console.log(`  ${stats.open_concerns} open safety concern(s), ${stats.attention} item(s) needing a decision`);
  });
}

async function cmdAttention(db, flags) {
  const rows = await db.query('select * from v_attention order by rank, days desc nulls last, label');
  out(flags, rows, () => {
    console.log(heading('Needs a decision, worst first'));
    console.log(table(rows, [
      { key: 'reason', label: 'why' },
      { key: 'label', label: 'record' },
      { key: 'client', label: 'client' },
      { key: 'place', label: 'who / where', width: 24 },
      { key: 'days', label: 'days', align: 'right' },
      { key: 'detail', label: 'detail', width: 70 },
    ]));
  });
}

async function cmdClients(db, flags) {
  const rows = await db.query(`
    select c.ref, c.name, c.suburb, c.status, c.consent_recorded_on is not null as consent, c.safety_alert is not null as alert,
           (select string_agg(f.ref || ' ' || f.program || ' ' || f.status, ', ' order by f.ref) from v_files f where f.client_id = c.id and f.status <> 'closed') as live_files,
           (select max(last_contact_on) from v_files f where f.client_id = c.id) as last_contact_on
      from clients c ${flags.all ? '' : "where c.status = 'active'"} order by c.name`);
  out(flags, rows, () => {
    console.log(heading(flags.all ? 'All clients' : 'Active clients'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'name', label: 'name' }, { key: 'suburb', label: 'suburb' },
      { key: 'consent', label: 'consent', format: yn }, { key: 'alert', label: 'alert', format: (v) => (v ? 'ALERT' : '') },
      { key: 'live_files', label: 'live files', width: 40 }, { key: 'last_contact_on', label: 'last contact', format: d },
    ]));
  });
}

async function cmdClient(db, args, flags) {
  const c = await resolveClient(db, args.join(' '));
  const files = await db.query('select * from v_files where client_id = $1 order by opened_on desc nulls first, ref', [c.id]);
  const sessions = await db.query('select ref, session_on, worker, program, attendance, state, note from v_sessions where client_id = $1 order by session_on desc limit 8', [c.id]);
  const goals = await db.query(`select g.ref, f.ref as file, g.goal, g.status, g.progress, g.target_on from goals g join service_files f on f.id = g.service_file_id where f.client_id = $1 order by g.status, g.ref`, [c.id]);
  const concerns = await db.query('select ref, raised_on, kind, mandatory, reported_to, reported_on, status, detail from concerns where client_id = $1 order by raised_on desc', [c.id]);
  const notes = await db.query(`select n.noted_on, n.kind, w.name as worker, n.body from case_notes n left join workers w on w.id = n.worker_id where n.client_id = $1 order by n.noted_on desc limit 5`, [c.id]);
  const card = { client: c, files, sessions, goals, concerns, notes };
  out(flags, card, () => {
    console.log(heading(`${c.name} (${c.ref})`));
    if (c.safety_alert) console.log(`  SAFETY ALERT: ${c.safety_alert}`);
    console.log(`  ${c.gender || ''} ${c.dob ? 'born ' + d(c.dob) : ''}  ${c.phone || ''}  ${c.suburb || ''} ${c.postcode || ''}`);
    console.log(`  identity ${c.cultural_identity || 'not recorded'}, language ${c.language || 'not recorded'}${c.interpreter ? ', interpreter needed' : ''}`);
    console.log(`  consent ${c.consent_recorded_on ? 'recorded ' + d(c.consent_recorded_on) : 'NOT RECORDED'}${c.consent_research ? ', research use yes' : ''}`);
    console.log(heading('Files'));
    console.log(table(files, [
      { key: 'ref', label: 'file' }, { key: 'program', label: 'prog' }, { key: 'worker', label: 'worker' }, { key: 'state', label: 'state' },
      { key: 'opened_on', label: 'opened', format: d }, { key: 'sessions_attended', label: 'sessions', align: 'right' },
      { key: 'last_contact_on', label: 'last', format: d }, { key: 'next_booked_on', label: 'next', format: d },
    ]));
    console.log(heading('Recent sessions'));
    console.log(table(sessions, [
      { key: 'session_on', label: 'date', format: d }, { key: 'worker', label: 'worker' }, { key: 'state', label: 'state' },
      { key: 'note', label: 'note', format: (v) => truncate(v || '', 60) },
    ]));
    console.log(heading('Goals'));
    console.log(table(goals, [
      { key: 'ref', label: 'ref' }, { key: 'goal', label: 'goal', width: 60 }, { key: 'status', label: 'status' },
      { key: 'progress', label: 'progress', format: (v) => `${bar(v)} ${v}%` },
    ]));
    if (concerns.length) {
      console.log(heading('Safety concerns'));
      console.log(table(concerns, [
        { key: 'ref', label: 'ref' }, { key: 'raised_on', label: 'raised', format: d }, { key: 'kind', label: 'kind' },
        { key: 'reported_on', label: 'reported', format: (v, r) => (v ? `${d(v)} ${r.reported_to}` : r.mandatory ? 'NOT REPORTED' : 'not mandatory') },
        { key: 'status', label: 'status' },
      ]));
    }
    if (notes.length) {
      console.log(heading('File notes'));
      console.log(table(notes, [{ key: 'noted_on', label: 'date', format: d }, { key: 'kind', label: 'kind' }, { key: 'worker', label: 'by' }, { key: 'body', label: 'note', width: 70 }]));
    }
  });
}

async function cmdConsent(db, args, flags) {
  const c = await resolveClient(db, args.join(' '));
  const on = parseDate(flags.on || 'today');
  await db.query('update clients set consent_recorded_on = $2, consent_research = $3 where id = $1', [c.id, on, Boolean(flags.research)]);
  out(flags, { client: c.ref, consent_recorded_on: on, research: Boolean(flags.research) }, () =>
    console.log(`Consent recorded for ${c.name} on ${on}${flags.research ? ' (research use: yes)' : ''}.`));
}

// ---------------------------------------------------------------- files

const FILE_COLS = [
  { key: 'ref', label: 'file' }, { key: 'client', label: 'client' }, { key: 'program', label: 'prog' }, { key: 'worker', label: 'worker' },
  { key: 'state', label: 'state' }, { key: 'sessions_attended', label: 'sessions', align: 'right' },
  { key: 'last_contact_on', label: 'last contact', format: d }, { key: 'next_booked_on', label: 'next', format: d },
  { key: 'review_due_on', label: 'review', format: d },
];

async function cmdFiles(db, flags) {
  const where = [];
  const params = [];
  if (flags.status) { params.push(String(flags.status)); where.push(`status = $${params.length}`); }
  else if (!flags.all) where.push("status = 'open'");
  if (flags.worker) { const w = await resolveWorker(db, flags.worker); params.push(w.id); where.push(`worker_id = $${params.length}`); }
  if (flags.program) { const p = await resolveProgram(db, flags.program); params.push(p.id); where.push(`program_id = $${params.length}`); }
  const rows = await db.query(`select * from v_files ${where.length ? 'where ' + where.join(' and ') : ''} order by program, ref`, params);
  out(flags, rows, () => { console.log(heading('Service files')); console.log(table(rows, FILE_COLS)); });
}

async function cmdFile(db, args, flags) {
  const sub = args[0];
  if (sub === 'open') return fileOpen(db, args.slice(1), flags);
  if (sub === 'close') return fileClose(db, args.slice(1), flags);
  if (sub === 'review') return fileReview(db, args.slice(1), flags);
  if (sub === 'assign') return fileAssign(db, args.slice(1), flags);
  return cmdClient(db, [(await resolveFile(db, args.join(' '))).client_ref], flags);
}

async function fileOpen(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  if (f.status !== 'waitlist') throw new CliError(`${f.ref} is ${f.status}, not on the waitlist.`);
  if (!f.consent_recorded_on) throw new CliError(`${f.client} has no privacy consent on record. Record it first: consent "${f.client}" --on=YYYY-MM-DD`);
  const w = await resolveWorker(db, flags.worker || f.worker);
  const on = parseDate(flags.on || 'today');
  assertCheck(w, on);
  const review = parseDate(flags.review || addDays(on, 90));
  await db.query("update service_files set status = 'open', opened_on = $2, worker_id = $3, review_due_on = $4 where id = $1", [f.file_id, on, w.id, review]);
  out(flags, { file: f.ref, opened_on: on, worker: w.name, review_due_on: review }, () =>
    console.log(`${f.ref} opened for ${f.client} with ${w.name} on ${on}. First review due ${review}. Take the starting outcome score at the first session.`));
}

async function fileClose(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  if (f.status === 'closed') throw new CliError(`${f.ref} is already closed.`);
  const reason = str(flags.reason);
  if (!reason) throw new CliError('Closing needs a reason: --reason="Goals achieved" (or "Client disengaged", "Referred on", "Moved away").');
  const exception = str(flags['no-post-reason']);
  if (f.status === 'open' && f.outcomes_required && !f.has_post && !exception) {
    throw new CliError(`${f.program} requires a closing outcome score. Record it (score ${f.ref} --kind=post --circumstances=N --goals=N --satisfaction=N) or say why it was not collected: --no-post-reason="..."`);
  }
  const booked = await db.query("select count(*) as n from sessions where service_file_id = $1 and attendance = 'booked'", [f.file_id]);
  const on = parseDate(flags.on || 'today');
  await db.query("update sessions set attendance = 'cancelled' where service_file_id = $1 and attendance = 'booked'", [f.file_id]);
  await db.query("update service_files set status = 'closed', closed_on = $2, close_reason = $3, outcome_exception = nullif($4, '') where id = $1", [f.file_id, on, reason, exception]);
  out(flags, { file: f.ref, closed_on: on, reason, cancelled_bookings: num(booked[0].n) }, () =>
    console.log(`${f.ref} closed on ${on}: ${reason}.${num(booked[0].n) ? ` ${booked[0].n} booked session(s) cancelled.` : ''}`));
}

async function fileReview(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  if (f.status !== 'open') throw new CliError(`${f.ref} is not open.`);
  const next = parseDate(flags.next || addDays(today(), 90));
  await db.query('update service_files set review_due_on = $2 where id = $1', [f.file_id, next]);
  await db.query("insert into case_notes (client_id, service_file_id, worker_id, kind, body) values ($1, $2, $3, 'meeting', $4)",
    [f.client_id, f.file_id, f.worker_id, `File review completed. ${str(flags.note) || 'Plan and goals reviewed.'} Next review ${next}.`]);
  out(flags, { file: f.ref, review_due_on: next }, () => console.log(`${f.ref} reviewed. Next review due ${next}.`));
}

async function fileAssign(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  const w = await resolveWorker(db, flags.worker);
  assertCheck(w, today());
  await db.query('update service_files set worker_id = $2 where id = $1', [f.file_id, w.id]);
  const moved = await db.query("update sessions set worker_id = $2 where service_file_id = $1 and attendance = 'booked' and session_on >= current_date returning ref", [f.file_id, w.id]);
  out(flags, { file: f.ref, worker: w.name, moved_bookings: moved.length }, () =>
    console.log(`${f.ref} now with ${w.name}. ${moved.length} future booking(s) moved.`));
}

async function cmdWaitlist(db, flags) {
  const rows = await db.query('select * from v_waitlist order by days_waiting desc');
  out(flags, rows, () => {
    console.log(heading('Waitlist, longest first'));
    console.log(table(rows, [
      { key: 'ref', label: 'file' }, { key: 'client', label: 'client' }, { key: 'program', label: 'prog' },
      { key: 'days_waiting', label: 'days', align: 'right' }, { key: 'referred_by', label: 'referred by', width: 40 },
      { key: 'consent', label: 'consent', format: yn },
    ]));
  });
}

// ---------------------------------------------------------------- referrals

async function cmdReferrals(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return referralAdd(db, flags);
  if (sub === 'accept') return referralAccept(db, args.slice(1), flags);
  if (sub === 'decline') return referralDecline(db, args.slice(1), flags);
  const rows = await db.query(`select * from v_referrals ${flags.all ? '' : "where status = 'new' or received_on >= current_date - 30"} order by status = 'new' desc, received_on`);
  out(flags, rows, () => {
    console.log(heading('Referrals'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'client_name', label: 'client' }, { key: 'program', label: 'prog' },
      { key: 'source', label: 'from', width: 36 }, { key: 'received_on', label: 'received', format: d },
      { key: 'status', label: 'status' }, { key: 'days_unanswered', label: 'unanswered', align: 'right', format: (v) => (v === null || v === undefined ? '' : `${v}d`) },
    ]));
  });
}

async function referralAdd(db, flags) {
  const name = str(flags.name);
  const source = str(flags.source);
  if (!name || !source) throw new CliError('A referral needs --name="Client Name" and --source="who referred".');
  const p = flags.program ? await resolveProgram(db, flags.program) : null;
  const ref = await nextRef(db, 'referrals', 'R', 2001);
  const received = parseDate(flags.received || 'today');
  await db.query('insert into referrals (ref, client_name, source, source_contact, program_id, received_on, reason) values ($1,$2,$3,$4,$5,$6,$7)',
    [ref, name, source, str(flags.contact) || null, p?.id || null, received, str(flags.reason) || null]);
  out(flags, { ref, client_name: name, received_on: received }, () => console.log(`${ref} recorded: ${name} from ${source}. Respond within 5 days.`));
}

async function referralAccept(db, args, flags) {
  const r = await resolveRef(db, 'referrals', args[0], 'referral');
  if (r.status !== 'new') throw new CliError(`${r.ref} is already ${r.status}.`);
  const p = flags.program ? await resolveProgram(db, flags.program) : r.program_id ? (await db.query('select * from programs where id = $1', [r.program_id]))[0] : null;
  if (!p) throw new CliError('Which programme? --program=FRS');
  let clientId = r.client_id;
  if (!clientId) {
    const existing = await db.query('select id from clients where lower(name) = lower($1)', [r.client_name]);
    if (existing.length === 1) clientId = existing[0].id;
    else {
      const cref = await nextRef(db, 'clients', 'C', 1001);
      const [c] = await db.query('insert into clients (ref, name, phone) values ($1, $2, $3) returning id', [cref, r.client_name, str(flags.phone) || null]);
      clientId = c.id;
    }
  }
  const fref = await nextRef(db, 'service_files', 'F', 3001);
  const [f] = await db.query("insert into service_files (ref, client_id, program_id, status, waitlisted_on) values ($1, $2, $3, 'waitlist', current_date) returning id", [fref, clientId, p.id]);
  await db.query("update referrals set status = 'waitlisted', responded_on = current_date, client_id = $2, program_id = $3, service_file_id = $4 where id = $1", [r.id, clientId, p.id, f.id]);
  out(flags, { referral: r.ref, file: fref, program: p.code }, () =>
    console.log(`${r.ref} accepted into ${p.code}: file ${fref} is on the waitlist. Record consent, then: file open ${fref} --worker="..."`));
}

async function referralDecline(db, args, flags) {
  const r = await resolveRef(db, 'referrals', args[0], 'referral');
  const reason = str(flags.reason);
  if (!reason) throw new CliError('Declining needs a reason the referrer can act on: --reason="Out of area: referred to ..."');
  await db.query("update referrals set status = 'declined', responded_on = current_date, decline_reason = $2 where id = $1", [r.id, reason]);
  out(flags, { referral: r.ref, status: 'declined', reason }, () => console.log(`${r.ref} declined: ${reason}. Draft the response to ${r.source} with /draft-referral-response.`));
}

// ---------------------------------------------------------------- sessions

async function cmdSessions(db, flags) {
  const ahead = num(flags.days || 7);
  const rows = await db.query(`select * from v_sessions where (attendance = 'booked' and session_on <= current_date + $1::int)
                                  or (attendance = 'attended' and note is null) order by session_on, worker`, [ahead]);
  out(flags, rows, () => {
    console.log(heading(`Sessions: the next ${ahead} days, plus anything unresolved`));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'session_on', label: 'date', format: d }, { key: 'client', label: 'client' },
      { key: 'worker', label: 'worker' }, { key: 'mode', label: 'mode' }, { key: 'state', label: 'state' },
    ]));
  });
}

async function cmdSession(db, args, flags) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === 'book') return sessionBook(db, rest, flags);
  if (sub === 'log') return sessionLog(db, rest, flags);
  if (sub === 'done') return sessionResolve(db, rest, flags, 'attended');
  if (sub === 'dna') return sessionResolve(db, rest, flags, 'did not attend');
  if (sub === 'cancel') return sessionResolve(db, rest, flags, 'cancelled');
  throw new CliError('session book|log|done|dna|cancel');
}

async function sessionBook(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  if (f.status !== 'open') throw new CliError(`${f.ref} is ${f.status}. Sessions are booked on open files only.`);
  const w = await resolveWorker(db, flags.worker || f.worker);
  const on = parseDate(flags.on);
  if (!on) throw new CliError('When? --on=YYYY-MM-DD (or +7)');
  assertCheck(w, on);
  const n = await db.query("select count(*) as n from sessions where service_file_id = $1", [f.file_id]);
  const ref = `${f.ref}-B${num(n[0].n) + 1}`;
  await db.query('insert into sessions (ref, service_file_id, worker_id, session_on, minutes, mode) values ($1,$2,$3,$4,$5,$6)',
    [ref, f.file_id, w.id, on, num(flags.minutes || 60), str(flags.mode) || 'in person']);
  out(flags, { ref, file: f.ref, session_on: on, worker: w.name }, () => console.log(`${ref} booked: ${f.client} with ${w.name} on ${on}.`));
}

async function sessionLog(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  if (f.status !== 'open') throw new CliError(`${f.ref} is ${f.status}. Log sessions against an open file.`);
  const note = str(flags.note);
  if (!note) throw new CliError('An attended session needs its note: --note="what happened, what was agreed". The note is the record of the service.');
  const w = await resolveWorker(db, flags.worker || f.worker);
  const on = parseDate(flags.on || 'today');
  assertCheck(w, on);
  const n = await db.query("select count(*) as n from sessions where service_file_id = $1", [f.file_id]);
  const ref = `${f.ref}-L${num(n[0].n) + 1}`;
  await db.query("insert into sessions (ref, service_file_id, worker_id, session_on, minutes, mode, attendance, note, noted_on) values ($1,$2,$3,$4,$5,$6,'attended',$7,current_date)",
    [ref, f.file_id, w.id, on, num(flags.minutes || 60), str(flags.mode) || 'in person', note]);
  out(flags, { ref, file: f.ref, session_on: on }, () => console.log(`${ref} logged for ${f.client} on ${on}.${!f.has_pre && f.outcomes_required ? ' No starting outcome score yet: take it now.' : ''}`));
}

async function sessionResolve(db, args, flags, attendance) {
  const s = await resolveRef(db, 'sessions', args[0], 'session');
  const note = str(flags.note);
  if (attendance === 'attended') {
    if (!note && !s.note) throw new CliError('Marking a session attended needs its note: --note="..."');
    const [w] = await db.query('select * from workers where id = $1', [s.worker_id]);
    assertCheck(w, isoDate(s.session_on));
  }
  await db.query('update sessions set attendance = $2, note = coalesce(nullif($3, \'\'), note), noted_on = case when nullif($3, \'\') is not null then current_date else noted_on end where id = $1', [s.id, attendance, note]);
  out(flags, { ref: s.ref, attendance }, () => console.log(`${s.ref} marked ${attendance}.`));
}

async function cmdNote(db, args, flags) {
  const s = await resolveRef(db, 'sessions', args[0], 'session');
  const note = str(flags.note);
  if (!note) throw new CliError('--note="..." is required.');
  if (s.note) throw new CliError(`${s.ref} already has a note. Add to the record with: log "<client>" --body="..."`);
  await db.query('update sessions set note = $2, noted_on = current_date where id = $1', [s.id, note]);
  out(flags, { ref: s.ref, noted_on: today() }, () => console.log(`Note added to ${s.ref}.`));
}

async function cmdLog(db, args, flags) {
  const c = await resolveClient(db, args.join(' '));
  const body = str(flags.body);
  if (!body) throw new CliError('--body="what happened" is required.');
  const files = await db.query("select id, worker_id from service_files where client_id = $1 and status = 'open' order by opened_on desc", [c.id]);
  const w = flags.worker ? await resolveWorker(db, flags.worker) : null;
  await db.query('insert into case_notes (client_id, service_file_id, worker_id, kind, body) values ($1,$2,$3,$4,$5)',
    [c.id, files[0]?.id || null, w?.id || files[0]?.worker_id || null, str(flags.kind) || 'note', body]);
  out(flags, { client: c.ref, logged: true }, () => console.log(`Noted on ${c.name}'s file.`));
}

// ---------------------------------------------------------------- goals and outcomes

async function cmdGoals(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') {
    const f = await resolveFile(db, args.slice(1).join(' '));
    const goal = str(flags.goal);
    if (!goal) throw new CliError('--goal="in the client\'s words" is required.');
    const ref = await nextRef(db, 'goals', 'G', 1);
    await db.query('insert into goals (ref, service_file_id, goal, target_on) values ($1,$2,$3,$4)', [ref, f.file_id, goal, parseDate(flags.target)]);
    return out(flags, { ref, file: f.ref }, () => console.log(`${ref} set on ${f.ref}: ${goal}`));
  }
  if (sub === 'update') {
    const g = await resolveRef(db, 'goals', args[1], 'goal');
    const progress = flags.progress !== undefined ? Math.max(0, Math.min(100, num(flags.progress))) : g.progress;
    const status = str(flags.status) || (progress === 100 ? 'achieved' : g.status);
    await db.query('update goals set progress = $2, status = $3, reviewed_on = current_date where id = $1', [g.id, progress, status]);
    return out(flags, { ref: g.ref, progress, status }, () => console.log(`${g.ref}: ${progress}% (${status}).`));
  }
  const params = [];
  let where = "f.status = 'open'";
  if (args.length) { const f = await resolveFile(db, args.join(' ')); params.push(f.file_id); where = 'f.id = $1'; }
  const rows = await db.query(`select g.ref, f.ref as file, c.name as client, w.name as worker, g.goal, g.status, g.progress, g.target_on, g.reviewed_on
                                 from goals g join service_files f on f.id = g.service_file_id join clients c on c.id = f.client_id left join workers w on w.id = f.worker_id
                                where ${where} order by f.ref, g.ref`, params);
  out(flags, rows, () => {
    console.log(heading('Goals'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'client', label: 'client' }, { key: 'goal', label: 'goal', width: 56 },
      { key: 'status', label: 'status' }, { key: 'progress', label: 'progress', format: (v) => `${bar(v)} ${v}%` },
      { key: 'reviewed_on', label: 'reviewed', format: d },
    ]));
  });
}

async function cmdScore(db, args, flags) {
  const f = await resolveFile(db, args.join(' '));
  const kind = str(flags.kind) || (f.has_pre ? 'review' : 'pre');
  if (!['pre', 'post', 'review'].includes(kind)) throw new CliError('--kind=pre|post|review');
  const scores = {
    circumstances: parseScore(flags.circumstances, '--circumstances'),
    goals: parseScore(flags.goals, '--goals'),
    satisfaction: parseScore(flags.satisfaction, '--satisfaction'),
  };
  if (scores.circumstances === null && scores.goals === null && scores.satisfaction === null) throw new CliError('Give at least one score: --circumstances=N --goals=N [--satisfaction=N], each 1 to 5.');
  const on = parseDate(flags.on || 'today');
  const measures = { circumstances: str(flags['circumstances-measure']) || 'Family functioning', goals: str(flags['goals-measure']) || 'Changed behaviours', satisfaction: 'Service met my needs' };
  const written = [];
  for (const [domain, score] of Object.entries(scores)) {
    if (score === null) continue;
    const ref = `${f.ref}-${kind.toUpperCase()}-${domain}-${on}`;
    await db.query('insert into assessments (ref, service_file_id, kind, domain, measure, score, assessed_on) values ($1,$2,$3,$4,$5,$6,$7) on conflict (ref) do update set score = excluded.score',
      [ref, f.file_id, kind, domain, measures[domain], score, on]);
    written.push({ domain, score });
  }
  out(flags, { file: f.ref, kind, assessed_on: on, scores: written }, () =>
    console.log(`${kind} scores recorded on ${f.ref}: ${written.map((w) => `${w.domain} ${w.score}`).join(', ')}.`));
}

async function cmdOutcomes(db, flags) {
  const params = [];
  let where = '';
  if (flags.program) { const p = await resolveProgram(db, flags.program); params.push(p.code); where = 'where program = $1'; }
  const rows = await db.query(`select program, domain, count(*) as pairs,
                                      round(avg(pre_score), 2) as avg_pre, round(avg(post_score), 2) as avg_post,
                                      round(100.0 * count(*) filter (where change > 0) / count(*)) as improved_pct
                                 from v_outcomes ${where} group by program, domain order by program, domain`, params);
  const missing = await db.query(`select ref, client, program, status, sessions_attended, has_pre, has_post from v_files
                                   where outcomes_required and ((status = 'open' and not has_pre and sessions_attended >= 2)
                                      or (status = 'closed' and not has_post and outcome_exception is null)) order by ref`);
  out(flags, { outcomes: rows, missing }, () => {
    console.log(heading('Outcomes: SCORE change from first to last, per programme'));
    console.log(table(rows, [
      { key: 'program', label: 'prog' }, { key: 'domain', label: 'domain' }, { key: 'pairs', label: 'pairs', align: 'right' },
      { key: 'avg_pre', label: 'avg pre', align: 'right' }, { key: 'avg_post', label: 'avg post', align: 'right' },
      { key: 'improved_pct', label: 'improved', align: 'right', format: (v) => `${v}%` },
    ]));
    console.log(heading('Files missing a score the programme needs'));
    console.log(table(missing, [
      { key: 'ref', label: 'file' }, { key: 'client', label: 'client' }, { key: 'program', label: 'prog' }, { key: 'status', label: 'status' },
      { key: 'has_pre', label: 'pre', format: yn }, { key: 'has_post', label: 'post', format: yn },
    ]));
  });
}

// ---------------------------------------------------------------- programmes, funders, the Data Exchange

async function cmdPrograms(db, flags) {
  const rows = await db.query('select * from v_programs order by code');
  out(flags, rows, () => {
    console.log(heading('Programmes: delivery against the funding agreement, period to date'));
    console.log(table(rows, [
      { key: 'code', label: 'code' }, { key: 'name', label: 'programme', width: 34 }, { key: 'funder', label: 'funder', width: 30 },
      { key: 'clients_served', label: 'clients', align: 'right', format: (v, r) => `${v}/${r.target_clients ?? '-'}` },
      { key: 'sessions_delivered', label: 'sessions', align: 'right', format: (v, r) => `${v}/${r.target_sessions ?? '-'}` },
      { key: 'elapsed_pct', label: 'time gone', align: 'right', format: (v) => `${v}%` },
      { key: 'waitlist', label: 'waiting', align: 'right' }, { key: 'report_due_on', label: 'report due', format: d },
    ]));
  });
}

async function cmdFunderReport(db, args, flags) {
  const p = await resolveProgram(db, args.join(' ') || flags.program);
  const from = parseDate(flags.from) || isoDate(p.period_start);
  const to = parseDate(flags.to) || [isoDate(p.period_end), today()].sort()[0];
  const q = (sql) => db.query(sql, [p.id, from, to]);
  const [delivery] = await q(`
    select count(distinct f.client_id) filter (where s.attendance = 'attended') as clients_served,
           count(*) filter (where s.attendance = 'attended') as sessions_attended,
           count(*) filter (where s.attendance = 'did not attend') as did_not_attend,
           coalesce(sum(s.minutes) filter (where s.attendance = 'attended'), 0) as minutes
      from sessions s join service_files f on f.id = s.service_file_id
     where f.program_id = $1 and s.session_on between $2 and $3`);
  const [files] = await q(`select count(*) filter (where opened_on between $2 and $3) as opened,
                                  count(*) filter (where closed_on between $2 and $3) as closed,
                                  count(*) filter (where status = 'waitlist') as waiting
                             from service_files where program_id = $1`);
  const closeReasons = await q(`select close_reason, count(*) as files from service_files where program_id = $1 and closed_on between $2 and $3 group by close_reason order by files desc`);
  const outcomes = await q(`select o.domain, count(*) as pairs, round(100.0 * count(*) filter (where o.change > 0) / count(*)) as improved_pct
                              from v_outcomes o join service_files f on f.id = o.file_id
                             where f.program_id = $1 and f.closed_on between $2 and $3 group by o.domain order by o.domain`);
  const people = await q(`select distinct c.id, c.gender, c.cultural_identity, c.dob, c.interpreter from clients c
                            join service_files f on f.client_id = c.id join sessions s on s.service_file_id = f.id
                           where f.program_id = $1 and s.attendance = 'attended' and s.session_on between $2 and $3`);
  const tally = (key) => Object.entries(people.reduce((m, r) => { const k = key(r) || 'not recorded'; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([k, n]) => ({ group: k, clients: n })).sort((a, b) => b.clients - a.clients);
  const ageBand = (r) => { if (!r.dob) return null; const a = Math.floor((Date.parse(to) - Date.parse(isoDate(r.dob))) / 31557600000); return a < 18 ? 'under 18' : a < 25 ? '18 to 24' : a < 45 ? '25 to 44' : a < 65 ? '45 to 64' : '65 and over'; };
  const sources = await q(`select r.source, count(*) as referrals from referrals r where r.program_id = $1 and r.received_on between $2 and $3 group by r.source order by referrals desc`);
  const report = {
    program: { code: p.code, name: p.name, contract_ref: p.contract_ref, outlet: p.outlet, target_clients: p.target_clients, target_sessions: p.target_sessions },
    period: { from, to },
    delivery: { clients_served: num(delivery.clients_served), sessions_attended: num(delivery.sessions_attended), did_not_attend: num(delivery.did_not_attend), hours: Math.round(num(delivery.minutes) / 6) / 10 },
    files: { opened: num(files.opened), closed: num(files.closed), waiting_now: num(files.waiting) },
    close_reasons: closeReasons,
    outcomes,
    demographics: { gender: tally((r) => r.gender), cultural_identity: tally((r) => r.cultural_identity), age: tally(ageBand), interpreter: people.filter((r) => r.interpreter).length },
    referral_sources: sources,
  };
  out(flags, report, () => {
    console.log(heading(`${p.name} (${p.code}) funder report, ${from} to ${to}`));
    console.log(`  contract ${p.contract_ref || '-'}, outlet ${p.outlet || '-'}`);
    console.log(`  clients served ${report.delivery.clients_served} of ${p.target_clients ?? '-'} target; sessions ${report.delivery.sessions_attended} of ${p.target_sessions ?? '-'}; ${report.delivery.hours} hours; ${report.delivery.did_not_attend} did not attend`);
    console.log(`  files opened ${report.files.opened}, closed ${report.files.closed}, waiting now ${report.files.waiting_now}`);
    console.log(heading('Outcomes on files closed in the period'));
    console.log(table(outcomes, [{ key: 'domain', label: 'domain' }, { key: 'pairs', label: 'pairs', align: 'right' }, { key: 'improved_pct', label: 'improved', align: 'right', format: (v) => `${v}%` }]));
    console.log(heading('Who we served'));
    console.log(table(report.demographics.cultural_identity, [{ key: 'group', label: 'cultural identity' }, { key: 'clients', label: 'clients', align: 'right' }]));
    console.log(table(report.demographics.age, [{ key: 'group', label: 'age' }, { key: 'clients', label: 'clients', align: 'right' }]));
    console.log(heading('Referral sources'));
    console.log(table(sources, [{ key: 'source', label: 'source', width: 50 }, { key: 'referrals', label: 'referrals', align: 'right' }]));
  });
}

async function cmdDex(db, args, flags) {
  if (args[0] === 'mark') {
    const through = parseDate(flags.through);
    if (!through) throw new CliError('dex mark --through=YYYY-MM-DD records that a person uploaded every attended session up to that date.');
    const rows = await db.query("update sessions s set dex_reported_on = current_date from v_sessions v where v.session_id = s.id and v.dex and s.attendance = 'attended' and s.dex_reported_on is null and s.session_on <= $1 returning s.ref", [through]);
    return out(flags, { marked: rows.length, through }, () => console.log(`${rows.length} session(s) recorded as uploaded to the Data Exchange, through ${through}.`));
  }
  const rows = await db.query(`select dex_period_end as period_end, dex_due_on as due_on, count(*) as sessions,
                                      count(distinct client_id) as clients, bool_or(state = 'DEX LATE') as late
                                 from v_sessions where dex and attendance = 'attended' and dex_reported_on is null
                                group by dex_period_end, dex_due_on order by dex_period_end`);
  const detail = flags.all ? await db.query("select ref, session_on, client, program, worker, dex_due_on, state from v_sessions where dex and attendance = 'attended' and dex_reported_on is null order by session_on") : [];
  out(flags, flags.all ? { periods: rows, sessions: detail } : rows, () => {
    console.log(heading('Data Exchange: attended sessions not yet reported'));
    console.log(table(rows, [
      { key: 'period_end', label: 'period ends', format: d }, { key: 'due_on', label: 'closes', format: d },
      { key: 'sessions', label: 'sessions', align: 'right' }, { key: 'clients', label: 'clients', align: 'right' },
      { key: 'late', label: 'state', format: (v) => (v ? 'LATE: period closed' : 'open') },
    ]));
    if (flags.all) console.log(table(detail, [{ key: 'ref', label: 'ref' }, { key: 'session_on', label: 'date', format: d }, { key: 'client', label: 'client' }, { key: 'program', label: 'prog' }, { key: 'state', label: 'state' }]));
  });
}

// ---------------------------------------------------------------- team

async function cmdTeam(db, flags) {
  const rows = await db.query(`select * from v_team ${flags.all ? '' : "where status = 'active'"} order by name`);
  out(flags, rows, () => {
    console.log(heading('The team'));
    console.log(table(rows, [
      { key: 'name', label: 'name' }, { key: 'role', label: 'role', width: 28 }, { key: 'check_state', label: 'safety check' },
      { key: 'safety_check_expires_on', label: 'expires', format: d }, { key: 'supervision_state', label: 'supervision' },
      { key: 'open_files', label: 'files', align: 'right', format: (v, r) => `${v}/${r.caseload_cap}` },
      { key: 'booked_next_7d', label: 'next 7d', align: 'right' },
    ]));
  });
}

async function cmdCheck(db, args, flags) {
  const w = await resolveWorker(db, args.join(' '));
  const expires = parseDate(flags.expires);
  if (!expires) throw new CliError('--expires=YYYY-MM-DD is required (the date on the clearance).');
  if (expires < today()) throw new CliError(`${expires} is already past. Record the renewed clearance's expiry date.`);
  await db.query('update workers set safety_check_expires_on = $2, safety_check_ref = coalesce(nullif($3, \'\'), safety_check_ref), safety_check = coalesce(nullif($4, \'\'), safety_check) where id = $1',
    [w.id, expires, str(flags.ref), str(flags.type)]);
  out(flags, { worker: w.name, expires }, () => console.log(`${w.name}'s safety check recorded, expires ${expires}.`));
}

async function cmdSupervision(db, args, flags) {
  const w = await resolveWorker(db, args.join(' '));
  const on = parseDate(flags.on || 'today');
  await db.query('update workers set last_supervision_on = $2 where id = $1', [w.id, on]);
  out(flags, { worker: w.name, last_supervision_on: on }, () => console.log(`Supervision recorded for ${w.name} on ${on}.`));
}

// ---------------------------------------------------------------- safety concerns

async function cmdConcerns(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') {
    const c = await resolveClient(db, args.slice(1).join(' '));
    const kind = str(flags.kind);
    const detail = str(flags.detail);
    if (!kind || !detail) throw new CliError('--kind="child protection|family violence|self-harm|adult at risk|other" and --detail="what was disclosed or seen" are required.');
    const ref = await nextRef(db, 'concerns', 'K', 1);
    const files = await db.query("select id, worker_id from service_files where client_id = $1 and status = 'open' order by opened_on desc", [c.id]);
    const w = flags.worker ? await resolveWorker(db, flags.worker) : null;
    await db.query('insert into concerns (ref, client_id, service_file_id, raised_by, kind, mandatory, detail) values ($1,$2,$3,$4,$5,$6,$7)',
      [ref, c.id, files[0]?.id || null, w?.id || files[0]?.worker_id || null, kind, Boolean(flags.mandatory), detail]);
    return out(flags, { ref, client: c.ref, mandatory: Boolean(flags.mandatory) }, () =>
      console.log(`${ref} raised for ${c.name}.${flags.mandatory ? ' Mandatory: record the report as soon as it is made (concerns report ' + ref + ' --to="...").' : ''}`));
  }
  if (sub === 'report') {
    const k = await resolveRef(db, 'concerns', args[1], 'concern');
    const to = str(flags.to);
    if (!to) throw new CliError('--to="the agency the report was made to" is required.');
    const on = parseDate(flags.on || 'today');
    await db.query('update concerns set reported_to = $2, reported_on = $3, report_ref = nullif($4, \'\') where id = $1', [k.id, to, on, str(flags.ref)]);
    return out(flags, { ref: k.ref, reported_to: to, reported_on: on }, () => console.log(`${k.ref} report to ${to} recorded on ${on}.`));
  }
  if (sub === 'close') {
    const k = await resolveRef(db, 'concerns', args[1], 'concern');
    if (k.mandatory && !k.reported_on) throw new CliError(`${k.ref} is a mandatory concern with no report on record. Record the report first.`);
    await db.query("update concerns set status = 'closed', closed_on = current_date where id = $1", [k.id]);
    return out(flags, { ref: k.ref, status: 'closed' }, () => console.log(`${k.ref} closed.`));
  }
  const rows = await db.query(`select k.ref, c.name as client, k.kind, k.mandatory, k.raised_on, current_date - k.raised_on as days, k.reported_to, k.reported_on, k.status
                                 from concerns k join clients c on c.id = k.client_id ${flags.all ? '' : "where k.status = 'open'"} order by k.mandatory and k.reported_on is null desc, k.raised_on`);
  out(flags, rows, () => {
    console.log(heading('Safety concerns'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'client', label: 'client' }, { key: 'kind', label: 'kind' },
      { key: 'raised_on', label: 'raised', format: d }, { key: 'days', label: 'days', align: 'right' },
      { key: 'reported_on', label: 'report', format: (v, r) => (v ? `${d(v)} ${r.reported_to}` : r.mandatory ? 'NOT REPORTED' : 'not mandatory') },
      { key: 'status', label: 'status' },
    ]));
  });
}

// ---------------------------------------------------------------- compliance

const RULES = [
  { id: 'concern-reported', title: 'Mandatory safety concerns are reported to the statutory agency', source: 'Children and Young Persons (Care and Protection) Act 1998 (NSW) s27; Children\'s Act 2014 (NZ) child protection policy',
    sql: `select k.ref, c.name as who, current_date - k.raised_on as days, k.kind || ' raised ' || k.raised_on || ', no report on record' as detail
            from concerns k join clients c on c.id = k.client_id where k.status = 'open' and k.mandatory and k.reported_on is null` },
  { id: 'safety-check', title: 'Every worker taking sessions holds a current safety check on the session date', source: 'Child Protection (Working with Children) Act 2012 (NSW); Children\'s (Requirements for Safety Checks of Children\'s Workers) Regulations 2015 (NZ)',
    sql: `select s.ref, w.name as who, current_date - w.safety_check_expires_on as days, s.attendance || ' ' || s.session_on || ' on a check that expired ' || coalesce(w.safety_check_expires_on::text, 'never recorded') as detail
            from sessions s join workers w on w.id = s.worker_id
           where s.attendance in ('booked', 'attended') and s.session_on >= current_date - 30
             and (w.safety_check_expires_on is null or w.safety_check_expires_on < s.session_on)` },
  { id: 'consent', title: 'Every open file has privacy consent and a collection notice on record', source: 'Privacy Act 1988 (Cth) APP 5; Privacy Act 2020 (NZ) IPP 3',
    sql: `select ref, client as who, current_date - opened_on as days, 'open since ' || opened_on || ', no consent recorded' as detail from v_files where status = 'open' and consent_recorded_on is null` },
  { id: 'dex', title: 'Data Exchange sessions are reported before the reporting period closes', source: 'DSS Data Exchange Protocols v11 (2024), s10: periods end 30 June and 31 December, then 30 days to close off',
    sql: `select ref, client as who, current_date - dex_due_on as days, 'attended ' || session_on || ', period closed ' || dex_due_on as detail from v_sessions where state = 'DEX LATE'` },
  { id: 'session-note', title: 'Every attended session has a note within two days', source: 'Your own records standard and your funding agreement\'s records clause',
    sql: `select ref, client as who, current_date - session_on as days, worker || ', attended ' || session_on || ', no note' as detail from v_sessions where attendance = 'attended' and note is null and current_date - session_on > 2` },
  { id: 'outcome-scores', title: 'Outcome programmes score every file at the start and at closing', source: 'DSS Data Exchange Partnership Approach (SCORE); your funding agreement',
    sql: `select ref, client as who, sessions_attended as days, case when status = 'open' then sessions_attended || ' sessions, no starting score' else 'closed ' || closed_on || ', no closing score and no reason recorded' end as detail
            from v_files where outcomes_required and ((status = 'open' and not has_pre and sessions_attended >= 2) or (status = 'closed' and not has_post and outcome_exception is null))` },
  { id: 'supervision', title: 'Practitioners receive supervision on schedule', source: 'AASW Supervision Standards (2014); your own supervision policy',
    sql: `select name as ref, role as who, current_date - last_supervision_on as days, 'last supervision ' || coalesce(last_supervision_on::text, 'never') as detail from v_team where status = 'active' and supervision_state <> 'ok'` },
  { id: 'referral-response', title: 'Every referral gets a response within five days', source: 'Your own service standard (set it to your funding agreement)',
    sql: `select ref, client_name as who, days_unanswered as days, 'from ' || source || ', received ' || received_on as detail from v_referrals where status = 'new' and days_unanswered > 5` },
  { id: 'file-review', title: 'Open files are reviewed on schedule', source: 'Your own case review standard (90 days by default)',
    sql: `select ref, client as who, current_date - review_due_on as days, 'review was due ' || review_due_on as detail from v_files where status = 'open' and review_due_on < current_date` },
];

async function cmdCompliance(db, flags) {
  const results = [];
  for (const r of RULES) {
    const rows = await db.query(`${r.sql} order by 3 desc nulls last`);
    results.push({ rule: r.id, title: r.title, source: r.source, count: rows.length, worst: rows[0] || null, rows });
  }
  out(flags, results, () => {
    console.log(heading('Compliance: the rules in docs/compliance.md, run against the records'));
    console.log(table(results, [
      { key: 'count', label: 'breaches', align: 'right' },
      { key: 'title', label: 'rule', width: 70 },
      { key: 'worst', label: 'worst', width: 46, format: (v) => (v ? `${v.ref} ${v.who} (${v.days ?? '-'}d)` : 'clean') },
    ]));
    for (const r of results.filter((x) => x.count)) {
      console.log(`\n  ${r.title}\n  source: ${r.source}`);
      for (const row of r.rows.slice(0, 5)) console.log(`    ${row.ref}  ${row.who}  ${row.detail}`);
    }
    console.log('\n  Nothing here is legal advice. Change docs/compliance.md and this check together.');
  });
}

// ---------------------------------------------------------------- import and export

async function cmdImport(db, args, flags) {
  if (args[0] !== 'penelope' && args[0] !== 'csv') throw new CliError('import penelope --roster=<file.csv> [--events=<file.csv>] [--worker="Name"] [--dry-run]');
  if (!flags.roster) throw new CliError('--roster=<csv> is required: the Worker Service Participant Roster report, saved as CSV.');
  const read = (f) => {
    const file = path.resolve(String(f));
    if (!existsSync(file)) throw new CliError(`No file at ${file}. Save the Penelope report as CSV and pass its path.`);
    return parseCsv(readFileSync(file, 'utf8'));
  };
  const roster = read(flags.roster);
  const events = flags.events ? read(flags.events) : [];
  const summary = { programs_created: [], clients_created: 0, files_created: 0, files_skipped: 0, workers_created: [], sessions_created: 0, sessions_skipped: 0, problems: [] };
  await db.exec('BEGIN');
  try {
    const workerFor = async (name) => {
      if (!name) return null;
      const hit = await db.query('select * from workers where lower(name) = lower($1)', [name]);
      if (hit.length) return hit[0];
      const [w] = await db.query("insert into workers (name, role) values ($1, 'Imported from Penelope') returning *", [name]);
      summary.workers_created.push(name);
      return w;
    };
    for (const [i, row] of roster.entries()) {
      const fileId = pick(row, 'Service File ID', 'Service File Id', 'File ID');
      const service = pick(row, 'Service', 'Service Name', 'Program');
      const clientName = pick(row, 'Client', 'Individual', 'Client Name');
      if (!fileId || !service || !clientName) { summary.problems.push(`roster row ${i + 2}: needs Service File ID, Service and Client`); continue; }
      let program = (await db.query('select * from programs where lower(name) = lower($1) or upper(code) = upper($1)', [service]))[0];
      if (!program) {
        const code = (service.match(/\b[A-Za-z]/g) || ['P']).join('').toUpperCase().slice(0, 6) + (summary.programs_created.length + 1);
        [program] = await db.query("insert into programs (code, name, period_start, period_end) values ($1, $2, current_date, current_date + 364) returning *", [code, service]);
        summary.programs_created.push(`${code} ${service}`);
      }
      const dob = parseDate(pick(row, 'Client Date of Birth', 'Date of Birth', 'DOB'));
      const caseId = pick(row, 'Case ID', 'Case Id');
      let client = (await db.query('select * from clients where lower(name) = lower($1) and (dob is null or $2::date is null or dob = $2::date)', [clientName, dob]))[0];
      if (!client) {
        const ref = await nextRef(db, 'clients', 'C', 1001);
        [client] = await db.query('insert into clients (ref, name, dob, phone, external_ref) values ($1,$2,$3,$4,$5) returning *', [ref, clientName, dob, pick(row, 'Client Phone Number', 'Phone') || null, caseId || null]);
        summary.clients_created++;
      }
      const ref = `PEN-${fileId}`;
      if ((await db.query('select 1 from service_files where ref = $1', [ref])).length) { summary.files_skipped++; continue; }
      const worker = await workerFor(pick(row, 'Worker', 'Assigned Worker', 'Worker Name') || str(flags.worker));
      const opened = parseDate(pick(row, 'Opened Date', 'Open Date', 'Opened')) || today();
      await db.query("insert into service_files (ref, client_id, program_id, worker_id, status, waitlisted_on, opened_on, review_due_on, external_ref) values ($1,$2,$3,$4,'open',$5,$5,current_date + 30,$6)",
        [ref, client.id, program.id, worker?.id || null, opened, fileId]);
      summary.files_created++;
    }
    for (const [i, row] of events.entries()) {
      const fileId = pick(row, 'Service File ID', 'Service File Id', 'File ID');
      const file = (await db.query('select * from service_files where external_ref = $1', [fileId]))[0];
      if (!file) { summary.problems.push(`events row ${i + 2}: service file ${fileId || '(blank)'} is not in the roster`); continue; }
      const eventId = pick(row, 'Event ID', 'Service Event ID', 'Event Id') || `${fileId}-${i + 1}`;
      const ref = `PEN-E${eventId}`;
      if ((await db.query('select 1 from sessions where ref = $1', [ref])).length) { summary.sessions_skipped++; continue; }
      const on = parseDate(pick(row, 'Event Date', 'Date', 'Session Date'));
      if (!on) { summary.problems.push(`events row ${i + 2}: no event date`); continue; }
      const status = pick(row, 'Attendance', 'Status', 'Event Status').toLowerCase();
      const attendance = /no.?show|did not|dna|absent/.test(status) ? 'did not attend' : /cancel/.test(status) ? 'cancelled' : on > today() ? 'booked' : 'attended';
      const worker = (await workerFor(pick(row, 'Worker', 'Staff', 'Worker Name'))) || (file.worker_id ? { id: file.worker_id } : null);
      if (!worker) { summary.problems.push(`events row ${i + 2}: no worker on the event or the file`); continue; }
      const minutes = Math.max(1, Math.round(num(pick(row, 'Duration (minutes)', 'Duration', 'Minutes') || 60)));
      const imported = attendance === 'attended';
      await db.query(`insert into sessions (ref, service_file_id, worker_id, session_on, minutes, attendance, note, noted_on, dex_reported_on, external_ref)
                      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ref, file.id, worker.id, on, minutes, attendance,
          imported ? 'Imported from Penelope. The session note stays in the Penelope record.' : null, imported ? on : null,
          imported && !flags['dex-unreported'] ? today() : null, eventId]);
      summary.sessions_created++;
    }
    if (flags['dry-run']) await db.exec('ROLLBACK');
    else await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  const audit = flags['dry-run'] ? [] : await db.query("select ref, client from v_files where ref like 'PEN-%' and status = 'open' and consent_recorded_on is null order by ref");
  summary.no_consent = audit.map((r) => `${r.ref} ${r.client}`);
  out(flags, { dry_run: Boolean(flags['dry-run']), ...summary }, () => {
    console.log(heading(flags['dry-run'] ? 'Import from Penelope: trial run, nothing written' : 'Import from Penelope'));
    console.log(`  files ${summary.files_created} new, ${summary.files_skipped} already here; clients ${summary.clients_created} new; sessions ${summary.sessions_created} new, ${summary.sessions_skipped} already here`);
    if (summary.programs_created.length) console.log(`  programmes created (set each funder and period): ${summary.programs_created.join(', ')}`);
    if (summary.workers_created.length) console.log(`  workers created (record each safety check): ${summary.workers_created.join(', ')}`);
    for (const p of summary.problems) console.log(`  PROBLEM ${p}`);
    if (summary.no_consent.length) console.log(`  ${summary.no_consent.length} imported file(s) have no consent on record yet: the first audit item.`);
  });
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => { if (v === null || v === undefined) return ''; const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

async function cmdExport(db, flags) {
  const dir = path.resolve(REPO_ROOT, str(flags.out) || path.join('exports', today()));
  mkdirSync(dir, { recursive: true });
  const tables = ['funders', 'programs', 'workers', 'clients', 'referrals', 'service_files', 'sessions', 'goals', 'assessments', 'concerns', 'case_notes'];
  const counts = {};
  for (const t of tables) {
    const rows = await db.query(`select * from ${t} order by created_at, id`);
    writeFileSync(path.join(dir, `${t}.csv`), toCsv(rows));
    counts[t] = rows.length;
  }
  out(flags, { dir, counts }, () => console.log(`Exported ${tables.length} files to ${path.relative(REPO_ROOT, dir) || dir}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`));
}

// ---------------------------------------------------------------- dispatch

const HELP = `case-management-for-claude-code

  stats                                   the organisation at a glance
  attention                               everything that wants a decision, worst first
  clients [--all]                         clients with their live files
  client <name|ref>                       one client's whole card
  consent <client> [--on=] [--research]   record privacy consent
  files [--worker= --program= --status= --all]
  file <ref|client>                       the client card for a file
  file open <ref> --worker= [--on= --review=]
  file close <ref> --reason= [--no-post-reason=]
  file review <ref> [--next= --note=]
  file assign <ref> --worker=
  waitlist                                longest wait first
  referrals [--all]
  referrals add --name= --source= [--program= --reason= --contact= --received=]
  referrals accept <ref> [--program=]
  referrals decline <ref> --reason=
  sessions [--days=7]                     booked ahead, unresolved, unnoted
  session book <file> --on= [--worker= --minutes= --mode=]
  session log <file> --note= [--on= --minutes= --mode= --worker=]
  session done|dna|cancel <session-ref> [--note=]
  note <session-ref> --note=              add a missing session note
  log <client> --body= [--kind=call|email|meeting|note]
  goals [<file>] | goals add <file> --goal= [--target=] | goals update <ref> --progress= [--status=]
  score <file> --kind=pre|post|review --circumstances=N --goals=N [--satisfaction=N]
  outcomes [--program=]
  programs                                delivery against each funding agreement
  funder-report <program> [--from= --to=]
  dex [--all] | dex mark --through=       Data Exchange sessions not yet reported
  team [--all]                            safety checks, supervision, caseloads
  check <worker> --expires= [--ref= --type=]
  supervision <worker> [--on=]
  concerns [--all] | concerns add <client> --kind= --detail= [--mandatory]
  concerns report <ref> --to= [--ref= --on=] | concerns close <ref>
  compliance                              the rules in docs/compliance.md against the records
  import penelope --roster=<csv> [--events=<csv>] [--worker=] [--dry-run] [--dex-unreported]
  export [--out=<dir>]                    every record to CSV

  Any read command takes --json.`;

async function main() {
  const { args, flags } = parseArgv(process.argv.slice(2));
  const [cmd, ...rest] = args;
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return; }
  const db = await getDb();
  try {
    switch (cmd) {
      case 'stats': return await cmdStats(db, flags);
      case 'attention': return await cmdAttention(db, flags);
      case 'clients': return await cmdClients(db, flags);
      case 'client': return await cmdClient(db, rest, flags);
      case 'consent': return await cmdConsent(db, rest, flags);
      case 'files': return await cmdFiles(db, flags);
      case 'file': return await cmdFile(db, rest, flags);
      case 'waitlist': return await cmdWaitlist(db, flags);
      case 'referrals': case 'referral': return await cmdReferrals(db, rest, flags);
      case 'sessions': return await cmdSessions(db, flags);
      case 'session': return await cmdSession(db, rest, flags);
      case 'note': return await cmdNote(db, rest, flags);
      case 'log': return await cmdLog(db, rest, flags);
      case 'goals': case 'goal': return await cmdGoals(db, rest, flags);
      case 'score': return await cmdScore(db, rest, flags);
      case 'outcomes': return await cmdOutcomes(db, flags);
      case 'programs': case 'programmes': return await cmdPrograms(db, flags);
      case 'funder-report': return await cmdFunderReport(db, rest, flags);
      case 'dex': return await cmdDex(db, rest, flags);
      case 'team': return await cmdTeam(db, flags);
      case 'check': return await cmdCheck(db, rest, flags);
      case 'supervision': return await cmdSupervision(db, rest, flags);
      case 'concerns': case 'concern': return await cmdConcerns(db, rest, flags);
      case 'compliance': return await cmdCompliance(db, flags);
      case 'import': return await cmdImport(db, rest, flags);
      case 'export': return await cmdExport(db, flags);
      default: throw new CliError(`Unknown command "${cmd}". Run with no arguments for the list.`);
    }
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e instanceof CliError ? e.message : e.stack || String(e));
  process.exit(e.code && Number.isInteger(e.code) ? e.code : 1);
});
