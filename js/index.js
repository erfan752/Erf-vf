import { API } from './config.js';

// مسیر و مدت هر گیف (میلی‌ثانیه). مدت رو دقیقاً برابر طول گیف بذار.
const INTRO_SRC = 'assets/intro.gif';
const INTRO_MS = 4000;
const HERO_SRC = 'assets/hero.gif';
const HERO_MS = 3500;

const $ = (s, r = document) => r.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const media = (k) => `${API}/media/${encodeURIComponent(k)}`;
const fmt = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' });

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((x) => x != null));
  return n;
}

// یه تگ img تازه می‌سازه تا گیف از فریم اول شروع بشه، بعد از مدت مشخص محوش می‌کنه و کامل پاکش می‌کنه
async function playGif(box, src, ms, skipTargets) {
  const img = new Image();
  img.alt = '';
  const ok = await new Promise((res) => {
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
  if (!ok) return;

  box.append(img);
  requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('in')));

  const skips = skipTargets.map((t) => new Promise((r) => t.addEventListener('click', r, { once: true })));
  await Promise.race([wait(ms), ...skips]);

  img.classList.remove('in');
  await wait(400);
  img.removeAttribute('src');
  img.remove();
}

async function intro() {
  const splash = $('#splash');
  if (reduce || sessionStorage.getItem('intro_seen')) {
    splash.remove();
    return;
  }
  await playGif($('.box', splash), INTRO_SRC, INTRO_MS, [$('#skip')]);
  splash.classList.add('out');
  await wait(600);
  splash.remove();
  sessionStorage.setItem('intro_seen', '1');
}

/* ---------- داده‌ها ---------- */
async function loadWork() {
  const box = $('#workRail');
  try {
    const r = await fetch(API + '/api/projects');
    if (!r.ok) throw new Error();
    const { projects } = await r.json();
    if (!projects.length) {
      box.replaceChildren(el('p', { class: 'empty' }, 'به‌زودی پروژه‌ها اینجا قرار می‌گیرن.'));
      return;
    }
    box.replaceChildren(
      ...projects.slice(0, 8).map((p) =>
        el('a', { class: 'work-card', href: 'channel.html#projects' },
          el('div', { class: 'pic' }, el('img', { src: media(p.images[0]), loading: 'lazy', alt: p.title })),
          el('h3', {}, p.title),
          p.caption ? el('p', {}, p.caption) : null)
      )
    );
  } catch {
    box.replaceChildren(el('p', { class: 'empty' }, 'بارگذاری پروژه‌ها ممکن نشد.'));
  }
}

async function loadChannel() {
  const box = $('#chat');
  try {
    const r = await fetch(API + '/api/posts');
    if (!r.ok) throw new Error();
    const { posts } = await r.json();
    if (!posts.length) {
      box.replaceChildren(el('p', { class: 'empty' }, 'هنوز پستی منتشر نشده.'));
      return;
    }
    box.replaceChildren(
      ...posts.slice(0, 3).reverse().map((p) =>
        el('article', { class: 'msg' },
          p.media_type === 'image' ? el('img', { src: media(p.media_key), loading: 'lazy', alt: '' }) : null,
          p.media_type === 'video' ? el('p', {}, 'ویدیو') : null,
          p.text ? el('p', {}, p.text) : null,
          el('time', {}, fmt.format(new Date(p.created_at))))
      )
    );
  } catch {
    box.replaceChildren(el('p', { class: 'empty' }, 'بارگذاری کانال ممکن نشد.'));
  }
}

function marquee() {
  const t = $('.marquee-track');
  t.append(...[...t.children].map((n) => n.cloneNode(true)));
}

/* ---------- شروع ---------- */
async function boot() {
  history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  $('#year').textContent = new Date().getFullYear().toLocaleString('en-US', { useGrouping: false });

  marquee();
  loadWork();
  loadChannel();

  await intro();
  if (!reduce) await playGif($('.hero-gif'), HERO_SRC, HERO_MS, [$('#hero')]);

  document.body.classList.remove('is-locked');
  document.body.classList.add('ready');
}
boot();