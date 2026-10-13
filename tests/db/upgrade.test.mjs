// schema.sql is pasted into Supabase as a whole, again after every change: it has to run twice
// in a row, and upgrade any database that's been live, keeping its data. The live database has
// run the last committed schema.sql, and once a version from the course repo (e920d9a), whose
// boards also carried where each game was played and allowed games recorded on zetamac itself.
import { execSync } from 'node:child_process';
import { fresh, check, done, SCHEMA, ROOT } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh(SCHEMA);
await t.db.exec(SCHEMA);
check('schema.sql runs twice in a row', true);

const versions = [['the last committed schema', 'HEAD'], ['the last schema before Google sign-in', 'be69f2e'], ['the course-repo schema', 'e920d9a']];
for (const [label, rev] of versions) {
  let old = null;
  try { old = execSync(`git show ${rev}:schema.sql`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
  if (old === null) { check(`${label}: not in this checkout (skipped)`, true); continue; }
  const u = await fresh(old);
  const A = await u.user('alex');
  await u.save(A, { score: 40, detail: arithLog('standard', 1, 40) });
  await u.save(A, { score: 12, source: 'manual' });
  if (/'zetamac'/.test(old)) await u.save(A, { score: 55, source: 'zetamac', detail: arithLog('standard', 2, 55) });
  const before = (await u.db.query('select count(*)::int n, sum(score)::int s from scores')).rows[0];
  let ok = true, msg = '';
  try { await u.db.exec(SCHEMA); await u.db.exec(SCHEMA); } catch (e) { ok = false; msg = e.message; }
  check(`${label}: upgrades to this one, twice`, ok, msg);
  const after = (await u.db.query('select count(*)::int n, sum(score)::int s from scores')).rows[0];
  check(`${label}: …keeping every score`, JSON.stringify(before) === JSON.stringify(after), [before, after]);
  const board = await u.rpc(null, 'board', { p_mode: 'standard', p_seconds: 120 });
  check(`${label}: …and the boards, profiles and Google names work`, board.total >= 1 && !!(await u.rpc(null, 'profile', { p_name: 'alex' })) &&
    (await u.db.query(`select count(*)::int n from information_schema.columns where table_name = 'profiles' and column_name = 'name_set'`)).rows[0].n === 1, board);
}

done();
