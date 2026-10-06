-- Case Management for Claude Code: the schema.
--
-- A community services organisation's case record the way Penelope holds it:
-- funders and the programmes they fund, workers with their safety checks and
-- supervision, clients with consent, referrals in, service files (one per
-- client per programme: waitlist, open, closed), sessions (service events)
-- with their notes, goals, outcome scores (SCORE: circumstances, goals,
-- satisfaction, 1 to 5), safety concerns and file notes.
--
-- Plain Postgres. Runs on any Postgres 13+ and on PGlite. No extensions.

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- funders and programmes

create table if not exists funders (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  kind             text not null default 'government' check (kind in ('government', 'philanthropic', 'other')),
  reports_to_dex   boolean not null default false, -- Australian DSS Data Exchange
  contact          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists programs (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null,
  funder_id          uuid references funders(id),
  outlet             text,
  contract_ref       text,
  period_start       date not null,
  period_end         date not null,
  target_clients     integer,
  target_sessions    integer,
  outcomes_required  boolean not null default true, -- pre and post SCORE on every file
  report_due_on      date,
  status             text not null default 'active' check (status in ('active', 'ended')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (period_end >= period_start)
);

-- ---------------------------------------------------------------- workers

create table if not exists workers (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null unique,
  role                     text,
  email                    text,
  status                   text not null default 'active' check (status in ('active', 'former')),
  safety_check             text,  -- 'WWCC NSW', 'Children''s Act safety check', ...
  safety_check_ref         text,
  safety_check_expires_on  date,
  last_supervision_on      date,
  supervision_every_days   integer not null default 30,
  caseload_cap             integer not null default 20,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------- clients

create table if not exists clients (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique,
  name                  text not null,
  dob                   date,
  gender                text,
  phone                 text,
  email                 text,
  suburb                text,
  postcode              text,
  cultural_identity     text,
  language              text,
  interpreter           boolean not null default false,
  consent_recorded_on   date,     -- privacy collection notice and consent to share
  consent_research      boolean not null default false, -- consent for de-identified funder research use
  safety_alert          text,     -- shown on every read of this client
  status                text not null default 'active' check (status in ('active', 'inactive')),
  external_ref          text,     -- the Penelope individual or case id
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- referrals, files, sessions

create table if not exists service_files (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique,
  client_id           uuid not null references clients(id),
  program_id          uuid not null references programs(id),
  worker_id           uuid references workers(id),
  status              text not null default 'waitlist' check (status in ('waitlist', 'open', 'closed')),
  waitlisted_on       date,
  opened_on           date,
  closed_on           date,
  close_reason        text,
  outcome_exception   text,  -- why no post score was collected, recorded at closing
  review_due_on       date,
  external_ref        text,  -- the Penelope service file id
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (status <> 'open' or opened_on is not null),
  check (status <> 'closed' or (closed_on is not null and close_reason is not null))
);

create table if not exists referrals (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,
  client_id        uuid references clients(id),
  client_name      text not null,
  source           text not null,
  source_contact   text,
  program_id       uuid references programs(id),
  received_on      date not null,
  reason           text,
  status           text not null default 'new' check (status in ('new', 'accepted', 'waitlisted', 'declined', 'withdrawn')),
  responded_on     date,
  decline_reason   text,
  service_file_id  uuid references service_files(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status = 'new' or responded_on is not null),
  check (status <> 'declined' or decline_reason is not null)
);

create table if not exists sessions (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null unique,
  service_file_id   uuid not null references service_files(id),
  worker_id         uuid not null references workers(id),
  session_on        date not null,
  minutes           integer not null default 60 check (minutes > 0),
  mode              text not null default 'in person' check (mode in ('in person', 'phone', 'video', 'outreach', 'group')),
  attendance        text not null default 'booked' check (attendance in ('booked', 'attended', 'did not attend', 'cancelled')),
  note              text,
  noted_on          date,
  dex_reported_on   date,
  external_ref      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (note is null or noted_on is not null)
);

create table if not exists goals (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,
  service_file_id  uuid not null references service_files(id),
  goal             text not null,
  set_on           date not null default current_date,
  target_on        date,
  status           text not null default 'active' check (status in ('active', 'achieved', 'discontinued')),
  progress         integer not null default 0 check (progress between 0 and 100),
  reviewed_on      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- SCORE: the Data Exchange outcome scale, also a sound general one. 1 (worst) to 5 (best).
create table if not exists assessments (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,
  service_file_id  uuid not null references service_files(id),
  kind             text not null check (kind in ('pre', 'post', 'review')),
  domain           text not null check (domain in ('circumstances', 'goals', 'satisfaction')),
  measure          text not null,
  score            integer not null check (score between 1 and 5),
  assessed_on      date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists concerns (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,
  client_id        uuid not null references clients(id),
  service_file_id  uuid references service_files(id),
  raised_by        uuid references workers(id),
  raised_on        date not null default current_date,
  kind             text not null check (kind in ('child protection', 'family violence', 'self-harm', 'adult at risk', 'other')),
  mandatory        boolean not null default false, -- must be reported to a statutory agency
  reported_to      text,
  reported_on      date,
  report_ref       text,
  detail           text not null,
  status           text not null default 'open' check (status in ('open', 'closed')),
  closed_on        date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'closed' or not mandatory or reported_on is not null)
);

create table if not exists case_notes (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id),
  service_file_id  uuid references service_files(id),
  worker_id        uuid references workers(id),
  noted_on         date not null default current_date,
  kind             text not null default 'note' check (kind in ('note', 'call', 'email', 'meeting', 'supervision')),
  body             text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists sessions_file_idx on sessions (service_file_id, session_on);
create index if not exists sessions_worker_idx on sessions (worker_id, session_on);
create index if not exists files_client_idx on service_files (client_id);
create index if not exists assessments_file_idx on assessments (service_file_id, kind);

do $$
declare t text;
begin
  foreach t in array array['funders','programs','workers','clients','service_files','referrals','sessions','goals','assessments','concerns','case_notes'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- views

-- Data Exchange reporting periods run January to June and July to December,
-- and each closes 30 days after it ends (30 July, 30 January): the close-off
-- period in the Data Exchange Protocols (Version 11, March 2024, section 10).
create or replace function dex_period_end(d date) returns date
language sql immutable as $$
  select case when extract(month from d) <= 6
              then make_date(extract(year from d)::int, 6, 30)
              else make_date(extract(year from d)::int, 12, 31) end
$$;

create or replace view v_files as
select f.id as file_id, f.ref, f.status,
       c.id as client_id, c.ref as client_ref, c.name as client, c.safety_alert,
       c.consent_recorded_on,
       p.id as program_id, p.code as program, p.name as program_name, p.outcomes_required,
       w.id as worker_id, w.name as worker,
       f.waitlisted_on, f.opened_on, f.closed_on, f.close_reason, f.outcome_exception, f.review_due_on,
       coalesce(s.attended, 0) as sessions_attended,
       coalesce(s.dna, 0) as did_not_attend,
       coalesce(s.minutes, 0) as minutes_attended,
       s.last_contact_on, s.next_booked_on,
       case when f.status = 'open' then current_date - coalesce(s.last_contact_on, f.opened_on) end as days_quiet,
       case when f.status = 'waitlist' then current_date - f.waitlisted_on end as days_waiting,
       exists (select 1 from assessments a where a.service_file_id = f.id and a.kind = 'pre') as has_pre,
       exists (select 1 from assessments a where a.service_file_id = f.id and a.kind = 'post') as has_post,
       (select count(*) from goals g where g.service_file_id = f.id and g.status = 'active') as active_goals,
       case
         when f.status = 'closed' then 'closed'
         when f.status = 'waitlist' then 'WAITLIST ' || (current_date - f.waitlisted_on) || 'd'
         when c.consent_recorded_on is null then 'NO CONSENT'
         when f.review_due_on < current_date then 'REVIEW OVERDUE'
         when s.next_booked_on is null and current_date - coalesce(s.last_contact_on, f.opened_on) >= 21 then 'QUIET'
         else 'ok'
       end as state
from service_files f
join clients c on c.id = f.client_id
join programs p on p.id = f.program_id
left join workers w on w.id = f.worker_id
left join lateral (
  select count(*) filter (where attendance = 'attended') as attended,
         count(*) filter (where attendance = 'did not attend') as dna,
         sum(minutes) filter (where attendance = 'attended') as minutes,
         max(session_on) filter (where attendance = 'attended') as last_contact_on,
         min(session_on) filter (where attendance = 'booked' and session_on >= current_date) as next_booked_on
  from sessions x where x.service_file_id = f.id
) s on true;

create or replace view v_sessions as
select s.id as session_id, s.ref, s.session_on, s.minutes, s.mode, s.attendance,
       s.note, s.noted_on, s.dex_reported_on,
       f.id as file_id, f.ref as file_ref, c.id as client_id, c.name as client,
       p.code as program, w.id as worker_id, w.name as worker,
       fu.name as funder, coalesce(fu.reports_to_dex, false) as dex,
       case when fu.reports_to_dex then dex_period_end(s.session_on) end as dex_period_end,
       case when fu.reports_to_dex then dex_period_end(s.session_on) + 30 end as dex_due_on,
       case
         when s.attendance = 'booked' and s.session_on < current_date then 'UNRESOLVED'
         when s.attendance = 'attended' and s.note is null then 'NO NOTE'
         when s.attendance = 'attended' and fu.reports_to_dex and s.dex_reported_on is null
              and dex_period_end(s.session_on) + 30 < current_date then 'DEX LATE'
         else s.attendance
       end as state
from sessions s
join service_files f on f.id = s.service_file_id
join clients c on c.id = f.client_id
join programs p on p.id = f.program_id
join workers w on w.id = s.worker_id
left join funders fu on fu.id = p.funder_id;

create or replace view v_team as
select w.id as worker_id, w.name, w.role, w.status, w.safety_check, w.safety_check_ref, w.safety_check_expires_on,
       case
         when w.safety_check_expires_on is null then 'NONE'
         when w.safety_check_expires_on < current_date then 'EXPIRED'
         when w.safety_check_expires_on < current_date + 30 then 'EXPIRES ' || (w.safety_check_expires_on - current_date) || 'd'
         else 'current'
       end as check_state,
       w.last_supervision_on,
       case
         when w.last_supervision_on is null then 'NONE'
         when current_date - w.last_supervision_on > w.supervision_every_days then 'OVERDUE ' || (current_date - w.last_supervision_on - w.supervision_every_days) || 'd'
         else 'ok'
       end as supervision_state,
       w.caseload_cap,
       (select count(*) from service_files f where f.worker_id = w.id and f.status = 'open') as open_files,
       (select count(*) from sessions s where s.worker_id = w.id and s.attendance = 'booked' and s.session_on between current_date and current_date + 7) as booked_next_7d
from workers w;

create or replace view v_waitlist as
select f.id as file_id, f.ref, c.name as client, c.ref as client_ref, p.code as program, f.waitlisted_on,
       current_date - f.waitlisted_on as days_waiting, r.source as referred_by,
       c.consent_recorded_on is not null as consent
from service_files f
join clients c on c.id = f.client_id
join programs p on p.id = f.program_id
left join referrals r on r.service_file_id = f.id
where f.status = 'waitlist';

create or replace view v_referrals as
select r.id as referral_id, r.ref, r.client_name, r.source, r.source_contact, p.code as program, r.received_on,
       r.status, r.responded_on, r.decline_reason, r.reason,
       case when r.status = 'new' then current_date - r.received_on end as days_unanswered
from referrals r
left join programs p on p.id = r.program_id;

-- Delivery against the funding agreement, period to date.
create or replace view v_programs as
select p.id as program_id, p.code, p.name, fu.name as funder, coalesce(fu.reports_to_dex, false) as dex,
       p.period_start, p.period_end, p.target_clients, p.target_sessions, p.report_due_on,
       (select count(distinct f.client_id) from sessions s join service_files f on f.id = s.service_file_id
         where f.program_id = p.id and s.attendance = 'attended' and s.session_on between p.period_start and least(p.period_end, current_date)) as clients_served,
       (select count(*) from sessions s join service_files f on f.id = s.service_file_id
         where f.program_id = p.id and s.attendance = 'attended' and s.session_on between p.period_start and least(p.period_end, current_date)) as sessions_delivered,
       (select count(*) from service_files f where f.program_id = p.id and f.status = 'open') as open_files,
       (select count(*) from service_files f where f.program_id = p.id and f.status = 'waitlist') as waitlist,
       round(100.0 * greatest(0, least(current_date, p.period_end) - p.period_start) / greatest(1, p.period_end - p.period_start)) as elapsed_pct
from programs p
left join funders fu on fu.id = p.funder_id
where p.status = 'active';

-- SCORE change per file: the first pre score against the latest post score, per domain.
create or replace view v_outcomes as
select f.id as file_id, f.ref, c.name as client, p.code as program, d.domain,
       pre.score as pre_score, post.score as post_score,
       post.score - pre.score as change
from service_files f
join clients c on c.id = f.client_id
join programs p on p.id = f.program_id
cross join (values ('circumstances'), ('goals')) d(domain)
join lateral (select score from assessments a where a.service_file_id = f.id and a.kind = 'pre' and a.domain = d.domain order by assessed_on, ref limit 1) pre on true
join lateral (select score from assessments a where a.service_file_id = f.id and a.kind = 'post' and a.domain = d.domain order by assessed_on desc, ref desc limit 1) post on true;

-- Everything that wants a decision, worst first. rank 1 is today's first phone call.
create or replace view v_attention as
select 1 as rank, 'CONCERN NOT REPORTED' as reason, k.ref as label, c.name as client, k.kind as place,
       current_date - k.raised_on as days, 'mandatory ' || k.kind || ' concern raised, no report to the statutory agency on record' as detail
from concerns k join clients c on c.id = k.client_id
where k.status = 'open' and k.mandatory and k.reported_on is null
union all
select 2, 'CHECK EXPIRED, STILL BOOKED', w.name, null, w.safety_check,
       current_date - w.safety_check_expires_on,
       (select count(*) from sessions s where s.worker_id = w.id and s.attendance = 'booked' and s.session_on >= current_date) || ' booked session(s) ahead on an expired safety check'
from workers w
where w.status = 'active' and (w.safety_check_expires_on is null or w.safety_check_expires_on < current_date)
  and exists (select 1 from sessions s where s.worker_id = w.id and s.attendance = 'booked' and s.session_on >= current_date)
union all
select 3, 'REFERRAL UNANSWERED', r.ref, r.client_name, r.source, current_date - r.received_on, 'received ' || r.received_on || ', no response yet'
from referrals r where r.status = 'new' and current_date - r.received_on > 5
union all
select 3, 'NO CONSENT', f.ref, f.client, f.program, current_date - f.opened_on, 'open file with no privacy consent recorded'
from v_files f where f.status = 'open' and f.consent_recorded_on is null
union all
select 3, 'DEX LATE', min(s.ref), s.client, s.program, current_date - min(s.dex_due_on),
       count(*) || ' session(s) not reported to the Data Exchange, period closed ' || min(s.dex_due_on)
from v_sessions s where s.state = 'DEX LATE' group by s.client, s.program
union all
select 4, 'NO NOTE', s.ref, s.client, s.worker, current_date - s.session_on, 'attended ' || s.session_on || ', no session note'
from v_sessions s where s.attendance = 'attended' and s.note is null and current_date - s.session_on > 2
union all
select 4, 'UNRESOLVED SESSION', s.ref, s.client, s.worker, current_date - s.session_on, 'booked for ' || s.session_on || ', never marked attended or not'
from v_sessions s where s.state = 'UNRESOLVED'
union all
select 4, 'FUNDER REPORT DUE', p.code, null, p.funder, p.report_due_on - current_date, 'report due ' || p.report_due_on
from v_programs p where p.report_due_on is not null and p.report_due_on <= current_date + 14
union all
select 5, 'QUIET', f.ref, f.client, f.worker, f.days_quiet, 'no contact in ' || f.days_quiet || ' days and nothing booked'
from v_files f where f.state = 'QUIET'
union all
select 5, 'WAITING', f.ref, f.client, f.program, f.days_waiting, 'on the waitlist ' || f.days_waiting || ' days'
from v_files f where f.status = 'waitlist' and f.days_waiting > 30
union all
select 6, 'REVIEW OVERDUE', f.ref, f.client, f.worker, current_date - f.review_due_on, 'file review was due ' || f.review_due_on
from v_files f where f.status = 'open' and f.review_due_on < current_date
union all
select 6, 'NO PRE SCORE', f.ref, f.client, f.worker, f.sessions_attended, f.sessions_attended || ' sessions in and no starting outcome score'
from v_files f where f.status = 'open' and f.outcomes_required and not f.has_pre and f.sessions_attended >= 2
union all
select 6, 'CHECK EXPIRING', w.name, null, w.safety_check, w.safety_check_expires_on - current_date, 'safety check expires ' || w.safety_check_expires_on || ': start the renewal'
from workers w where w.status = 'active' and w.safety_check_expires_on between current_date and current_date + 30
union all
select 6, 'SUPERVISION OVERDUE', t.name, null, t.role, current_date - t.last_supervision_on, 'last supervision ' || coalesce(t.last_supervision_on::text, 'never')
from v_team t where t.status = 'active' and t.supervision_state <> 'ok';
