/**
 * JSango Documentation - Interactivity & ScrollSpy
 */

document.addEventListener('DOMContentLoaded', () => {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const docsSidebar = document.getElementById('docsSidebar');
  const searchInput = document.getElementById('docsSearchInput');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const tocLinks = document.querySelectorAll('.toc-link');
  const sections = document.querySelectorAll('.doc-section');
  const activeCrumb = document.getElementById('activeCrumb');

  // 1. Mobile Sidebar Toggle
  if (sidebarToggle && docsSidebar) {
    sidebarToggle.addEventListener('click', () => {
      docsSidebar.classList.toggle('open');
    });

    // Close sidebar when clicking a link on mobile
    sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          docsSidebar.classList.remove('open');
        }
      });
    });
  }

  // 2. Keyboard shortcut for search ('/')
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });

  // 3. Search Filter across documentation sections and sidebar links
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();

      sidebarLinks.forEach(link => {
        const text = link.textContent.toLowerCase();
        const parentLi = link.parentElement;
        if (text.includes(term)) {
          if (parentLi) parentLi.style.display = 'block';
        } else {
          if (parentLi) parentLi.style.display = 'none';
        }
      });
    });
  }

  // 4. ScrollSpy
  function updateActiveSection() {
    let currentId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    if (!currentId && sections.length > 0) {
      currentId = sections[0].getAttribute('id');
    }

    if (currentId) {
      // Update sidebar
      sidebarLinks.forEach(link => {
        const href = link.getAttribute('href')?.substring(1);
        if (href === currentId) {
          link.classList.add('active');
          if (activeCrumb) activeCrumb.textContent = link.textContent;
        } else {
          link.classList.remove('active');
        }
      });

      // Update right TOC
      tocLinks.forEach(link => {
        const href = link.getAttribute('href')?.substring(1);
        if (href === currentId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
  }

  // 5. Dynamic npm version loader
  async function fetchLiveVersion() {
    try {
      const res = await fetch('https://registry.npmjs.org/jsango/latest');
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          const vStr = `v${data.version}`;
          document.querySelectorAll('.brand-badge, .jsango-version-badge').forEach((el) => {
            el.textContent = vStr;
          });
        }
      }
    } catch {
      // Fallback
    }
  }
  fetchLiveVersion();
});
