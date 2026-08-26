const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

async function loadOfficialLogo() {
  const logos = document.querySelectorAll('[data-official-logo]');
  if (!logos.length) return;
  try {
    const parts = await Promise.all(Array.from({ length: 5 }, (_, index) =>
      fetch(`assets/logo-chunks/l${index + 1}.txt?v=21`, { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('logo chunk failed');
        return r.text();
      })
    ));
    const base64 = parts.join('').replace(/\s+/g, '');
    const src = `data:image/webp;base64,${base64}`;
    logos.forEach(img => { img.src = src; });
  } catch (e) {
    console.error('Official logo loader failed; using file fallback.', e);
  }
}

async function loadSharpDonPhoto() {
  const photos = document.querySelectorAll('.hero-photo');
  if (!photos.length) return;
  try {
    const parts = await Promise.all(Array.from({ length: 7 }, (_, index) =>
      fetch(`assets/don-chunks/p${index + 1}.txt?v=21`, { cache: 'force-cache' }).then(r => {
        if (!r.ok) throw new Error('Don image chunk failed');
        return r.text();
      })
    ));
    const base64 = parts.join('').replace(/\s+/g, '');
    photos.forEach(img => { img.src = `data:image/avif;base64,${base64}`; });
  } catch (e) {
    console.error('High-quality Don photo loader failed.', e);
  }
}

async function loadArticlePhoto() {
  const photos = document.querySelectorAll('[data-article-photo]');
  if (!photos.length) return;
  try {
    const response = await fetch('assets/article-inline.b64?v=21', { cache: 'no-store' });
    if (!response.ok) throw new Error('article data failed');
    const base64 = (await response.text()).replace(/\s+/g, '');
    if (base64.length < 1000) throw new Error('article data too small');
    const src = `data:image/jpeg;base64,${base64}`;
    photos.forEach(img => { img.src = src; });
  } catch (e) {
    console.error('Article image failed to load.', e);
  }
}

loadOfficialLogo();
loadSharpDonPhoto();
loadArticlePhoto();
