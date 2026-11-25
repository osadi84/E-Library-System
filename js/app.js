/* ==========================================================================
   My e-Library: client-side "local database" + page logic
   --------------------------------------------------------------------------
   All data (books, users, cart, wishlist, orders, reviews) is stored in the
   browser's localStorage, so the whole system runs without a server and can
   be hosted on GitHub Pages.

   NOTE: this is a learning / demo system. Passwords are hashed in the
   browser, but anything stored client-side can be read by the device owner.
   Do not use real passwords or personal data.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'elib.';
  var VERSION = 2;
  var FREE_SHIPPING_OVER = 5000;
  var SHIPPING_FEE = 350;
  var STATUSES = ['Processing', 'Shipped', 'Completed', 'Cancelled'];
  var CATEGORIES = ['Fiction', 'Non-Fiction', 'Textbook', 'Classic'];

  /* ------------------------------------------------------------------ *
   *  Generated artwork (covers, banners, avatars): no external images,
   *  so nothing can break when a hotlinked picture disappears.
   * ------------------------------------------------------------------ */
  var PALETTE = [['#1e3c72', '#2a5298'], ['#134e5e', '#3f8f6b'], ['#3a1c71', '#b4506f'], ['#232526', '#4a4d50'],
                 ['#0f2027', '#2c5364'], ['#42275a', '#734b6d'], ['#4b3a7a', '#516395'], ['#1d4350', '#a43931']];
  function xml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
  function hashStr(t) { var h = 0; t = String(t); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h); }
  function wrap(text, max, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '') + '…'; }
    return lines;
  }
  function uri(svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }
  function coverSvg(title, author, category) {
    var c = PALETTE[hashStr(title) % PALETTE.length], lines = wrap(title, 13, 5), y0 = 190 - (lines.length - 1) * 17;
    var t = lines.map(function (l, i) { return '<text x="158" y="' + (y0 + i * 34) + '" text-anchor="middle" font-size="27" font-weight="700" fill="#fff" font-family="Georgia,serif">' + xml(l) + '</text>'; }).join('');
    return uri('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/>' +
      '<rect width="16" height="400" fill="#000" opacity=".25"/><text x="158" y="58" text-anchor="middle" font-size="12" letter-spacing="3" fill="#fff" opacity=".7" font-family="sans-serif">' + xml(String(category || 'BOOK').toUpperCase()) + '</text>' +
      '<line x1="108" y1="76" x2="208" y2="76" stroke="#fff" opacity=".4"/>' + t +
      '<line x1="108" y1="326" x2="208" y2="326" stroke="#fff" opacity=".4"/><text x="158" y="355" text-anchor="middle" font-size="15" fill="#fff" opacity=".85" font-family="sans-serif">' + xml(wrap(author, 28, 1)[0] || '') + '</text></svg>');
  }
  function bannerSvg(text) {
    var c = PALETTE[hashStr(text) % PALETTE.length];
    return uri('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>' +
      '<rect width="800" height="400" fill="url(#g)"/><circle cx="700" cy="60" r="150" fill="#fff" opacity=".06"/><circle cx="90" cy="360" r="120" fill="#fff" opacity=".06"/>' +
      '<g fill="#fff" opacity=".18"><rect x="330" y="250" width="30" height="90" rx="3"/><rect x="366" y="230" width="30" height="110" rx="3"/><rect x="402" y="262" width="30" height="78" rx="3"/><rect x="438" y="240" width="30" height="100" rx="3"/></g>' +
      '<text x="400" y="170" text-anchor="middle" font-size="44" font-weight="700" fill="#fff" font-family="Georgia,serif">' + xml(wrap(text, 24, 2)[0] || '') + '</text>' +
      '<text x="400" y="218" text-anchor="middle" font-size="44" font-weight="700" fill="#fff" font-family="Georgia,serif">' + xml(wrap(text, 24, 2)[1] || '') + '</text></svg>');
  }
  function avatarSvg(n) {
    var c = PALETTE[hashStr(String(n)) % PALETTE.length];
    return uri('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="' + c[1] + '"/><circle cx="100" cy="78" r="38" fill="#fff" opacity=".85"/><path d="M28 200c4-52 38-74 72-74s68 22 72 74z" fill="#fff" opacity=".85"/></svg>');
  }
  var PLACEHOLDER = coverSvg('No cover', '', 'Book');
  function coverOf(b) { return /^https?:\/\//i.test(b.image || '') ? b.image : coverSvg(b.title, b.author, b.category); }

  /* ------------------------------------------------------------------ *
   *  Low-level storage (localStorage with in-memory fallback)
   * ------------------------------------------------------------------ */
  var mem = {};
  function read(k, d) {
    try {
      var v = localStorage.getItem(KEY + k);
      return v === null ? (k in mem ? mem[k] : d) : JSON.parse(v);
    } catch (e) { return k in mem ? mem[k] : d; }
  }
  function write(k, v) {
    mem[k] = v;
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* storage blocked: memory only */ }
  }
  function remove(k) {
    delete mem[k];
    try { localStorage.removeItem(KEY + k); } catch (e) { /* ignore */ }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------------ *
   *  Helpers
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return 'Rs. ' + Number(n || 0).toLocaleString('en-US'); }
  function stars(n) {
    n = Math.max(0, Math.min(5, Math.round(n || 0)));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }
  function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function ago(iso) {
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return 'today';
    if (d === 1) return '1 day ago';
    if (d < 7) return d + ' days ago';
    if (d < 30) return Math.floor(d / 7) + ' week(s) ago';
    return fmtDate(iso);
  }
  function safeImg(u) { return /^(https?:\/\/|data:image\/)/i.test(u || '') ? u : PLACEHOLDER; }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function safeNext(n) { return /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(n || '') ? n : ''; }

  // Small synchronous SHA-256 (works on file:// and http:// alike)
  function sha256(str) {
    var K = [], H = [], i, j, p = 2, n = 0;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    while (K.length < 64) {
      var prime = true;
      for (j = 2; j * j <= p; j++) if (p % j === 0) { prime = false; break; }
      if (prime) { if (n < 8) H[n] = frac(Math.sqrt(p)); K[n++] = frac(Math.cbrt(p)); }
      p++;
    }
    var bytes = unescape(encodeURIComponent(str)), words = [], len = bytes.length;
    for (i = 0; i < len; i++) words[i >> 2] |= bytes.charCodeAt(i) << (24 - (i % 4) * 8);
    words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    words[(((len + 8) >> 6) << 4) + 15] = len * 8;
    function rr(x, c) { return (x >>> c) | (x << (32 - c)); }
    for (var b = 0; b < words.length; b += 16) {
      var w = [], a = H.slice(0);
      for (i = 0; i < 16; i++) w[i] = words[b + i] | 0;
      for (i = 0; i < 64; i++) {
        if (i >= 16) {
          var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          var s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        var S1 = rr(a[4], 6) ^ rr(a[4], 11) ^ rr(a[4], 25);
        var ch = (a[4] & a[5]) ^ (~a[4] & a[6]);
        var t1 = (a[7] + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rr(a[0], 2) ^ rr(a[0], 13) ^ rr(a[0], 22);
        var maj = (a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]);
        var t2 = (S0 + maj) | 0;
        a = [(t1 + t2) | 0, a[0], a[1], a[2], (a[3] + t1) | 0, a[4], a[5], a[6]];
      }
      for (i = 0; i < 8; i++) H[i] = (H[i] + a[i]) | 0;
    }
    return H.map(function (h) { return ('00000000' + (h >>> 0).toString(16)).slice(-8); }).join('');
  }
  function hashPw(email, pw) { return sha256('elib|' + String(email).toLowerCase() + '|' + pw); }

  /* ------------------------------------------------------------------ *
   *  Seed data (first visit, or after "Reset demo data")
   * ------------------------------------------------------------------ */
  function seed(force) {
    if (!force && read('version') === VERSION && read('books')) return;
    write('books', clone(window.SEED_BOOKS || []));
    write('users', [
      { id: 1, first: 'Admin', last: 'User', email: 'admin@elibrary.com', hash: hashPw('admin@elibrary.com', 'Admin@123'), role: 'admin', created: daysAgo(40) },
      { id: 2, first: 'Demo', last: 'Reader', email: 'reader@example.com', hash: hashPw('reader@example.com', 'Reader@123'), role: 'user', created: daysAgo(12) }
    ]);
    var books = read('books', []);
    function item(id, qty) {
      var b = books.filter(function (x) { return x.id === id; })[0];
      return b ? { bookId: b.id, title: b.title, image: b.image, price: b.price, qty: qty } : null;
    }
    function mk(id, days, items, status, pay) {
      items = items.filter(Boolean);
      var sub = items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
      var ship = sub >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
      return {
        id: 'ORD-' + id, userEmail: 'reader@example.com', userName: 'Demo Reader', date: daysAgo(days), items: items,
        subtotal: sub, shipping: ship, total: sub + ship, status: status, payment: pay,
        address: { name: 'Demo Reader', line: '12 Library Road', city: 'Colombo', state: 'Western', zip: '00700', country: 'Sri Lanka', phone: '0771234567' }
      };
    }
    write('orders', [
      mk(1003, 2, [item(1, 1), item(3, 1)], 'Processing', 'Cash on Delivery'),
      mk(1002, 6, [item(2, 2)], 'Shipped', 'Bank transfer'),
      mk(1001, 15, [item(7, 1), item(8, 1), item(9, 1)], 'Completed', 'Cash on Delivery')
    ]);
    write('seq', 1003);
    write('reviews', {
      '1': [{ user: 'Demo Reader', rating: 5, text: 'Gripping from the first chapter, and the ending genuinely surprised me.', date: daysAgo(5) }],
      '2': [{ user: 'Demo Reader', rating: 5, text: 'Practical and easy to apply. I started using the habit-stacking idea the same week.', date: daysAgo(9) }]
    });
    write('version', VERSION);
  }

  /* ------------------------------------------------------------------ *
   *  Session
   * ------------------------------------------------------------------ */
  function sessGet() {
    try {
      var v = sessionStorage.getItem(KEY + 'session') || localStorage.getItem(KEY + 'session');
      return v ? JSON.parse(v) : (mem.session || null);
    } catch (e) { return mem.session || null; }
  }
  function sessSet(s, remember) {
    mem.session = s;
    try {
      sessionStorage.removeItem(KEY + 'session');
      localStorage.removeItem(KEY + 'session');
      if (s) (remember ? localStorage : sessionStorage).setItem(KEY + 'session', JSON.stringify(s));
    } catch (e) { /* memory only */ }
  }

  /* ------------------------------------------------------------------ *
   *  Store: the public "database" API
   * ------------------------------------------------------------------ */
  var Store = {
    money: money, stars: stars, esc: esc, STATUSES: STATUSES, CATEGORIES: CATEGORIES,
    cover: coverSvg, banner: bannerSvg, avatar: avatarSvg,
    FREE_SHIPPING_OVER: FREE_SHIPPING_OVER, SHIPPING_FEE: SHIPPING_FEE,

    /* ---- books ---- */
    books: function () { return read('books', []); },
    book: function (id) {
      id = Number(id);
      return Store.books().filter(function (b) { return b.id === id; })[0] || null;
    },
    findByTitle: function (t) {
      t = String(t).toLowerCase();
      return Store.books().filter(function (b) { return b.title.toLowerCase() === t; })[0] || null;
    },
    rating: function (b) {
      var r = (read('reviews', {})[b.id] || []);
      if (!r.length) return { avg: b.rating, count: 0 };
      var avg = r.reduce(function (s, x) { return s + x.rating; }, 0) / r.length;
      return { avg: avg, count: r.length };
    },
    catalog: function () {
      return Store.books().map(function (b) {
        return { id: b.id, title: b.title, author: b.author, image: coverOf(b), category: b.category,
                 price: b.price, date: b.date, rating: Math.round(Store.rating(b).avg) };
      });
    },
    addBook: function (data) {
      var books = Store.books();
      var id = books.reduce(function (m, b) { return Math.max(m, b.id); }, 0) + 1;
      var b = {
        id: id, title: data.title.trim(), author: data.author.trim(), image: data.image || '', price: Math.max(0, Math.round(Number(data.price) || 0)),
        rating: 4, category: data.category, collection: 'Added by admin',
        description: (data.description || '').trim() || (data.title.trim() + ' by ' + data.author.trim() + '.'),
        read: '', date: new Date().toISOString()
      };
      books.unshift(b);
      write('books', books);
      return b;
    },
    deleteBook: function (id) {
      id = Number(id);
      write('books', Store.books().filter(function (b) { return b.id !== id; }));
      // remove from carts and wishlists so nothing points at a missing book
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(KEY + 'cart:') === 0 || k.indexOf(KEY + 'wish:') === 0) {
          var key = k.slice(KEY.length), v = read(key, null);
          if (Array.isArray(v)) write(key, v.filter(function (x) { return x !== id; }));
          else if (v && typeof v === 'object') { delete v[id]; write(key, v); }
        }
      });
    },

    /* ---- auth ---- */
    users: function () { return read('users', []); },
    currentUser: function () {
      var s = sessGet();
      if (!s) return null;
      return Store.users().filter(function (u) { return u.email === s.email; })[0] || null;
    },
    isAdmin: function () { var u = Store.currentUser(); return !!(u && u.role === 'admin'); },
    register: function (d) {
      var email = String(d.email || '').trim().toLowerCase();
      if (!d.first || !d.last || !email || !d.password) return { ok: false, error: 'All fields are required.' };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
      if (d.password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
      if (d.password !== d.confirm) return { ok: false, error: 'Passwords do not match.' };
      var users = Store.users();
      if (users.some(function (u) { return u.email === email; })) return { ok: false, error: 'That email is already registered.' };
      var id = users.reduce(function (m, u) { return Math.max(m, u.id); }, 0) + 1;
      var user = { id: id, first: d.first.trim(), last: d.last.trim(), email: email, hash: hashPw(email, d.password), role: 'user', created: new Date().toISOString() };
      users.push(user);
      write('users', users);
      return { ok: true, user: user };
    },
    login: function (email, password, remember) {
      email = String(email || '').trim().toLowerCase();
      var u = Store.users().filter(function (x) { return x.email === email; })[0];
      if (!u || u.hash !== hashPw(email, password)) return { ok: false, error: 'Invalid email or password.' };
      var guestCart = read('cart:guest', {});
      sessSet({ email: u.email }, remember);
      // merge the guest cart / wishlist into the account
      var cart = read('cart:' + u.email, {});
      Object.keys(guestCart).forEach(function (id) { cart[id] = Math.min(10, (cart[id] || 0) + guestCart[id]); });
      write('cart:' + u.email, cart);
      remove('cart:guest');
      var wl = read('wish:' + u.email, []);
      read('wish:guest', []).forEach(function (id) { if (wl.indexOf(id) < 0) wl.push(id); });
      write('wish:' + u.email, wl);
      remove('wish:guest');
      return { ok: true, user: u };
    },
    logout: function () { sessSet(null); },
    deleteUser: function (id) {
      write('users', Store.users().filter(function (u) { return !(u.id === id && u.role !== 'admin'); }));
    },

    /* ---- cart ---- */
    _owner: function () { var s = sessGet(); return s ? s.email : 'guest'; },
    cart: function () { return read('cart:' + Store._owner(), {}); },
    cartCount: function () {
      var c = Store.cart();
      return Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0);
    },
    addToCart: function (id, qty) {
      var b = Store.book(id);
      if (!b) return;
      qty = Math.max(1, parseInt(qty, 10) || 1);
      var c = Store.cart();
      c[id] = Math.min(10, (c[id] || 0) + qty);
      write('cart:' + Store._owner(), c);
      UI.refresh();
      UI.toast('“' + b.title + '” added to your cart', 'success');
    },
    setQty: function (id, qty) {
      var c = Store.cart();
      qty = parseInt(qty, 10);
      if (qty > 0) c[id] = Math.min(10, qty); else delete c[id];
      write('cart:' + Store._owner(), c);
      UI.refresh();
    },
    removeFromCart: function (id) { Store.setQty(id, 0); },
    clearCart: function () { write('cart:' + Store._owner(), {}); UI.refresh(); },
    cartDetail: function () {
      var c = Store.cart(), out = [];
      Object.keys(c).forEach(function (id) {
        var b = Store.book(id);
        if (b) out.push({ book: b, qty: c[id], line: b.price * c[id] });
      });
      return out;
    },
    totals: function () {
      var d = Store.cartDetail();
      var sub = d.reduce(function (s, x) { return s + x.line; }, 0);
      var ship = d.length === 0 ? 0 : (sub >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE);
      return { subtotal: sub, shipping: ship, total: sub + ship, count: d.reduce(function (s, x) { return s + x.qty; }, 0) };
    },

    /* ---- wishlist ---- */
    wishlist: function () { return read('wish:' + Store._owner(), []); },
    inWishlist: function (id) { return Store.wishlist().indexOf(Number(id)) >= 0; },
    toggleWish: function (id) {
      id = Number(id);
      var w = Store.wishlist(), i = w.indexOf(id), b = Store.book(id);
      if (i >= 0) { w.splice(i, 1); UI.toast('Removed from wishlist', 'info'); }
      else { w.push(id); UI.toast('“' + (b ? b.title : 'Book') + '” saved to your wishlist', 'success'); }
      write('wish:' + Store._owner(), w);
      UI.refresh();
      return i < 0;
    },

    /* ---- orders ---- */
    orders: function () { return read('orders', []); },
    order: function (id) { return Store.orders().filter(function (o) { return o.id === id; })[0] || null; },
    ordersForCurrentUser: function () {
      var u = Store.currentUser();
      if (!u) return [];
      return Store.orders().filter(function (o) { return u.role === 'admin' || o.userEmail === u.email; });
    },
    placeOrder: function (address, payment) {
      var u = Store.currentUser();
      if (!u) return { ok: false, error: 'Please log in first.' };
      var det = Store.cartDetail();
      if (!det.length) return { ok: false, error: 'Your cart is empty.' };
      var t = Store.totals(); // always recalculated from the book prices in the database
      var seq = read('seq', 1000) + 1;
      write('seq', seq);
      var order = {
        id: 'ORD-' + seq, userEmail: u.email, userName: u.first + ' ' + u.last, date: new Date().toISOString(),
        items: det.map(function (x) { return { bookId: x.book.id, title: x.book.title, image: x.book.image, price: x.book.price, qty: x.qty }; }),
        subtotal: t.subtotal, shipping: t.shipping, total: t.total, status: 'Processing', payment: payment, address: address
      };
      var orders = Store.orders();
      orders.unshift(order);
      write('orders', orders);
      Store.clearCart();
      return { ok: true, order: order };
    },
    setOrderStatus: function (id, status) {
      if (STATUSES.indexOf(status) < 0) return;
      var orders = Store.orders();
      orders.forEach(function (o) { if (o.id === id) o.status = status; });
      write('orders', orders);
    },

    /* ---- reviews ---- */
    reviews: function (bookId) { return (read('reviews', {})[bookId] || []).slice().reverse(); },
    addReview: function (bookId, rating, text) {
      var u = Store.currentUser();
      if (!u) return false;
      var all = read('reviews', {});
      (all[bookId] = all[bookId] || []).push({ user: u.first + ' ' + u.last.charAt(0) + '.', rating: rating, text: text, date: new Date().toISOString() });
      write('reviews', all);
      return true;
    },

    /* ---- contact messages ---- */
    messages: function () { return read('messages', []); },
    addMessage: function (m) {
      var all = Store.messages();
      var id = all.reduce(function (x, y) { return Math.max(x, y.id); }, 0) + 1;
      all.unshift({ id: id, name: m.name, email: m.email, subject: m.subject, message: m.message, date: new Date().toISOString() });
      write('messages', all);
    },
    deleteMessage: function (id) { write('messages', Store.messages().filter(function (m) { return m.id !== id; })); },

    /* ---- database tools ---- */
    exportJSON: function () {
      var dump = { exported: new Date().toISOString(), version: VERSION };
      ['books', 'users', 'orders', 'reviews', 'messages', 'seq'].forEach(function (k) { dump[k] = read(k, null); });
      return JSON.stringify(dump, null, 2);
    },
    importJSON: function (text) {
      var d = JSON.parse(text);
      if (!Array.isArray(d.books) || !Array.isArray(d.users) || !Array.isArray(d.orders)) throw new Error('Not a valid backup file.');
      ['books', 'users', 'orders', 'reviews', 'messages', 'seq'].forEach(function (k) { if (d[k] != null) write(k, d[k]); });
      write('version', VERSION);
    },
    resetAll: function () {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KEY) === 0) localStorage.removeItem(k); });
      mem = {};
      sessSet(null);
      seed(true);
    }
  };

  /* ------------------------------------------------------------------ *
   *  UI helpers shared by every page
   * ------------------------------------------------------------------ */
  var UI = {
    css: function () {
      var s = document.createElement('style');
      s.textContent =
        '.hidden{display:none!important}' +
        '.elib-toasts{position:fixed;right:16px;bottom:16px;z-index:2000;display:flex;flex-direction:column;gap:8px}' +
        '.elib-toast{background:#2a2a2a;color:#fff;border-left:4px solid #4caf50;padding:10px 14px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);max-width:320px;font-size:.9rem}' +
        '.elib-toast.error{border-color:#dc3545}.elib-toast.info{border-color:#0dcaf0}' +
        '.cart-item-img{width:56px;height:76px;object-fit:cover;border-radius:4px}' +
        '.book-img{height:260px;object-fit:cover}' +
        '.elib-badge{position:absolute;top:-6px;right:-10px;font-size:.62rem;line-height:1;padding:3px 5px;border-radius:10px;background:#dc3545;color:#fff;font-family:sans-serif}' +
        '.elib-badge.wish{background:#4caf50}' +
        '.elib-card-actions .btn{padding:.2rem .5rem}' +
        '.checkout-form-section{display:none}.checkout-form-section.active{display:block}' +
        '.table-dark{--bs-table-bg:#1f1f1f}' +
        '.text-muted{color:#a3a3a3!important}' +
        'a.icon-btn,.navbar a{text-decoration:none}' +
        '.form-range{accent-color:#4caf50}' +
        '.form-check-input:checked{background-color:#4caf50;border-color:#4caf50}' +
        '.breadcrumb-nav a,#app a:not(.btn):not(.text-white){color:#7bd88f}' +
        '.star-input button{background:none;border:0;color:#ffc107;font-size:1.5rem;padding:0 2px;cursor:pointer}';
      document.head.appendChild(s);
    },
    toast: function (msg, type) {
      var box = $('.elib-toasts');
      if (!box) { box = document.createElement('div'); box.className = 'elib-toasts'; document.body.appendChild(box); }
      var t = document.createElement('div');
      t.className = 'elib-toast ' + (type || '');
      t.textContent = msg;
      box.appendChild(t);
      setTimeout(function () { t.remove(); }, 3200);
    },
    alert: function (el, msg, type) {
      if (el) el.innerHTML = msg ? '<div class="alert alert-' + (type || 'danger') + '" role="alert">' + esc(msg) + '</div>' : '';
    },
    badge: function (link, cls, n) {
      if (!link) return;
      link.classList.add('position-relative');
      $$('.badge, .elib-badge', link).forEach(function (x) { x.remove(); });
      if (n > 0) {
        var b = document.createElement('span');
        b.className = 'elib-badge ' + cls;
        b.textContent = n;
        link.appendChild(b);
      }
    },
    refresh: function () {
      UI.badge($('.navbar a[href="cart.html"]'), 'cart', Store.cartCount());
      UI.badge($('.navbar a[href="wishlist.html"]'), 'wish', Store.wishlist().length);
      $$('[data-wish-id]').forEach(function (btn) {
        var on = Store.inWishlist(btn.getAttribute('data-wish-id'));
        btn.classList.toggle('btn-danger', on);
        btn.classList.toggle('btn-outline-light', !on);
      });
    },
    polish: function () {
      var LABELS = { 'index.html': 'Home', 'catalogs.html': 'Catalogs', 'book-collection.html': 'Collections', 'blog.html': 'Blog', 'about.html': 'About',
                     'contact.html': 'Contact', 'help.html': 'Help', 'wishlist.html': 'Wishlist', 'cart.html': 'Cart', 'login.html': 'Account', 'admin.html': 'Admin dashboard' };
      $$('.navbar a').forEach(function (a) {
        var label = LABELS[a.getAttribute('href') || ''];
        if (label && !a.getAttribute('aria-label') && !a.textContent.replace(/\d+/g, '').trim()) { a.setAttribute('aria-label', label); if (!a.title) a.title = label; }
      });
      // social icons: only GitHub / LinkedIn, taken from js/config.js; anything else is removed instead of left as a dead link
      var cfg = window.SITE_CONFIG || {};
      $$('a[href="#"] > i.fab').forEach(function (i) {
        var a = i.parentNode, url = /fa-github/.test(i.className) ? cfg.github : /fa-linkedin/.test(i.className) ? cfg.linkedin : '';
        if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', /github/.test(i.className) ? 'GitHub' : 'LinkedIn'); }
        else a.remove();
      });
      // generated artwork for static pages
      $$('img[data-banner]').forEach(function (img) { img.src = bannerSvg(img.getAttribute('data-banner')); });
      $$('img[data-avatar]').forEach(function (img) { img.src = avatarSvg(img.getAttribute('data-avatar')); });
    },
    navbar: function () {
      var u = Store.currentUser();
      var link = $('.navbar a[href="login.html"]');
      if (link && u) {
        link.title = 'Signed in as ' + u.email;
        link.innerHTML = '<i class="fas fa-user"></i> <small class="d-none d-lg-inline">' + esc(u.first) + '</small>';
        var extra = '';
        if (u.role === 'admin') extra += '<a href="admin.html" class="icon-btn" title="Admin dashboard"><i class="fas fa-gauge"></i></a>';
        extra += '<a href="order.html" class="icon-btn" title="My orders"><i class="fas fa-box"></i></a>';
        extra += '<a href="#" class="icon-btn" id="navLogout" title="Log out"><i class="fas fa-sign-out-alt"></i></a>';
        link.insertAdjacentHTML('afterend', extra);
      }
      var out = document.getElementById('navLogout') || document.getElementById('logoutBtn');
      if (out) out.addEventListener('click', function (e) { e.preventDefault(); Store.logout(); location.href = 'login.html'; });
      $$('form[action="search.html"]').forEach(function (f) {
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var inp = $('input', f);
          location.href = 'catalogs.html?q=' + encodeURIComponent(inp ? inp.value.trim() : '');
        });
      });
    }
  };
  Store.ui = UI;

  /* ------------------------------------------------------------------ *
   *  Book card used on the home page
   * ------------------------------------------------------------------ */
  function featuredCard(b) {
    return '<div class="col-md-4 mb-4 book-card" data-search="' + esc((b.title + ' ' + b.author + ' ' + b.category).toLowerCase()) + '">' +
      '<div class="card h-100"><img src="' + esc(coverOf(b)) + '" class="card-img-top book-img" alt="' + esc(b.title) + ' cover" loading="lazy">' +
      '<div class="card-body"><h5 class="card-title">' + esc(b.title) + '</h5><p class="card-text">' + esc(b.author) + '</p>' +
      '<div class="d-flex justify-content-between align-items-center"><span class="text-warning small">' + stars(Store.rating(b).avg) + '</span><span class="fw-bold">' + money(b.price) + '</span></div></div>' +
      '<div class="card-footer bg-transparent border-top-0 d-flex gap-2 elib-card-actions">' +
      '<a href="book-details.html?id=' + b.id + '" class="btn btn-custom btn-sm flex-grow-1">View Details</a>' +
      '<button class="btn btn-outline-light btn-sm" title="Add to cart" onclick="Store.addToCart(' + b.id + ',1)"><i class="fas fa-cart-plus"></i></button>' +
      '<button class="btn btn-outline-light btn-sm" title="Wishlist" data-wish-id="' + b.id + '" onclick="Store.toggleWish(' + b.id + ')"><i class="fas fa-heart"></i></button>' +
      '</div></div></div>';
  }

  /* ------------------------------------------------------------------ *
   *  Page controllers
   * ------------------------------------------------------------------ */
  var pages = {};

  pages.index = function () {
    var box = $('#booksContainer');
    if (!box) return;
    box.innerHTML = Store.books().filter(function (b) { return b.id <= 6; }).map(featuredCard).join('');
  };

  /* ---- contact ---- */
  pages.contact = function () {
    var form = $('#contactForm'), msg = $('#formAlert');
    if (!form) return;
    var u = Store.currentUser();
    if (u) { $('#name').value = u.first + ' ' + u.last; $('#email').value = u.email; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      Store.addMessage({ name: $('#name').value.trim(), email: $('#email').value.trim(), subject: $('#subject').value.trim(), message: $('#message').value.trim() });
      UI.alert(msg, 'Thanks! Your message has been saved. (In this demo it appears in the admin dashboard.)', 'success');
      $('#subject').value = ''; $('#message').value = '';
    });
  };

  /* ---- login ---- */
  pages.login = function () {
    var form = $('#loginForm'), msg = $('#formAlert');
    if (!form) return;
    if (Store.currentUser()) {
      var u = Store.currentUser();
      UI.alert(msg, 'You are already signed in as ' + u.email + '.', 'info');
    }
    if (qs('registered')) UI.alert(msg, 'Account created. Please sign in.', 'success');
    var hint = document.createElement('div');
    hint.className = 'small text-muted mt-3 border-top pt-3';
    hint.innerHTML = '<strong>Demo accounts</strong><br>Admin: <code>admin@elibrary.com</code> / <code>Admin@123</code><br>Reader: <code>reader@example.com</code> / <code>Reader@123</code>';
    form.appendChild(hint);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = Store.login($('#email').value, $('#password').value, $('#remember') && $('#remember').checked);
      if (!r.ok) return UI.alert(msg, r.error);
      var next = safeNext(qs('next'));
      location.href = next || (r.user.role === 'admin' ? 'admin.html' : 'index.html');
    });
  };

  /* ---- register ---- */
  pages.register = function () {
    var form = $('#registerForm'), msg = $('#formAlert');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!$('#terms').checked) return UI.alert(msg, 'Please accept the Terms of Service to continue.');
      var r = Store.register({
        first: $('#firstName').value, last: $('#lastName').value, email: $('#email').value,
        password: $('#password').value, confirm: $('#confirmPassword').value
      });
      if (!r.ok) return UI.alert(msg, r.error);
      Store.login(r.user.email, $('#password').value, false);
      location.href = safeNext(qs('next')) || 'index.html';
    });
  };

  /* ---- book details ---- */
  pages['book-details'] = function () {
    var app = $('#app'), id = qs('id');
    var b = Store.book(id);
    if (!b) {
      app.innerHTML = '<div class="text-center py-5"><h3>Book not found</h3><p class="text-muted">It may have been removed.</p><a class="btn btn-custom" href="catalogs.html">Browse all books</a></div>';
      return;
    }
    var r = Store.rating(b);
    function draw() {
      var revs = Store.reviews(b.id), u = Store.currentUser();
      var similar = Store.books().filter(function (x) { return x.category === b.category && x.id !== b.id; }).slice(0, 4);
      var canRead = /\.pdf$/i.test(b.read || '');
      app.innerHTML =
        '<nav class="small mb-3 breadcrumb-nav"><a href="index.html">Home</a> / <a href="catalogs.html">Catalog</a> / ' + esc(b.title) + '</nav>' +
        '<div class="row"><div class="col-md-4 mb-4"><div class="card"><img src="' + esc(coverOf(b)) + '" class="card-img-top" alt="' + esc(b.title) + ' cover">' +
        '<div class="card-body text-center"><div class="btn-group w-100">' +
        '<button class="btn btn-custom" id="addCart"><i class="fas fa-cart-plus"></i> Add to Cart</button>' +
        '<button class="btn btn-outline-light" id="wishBtn" data-wish-id="' + b.id + '" title="Wishlist"><i class="fas fa-heart"></i></button></div>' +
        (canRead ? '<a class="btn btn-outline-light w-100 mt-2" target="_blank" rel="noopener" href="' + esc(b.read) + '"><i class="fas fa-book-open"></i> Read online</a>' +
                   '<a class="btn btn-outline-light w-100 mt-2" download href="' + esc(b.read) + '"><i class="fas fa-download"></i> Download PDF</a>' : '') +
        '</div></div></div>' +
        '<div class="col-md-8"><div class="card"><div class="card-body">' +
        '<h2>' + esc(b.title) + '</h2><p class="text-muted">by ' + esc(b.author) + '</p>' +
        '<div class="d-flex align-items-center mb-3"><div class="text-warning me-2">' + stars(r.avg) + '</div>' +
        '<span>' + r.avg.toFixed(1) + (r.count ? ' (' + r.count + ' review' + (r.count > 1 ? 's' : '') + ')' : '') + '</span></div>' +
        '<div class="mb-3"><span class="badge bg-secondary me-2">' + esc(b.category) + '</span><span class="badge bg-secondary">' + esc(b.collection || '') + '</span></div>' +
        '<h4 class="mb-3">' + money(b.price) + '</h4>' +
        '<div class="mb-4"><h5>Description</h5><p>' + esc(b.description) + '</p></div>' +
        '<div class="row mb-4"><div class="col-md-6"><h5>Details</h5><ul class="list-unstyled mb-0">' +
        '<li><strong>Category:</strong> ' + esc(b.category) + '</li><li><strong>Format:</strong> eBook (PDF)</li><li><strong>Catalog no.:</strong> #' + b.id + '</li></ul></div>' +
        '<div class="col-md-6"><h5>Quantity</h5><select class="form-select bg-dark text-white border-secondary" id="qty">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<option>' + n + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="d-flex gap-2"><button class="btn btn-custom flex-grow-1" id="buyNow">Buy Now</button>' +
        '<button class="btn btn-outline-light" id="shareBtn" title="Copy link"><i class="fas fa-share-alt"></i></button></div>' +
        '</div></div>' +
        '<div class="card mt-4"><div class="card-header"><h5 class="mb-0">Reviews (' + revs.length + ')</h5></div><div class="card-body">' +
        (revs.length ? revs.map(function (v) {
          return '<div class="mb-4"><div class="d-flex justify-content-between mb-1"><h6>' + esc(v.user) + '</h6><span class="text-warning">' + stars(v.rating) + '</span></div>' +
                 '<p class="mb-1">' + esc(v.text) + '</p><small class="text-muted">Posted ' + ago(v.date) + '</small></div>';
        }).join('') : '<p class="text-muted">No reviews yet. Be the first to review this book.</p>') +
        (u ? '<hr><h6>Write a review</h6><div id="revAlert"></div><div class="mb-2 star-input" id="starInput"></div>' +
             '<textarea class="form-control bg-dark text-white border-secondary mb-2" id="revText" rows="3" placeholder="Share your thoughts..."></textarea>' +
             '<button class="btn btn-outline-light" id="revSubmit">Submit review</button>'
           : '<hr><a class="btn btn-outline-light" href="login.html?next=' + encodeURIComponent('book-details.html?id=' + b.id) + '">Log in to write a review</a>') +
        '</div></div></div></div>' +
        (similar.length ? '<section class="mt-5"><h3 class="mb-4">You May Also Like</h3><div class="row g-4">' + similar.map(function (s) {
          return '<div class="col-6 col-md-3"><a class="text-decoration-none" href="book-details.html?id=' + s.id + '"><div class="card h-100">' +
                 '<img src="' + esc(coverOf(s)) + '" class="card-img-top book-img" alt=""><div class="card-body"><h6 class="card-title text-white">' + esc(s.title) + '</h6>' +
                 '<span class="text-white-50 small">' + money(s.price) + '</span></div></div></a></div>';
        }).join('') + '</div></section>' : '');

      $('#addCart').onclick = function () { Store.addToCart(b.id, $('#qty').value); };
      $('#wishBtn').onclick = function () { Store.toggleWish(b.id); };
      $('#buyNow').onclick = function () { Store.addToCart(b.id, $('#qty').value); location.href = 'checkout.html'; };
      $('#shareBtn').onclick = function () {
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { UI.toast('Link copied', 'info'); });
        else UI.toast(location.href, 'info');
      };
      if (u) {
        var rating = 5, si = $('#starInput');
        (function paint() {
          si.innerHTML = [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + ' stars">' + (n <= rating ? '★' : '☆') + '</button>'; }).join('');
          $$('button', si).forEach(function (btn) { btn.onclick = function () { rating = Number(btn.getAttribute('data-n')); paint(); }; });
        })();
        $('#revSubmit').onclick = function () {
          var text = $('#revText').value.trim();
          if (text.length < 5) return UI.alert($('#revAlert'), 'Please write at least a few words.');
          Store.addReview(b.id, rating, text);
          UI.toast('Thanks for your review!', 'success');
          draw();
        };
      }
      UI.refresh();
    }
    draw();
    document.title = b.title + ' - My e-Library';
  };

  /* ---- wishlist ---- */
  pages.wishlist = function () {
    var app = $('#app');
    var add = qs('add');
    if (add && Store.book(add) && !Store.inWishlist(add)) Store.toggleWish(add);
    if (add) history.replaceState(null, '', 'wishlist.html');
    function draw() {
      var items = Store.wishlist().map(Store.book).filter(Boolean);
      if (!items.length) {
        app.innerHTML = '<div class="text-center py-5"><i class="far fa-heart fa-3x mb-3 text-muted"></i><h4>Your wishlist is empty</h4><p class="text-muted">Tap the heart on any book to save it here.</p><a class="btn btn-custom" href="catalogs.html">Browse books</a></div>';
        return;
      }
      app.innerHTML = '<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h5 class="mb-0">' + items.length + ' item' + (items.length > 1 ? 's' : '') + ' in wishlist</h5>' +
        '<button class="btn btn-custom btn-sm" id="allToCart">Add all to cart</button></div><div class="card-body"><div class="table-responsive">' +
        '<table class="table table-dark align-middle"><thead><tr><th>Book</th><th>Price</th><th></th></tr></thead><tbody>' +
        items.map(function (b) {
          return '<tr><td><div class="d-flex align-items-center"><img src="' + esc(coverOf(b)) + '" class="cart-item-img me-3" alt="">' +
            '<div><a class="text-white text-decoration-none" href="book-details.html?id=' + b.id + '"><h6 class="mb-0">' + esc(b.title) + '</h6></a><small class="text-muted">' + esc(b.author) + '</small></div></div></td>' +
            '<td>' + money(b.price) + '</td><td class="text-end"><div class="d-flex gap-2 justify-content-end">' +
            '<button class="btn btn-sm btn-custom" data-cart="' + b.id + '">Add to Cart</button>' +
            '<button class="btn btn-sm btn-outline-danger" data-rm="' + b.id + '" title="Remove"><i class="fas fa-trash"></i></button></div></td></tr>';
        }).join('') + '</tbody></table></div></div></div>';
      $$('[data-cart]', app).forEach(function (x) { x.onclick = function () { Store.addToCart(x.getAttribute('data-cart'), 1); }; });
      $$('[data-rm]', app).forEach(function (x) { x.onclick = function () { Store.toggleWish(x.getAttribute('data-rm')); draw(); }; });
      $('#allToCart').onclick = function () { items.forEach(function (b) { Store.addToCart(b.id, 1); }); };
    }
    draw();
  };

  /* ---- cart ---- */
  pages.cart = function () {
    var app = $('#app');
    function draw() {
      var det = Store.cartDetail(), t = Store.totals();
      if (!det.length) {
        app.innerHTML = '<div class="text-center py-5"><i class="fas fa-shopping-cart fa-3x mb-3 text-muted"></i><h4>Your cart is empty</h4><p class="text-muted">Add some books to get started.</p><a class="btn btn-custom" href="catalogs.html">Browse books</a></div>';
        return;
      }
      app.innerHTML = '<div class="row"><div class="col-lg-8"><div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center">' +
        '<h5 class="mb-0">' + t.count + ' item' + (t.count > 1 ? 's' : '') + ' in your cart</h5><a href="catalogs.html" class="btn btn-outline-light btn-sm">Continue Shopping</a></div>' +
        '<div class="card-body"><div class="table-responsive"><table class="table table-dark align-middle"><thead><tr><th style="width:46%">Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>' +
        det.map(function (x) {
          var b = x.book;
          return '<tr><td><div class="d-flex align-items-center"><img src="' + esc(coverOf(b)) + '" class="cart-item-img me-3" alt="">' +
            '<div><a class="text-white text-decoration-none" href="book-details.html?id=' + b.id + '"><h6 class="mb-1">' + esc(b.title) + '</h6></a><p class="mb-0 text-muted small">by ' + esc(b.author) + '</p></div></div></td>' +
            '<td>' + money(b.price) + '</td><td><select class="form-select form-select-sm bg-dark text-white border-secondary" style="width:72px" data-qty="' + b.id + '">' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option' + (n === x.qty ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></td>' +
            '<td>' + money(x.line) + '</td><td class="text-end"><button class="btn btn-sm btn-outline-danger" data-rm="' + b.id + '" title="Remove"><i class="fas fa-trash"></i></button></td></tr>';
        }).join('') + '</tbody></table></div><div class="d-flex justify-content-end"><button class="btn btn-outline-danger" id="clearCart"><i class="fas fa-trash"></i> Clear cart</button></div></div></div></div>' +
        '<div class="col-lg-4"><div class="card"><div class="card-header"><h5 class="mb-0">Order Summary</h5></div><div class="card-body">' +
        '<div class="d-flex justify-content-between mb-2"><span>Subtotal (' + t.count + ' items)</span><span>' + money(t.subtotal) + '</span></div>' +
        '<div class="d-flex justify-content-between mb-2"><span>Shipping</span><span>' + (t.shipping ? money(t.shipping) : 'Free') + '</span></div>' +
        (t.shipping ? '<p class="small text-muted">Free shipping on orders over ' + money(FREE_SHIPPING_OVER) + '.</p>' : '') +
        '<hr><div class="d-flex justify-content-between fw-bold mb-4"><span>Total</span><span>' + money(t.total) + '</span></div>' +
        '<a href="checkout.html" class="btn btn-custom w-100">Proceed to Checkout</a></div></div></div></div>';
      $$('[data-qty]', app).forEach(function (s) { s.onchange = function () { Store.setQty(s.getAttribute('data-qty'), s.value); draw(); }; });
      $$('[data-rm]', app).forEach(function (x) { x.onclick = function () { Store.removeFromCart(x.getAttribute('data-rm')); draw(); }; });
      $('#clearCart').onclick = function () { if (confirm('Remove everything from your cart?')) { Store.clearCart(); draw(); } };
    }
    draw();
  };

  /* ---- checkout ---- */
  pages.checkout = function () {
    var app = $('#app');
    if (!Store.currentUser()) { location.replace('login.html?next=checkout.html'); return; }
    if (!Store.cartDetail().length) { location.replace('cart.html'); return; }
    var u = Store.currentUser();
    var saved = read('addr:' + u.email, {});
    var data = { address: null, payment: 'Cash on Delivery' };
    function val(id) { return ($('#' + id).value || '').trim(); }
    function summary() {
      var det = Store.cartDetail(), t = Store.totals();
      return '<div class="card"><div class="card-header"><h5 class="mb-0">Order Summary</h5></div><div class="card-body">' +
        det.map(function (x) {
          return '<div class="d-flex align-items-center mb-2"><img src="' + esc(coverOf(x.book)) + '" width="40" height="54" style="object-fit:cover" class="me-2 rounded" alt="">' +
                 '<div class="flex-grow-1"><p class="mb-0 small">' + esc(x.book.title) + '</p><p class="mb-0 small text-muted">' + x.qty + ' × ' + money(x.book.price) + '</p></div><span class="small">' + money(x.line) + '</span></div>';
        }).join('') + '<hr><div class="d-flex justify-content-between mb-2"><span>Subtotal</span><span>' + money(t.subtotal) + '</span></div>' +
        '<div class="d-flex justify-content-between mb-2"><span>Shipping</span><span>' + (t.shipping ? money(t.shipping) : 'Free') + '</span></div><hr>' +
        '<div class="d-flex justify-content-between fw-bold"><span>Total</span><span>' + money(t.total) + '</span></div>' +
        '<a href="cart.html" class="small d-block mt-3">Edit cart</a></div></div>';
    }
    function go(n) {
      for (var i = 1; i <= 4; i++) {
        $('#sec' + i).classList.toggle('active', i === n);
        $('#step' + i).classList.toggle('active', i === n);
        $('#step' + i).classList.toggle('completed', i < n);
      }
      window.scrollTo(0, 0);
    }
    var countries = ['Sri Lanka', 'India', 'United Kingdom', 'United States', 'Canada', 'Australia'];
    app.innerHTML =
      '<div class="checkout-steps">' + ['Shipping', 'Payment', 'Review', 'Complete'].map(function (t, i) {
        return '<div class="step' + (i === 0 ? ' active' : '') + '" id="step' + (i + 1) + '"><div class="step-number">' + (i + 1) + '</div><div class="step-title">' + t + '</div></div>';
      }).join('') + '</div><div class="row"><div class="col-lg-8">' +
      '<div class="checkout-form-section active" id="sec1"><div class="card mb-4"><div class="card-header"><h4 class="mb-0">Shipping Information</h4></div><div class="card-body">' +
      '<form id="shipForm"><div class="mb-3"><label class="form-label" for="fullName">Full name</label><input class="form-control bg-dark text-white border-secondary" id="fullName" required value="' + esc(saved.name || (u.first + ' ' + u.last)) + '"></div>' +
      '<div class="mb-3"><label class="form-label" for="line">Address</label><input class="form-control bg-dark text-white border-secondary" id="line" required value="' + esc(saved.line || '') + '"></div>' +
      '<div class="row"><div class="col-md-4 mb-3"><label class="form-label" for="city">City</label><input class="form-control bg-dark text-white border-secondary" id="city" required value="' + esc(saved.city || '') + '"></div>' +
      '<div class="col-md-4 mb-3"><label class="form-label" for="state">Province / State</label><input class="form-control bg-dark text-white border-secondary" id="state" required value="' + esc(saved.state || '') + '"></div>' +
      '<div class="col-md-4 mb-3"><label class="form-label" for="zip">Postal code</label><input class="form-control bg-dark text-white border-secondary" id="zip" required value="' + esc(saved.zip || '') + '"></div></div>' +
      '<div class="row"><div class="col-md-6 mb-3"><label class="form-label" for="country">Country</label><select class="form-select bg-dark text-white border-secondary" id="country">' +
      countries.map(function (c) { return '<option' + (c === (saved.country || 'Sri Lanka') ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="col-md-6 mb-3"><label class="form-label" for="phone">Phone</label><input type="tel" class="form-control bg-dark text-white border-secondary" id="phone" required value="' + esc(saved.phone || '') + '"></div></div>' +
      '<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="saveAddr"' + (saved.line ? ' checked' : '') + '><label class="form-check-label" for="saveAddr">Remember this address on this device</label></div>' +
      '<div class="d-flex justify-content-between"><a href="cart.html" class="btn btn-outline-light">Back to Cart</a><button type="submit" class="btn btn-custom">Continue to Payment</button></div></form></div></div></div>' +
      '<div class="checkout-form-section" id="sec2"><div class="card mb-4"><div class="card-header"><h4 class="mb-0">Payment Method</h4></div><div class="card-body">' +
      ['Cash on Delivery', 'Bank transfer', 'Card (demo)'].map(function (m, i) {
        return '<div class="form-check mb-2"><input class="form-check-input" type="radio" name="pay" id="pay' + i + '" value="' + m + '"' + (i === 0 ? ' checked' : '') + '><label class="form-check-label" for="pay' + i + '">' + m + '</label></div>';
      }).join('') + '<p class="small text-muted mt-3 mb-4">This is a demo store: no real payment is taken and no card details are collected or stored.</p>' +
      '<div class="d-flex justify-content-between"><button class="btn btn-outline-light" id="back1">Back</button><button class="btn btn-custom" id="to3">Review Order</button></div></div></div></div>' +
      '<div class="checkout-form-section" id="sec3"><div class="card mb-4"><div class="card-header"><h4 class="mb-0">Review Your Order</h4></div><div class="card-body">' +
      '<div class="row mb-3"><div class="col-md-6"><h6>Ship to <a href="#" id="edit1" class="small ms-2">Edit</a></h6><p class="mb-0" id="revAddr"></p></div>' +
      '<div class="col-md-6"><h6>Payment <a href="#" id="edit2" class="small ms-2">Edit</a></h6><p class="mb-0" id="revPay"></p></div></div>' +
      '<div id="placeAlert"></div><div class="d-flex justify-content-between"><button class="btn btn-outline-light" id="back2">Back</button><button class="btn btn-custom" id="place">Place Order</button></div></div></div></div>' +
      '<div class="checkout-form-section" id="sec4"><div class="card mb-4"><div class="card-body text-center p-5"><i class="fas fa-check-circle fa-4x text-success mb-3"></i>' +
      '<h3>Thank you for your order!</h3><p class="lead mb-1">Your order <strong id="doneId"></strong> has been placed.</p><p class="text-muted">You can track its status in your order history.</p>' +
      '<a class="btn btn-custom me-2" id="doneLink" href="order.html">View Order</a><a class="btn btn-outline-light" href="catalogs.html">Continue Shopping</a></div></div></div>' +
      '</div><div class="col-lg-4" id="sumCol">' + summary() + '</div></div>';

    $('#shipForm').addEventListener('submit', function (e) {
      e.preventDefault();
      data.address = { name: val('fullName'), line: val('line'), city: val('city'), state: val('state'), zip: val('zip'), country: $('#country').value, phone: val('phone') };
      if ($('#saveAddr').checked) write('addr:' + u.email, data.address); else remove('addr:' + u.email);
      go(2);
    });
    $('#back1').onclick = function () { go(1); };
    $('#to3').onclick = function () {
      data.payment = ($('input[name="pay"]:checked') || {}).value || 'Cash on Delivery';
      var a = data.address;
      $('#revAddr').innerHTML = esc(a.name) + '<br>' + esc(a.line) + '<br>' + esc(a.city) + ', ' + esc(a.state) + ' ' + esc(a.zip) + '<br>' + esc(a.country) + '<br>' + esc(a.phone);
      $('#revPay').textContent = data.payment;
      go(3);
    };
    $('#edit1').onclick = function (e) { e.preventDefault(); go(1); };
    $('#edit2').onclick = function (e) { e.preventDefault(); go(2); };
    $('#back2').onclick = function () { go(2); };
    $('#place').onclick = function () {
      var r = Store.placeOrder(data.address, data.payment);
      if (!r.ok) return UI.alert($('#placeAlert'), r.error);
      $('#doneId').textContent = r.order.id;
      $('#doneLink').href = 'order.html?id=' + encodeURIComponent(r.order.id);
      go(4);
      $('#sumCol').innerHTML = '';
    };
  };

  /* ---- orders (history + detail) ---- */
  pages.order = function () {
    var app = $('#app');
    var u = Store.currentUser();
    if (!u) { location.replace('login.html?next=order.html'); return; }
    var id = qs('id');
    var hero = $('.hero h1'), lead = $('.hero .lead');
    function badge(s) {
      var cls = { Processing: 'bg-warning text-dark', Shipped: 'bg-primary', Completed: 'bg-success', Cancelled: 'bg-danger' }[s] || 'bg-secondary';
      return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    }
    if (id) {
      var o = Store.order(id);
      if (!o || (u.role !== 'admin' && o.userEmail !== u.email)) {
        app.innerHTML = '<div class="text-center py-5"><h4>Order not found</h4><a class="btn btn-custom" href="order.html">My orders</a></div>';
        return;
      }
      if (hero) hero.textContent = 'Order ' + o.id;
      if (lead) lead.textContent = 'Placed on ' + fmtDate(o.date);
      var a = o.address;
      app.innerHTML = '<div class="row justify-content-center"><div class="col-lg-9"><div class="card"><div class="card-body p-4">' +
        '<div class="d-flex justify-content-between align-items-start mb-4"><div><h3 class="mb-1">Order ' + esc(o.id) + '</h3><span class="text-muted">' + fmtDate(o.date) + '</span></div><div>' + badge(o.status) + '</div></div>' +
        '<div class="row mb-4"><div class="col-md-6"><h5>Order details</h5><ul class="list-unstyled"><li><strong>Total:</strong> ' + money(o.total) + '</li><li><strong>Payment:</strong> ' + esc(o.payment) + '</li><li><strong>Customer:</strong> ' + esc(o.userName) + '</li></ul></div>' +
        '<div class="col-md-6"><h5>Shipping address</h5><p class="mb-0">' + esc(a.name) + '<br>' + esc(a.line) + '<br>' + esc(a.city) + ', ' + esc(a.state) + ' ' + esc(a.zip) + '<br>' + esc(a.country) + '</p></div></div>' +
        '<div class="table-responsive"><table class="table table-dark"><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>' +
        o.items.map(function (i) { return '<tr><td>' + esc(i.title) + '</td><td>' + money(i.price) + '</td><td>' + i.qty + '</td><td>' + money(i.price * i.qty) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="3" class="text-end">Shipping</td><td>' + (o.shipping ? money(o.shipping) : 'Free') + '</td></tr><tr><th colspan="3" class="text-end">Total</th><th>' + money(o.total) + '</th></tr></tfoot></table></div>' +
        '<div class="d-flex justify-content-between mt-4"><a href="order.html" class="btn btn-outline-light">All orders</a><div>' +
        (o.status === 'Processing' ? '<button class="btn btn-outline-danger me-2" id="cancelOrder">Cancel order</button>' : '') +
        '<button class="btn btn-custom" onclick="window.print()"><i class="fas fa-print"></i> Print</button></div></div></div></div></div></div>';
      var c = $('#cancelOrder');
      if (c) c.onclick = function () { if (confirm('Cancel this order?')) { Store.setOrderStatus(o.id, 'Cancelled'); location.reload(); } };
      return;
    }
    if (hero) hero.textContent = u.role === 'admin' ? 'All Orders' : 'My Orders';
    if (lead) lead.textContent = 'Track your purchases';
    var orders = Store.ordersForCurrentUser();
    if (!orders.length) {
      app.innerHTML = '<div class="text-center py-5"><i class="fas fa-box-open fa-3x mb-3 text-muted"></i><h4>No orders yet</h4><a class="btn btn-custom" href="catalogs.html">Browse books</a></div>';
      return;
    }
    app.innerHTML = '<div class="card"><div class="card-body"><div class="table-responsive"><table class="table table-dark table-hover align-middle"><thead><tr><th>Order</th><th>Date</th>' +
      (u.role === 'admin' ? '<th>Customer</th>' : '') + '<th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>' +
      orders.map(function (o) {
        return '<tr><td>' + esc(o.id) + '</td><td>' + fmtDate(o.date) + '</td>' + (u.role === 'admin' ? '<td>' + esc(o.userName) + '</td>' : '') +
          '<td>' + o.items.reduce(function (s, i) { return s + i.qty; }, 0) + '</td><td>' + money(o.total) + '</td><td>' + badge(o.status) + '</td>' +
          '<td><a class="btn btn-sm btn-custom" href="order.html?id=' + encodeURIComponent(o.id) + '">View</a></td></tr>';
      }).join('') + '</tbody></table></div></div></div>';
  };

  /* ---- admin ---- */
  pages.admin = function () {
    var app = $('#app');
    var u = Store.currentUser();
    if (!u || u.role !== 'admin') { location.replace('login.html?next=admin.html'); return; }
    function statusSelect(o) {
      return '<select class="form-select form-select-sm bg-dark text-white border-secondary" style="min-width:130px" data-status="' + esc(o.id) + '">' +
        STATUSES.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
    }
    function draw() {
      var books = Store.books(), users = Store.users(), orders = Store.orders();
      var revenue = orders.filter(function (o) { return o.status !== 'Cancelled'; }).reduce(function (s, o) { return s + o.total; }, 0);
      function stat(label, val, icon) {
        return '<div class="col-6 col-md-3 mb-3"><div class="card h-100"><div class="card-body"><h6 class="text-muted"><i class="fas ' + icon + ' me-1"></i>' + label + '</h6><h2 class="mb-0">' + val + '</h2></div></div></div>';
      }
      app.innerHTML = '<h2 class="mb-4" id="dashboard">Admin Dashboard</h2><div class="row mb-2">' +
        stat('Total Books', books.length, 'fa-book') + stat('Users', users.length, 'fa-users') + stat('Orders', orders.length, 'fa-file-alt') + stat('Revenue', money(revenue), 'fa-coins') + '</div>' +

        '<div class="card mb-4" id="orders"><div class="card-header"><h5 class="mb-0">Orders</h5></div><div class="card-body"><div class="table-responsive" style="max-height:360px;overflow:auto">' +
        (orders.length ? '<table class="table table-dark table-hover align-middle"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>' +
        orders.map(function (o) {
          return '<tr><td>' + esc(o.id) + '</td><td>' + esc(o.userName) + '</td><td>' + o.items.reduce(function (s, i) { return s + i.qty; }, 0) + '</td><td>' + money(o.total) + '</td><td>' + statusSelect(o) + '</td>' +
                 '<td><a class="btn btn-sm btn-custom" href="order.html?id=' + encodeURIComponent(o.id) + '">View</a></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="text-muted mb-0">No orders yet.</p>') + '</div></div></div>' +

        '<div class="card mb-4" id="books"><div class="card-header d-flex justify-content-between align-items-center"><h5 class="mb-0">Books (' + books.length + ')</h5>' +
        '<button class="btn btn-custom btn-sm" id="toggleAdd"><i class="fas fa-plus"></i> Add book</button></div><div class="card-body">' +
        '<form id="addBookForm" class="d-none border rounded p-3 mb-3 border-secondary"><div id="bookAlert"></div><div class="row g-2">' +
        '<div class="col-md-6"><input class="form-control bg-dark text-white border-secondary" id="nbTitle" placeholder="Title" required></div>' +
        '<div class="col-md-6"><input class="form-control bg-dark text-white border-secondary" id="nbAuthor" placeholder="Author" required></div>' +
        '<div class="col-md-4"><input type="number" min="0" class="form-control bg-dark text-white border-secondary" id="nbPrice" placeholder="Price (Rs.)" required></div>' +
        '<div class="col-md-4"><select class="form-select bg-dark text-white border-secondary" id="nbCat">' + CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
        '<div class="col-md-4"><input class="form-control bg-dark text-white border-secondary" id="nbImage" placeholder="Cover image URL (optional)"></div>' +
        '<div class="col-12"><textarea class="form-control bg-dark text-white border-secondary" id="nbDesc" rows="2" placeholder="Description (optional)"></textarea></div>' +
        '<div class="col-12"><button class="btn btn-custom" type="submit">Save book</button></div></div></form>' +
        '<div class="table-responsive" style="max-height:420px;overflow:auto"><table class="table table-dark table-hover align-middle"><thead><tr><th>#</th><th>Title</th><th>Author</th><th>Category</th><th>Price</th><th></th></tr></thead><tbody>' +
        books.map(function (b) {
          return '<tr><td>' + b.id + '</td><td><a class="text-white" href="book-details.html?id=' + b.id + '">' + esc(b.title) + '</a></td><td>' + esc(b.author) + '</td><td>' + esc(b.category) + '</td><td>' + money(b.price) + '</td>' +
                 '<td class="text-end"><button class="btn btn-sm btn-outline-danger" data-delbook="' + b.id + '" title="Delete"><i class="fas fa-trash"></i></button></td></tr>';
        }).join('') + '</tbody></table></div></div></div>' +

        '<div class="card mb-4" id="users"><div class="card-header"><h5 class="mb-0">Users (' + users.length + ')</h5></div><div class="card-body"><div class="table-responsive">' +
        '<table class="table table-dark align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>' +
        users.map(function (x) {
          return '<tr><td>' + esc(x.first + ' ' + x.last) + '</td><td>' + esc(x.email) + '</td><td><span class="badge ' + (x.role === 'admin' ? 'bg-danger' : 'bg-secondary') + '">' + esc(x.role) + '</span></td><td>' + ago(x.created) + '</td>' +
                 '<td class="text-end">' + (x.role === 'admin' ? '' : '<button class="btn btn-sm btn-outline-danger" data-deluser="' + x.id + '" title="Remove user"><i class="fas fa-user-slash"></i></button>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div></div>' +

        '<div class="card mb-4" id="messages"><div class="card-header"><h5 class="mb-0">Messages (' + Store.messages().length + ')</h5></div><div class="card-body">' +
        (Store.messages().length ? '<div class="list-group">' + Store.messages().map(function (m) {
          return '<div class="list-group-item bg-dark text-white border-secondary"><div class="d-flex justify-content-between"><strong>' + esc(m.subject) + '</strong><small class="text-muted">' + ago(m.date) + '</small></div>' +
                 '<small class="text-muted">' + esc(m.name) + ' · ' + esc(m.email) + '</small><p class="mb-2 mt-1">' + esc(m.message) + '</p>' +
                 '<button class="btn btn-sm btn-outline-danger" data-delmsg="' + m.id + '"><i class="fas fa-trash"></i> Delete</button></div>';
        }).join('') + '</div>' : '<p class="text-muted mb-0">No messages yet. Messages sent from the Contact page appear here.</p>') + '</div></div>' +

        '<div class="card mb-4" id="settings"><div class="card-header"><h5 class="mb-0">Database tools</h5></div><div class="card-body">' +
        '<p class="text-muted small">Data is stored in this browser (localStorage). Export a JSON backup, restore one, or reset to the demo data.</p>' +
        '<div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-light" id="exportDb"><i class="fas fa-download"></i> Export backup</button>' +
        '<label class="btn btn-outline-light mb-0"><i class="fas fa-upload"></i> Import backup<input type="file" id="importDb" accept="application/json" hidden></label>' +
        '<button class="btn btn-outline-danger" id="resetDb"><i class="fas fa-rotate-left"></i> Reset demo data</button></div></div></div>';

      $$('[data-status]', app).forEach(function (s) {
        s.onchange = function () { Store.setOrderStatus(s.getAttribute('data-status'), s.value); UI.toast('Order status updated', 'success'); draw(); };
      });
      $$('[data-delmsg]', app).forEach(function (x) {
        x.onclick = function () { Store.deleteMessage(Number(x.getAttribute('data-delmsg'))); draw(); };
      });
      $('#toggleAdd').onclick = function () { $('#addBookForm').classList.toggle('d-none'); };
      $('#addBookForm').onsubmit = function (e) {
        e.preventDefault();
        var img = $('#nbImage').value.trim();
        if (img && !/^https?:\/\//i.test(img)) return UI.alert($('#bookAlert'), 'Image URL must start with http:// or https://');
        Store.addBook({ title: $('#nbTitle').value, author: $('#nbAuthor').value, price: $('#nbPrice').value, category: $('#nbCat').value, image: img, description: $('#nbDesc').value });
        UI.toast('Book added', 'success');
        draw();
      };
      $$('[data-delbook]', app).forEach(function (x) {
        x.onclick = function () { if (confirm('Delete this book?')) { Store.deleteBook(x.getAttribute('data-delbook')); UI.toast('Book deleted', 'info'); draw(); } };
      });
      $$('[data-deluser]', app).forEach(function (x) {
        x.onclick = function () { if (confirm('Remove this user?')) { Store.deleteUser(Number(x.getAttribute('data-deluser'))); draw(); } };
      });
      $('#exportDb').onclick = function () {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
        a.download = 'elibrary-backup.json';
        a.click();
      };
      $('#importDb').onchange = function () {
        var f = this.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try { Store.importJSON(rd.result); UI.toast('Backup restored', 'success'); draw(); }
          catch (err) { UI.toast(err.message || 'Import failed', 'error'); }
        };
        rd.readAsText(f);
      };
      $('#resetDb').onclick = function () {
        if (confirm('Reset ALL data to the demo state? This cannot be undone.')) { Store.resetAll(); location.href = 'login.html'; }
      };
    }
    draw();
  };

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */
  window.Store = Store;
  seed(false);

  // any picture that fails to load falls back to a generated cover (capture phase: "error" does not bubble)
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && !t.getAttribute('data-fallback')) {
      t.setAttribute('data-fallback', '1');
      t.src = coverSvg(t.alt || 'Image', '', 'Book');
    }
  }, true);

  // links that point nowhere yet say so instead of jumping to the top of the page
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#"]');
    if (!a || e.defaultPrevented || a.hasAttribute('data-bs-toggle') || a.hasAttribute('onclick') || a.closest('.admin-sidebar')) return;
    e.preventDefault();
    UI.toast('This section is coming soon', 'info');
  });

  function boot() {
    UI.css();
    UI.polish();
    UI.navbar();
    UI.refresh();
    var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
    if (pages[page]) pages[page]();
    UI.refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
