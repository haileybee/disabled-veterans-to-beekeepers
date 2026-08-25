const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

async function loadOfficialLogo() {
  const logos = document.querySelectorAll('[data-official-logo]');
  if (!logos.length) return;

  try {
    const parts = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        fetch(`assets/logo-chunks/l${index + 1}.txt?v=13`, { cache: 'no-cache' })
          .then(response => {
            if (!response.ok) throw new Error(`Logo chunk ${index + 1} failed`);
            return response.text();
          })
      )
    );

    const base64 = parts.join('').replace(/\s+/g, '');
    const officialLogo = `data:image/webp;base64,${base64}`;

    logos.forEach(logo => {
      logo.src = officialLogo;
      logo.removeAttribute('width');
      logo.removeAttribute('height');
    });
  } catch (error) {
    console.error('Could not load the official logo.', error);
  }
}

async function loadSharpDonPhoto() {
  const photos = document.querySelectorAll('.hero-photo, .story-photo');
  if (!photos.length) return;

  try {
    const parts = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        fetch(`assets/don-chunks/p${index + 1}.txt?v=8`, { cache: 'force-cache' })
          .then(response => {
            if (!response.ok) throw new Error(`Image chunk ${index + 1} failed`);
            return response.text();
          })
      )
    );

    const base64 = parts.join('').replace(/\s+/g, '');
    const sharpPhoto = `data:image/avif;base64,${base64}`;

    photos.forEach(photo => {
      photo.src = sharpPhoto;
      photo.classList.add('sharp-photo-loaded');
    });
  } catch (error) {
    console.error('Could not load the high-quality Don photo.', error);
  }
}

function addFacebookLink() {
  const contact = document.querySelector('#contact .contact-grid > div');
  if (!contact || contact.querySelector('[data-facebook-link]')) return;

  const row = document.createElement('p');
  row.innerHTML = '<a class="outline-button" data-facebook-link href="https://www.facebook.com/share/193j78B3PP/" target="_blank" rel="noopener noreferrer">Follow us on Facebook <span>🐝</span></a>';
  contact.appendChild(row);
}

loadOfficialLogo();
loadSharpDonPhoto();
addFacebookLink();
