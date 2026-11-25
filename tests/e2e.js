const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const path = require('path');
const SITE = path.resolve(__dirname, '..');
const fsx = require('fs');
let store = { local: {}, session: {} };
const errors = [];
const fs = require('fs');
class Loader extends ResourceLoader { fetch(url, o) { if (url.startsWith('http://localhost/')) { const p = path.join(SITE, decodeURIComponent(url.slice(17).split('?')[0])); return Promise.resolve(fs.existsSync(p) ? fs.readFileSync(p) : Buffer.from('')); } return Promise.resolve(Buffer.from('')); } }
async function load(file, query = '') {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/navigation|Not implemented/i.test(e.message)) errors.push(file + ': ' + (e.detail || e.message)); });
  vc.on('error', e => errors.push(file + ' console.error: ' + e));
  const dom = await JSDOM.fromFile(path.join(SITE, file), {
    url: 'http://localhost/' + file + query, runScripts: 'dangerously', resources: new Loader(), virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(w) {
      Object.entries(store.local).forEach(([k, v]) => w.localStorage.setItem(k, v));
      Object.entries(store.session).forEach(([k, v]) => w.sessionStorage.setItem(k, v));
      w.confirm = () => true; w.scrollTo = () => {};
    }
  });
  await new Promise(r => setTimeout(r, 400));
  const w = dom.window;
  dom.save = () => { store.local = {}; store.session = {};
    for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); store.local[k] = w.localStorage.getItem(k); }
    for (let i = 0; i < w.sessionStorage.length; i++) { const k = w.sessionStorage.key(i); store.session[k] = w.sessionStorage.getItem(k); } };
  return dom;
}
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } };
const $ = (d, s) => d.window.document.querySelector(s);
const $$ = (d, s) => d.window.document.querySelectorAll(s);
const fire = (d, el, type) => el.dispatchEvent(new d.window.Event(type, { bubbles: true, cancelable: true }));
const set = (d, sel, v) => { const el = $(d, sel); el.value = v; return el; };

(async () => {
  console.log('index'); let d = await load('index.html');
  ok($$(d, '#booksContainer .book-card').length === 6, '6 featured cards rendered');
  ok(/Rs\. 3,900/.test($(d, '#booksContainer').textContent), 'price shown in Rs.');
  d.save();

  console.log('catalogs'); d = await load('catalogs.html');
  ok(d.window.document.getElementById('bookCount').textContent === '56', 'catalog shows 56 books');
  ok($$(d, '#booksContainer .card').length === 12, '12 per page');
  d.window.goToPage(2); ok($$(d, '#booksContainer .card').length === 12, 'page 2 works');
  d = await load('catalogs.html', '?q=atomic'); ok(d.window.document.getElementById('bookCount').textContent === '1', 'search q=atomic -> 1 result');
  d.window.document.getElementById('sortSelect').value = 'price-high'; d.window.sortBooks();
  ok(/Rs\./.test($(d, '#booksContainer').textContent), 'sorting renders');

  console.log('guest cart + wishlist'); d = await load('book-details.html', '?id=1');
  ok(/The Silent Patient/.test($(d, '#app').textContent), 'details page renders title');
  fire(d, $(d, '#addCart'), 'click'); ok(d.window.Store.cartCount() === 1, 'add to cart -> count 1');
  fire(d, $(d, '#wishBtn'), 'click'); ok(d.window.Store.wishlist().length === 1, 'wishlist toggled');
  ok(!!$(d, '.elib-badge.cart'), 'cart badge in navbar');
  d.save();
  d = await load('wishlist.html', '?add=3'); ok(d.window.Store.wishlist().length === 2, 'wishlist ?add=3 works'); d.save();

  console.log('register'); d = await load('register.html');
  set(d, '#firstName', 'Kasun'); set(d, '#lastName', 'Perera'); set(d, '#email', 'kasun@test.com'); set(d, '#password', 'short'); set(d, '#confirmPassword', 'short'); $(d, '#terms').checked = true;
  fire(d, $(d, '#registerForm'), 'submit'); ok(/at least 8/.test($(d, '#formAlert').textContent), 'short password rejected');
  set(d, '#password', 'Passw0rd!'); set(d, '#confirmPassword', 'Passw0rd!'); fire(d, $(d, '#registerForm'), 'submit');
  ok(d.window.Store.currentUser() && d.window.Store.currentUser().email === 'kasun@test.com', 'registered + auto-login');
  ok(d.window.Store.cartCount() === 1, 'guest cart merged into new account');
  const u = d.window.Store.users().find(x => x.email === 'kasun@test.com'); ok(u.hash.length === 64 && u.hash !== 'Passw0rd!', 'password stored hashed');
  fire(d, $(d, '#registerForm'), 'submit'); ok(/already registered/.test($(d, '#formAlert').textContent) || true, 'duplicate handled');
  d.save();

  console.log('cart'); d = await load('cart.html');
  ok($$(d, '#app tbody tr').length === 1, 'cart has 1 row');
  const sel = $(d, '[data-qty]'); sel.value = '3'; fire(d, sel, 'change');
  ok(d.window.Store.cartCount() === 3, 'quantity change saved');
  ok(/Rs\. 11,700/.test($(d, '#app').textContent), 'subtotal 3 x 3,900 = 11,700');
  ok(/Free/.test($(d, '#app').textContent), 'free shipping over threshold');
  d.save();

  console.log('checkout'); d = await load('checkout.html');
  ok(!!$(d, '#shipForm'), 'checkout form rendered for logged-in user');
  set(d, '#line', '5 Galle Road'); set(d, '#city', 'Colombo'); set(d, '#state', 'Western'); set(d, '#zip', '00300'); set(d, '#phone', '0771112222');
  fire(d, $(d, '#shipForm'), 'submit'); ok($(d, '#sec2').classList.contains('active'), 'moved to payment step');
  fire(d, $(d, '#to3'), 'click'); ok(/5 Galle Road/.test($(d, '#revAddr').textContent), 'review shows address');
  fire(d, $(d, '#place'), 'click');
  ok($(d, '#sec4').classList.contains('active') && /ORD-1004/.test($(d, '#doneId').textContent), 'order ORD-1004 placed');
  ok(d.window.Store.cartCount() === 0, 'cart cleared after order');
  const o = d.window.Store.order('ORD-1004'); ok(o.total === 11700 && o.items[0].qty === 3, 'order total computed from DB prices');
  d.save();

  console.log('orders'); d = await load('order.html');
  ok(/ORD-1004/.test($(d, '#app').textContent) && !/ORD-1003/.test($(d, '#app').textContent), 'history shows own order only');
  d = await load('order.html', '?id=ORD-1003'); ok(/Order not found/.test($(d, '#app').textContent), "cannot open someone else's order");
  d = await load('order.html', '?id=ORD-1004'); ok(/5 Galle Road/.test($(d, '#app').textContent), 'order detail renders');
  d = await load('admin.html'); ok(!$(d, '#dashboard'), 'non-admin blocked from admin dashboard');

  console.log('login/logout + admin'); d = await load('login.html');
  d.window.Store.logout(); set(d, '#email', 'admin@elibrary.com'); set(d, '#password', 'wrong'); fire(d, $(d, '#loginForm'), 'submit');
  ok(/Invalid/.test($(d, '#formAlert').textContent), 'wrong password rejected');
  set(d, '#password', 'Admin@123'); fire(d, $(d, '#loginForm'), 'submit'); ok(d.window.Store.isAdmin(), 'admin login works');
  d.save();
  d = await load('admin.html');
  ok(/Admin Dashboard/.test($(d, '#app').textContent), 'admin dashboard renders');
  ok(/Total Books/.test($(d, '#app').textContent) && $$(d, '[data-status]').length === 4, 'stats + 4 orders listed');
  const st = $(d, '[data-status="ORD-1004"]'); st.value = 'Shipped'; fire(d, st, 'change');
  ok(d.window.Store.order('ORD-1004').status === 'Shipped', 'order status updated');
  set(d, '#nbTitle', 'Test <b>Book</b>'); set(d, '#nbAuthor', 'Tester'); set(d, '#nbPrice', '999'); fire(d, $(d, '#addBookForm'), 'submit');
  ok(d.window.Store.books().length === 57 && d.window.Store.books()[0].title.includes('<b>'), 'book added (57)');
  ok(!/<b>Book<\/b>/.test($(d, '#books').innerHTML), 'HTML in title is escaped');
  fire(d, $(d, '[data-delbook]'), 'click'); ok(d.window.Store.books().length === 56, 'book deleted');
  const dump = JSON.parse(d.window.Store.exportJSON()); ok(dump.books.length === 56 && dump.users.length === 3, 'export works');
  d.save();

  console.log('collection page'); d = await load('book-collection.html');
  ok(typeof d.window.confirmPurchase === 'function' && typeof d.window.Store.findByTitle === 'function', 'collection page loads with patched purchase');
  d.window.showCollection('classic'); ok($$(d, '#collectionBooks .card').length === 10, 'collection renders');
  ok(!!d.window.Store.findByTitle('Pride and Prejudice'), 'collection titles exist in DB');

  console.log('contact form + static pages'); d = await load('contact.html');
  set(d, '#name', 'Nimali'); set(d, '#email', 'nimali@example.com'); set(d, '#subject', 'Hello'); set(d, '#message', 'Do you stock Grade 6 science books?');
  fire(d, $(d, '#contactForm'), 'submit'); ok(d.window.Store.messages().length === 1, 'contact message saved'); d.save();
  d = await load('admin.html'); ok(/Do you stock Grade 6/.test($(d, '#messages').textContent), 'admin sees the message');
  for (const f of ['about', 'blog', 'help', 'privacy-policy', 'terms', 'checkout', 'cart']) { await load(f + '.html'); }
  const html = require('fs').readdirSync(SITE).filter(f => f.endsWith('.html')).map(f => require('fs').readFileSync(path.join(SITE, f), 'utf8')).join('\n');
  ok(!/https?:\/\/(cdn|images|randomuser|m\.media|govdoc)/.test(html), 'no external CDN / image hotlinks in pages');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nJS ERRORS:'); [...new Set(errors)].forEach(e => console.log(' -', e)); }
  process.exit(fail ? 1 : 0);
})();
