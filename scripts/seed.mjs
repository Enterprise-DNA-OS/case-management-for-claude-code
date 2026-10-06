#!/usr/bin/env node
// Loads supabase/seed.sql: Harbourside Family Services, a fictional Newcastle
// NSW community services organisation with four funded programmes, six workers,
// fourteen clients, referrals, service files, sessions, goals, outcome scores
// and safety concerns. Dates are relative to today and every row has a unique
// ref with ON CONFLICT DO NOTHING, so re-running it is harmless.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  const sql = readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
  await db.exec(sql);
  const [c] = await db.query(`
    select (select count(*) from programs)      as programs,
           (select count(*) from workers)       as workers,
           (select count(*) from clients)       as clients,
           (select count(*) from referrals)     as referrals,
           (select count(*) from service_files) as files,
           (select count(*) from sessions)      as sessions,
           (select count(*) from goals)         as goals,
           (select count(*) from assessments)   as scores,
           (select count(*) from concerns)      as concerns
  `);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const db = await getDb();
  try {
    const counts = await seed(db);
    console.log('seeded:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
  } finally {
    await db.close();
  }
}
