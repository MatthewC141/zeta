// Google accounts: a placeholder name kept off the leaderboard until the player picks theirs.
import { fresh, check, done } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh();
const { db, as, rpc, err, save } = t;
const G = await t.googleUser('somebody@gmail.com'), A = await t.user('alex');
const prof = async id => (await db.query('select username, private, name_set from profiles where id = $1', [id])).rows[0];

const p0 = await prof(G);
check('a first Google sign-in makes an account with a placeholder name', /^player_[0-9a-f]{12}$/.test(p0.username) && p0.name_set === false, p0);
check('…kept off the leaderboard until a name is picked', p0.private === true);
check('the Google email is not the name', !p0.username.includes('somebody'));
await save(G, { score: 30, detail: arithLog('standard', 1, 30) });
check('its games count, but stay off the board for now', (await as(null, `select count(*)::int n from leaderboard`)).rows[0].n === 0);

check('a name must be 3 to 20 letters, digits or underscores', /3 to 20/.test(await err(() => rpc(G, 'set_username', { p_name: 'a b' }))));
check('a taken name is refused, whatever its capitals', /taken/.test(await err(() => rpc(G, 'set_username', { p_name: 'ALEX' }))));
check('picking a name saves it as typed', (await rpc(G, 'set_username', { p_name: 'Sam_99' })) === 'Sam_99');
const p1 = await prof(G);
check('…and puts the account on the leaderboard', p1.username === 'Sam_99' && p1.name_set && !p1.private &&
  (await as(null, `select username from leaderboard`)).rows.map(r => r.username).join() === 'Sam_99');
check('a name is picked once', /already set/.test(await err(() => rpc(G, 'set_username', { p_name: 'Sam_100' }))));
check('name-and-password accounts can’t rename themselves', /already set/.test(await err(() => rpc(A, 'set_username', { p_name: 'alexander' }))));
check('signed out: refused', !!(await err(() => rpc(null, 'set_username', { p_name: 'nobody1' }))));
check('the new name is taken for everyone else', !!(await err(() => t.user('sam_99'))));

check('a Google account’s email may change on Google’s side', !(await err(() => db.query(`update auth.users set email = 'new@gmail.com' where id = $1`, [G]))));
check('…but a name account’s sign-in address still can’t', /can.t be changed/.test(await err(() => db.query(`update auth.users set email = 'x@users.zetamac-tracker.invalid' where id = $1`, [A]))));
await rpc(G, 'delete_me');
check('a Google account deletes like any other', (await db.query('select count(*)::int n from profiles where id = $1', [G])).rows[0].n === 0);

done();
