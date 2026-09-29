/**
 * JSango Documentation - Interactivity & ScrollSpy
 */

document.addEventListener('DOMContentLoaded', () => {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const docsSidebar = document.getElementById('docsSidebar');
  const searchInput = document.getElementById('docsSearchInput');
  const sidebarLinks = Array.from(document.querySelectorAll('.sidebar-link'));
  const tocLinks = Array.from(document.querySelectorAll('.toc-link'));
  const sidebarGroups = document.querySelectorAll('.sidebar-group');
  const activeCrumb = document.getElementById('activeCrumb');
  const searchEmpty = document.getElementById('docsSearchEmpty');

  const docsSidebarBackdrop = document.getElementById('docsSidebarBackdrop');

  // 1. Mobile Sidebar Toggle & Backdrop
  function closeSidebar() {
    if (docsSidebar) docsSidebar.classList.remove('open');
    if (docsSidebarBackdrop) docsSidebarBackdrop.classList.remove('active');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  function openSidebar() {
    if (docsSidebar) docsSidebar.classList.add('open');
    if (docsSidebarBackdrop) docsSidebarBackdrop.classList.add('active');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
  }

  if (sidebarToggle && docsSidebar) {
    sidebarToggle.addEventListener('click', () => {
      if (docsSidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (docsSidebarBackdrop) {
      docsSidebarBackdrop.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking a link on mobile
    sidebarLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          closeSidebar();
        }
      });
    });
  }

  const mobileSearchToggle = document.getElementById('mobileSearchToggle');
  const docsSearchWrapper = document.getElementById('docsSearchWrapper');
  const docsSearchCloseBtn = document.getElementById('docsSearchCloseBtn');

  // Mobile Search Toggle & Close
  function openMobileSearch() {
    if (docsSearchWrapper) {
      docsSearchWrapper.classList.add('mobile-active');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  }

  function closeMobileSearch() {
    if (docsSearchWrapper) {
      docsSearchWrapper.classList.remove('mobile-active');
    }
  }

  if (mobileSearchToggle) {
    mobileSearchToggle.addEventListener('click', openMobileSearch);
  }

  if (docsSearchCloseBtn) {
    docsSearchCloseBtn.addEventListener('click', closeMobileSearch);
  }

  // 2. Keyboard shortcut for search ('/')
  window.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, [contenteditable]');
    if (e.key === '/' && !typing) {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        openMobileSearch();
      } else if (searchInput) {
        searchInput.focus();
      }
    }
    if (e.key === 'Escape') {
      if (searchInput && document.activeElement === searchInput && searchInput.value) {
        searchInput.value = '';
        runSearch('');
      }
      closeMobileSearch();
      closeSidebar();
    }
  });

  // Each sidebar link points at a section or a sub-heading inside one.
  // Index the text of the content it points at so search matches body copy,
  // not only link titles.
  const entries = sidebarLinks
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1) || '';
      const target = document.getElementById(id);
      if (!target) return null;
      return { id, link, target, text: '' };
    })
    .filter(Boolean);

  entries.forEach((entry, i) => {
    // Content for an entry runs from its target to the next entry's target.
    const next = entries[i + 1]?.target;
    let text = entry.target.textContent || '';
    let node = entry.target.nextElementSibling;
    if (entry.target.matches('section')) {
      // A section target contains its sub-headings; stop at the first one that is its own entry.
      text = '';
      for (const child of entry.target.children) {
        if (next && child === next) break;
        text += ' ' + child.textContent;
      }
      node = null;
    }
    while (node && node !== next && !node.matches('section, hr')) {
      text += ' ' + node.textContent;
      node = node.nextElementSibling;
    }
    entry.text = (entry.link.textContent + ' ' + text).toLowerCase();
  });

  // 3. Search filter across documentation content
  function runSearch(raw) {
    const term = raw.toLowerCase().trim();
    let matches = 0;

    entries.forEach(({ link, text }) => {
      const hit = !term || text.includes(term);
      if (link.parentElement) link.parentElement.style.display = hit ? '' : 'none';
      if (hit) matches += 1;
    });

    sidebarGroups.forEach((group) => {
      const visible = group.querySelector('.sidebar-links li:not([style*="none"])');
      group.style.display = visible ? '' : 'none';
    });

    if (searchEmpty) searchEmpty.hidden = matches > 0;
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value;

      // If user is searching on mobile, ensure sidebar opens so they see matched topics
      if (term.trim().length > 0 && window.innerWidth <= 768 && docsSidebar && !docsSidebar.classList.contains('open')) {
        openSidebar();
      }

      runSearch(term);
    });

    // Enter jumps to the first match
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const first = entries.find(({ link }) => link.parentElement?.style.display !== 'none');
      if (first) {
        first.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${first.id}`);
        closeMobileSearch();
        if (window.innerWidth <= 768) closeSidebar();
      }
    });
  }

  // 4. ScrollSpy
  let currentId = '';

  function updateActiveSection() {
    if (entries.length === 0) return;
    const offset = 140;
    let index = 0;

    entries.forEach((entry, i) => {
      if (entry.target.getBoundingClientRect().top - offset <= 0) index = i;
    });

    // At the very bottom of the page, highlight the last entry.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      index = entries.length - 1;
    }

    const active = entries[index];
    if (active.id === currentId) return;
    currentId = active.id;

    sidebarLinks.forEach((link) => {
      const on = link === active.link;
      link.classList.toggle('active', on);
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });

    // The right-hand TOC only lists top-level sections; highlight the section containing the active entry.
    const section = active.target.closest('.doc-section');
    const sectionId = section?.id;
    tocLinks.forEach((link) => {
      const href = link.getAttribute('href')?.slice(1);
      link.classList.toggle('active', href === active.id || href === sectionId);
    });

    if (activeCrumb) activeCrumb.textContent = active.link.textContent;
  }

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActiveSection();
        ticking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener('resize', updateActiveSection);
  updateActiveSection();
});
