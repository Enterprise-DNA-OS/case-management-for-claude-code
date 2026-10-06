-- Demo data: Harbourside Family Services, a fictional Newcastle NSW community
-- services organisation running four funded programmes. Every date is relative
-- to today so the demo always has something to say:
--   * a child protection concern raised two days ago with no report on record
--   * a family worker booked next week on a safety check that expired 12 days ago
--   * a referral unanswered for 8 days
--   * a Data Exchange funded file with sessions from a closed reporting period never reported
--   * an attended youth session with no note, an open file with no consent recorded
--   * a youth file four sessions in with no starting outcome score
--   * a quiet file, a review overdue, a family waiting 41 days, supervision overdue
--   * a funder report due in nine days
-- Unique refs and ON CONFLICT DO NOTHING make it safe to run twice.

insert into funders (name, kind, reports_to_dex, contact) values
  ('Department of Social Services', 'government', true, 'Funding Arrangement Manager, DSS'),
  ('NSW Department of Communities and Justice', 'government', false, 'Contract manager, Hunter district'),
  ('Hunter Community Foundation', 'philanthropic', false, 'Grants officer')
on conflict (name) do nothing;

insert into programs (code, name, funder_id, outlet, contract_ref, period_start, period_end, target_clients, target_sessions, outcomes_required, report_due_on)
select v.code, v.name, (select id from funders where name = v.funder), v.outlet, v.contract_ref,
       current_date - 97, current_date + 267, v.tc, v.ts, v.outcomes, case when v.report_in is null then null else current_date + v.report_in end
from (values
  ('FRS', 'Family and Relationship Services', 'Department of Social Services', 'Hamilton', '4-ABC123', 60, 420, true, null::int),
  ('CAP', 'Children and Parenting Support', 'Department of Social Services', 'Hamilton', '4-ABC124', 40, 240, true, null::int),
  ('YTH', 'Youth Counselling', 'NSW Department of Communities and Justice', 'Wallsend', 'DCJ-HNE-0457', 30, 260, true, 9),
  ('FVC', 'Family Violence Case Management', 'Hunter Community Foundation', 'Hamilton', 'HCF-2026-11', 20, 180, false, 40)
) v(code, name, funder, outlet, contract_ref, tc, ts, outcomes, report_in)
on conflict (code) do nothing;

insert into workers (name, role, email, status, safety_check, safety_check_ref, safety_check_expires_on, last_supervision_on, supervision_every_days, caseload_cap)
values
  ('Priya Raman', 'Senior counsellor', 'priya@harbourside.example', 'active', 'WWCC NSW', 'WWC0456712E', current_date + 610, current_date - 12, 30, 22),
  ('Tom Avery', 'Family worker', 'tom@harbourside.example', 'active', 'WWCC NSW', 'WWC0391184E', current_date - 12, current_date - 20, 30, 18),
  ('Leilani Fonoti', 'Youth worker', 'leilani@harbourside.example', 'active', 'WWCC NSW', 'WWC0518839E', current_date + 900, current_date - 52, 30, 16),
  ('Grace Whitlam', 'Family violence case manager', 'grace@harbourside.example', 'active', 'WWCC NSW', 'WWC0287760E', current_date + 20, current_date - 9, 30, 14),
  ('Daniel Okafor', 'Intake coordinator', 'daniel@harbourside.example', 'active', 'WWCC NSW', 'WWC0610045E', current_date + 1200, current_date - 15, 30, 0),
  ('Ruth Bennett', 'Counsellor', null, 'former', 'WWCC NSW', 'WWC0110021E', current_date - 200, current_date - 260, 30, 20)
on conflict (name) do nothing;

insert into clients (ref, name, dob, gender, phone, suburb, postcode, cultural_identity, language, interpreter, consent_recorded_on, consent_research, safety_alert, status)
values
  ('C-1001', 'Mia Harrison',   current_date - 13200, 'Female', '0412 330 118', 'Mayfield',     '2304', 'Australian', 'English', false, current_date - 80, true,  null, 'active'),
  ('C-1002', 'Jordan Ellis',   current_date - 15400, 'Male',   '0423 551 902', 'Hamilton',     '2303', 'Australian', 'English', false, current_date - 70, false, null, 'active'),
  ('C-1003', 'Sarah Nguyen',   current_date - 12800, 'Female', '0431 774 260', 'Wallsend',     '2287', 'Vietnamese', 'Vietnamese', true, current_date - 262, true, null, 'active'),
  ('C-1004', 'Ben Kowalski',   current_date - 14100, 'Male',   '0400 218 655', 'Lambton',      '2299', 'Polish',     'English', false, current_date - 40, true,  null, 'active'),
  ('C-1005', 'Aaliyah Brown',  current_date - 5900,  'Female', '0447 902 331', 'Wallsend',     '2287', 'Aboriginal', 'English', false, current_date - 50, false, 'Safety plan in place: check in at the start of every session.', 'active'),
  ('C-1006', 'Kai Tipene',     current_date - 6200,  'Male',   '0455 120 784', 'Cardiff',      '2285', 'Maori',      'English', false, current_date - 35, true,  null, 'active'),
  ('C-1007', 'Hannah Reid',    current_date - 11900, 'Female', '0466 340 219', 'Merewether',   '2291', 'Australian', 'English', false, current_date - 45, false, 'Do not leave voicemail. Text only to this number.', 'active'),
  ('C-1008', 'Olivia Martin',  current_date - 10800, 'Female', '0478 655 102', 'Adamstown',    '2289', 'Australian', 'English', false, current_date - 120, false, 'Former partner holds an AVO naming her. Never confirm attendance to a caller.', 'active'),
  ('C-1009', 'Ethan Clarke',   current_date - 12300, 'Male',   '0481 994 207', 'Charlestown',  '2290', 'Australian', 'English', false, current_date - 41, true,  null, 'active'),
  ('C-1010', 'Zara Ahmed',     current_date - 11500, 'Female', '0492 417 860', 'Jesmond',      '2299', 'Pakistani',  'Urdu',    true,  null, false, null, 'active'),
  ('C-1011', 'Liam O''Connor', current_date - 16900, 'Male',   '0403 112 549', 'New Lambton',  '2305', 'Irish',      'English', false, current_date - 150, true,  null, 'active'),
  ('C-1012', 'Chloe Davies',   current_date - 12000, 'Female', '0415 663 018', 'Kotara',       '2289', 'Australian', 'English', false, current_date - 160, true,  null, 'active'),
  ('C-1013', 'Noah Williams',  current_date - 14600, 'Male',   '0427 380 455', 'Islington',    '2296', 'Australian', 'English', false, null, false, null, 'active'),
  ('C-1014', 'Ruby Thompson',  current_date - 17800, 'Female', '0438 201 776', 'Hamilton',     '2303', 'Australian', 'English', false, current_date - 400, false, null, 'inactive')
on conflict (ref) do nothing;

-- One spec row per service file drives the file, its sessions, its scores and its goals.
create temporary table if not exists seed_spec (
  ref text, client text, program text, worker text, status text,
  opened_ago int, closed_ago int, waitlisted_ago int,
  sessions int, gap int, last_ago int, booked_ahead int,
  dna_at int, last_note_missing boolean, dex_missed boolean, unresolved_ago int,
  pre boolean, post boolean, pre_c int, pre_g int, post_c int, post_g int,
  review_in int, close_reason text, outcome_exception text, mode text
);
truncate seed_spec;
insert into seed_spec values
  ('F-3001','C-1001','FRS','Priya Raman','open',   70, null, null,  8,  7,  3,    4, 3, false, false, null, true,  false, 2, 2, null, null,   40, null, null, 'in person'),
  ('F-3002','C-1002','FRS','Priya Raman','open',   66, null, null,  5,  9, 26, null, 0, false, false, null, true,  false, 3, 2, null, null,   20, null, null, 'phone'),
  ('F-3003','C-1003','FRS','Tom Avery',  'open',  260, null, null, 12, 21,  6,    3, 0, false, true,  null, true,  false, 2, 1, null, null,   30, null, null, 'in person'),
  ('F-3004','C-1004','CAP','Tom Avery',  'open',   38, null, null,  5,  7,  2,    5, 0, false, false,    9, true,  false, 2, 3, null, null,   50, null, null, 'outreach'),
  ('F-3005','C-1005','YTH','Leilani Fonoti','open',48, null, null,  6,  7,  4,    3, 2, true,  false, null, true,  false, 1, 2, null, null,   35, null, null, 'in person'),
  ('F-3006','C-1006','YTH','Leilani Fonoti','open',33, null, null,  4,  7,  5,    2, 0, false, false, null, false, false, null, null, null, null, 60, null, null, 'in person'),
  ('F-3007','C-1007','FVC','Grace Whitlam','open', 44, null, null,  6,  6,  2,    1, 0, false, false, null, false, false, null, null, null, null, 45, null, null, 'phone'),
  ('F-3008','C-1008','FVC','Grace Whitlam','open',118, null, null, 14,  8,  5,    6, 7, false, false, null, false, false, null, null, null, null, -11, null, null, 'in person'),
  ('F-3009','C-1009','CAP', null,        'waitlist', null, null, 41, 0, 0, 0, null, 0, false, false, null, false, false, null, null, null, null, null, null, null, null),
  ('F-3010','C-1010','FRS', null,        'waitlist', null, null, 12, 0, 0, 0, null, 0, false, false, null, false, false, null, null, null, null, null, null, null, null),
  ('F-3011','C-1011','FRS','Priya Raman','closed',148,   20, null, 10, 12, 21, null, 0, false, false, null, true,  true,  2, 2, 4, 4, null, 'Goals achieved', null, 'in person'),
  ('F-3012','C-1012','CAP','Priya Raman','closed',158,   35, null,  9, 13, 36, null, 5, false, false, null, true,  false, 3, 2, null, null, null, 'Client disengaged', null, 'video'),
  ('F-3013','C-1013','FRS','Priya Raman','open',   24, null, null,  3,  7,  3,    6, 0, false, false, null, true,  false, 2, 2, null, null,   66, null, null, 'in person'),
  ('F-3014','C-1014','FRS','Ruth Bennett','closed',420,  300, null,  7, 14, 300, null, 0, false, false, null, true,  true,  2, 3, 3, 4, null, 'Goals achieved', null, 'in person');

insert into service_files (ref, client_id, program_id, worker_id, status, waitlisted_on, opened_on, closed_on, close_reason, outcome_exception, review_due_on)
select s.ref, (select id from clients where ref = s.client), (select id from programs where code = s.program),
       (select id from workers where name = s.worker), s.status,
       case when s.waitlisted_ago is not null then current_date - s.waitlisted_ago else current_date - s.opened_ago - 6 end,
       case when s.opened_ago is not null then current_date - s.opened_ago end,
       case when s.closed_ago is not null then current_date - s.closed_ago end,
       s.close_reason, s.outcome_exception,
       case when s.review_in is not null then current_date + s.review_in end
from seed_spec s
on conflict (ref) do nothing;

-- Sessions: k = 1..n, the last one `last_ago` days back, `gap` days apart.
insert into sessions (ref, service_file_id, worker_id, session_on, minutes, mode, attendance, note, noted_on, dex_reported_on)
select s.ref || '-S' || lpad(k::text, 2, '0'),
       f.id, f.worker_id,
       d.session_on,
       case when s.mode = 'phone' then 45 else 60 end,
       s.mode,
       case when k = s.dna_at then 'did not attend' else 'attended' end,
       case when k = s.dna_at then null
            when s.last_note_missing and k = s.sessions then null
            else (array[
              'Reviewed the week. Client named two triggers and practised the plan for each.',
              'Worked on the communication goal. Agreed a script for the next hard conversation at home.',
              'Checked safety and supports. No new risks raised. Goal progress discussed.',
              'Explored what got in the way since last session. Small win on the routine goal.',
              'Planned for the school holidays. Linked client to the local playgroup.',
              'Debriefed a difficult week. Client used the calming plan twice and named it.'
            ])[1 + (k % 6)] end,
       case when k = s.dna_at or (s.last_note_missing and k = s.sessions) then null
            else least(current_date, d.session_on + 1) end,
       case when fu.reports_to_dex and k <> s.dna_at
                 and not (s.dex_missed and d.session_on < current_date - 200)
                 and (date_trunc('month', d.session_on) + interval '1 month 4 days')::date <= current_date
            then (date_trunc('month', d.session_on) + interval '1 month 4 days')::date end
from seed_spec s
join service_files f on f.ref = s.ref
join programs p on p.id = f.program_id
left join funders fu on fu.id = p.funder_id
cross join lateral generate_series(1, s.sessions) k
cross join lateral (select current_date - s.last_ago - (s.sessions - k) * s.gap as session_on) d
where s.sessions > 0
on conflict (ref) do nothing;

insert into sessions (ref, service_file_id, worker_id, session_on, minutes, mode, attendance)
select s.ref || '-B1', f.id, f.worker_id, current_date + s.booked_ahead, 60, s.mode, 'booked'
from seed_spec s join service_files f on f.ref = s.ref
where s.booked_ahead is not null
on conflict (ref) do nothing;

insert into sessions (ref, service_file_id, worker_id, session_on, minutes, mode, attendance)
select s.ref || '-U1', f.id, f.worker_id, current_date - s.unresolved_ago, 60, s.mode, 'booked'
from seed_spec s join service_files f on f.ref = s.ref
where s.unresolved_ago is not null
on conflict (ref) do nothing;

-- SCORE: pre at the first session, post at the last (closed files).
insert into assessments (ref, service_file_id, kind, domain, measure, score, assessed_on)
select s.ref || '-PRE-' || d.domain, f.id, 'pre', d.domain, d.measure,
       case d.domain when 'circumstances' then s.pre_c else s.pre_g end,
       f.opened_on + 1
from seed_spec s join service_files f on f.ref = s.ref
cross join (values ('circumstances', 'Family functioning'), ('goals', 'Changed behaviours')) d(domain, measure)
where s.pre
on conflict (ref) do nothing;

insert into assessments (ref, service_file_id, kind, domain, measure, score, assessed_on)
select s.ref || '-POST-' || d.domain, f.id, 'post', d.domain, d.measure,
       case d.domain when 'circumstances' then s.post_c when 'goals' then s.post_g else 5 end,
       f.closed_on
from seed_spec s join service_files f on f.ref = s.ref
cross join (values ('circumstances', 'Family functioning'), ('goals', 'Changed behaviours'), ('satisfaction', 'Service met my needs')) d(domain, measure)
where s.post
on conflict (ref) do nothing;

insert into goals (ref, service_file_id, goal, set_on, target_on, status, progress, reviewed_on)
select v.ref, f.id, v.goal, f.opened_on + 1, f.opened_on + v.target_days, v.status, v.progress, current_date - v.reviewed_ago
from (values
  ('G-01', 'F-3001', 'Agree a weekly routine with the children that both parents keep to', 120, 'active', 50, 10),
  ('G-02', 'F-3001', 'Talk through disagreements without raised voices in front of the kids', 120, 'active', 30, 10),
  ('G-03', 'F-3002', 'Re-establish regular contact with his daughter', 90, 'active', 20, 30),
  ('G-04', 'F-3003', 'Keep the tenancy: rent plan agreed with the landlord', 180, 'achieved', 100, 60),
  ('G-05', 'F-3003', 'Child back at school four days a week', 240, 'active', 60, 21),
  ('G-06', 'F-3004', 'Use the bedtime plan five nights in seven', 60, 'active', 40, 9),
  ('G-07', 'F-3005', 'Name and use two calming strategies at school', 60, 'active', 50, 11),
  ('G-08', 'F-3006', 'Return to footy training', 60, 'active', 25, 12),
  ('G-09', 'F-3007', 'Safety plan written and copies held safely', 21, 'achieved', 100, 30),
  ('G-10', 'F-3007', 'Secure stable housing', 120, 'active', 20, 7),
  ('G-11', 'F-3008', 'Complete the family court affidavit with the duty lawyer', 90, 'achieved', 100, 40),
  ('G-12', 'F-3008', 'Rebuild a budget she controls', 150, 'active', 70, 33),
  ('G-13', 'F-3011', 'Return to work part time', 120, 'achieved', 100, 21),
  ('G-14', 'F-3013', 'Sleep through most nights without drinking', 90, 'active', 10, 3)
) v(ref, file, goal, target_days, status, progress, reviewed_ago)
join service_files f on f.ref = v.file
on conflict (ref) do nothing;

insert into referrals (ref, client_id, client_name, source, source_contact, program_id, received_on, reason, status, responded_on, decline_reason, service_file_id)
select v.ref, (select id from clients where ref = v.client), v.client_name, v.source, v.contact,
       (select id from programs where code = v.program), current_date - v.received_ago, v.reason, v.status,
       case when v.responded_ago is not null then current_date - v.responded_ago end, v.decline_reason,
       (select id from service_files where ref = v.file)
from (values
  ('R-2001', null, 'Isla Morgan', 'Hunter New England Health, perinatal team', 'Social worker, John Hunter Hospital', 'CAP', 8, 'New mother, low mood, partner working away. Asks for parenting support.', 'new', null, null, null),
  ('R-2002', null, 'Isabella Ford', 'Self-referral (web form)', null, 'FRS', 2, 'Separated last month, wants help agreeing arrangements for the kids.', 'new', null, null, null),
  ('R-2003', 'C-1001', 'Mia Harrison', 'GP, Mayfield Medical Centre', 'Dr Kaur', 'FRS', 77, 'Relationship conflict, two children under 8.', 'accepted', 75, null, 'F-3001'),
  ('R-2004', 'C-1009', 'Ethan Clarke', 'School counsellor, Charlestown Public', null, 'CAP', 44, 'Father struggling with son''s behaviour after separation.', 'waitlisted', 41, null, 'F-3009'),
  ('R-2005', null, 'Jack Turner', 'Self-referral (phone)', null, 'FRS', 19, 'Wants couples counselling.', 'declined', 17, 'Lives in Port Stephens: referred to the local service with a warm handover.', null),
  ('R-2006', 'C-1010', 'Zara Ahmed', 'Settlement Services, Hunter', 'Case worker, Amina', 'FRS', 14, 'Recently arrived, family stress, needs an Urdu interpreter.', 'waitlisted', 12, null, 'F-3010')
) v(ref, client, client_name, source, contact, program, received_ago, reason, status, responded_ago, decline_reason, file)
on conflict (ref) do nothing;

insert into concerns (ref, client_id, service_file_id, raised_by, raised_on, kind, mandatory, reported_to, reported_on, report_ref, detail, status, closed_on)
select v.ref, (select id from clients where ref = v.client), (select id from service_files where ref = v.file),
       (select id from workers where name = v.worker), current_date - v.raised_ago, v.kind, v.mandatory, v.reported_to,
       case when v.reported_ago is not null then current_date - v.reported_ago end, v.report_ref, v.detail, v.status,
       case when v.closed_ago is not null then current_date - v.closed_ago end
from (values
  ('K-01', 'C-1007', 'F-3007', 'Grace Whitlam', 2, 'child protection', true, null, null, null, 'Client disclosed partner hit their 6 year old during an access visit. Child seen at school, no visible injury.', 'open', null),
  ('K-02', 'C-1005', 'F-3005', 'Leilani Fonoti', 30, 'self-harm', false, null, null, null, 'Disclosed self-harm thoughts. Safety plan written with her, school counsellor aware with consent.', 'open', null),
  ('K-03', 'C-1008', 'F-3008', 'Grace Whitlam', 64, 'family violence', true, 'NSW Police (DV liaison)', 63, 'E 48821907', 'Former partner turned up at her workplace in breach of the AVO.', 'closed', 50)
) v(ref, client, file, worker, raised_ago, kind, mandatory, reported_to, reported_ago, report_ref, detail, status, closed_ago)
on conflict (ref) do nothing;

insert into case_notes (client_id, service_file_id, worker_id, noted_on, kind, body)
select (select id from clients where ref = v.client), (select id from service_files where ref = v.file),
       (select id from workers where name = v.worker), current_date - v.ago, v.kind, v.body
from (values
  ('C-1002', 'F-3002', 'Priya Raman', 19, 'call', 'Left a message after the missed check-in. No call back yet.'),
  ('C-1009', 'F-3009', 'Daniel Okafor', 20, 'call', 'Waitlist check-in call. Still wants the service, situation stable, school aware.'),
  ('C-1003', 'F-3003', 'Tom Avery', 6, 'meeting', 'Joint meeting with the school wellbeing officer. Attendance up to three days a week.'),
  ('C-1007', 'F-3007', 'Grace Whitlam', 2, 'note', 'Disclosure recorded as concern K-01. Discussed with team leader. Report to be made today.')
) v(client, file, worker, ago, kind, body)
where not exists (select 1 from case_notes n where n.body = v.body);

drop table seed_spec;
