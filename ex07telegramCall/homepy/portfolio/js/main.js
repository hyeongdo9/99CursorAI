/**
 * Portfolio — Main JavaScript
 * Navigation, scroll spy, Notes board, Contact form
 */

/* ---------- Notes Data ---------- */
const NOTES_DATA = [
  {
    id: 8,
    title: 'React 19 새 기능 정리',
    category: 'article',
    categoryLabel: '글',
    date: '2026-08-15',
    url: 'https://yourusername.github.io/blog/react-19',
  },
  {
    id: 7,
    title: 'TypeScript 고급 타입 패턴',
    category: 'article',
    categoryLabel: '글',
    date: '2026-08-10',
    url: 'https://yourusername.github.io/blog/ts-advanced',
  },
  {
    id: 6,
    title: '웹 개발 기초 — HTML/CSS/JS',
    category: 'lecture',
    categoryLabel: '수업 자료',
    date: '2026-07-28',
    url: 'https://yourusername.github.io/lectures/web-basics',
  },
  {
    id: 5,
    title: 'Node.js REST API 설계',
    category: 'lecture',
    categoryLabel: '수업 자료',
    date: '2026-07-20',
    url: 'https://yourusername.github.io/lectures/nodejs-api',
  },
  {
    id: 4,
    title: 'Portfolio Site (GitHub Pages)',
    category: 'github-pages',
    categoryLabel: 'GitHub Pages',
    date: '2026-07-01',
    url: 'https://yourusername.github.io',
  },
  {
    id: 3,
    title: 'Algorithm Study Notes',
    category: 'github-pages',
    categoryLabel: 'GitHub Pages',
    date: '2026-06-15',
    url: 'https://yourusername.github.io/algo-notes',
  },
  {
    id: 2,
    title: 'Docker 컨테이너 입문',
    category: 'article',
    categoryLabel: '글',
    date: '2026-06-01',
    url: 'https://yourusername.github.io/blog/docker-intro',
  },
  {
    id: 1,
    title: 'Git & GitHub 협업 워크플로우',
    category: 'lecture',
    categoryLabel: '수업 자료',
    date: '2026-05-20',
    url: 'https://yourusername.github.io/lectures/git-workflow',
  },
];

const CATEGORY_CLASS_MAP = {
  article: 'category-badge--article',
  lecture: 'category-badge--lecture',
  'github-pages': 'category-badge--github-pages',
};

/* ---------- DOM Elements ---------- */
const header = document.getElementById('header');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav__link');
const sections = document.querySelectorAll('.section, .hero');
const notesBody = document.getElementById('notesBody');
const notesFilters = document.getElementById('notesFilters');
const notesSearch = document.getElementById('notesSearch');
const notesEmpty = document.getElementById('notesEmpty');
const notesTable = document.getElementById('notesTable');
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');
const resumeBtn = document.getElementById('resumeBtn');

/* ---------- Navigation ---------- */
function toggleMobileMenu() {
  const isOpen = navMenu.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', isOpen);
  navToggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
}

function closeMobileMenu() {
  navMenu.classList.remove('open');
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-label', '메뉴 열기');
}

navToggle.addEventListener('click', toggleMobileMenu);

navLinks.forEach((link) => {
  link.addEventListener('click', () => closeMobileMenu());
});

/* ---------- Scroll: Header shadow & Active nav ---------- */
function onScroll() {
  header.classList.toggle('scrolled', window.scrollY > 20);
  updateActiveNav();
}

function updateActiveNav() {
  let current = 'home';

  sections.forEach((section) => {
    const top = section.offsetTop - 100;
    const height = section.offsetHeight;
    if (window.scrollY >= top && window.scrollY < top + height) {
      current = section.id;
    }
  });

  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- Notes Board ---------- */
let activeFilter = 'all';
let searchQuery = '';

function renderNotes() {
  const filtered = NOTES_DATA.filter((note) => {
    const matchCategory = activeFilter === 'all' || note.category === activeFilter;
    const matchSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  notesBody.innerHTML = filtered
    .map(
      (note) => `
      <tr>
        <td class="col-no">${note.id}</td>
        <td class="col-title">
          <a href="${note.url}" target="_blank" rel="noopener noreferrer">${note.title}</a>
        </td>
        <td class="col-category">
          <span class="category-badge ${CATEGORY_CLASS_MAP[note.category]}">${note.categoryLabel}</span>
        </td>
        <td class="col-date">${note.date}</td>
        <td class="col-link">
          <a href="${note.url}" target="_blank" rel="noopener noreferrer" class="link-icon" aria-label="링크 열기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </td>
      </tr>
    `
    )
    .join('');

  const isEmpty = filtered.length === 0;
  notesEmpty.classList.toggle('hidden', !isEmpty);
  notesTable.classList.toggle('hidden', isEmpty);
}

notesFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.notes__filter');
  if (!btn) return;

  notesFilters.querySelectorAll('.notes__filter').forEach((f) => f.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderNotes();
});

notesSearch.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  renderNotes();
});

/* ---------- Contact Form ---------- */
contactForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = contactForm.name.value.trim();
  const email = contactForm.email.value.trim();
  const message = contactForm.message.value.trim();

  if (!name || !email || !message) {
    showFormStatus('모든 필드를 입력해 주세요.', true);
    return;
  }

  // Demo: 실제 전송은 React/API 연동 시 구현
  showFormStatus('메시지가 전송되었습니다. 감사합니다!');
  contactForm.reset();

  setTimeout(() => {
    formStatus.classList.add('hidden');
  }, 4000);
});

function showFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.remove('hidden', 'error');
  if (isError) formStatus.classList.add('error');
}

/* ---------- Resume Button (placeholder) ---------- */
resumeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  alert('이력서 PDF 파일 경로를 resumeBtn href에 연결해 주세요.\n예: href="assets/resume.pdf"');
});

/* ---------- Inception Parallax ---------- */
const parallaxLayers = document.querySelectorAll('[data-depth]');
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

function updateParallax() {
  targetX += (mouseX - targetX) * 0.06;
  targetY += (mouseY - targetY) * 0.06;

  const scrollY = window.scrollY;

  parallaxLayers.forEach((layer) => {
    const depth = parseFloat(layer.dataset.depth) || 0.5;
    const offsetX = targetX * depth * 30;
    const offsetY = scrollY * depth * 0.35 + targetY * depth * 20;

    if (layer.classList.contains('perspective-grid')) {
      layer.style.transform = `perspective(500px) rotateX(72deg) translate3d(${offsetX}px, ${offsetY * 0.5}px, 0)`;
    } else {
      layer.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
    }
  });

  requestAnimationFrame(updateParallax);
}

document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderNotes();
  onScroll();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (parallaxLayers.length && !prefersReducedMotion) {
    requestAnimationFrame(updateParallax);
  }
});
