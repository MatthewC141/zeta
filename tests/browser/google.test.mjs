// Signing in with Google: the trip out and back (PKCE), picking a name, signing in again, and the
// button staying hidden while the project has Google switched off.
import { browser, check, done, answerMany, sleep, sql, ENV } from './lib.mjs';

const google = body => fetch(`${ENV.mock}/__google`, { method: 'POST', body: JSON.stringify(body) });
const H = { apikey: 'test-anon-key', 'Content-Type': 'application/json' };
await fetch(`${ENV.mock}/auth/v1/signup`, { method: 'POST', headers: H, body: JSON.stringify({ email: 'taken_one@users.zetamac-tracker.invalid', password: 'password1234', data: { username: 'Taken_One' } }) });

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);

// ---- switched off: no button ----
await google({ on: false });
await b.go('account.html', 1200);
check('with Google switched off, there’s no Google button', !(await b.shown('#google')));

// ---- first sign-in ----
await google({ on: true, email: 'sam.player@gmail.com' });
await b.go('account.html', 1200);
check('with Google on, the button shows', await b.shown('#google') && /email stays private/.test(await b.text('#google-box')));
await b.shot('google-button');
await b.click('#google');
await b.until(`!document.querySelector('#pick').hidden`, 10000);
check('back from Google, a new account is asked for its name', /Pick your name/.test(await b.text('#pick')));
check('…the one-time code is gone from the address', !/code=/.test(await b.ev('location.href')));
check('…and the secret that went with it is gone from the tab', await b.ev(`sessionStorage.getItem('zm-pkce')`) === null);
const placeholder = (await sql(`select username, private, name_set from profiles p join auth.users u on u.id = p.id where u.email = 'sam.player@gmail.com'`))[0];
check('until then the account has a placeholder name, off the board', /^player_/.test(placeholder.username) && placeholder.private && !placeholder.name_set, placeholder);
check('the Google email is nowhere on the page', !(await b.ev(`document.body.innerText.includes('sam.player')`)));
await b.shot('google-pick');

await b.ev(`document.querySelector('#pick-name').value = 'taken_ONE'; document.querySelector('#pick-form').requestSubmit()`);
await b.until(`/taken/.test(document.querySelector('#pick-msg').textContent)`);
check('a taken name is refused', true);
await b.ev(`document.querySelector('#pick-name').value = 'Sam_G'; document.querySelector('#pick-form').requestSubmit()`);
await b.until(`!document.querySelector('#in').hidden`);
check('picking a free name signs you in under it', (await b.text('#me-name')) === 'Sam_G' && /Welcome, Sam_G/.test(await b.text('#in-msg')));

// ---- playing: games count and go on the board ----
await b.go('play.html');
await b.click('#start'); await b.until('running');
await answerMany(b, 6);
await b.ev('finish()');
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
check('a Google account’s game counts and goes on the board', (await sql(`select username from leaderboard`)).some(r => r.username === 'Sam_G'));

// ---- out and back in: straight in, same name ----
await b.go('account.html', 1200);
await b.click('#logout'); await sleep(1200);
await b.click('#google');
await b.until(`!document.querySelector('#in').hidden`, 10000);
check('signing in with Google again goes straight in, same name', (await b.text('#me-name')) === 'Sam_G' && (await b.ev(`document.querySelector('#pick').hidden`)));
check('…one account, not two', (await sql(`select count(*)::int n from auth.users where email = 'sam.player@gmail.com'`))[0].n === 1);

// ---- a code that doesn't match this tab's secret ----
await b.click('#logout'); await sleep(1000);
await b.ev(`sessionStorage.setItem('zm-pkce', 'not-the-secret')`);
await b.go('account.html?code=g-made-up', 1500);
check('a code that doesn’t check out signs no one in, and says so', !(await b.ev('ZM_CLOUD.user()')) && /Google sign-in didn’t finish/.test(await b.text('#msg')), await b.text('#msg'));

check('no page errors', b.errors.length === 0, b.errors);
b.close();
done();
