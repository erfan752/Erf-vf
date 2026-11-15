import { API } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const media = (key) => `${API}/media/${encodeURIComponent(key)}`;

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((x) => x != null));
  return n;
}

let token = localStorage.getItem('admin_token') || '';

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(API + path, { ...opts, headers });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `خطا ${r.status}`);
  }
  return r.json();
}

const fmt = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

function linkify(text) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    i % 2 ? el('a', { href: p, target: '_blank', rel: 'noopener', dir: 'ltr' }, p) : p
  );
}

/* ---------- tabs ---------- */
const TABS = ['feed', 'projects', 'resume'];

function showTab() {
  const name = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'feed';
  for (const t of TABS) $('#' + t).hidden = t !== name;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------- admin ---------- */
function applyAdmin() {
  const on = !!token;
  $('#composer').hidden = !on;
  $('#projectForm').hidden = !on;
  $('#logout').hidden = !on;
  // رندر دوباره تا دکمه‌های حذف نمایش داده بشن
  loadPosts(true);
  loadProjects();
}

async function adminLogin() {
  const t = prompt('رمز مدیر را وارد کن');
  history.replaceState(null, '', location.pathname + '#feed');
  if (!t) return;
  try {
    const r = await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${t}` } });
    if (!r.ok) throw new Error();
    token = t;
    localStorage.setItem('admin_token', t);
  } catch {
    alert('رمز اشتباه است');
  }
}

$('#logout').addEventListener('click', () => {
  token = '';
  localStorage.removeItem('admin_token');
  applyAdmin();
});

/* ---------- feed ---------- */
let oldest = null;

function postNode(p) {
  const m = p.media_key
    ? p.media_type === 'video'
      ? el('video', { class: 'media', src: media(p.media_key), controls: true, preload: 'metadata', playsinline: true })
      : el('img', {
          class: 'media', src: media(p.media_key), loading: 'lazy', alt: '',
          onclick: () => openViewer({ title: '', caption: p.text, images: [p.media_key] }),
        })
    : null;

  const foot = el('div', { class: 'foot' }, el('time', {}, fmt.format(new Date(p.created_at))));
  if (token) {
    foot.prepend(
      el('button', {
        class: 'linklike',
        onclick: async () => {
          if (!confirm('این پست حذف بشه؟')) return;
          await api(`/api/posts/${p.id}`, { method: 'DELETE' });
          loadPosts(true);
        },
      }, 'حذف')
    );
  }
  return el('article', { class: 'bubble' }, m, p.text ? el('p', { class: 'text' }, linkify(p.text)) : null, foot);
}

async function loadPosts(reset = false) {
  if (reset) { oldest = null; $('#posts').replaceChildren(); }
  const q = oldest ? `?before=${oldest}` : '';
  try {
    const { posts, hasMore } = await api('/api/posts' + q);
    for (const p of posts) $('#posts').append(postNode(p));
    if (posts.length) oldest = posts[posts.length - 1].id;
    $('#more').hidden = !hasMore;
    $('#postsEmpty').hidden = $('#posts').children.length > 0;
  } catch (e) {
    $('#postsEmpty').hidden = false;
    $('#postsEmpty').textContent = 'بارگذاری پست‌ها ممکن نشد: ' + e.message;
  }
}
$('#more').addEventListener('click', () => loadPosts(false));

function bindForm(form, endpoint, after) {
  const msg = $('.msg', form);
  const btn = $('button[type=submit]', form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'msg';
    msg.textContent = 'در حال ارسال...';
    btn.disabled = true;
    try {
      await api(endpoint, { method: 'POST', body: new FormData(form) });
      form.reset();
      msg.textContent = '';
      after();
    } catch (err) {
      msg.className = 'msg err';
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}
bindForm($('#composer'), '/api/posts', () => loadPosts(true));
bindForm($('#projectForm'), '/api/projects', loadProjects);

/* ---------- projects ---------- */
async function loadProjects() {
  const grid = $('#projectGrid');
  try {
    const { projects } = await api('/api/projects');
    grid.replaceChildren(
      ...projects.map((p) =>
        el('button', { class: 'card', onclick: () => openViewer(p) },
          el('div', { class: 'cover' },
            el('img', { src: media(p.images[0]), loading: 'lazy', alt: '' }),
            p.images.length > 1 ? el('span', { class: 'count' }, `${p.images.length.toLocaleString('fa-IR')} عکس`) : null),
          el('h3', {}, p.title),
          p.caption ? el('p', {}, p.caption) : null)
      )
    );
    $('#projectsEmpty').hidden = projects.length > 0;
  } catch (e) {
    $('#projectsEmpty').hidden = false;
    $('#projectsEmpty').textContent = 'بارگذاری پروژه‌ها ممکن نشد: ' + e.message;
  }
}

/* ---------- viewer ---------- */
const dlg = $('#viewer');

function openViewer(p) {
  const stage = $('.stage', dlg);
  const thumbs = $('.thumbs', dlg);
  const show = (i) => {
    stage.replaceChildren(el('img', { src: media(p.images[i]), alt: p.title || '' }));
    [...thumbs.children].forEach((b, j) => b.setAttribute('aria-current', j === i));
  };
  thumbs.replaceChildren(
    ...(p.images.length > 1
      ? p.images.map((k, i) => el('button', { 'aria-label': `عکس ${i + 1}`, onclick: () => show(i) }, el('img', { src: media(k), alt: '' })))
      : [])
  );
  show(0);

  $('h2', dlg).textContent = p.title || '';
  $('h2', dlg).hidden = !p.title;
  $('.cap', dlg).textContent = p.caption || '';
  const link = $('.plink', dlg);
  link.hidden = !p.link;
  if (p.link) link.href = p.link;

  const del = $('.del', dlg);
  del.hidden = !(token && p.id);
  del.onclick = async () => {
    if (!confirm('این پروژه و همه عکس‌هاش حذف بشه؟')) return;
    await api(`/api/projects/${p.id}`, { method: 'DELETE' });
    dlg.close();
    loadProjects();
  };
  dlg.showModal();
}
$('.close', dlg).addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

/* ---------- start ---------- */
$('#avatarImg').addEventListener('error', (e) => e.target.remove());
window.addEventListener('hashchange', async () => {
  if (location.hash === '#admin') { await adminLogin(); applyAdmin(); }
  showTab();
});

(async () => {
  if (location.hash === '#admin') await adminLogin();
  showTab();
  applyAdmin();
})();
