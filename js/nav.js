// nav.js — mobile menu toggle + scroll shadow
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
const nav       = document.getElementById('nav');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// Close menu on link click
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Scroll shadow
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    nav.style.boxShadow = '0 1px 24px rgba(0,0,0,0.06)';
  } else {
    nav.style.boxShadow = 'none';
  }
}, { passive: true });
