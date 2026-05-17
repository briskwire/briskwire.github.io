/* ============================================================
   Briskwire — Main Script
   ============================================================ */

(function () {
  'use strict';

  // ---- DOM refs ----
  const navbar     = document.querySelector('.navbar');
  const navToggle  = document.querySelector('.nav-toggle');
  const navLinks   = document.querySelector('.nav-links');
  const navOverlay = document.querySelector('.nav-overlay');

  // ============================================================
  // 1. SMOOTH SCROLL
  // ============================================================
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ============================================================
  // 2. NAVBAR — scroll shadow + mobile menu
  // ============================================================
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  function closeMenu() {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  function openMenu() {
    navLinks.classList.add('open');
    navToggle.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    const first = navLinks.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.contains('open') ? closeMenu() : openMenu();
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => { if (navLinks.classList.contains('open')) closeMenu(); });
    });

    document.addEventListener('click', e => {
      if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !navToggle.contains(e.target)) closeMenu();
    });

    if (navOverlay) navOverlay.addEventListener('click', closeMenu);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) closeMenu();
      if (e.key === 'Tab' && navLinks.classList.contains('open')) {
        const items = navLinks.querySelectorAll('a');
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024 && navLinks.classList.contains('open')) closeMenu();
    });
  }

  // ============================================================
  // 3. SCROLL ANIMATIONS — fade-in-up via IntersectionObserver
  // ============================================================
  const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  function observeFadeElements() {
    document.querySelectorAll('.fade-in-up').forEach(el => fadeObserver.observe(el));
  }

  // ============================================================
  // 4. SCREENSHOTS — build from index.txt, lightbox
  // ============================================================
  let screenshotItems = [];

  async function buildScreenshots() {
    const grid = document.querySelector('.screenshots-grid');
    if (!grid) return;

    try {
      const resp = await fetch('screenshots/index.txt');
      if (!resp.ok) throw new Error('no-index');
      const text = await resp.text();
      // Lines starting with '#' become group headers; other non-empty lines are screenshots.
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const entries = lines.map(l => l.startsWith('#')
        ? { kind: 'group', label: l.replace(/^#+\s*/, '') }
        : { kind: 'shot',  name: l });
      if (!entries.some(e => e.kind === 'shot')) throw new Error('empty');

      grid.innerHTML = '';
      entries.forEach(entry => {
        if (entry.kind === 'group') {
          const header = document.createElement('h3');
          header.className = 'screenshots-group-header';
          header.textContent = entry.label;
          grid.appendChild(header);
          return;
        }
        const name = entry.name;
        const item = document.createElement('div');
        item.className = 'screenshot-item fade-in-up';
        item.dataset.screenshot = `screenshots/${name}.png`;
        item.dataset.descriptionMd = `screenshots/${name}.md`;

        const img = document.createElement('img');
        img.src = `screenshots/${name}.png`;
        img.alt = 'Briskwire Screenshot';
        img.className = 'screenshot-img';
        img.loading = 'lazy';

        const desc = document.createElement('div');
        desc.className = 'screenshot-description loading';

        item.appendChild(img);
        item.appendChild(desc);
        grid.appendChild(item);
      });

      screenshotItems = Array.from(grid.querySelectorAll('.screenshot-item'));
      loadDescriptions();
      initLightbox();
      observeFadeElements();
    } catch {
      grid.innerHTML = '<div class="screenshots-empty">Screenshots coming soon — Briskwire is in active development.</div>';
    }
  }

  async function loadDescriptions() {
    const items = document.querySelectorAll('.screenshot-item[data-description-md]');
    await Promise.all(Array.from(items).map(async item => {
      const mdPath = item.dataset.descriptionMd;
      const div = item.querySelector('.screenshot-description');
      if (!mdPath || !div) return;
      try {
        const r = await fetch(mdPath);
        if (!r.ok) throw new Error();
        const md = await r.text();
        const lines = md.split('\n').map(l => l.trim()).filter(Boolean);
        const titleIdx = lines.findIndex(l => l.startsWith('#'));
        let text = '';
        if (titleIdx >= 0 && lines.length > titleIdx + 1) {
          text = lines.slice(titleIdx + 1).join(' ').trim();
        }
        if (!text && lines.length) text = lines[0].replace(/^#\s*/, '').trim();
        if (text) { div.textContent = text; } else { div.remove(); }
      } catch {
        div.remove();
      }
    }));
  }

  // ---- Lightbox ----
  const modal         = document.getElementById('screenshot-modal');
  const modalImg      = document.getElementById('screenshot-modal-img');
  const modalDesc     = document.getElementById('screenshot-modal-description');
  const closeBtn      = document.querySelector('.screenshot-modal-close');
  const prevBtn       = document.getElementById('screenshot-modal-prev');
  const nextBtn       = document.getElementById('screenshot-modal-next');
  let currentIdx = -1;

  function openLightbox(idx) {
    if (idx < 0 || idx >= screenshotItems.length) return;
    currentIdx = idx;
    const item = screenshotItems[idx];
    const src  = item.dataset.screenshot;
    if (!src) return;

    modalImg.src = src;

    const descDiv = item.querySelector('.screenshot-description');
    modalDesc.textContent = (descDiv && descDiv.textContent.trim()) ? descDiv.textContent : '';

    prevBtn.style.display = idx > 0 ? 'flex' : 'none';
    nextBtn.style.display = idx < screenshotItems.length - 1 ? 'flex' : 'none';

    document.body.style.overflow = 'hidden';
    modal.classList.add('show');
    closeBtn.focus();
  }

  function closeLightbox() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    const section = document.getElementById('screenshots');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initLightbox() {
    screenshotItems.forEach((item, i) => {
      item.addEventListener('click', () => openLightbox(i));
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });
  if (modalImg) modalImg.addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });
  if (modal) modal.addEventListener('click', e => {
    if (e.target === modal || e.target.classList.contains('screenshot-modal-container')) closeLightbox();
  });
  const topbar = document.querySelector('.screenshot-modal-topbar');
  if (topbar) topbar.addEventListener('click', e => e.stopPropagation());

  if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); if (currentIdx > 0) openLightbox(currentIdx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); if (currentIdx < screenshotItems.length - 1) openLightbox(currentIdx + 1); });

  document.addEventListener('keydown', e => {
    if (!modal || !modal.classList.contains('show')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft' && currentIdx > 0) openLightbox(currentIdx - 1);
    else if (e.key === 'ArrowRight' && currentIdx < screenshotItems.length - 1) openLightbox(currentIdx + 1);
  });

  // ============================================================
  // 5. YOUTUBE HELPERS & VIDEO MODAL
  // ============================================================
  function extractPlaylistId(url) {
    if (!url) return null;
    const m = url.match(/[?&]list=([^&]+)/);
    return m ? m[1] : null;
  }

  function youtubeEmbedUrl(url) {
    const pid = extractPlaylistId(url);
    if (pid) return `https://www.youtube.com/embed/videoseries?list=${pid}`;
    return null;
  }

  const videoModal   = document.getElementById('video-modal');
  const videoIframe  = document.getElementById('video-modal-iframe');
  const videoTitle   = document.getElementById('video-modal-title');
  const videoCloseBtn = document.getElementById('video-modal-close');
  const videoBackdrop = videoModal ? videoModal.querySelector('.video-modal-backdrop') : null;

  function openVideoModal(url, title) {
    const embed = youtubeEmbedUrl(url);
    if (!embed || !videoModal) return;
    videoIframe.src = embed;
    videoTitle.textContent = title || '';
    document.body.style.overflow = 'hidden';
    videoModal.classList.add('show');
    videoCloseBtn.focus();
  }

  function closeVideoModal() {
    if (!videoModal) return;
    videoModal.classList.remove('show');
    document.body.style.overflow = '';
    videoIframe.src = '';
  }

  if (videoCloseBtn) videoCloseBtn.addEventListener('click', closeVideoModal);
  if (videoBackdrop) videoBackdrop.addEventListener('click', closeVideoModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && videoModal && videoModal.classList.contains('show')) closeVideoModal();
  });

  // ============================================================
  // 6. RELEASE NOTES — load from index.txt
  // ============================================================
  async function loadReleaseNotes() {
    const container = document.getElementById('release-notes-container');
    if (!container || container.dataset.loaded === 'true') return;

    try {
      const indexResp = await fetch('release_notes/index.txt');
      if (!indexResp.ok) throw new Error('No index');
      const indexText = await indexResp.text();
      const files = indexText.split('\n').map(l => l.trim()).filter(l => l.endsWith('.txt'))
        .map(l => l.startsWith('release_notes/') ? l : `release_notes/${l}`);

      if (!files.length) {
        container.innerHTML = '<div class="release-notes-loading">Release notes will appear here once Briskwire hits the Play Store.</div>';
        return;
      }

      const notes = (await Promise.all(files.map(async fp => {
        try {
          const r = await fetch(fp);
          if (!r.ok) return null;
          const content = await r.text();
          const m = fp.match(/(\d+\.\d+\.\d+)/);
          return { version: m ? m[1] : 'Unknown', content, filePath: fp };
        } catch { return null; }
      }))).filter(Boolean);

      if (!notes.length) {
        container.innerHTML = '<div class="release-notes-loading">Release notes will appear here once Briskwire hits the Play Store.</div>';
        return;
      }

      notes.sort((a, b) => {
        const pa = a.version.split('.').map(Number), pb = b.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) { if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0); }
        return 0;
      });

      const enriched = await Promise.all(notes.map(async note => {
        const ytPaths = [
          `release_notes/Youtube_Tutorial_Link_${note.version}.txt`,
          `local/release_notes/Youtube_Tutorial_Link_${note.version}.txt`
        ];
        let youtubeLink = null;
        for (const p of ytPaths) {
          try { const r = await fetch(p); if (r.ok) { const t = (await r.text()).trim(); if (t) { youtubeLink = t; break; } } } catch {}
        }
        return { ...note, youtubeLink };
      }));

      container.innerHTML = enriched.map((note, i) => renderNote(note, i === 0)).join('');
      container.dataset.loaded = 'true';

      container.querySelectorAll('.release-note-header').forEach(header => {
        header.addEventListener('click', e => {
          const ytBtn = e.target.closest('.youtube-logo-link-release-notes');
          if (ytBtn) {
            e.stopPropagation();
            const url = ytBtn.dataset.youtube;
            const ver = ytBtn.dataset.version;
            if (url) openVideoModal(url, `Tutorial — Version ${ver}`);
            return;
          }
          header.closest('.release-note-item').classList.toggle('open');
        });
      });

      container.querySelectorAll('.release-note-item').forEach(el => {
        el.classList.add('fade-in-up');
        fadeObserver.observe(el);
      });

    } catch {
      container.innerHTML = '<div class="release-notes-loading">Release notes will appear here once Briskwire hits the Play Store.</div>';
    }
  }

  function parseNote(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const sections = { 'New Features': [], 'Bug Fixes': [], 'Improvements': [] };
    let current = null;
    for (const line of lines) {
      if (line === 'New Features:') current = 'New Features';
      else if (line === 'Bug Fixes:') current = 'Bug Fixes';
      else if (line === 'Improvements:') current = 'Improvements';
      else if (current && line.startsWith('\u2022')) sections[current].push(line.substring(1).trim());
      else if (current && sections[current].length) sections[current][sections[current].length - 1] += ' ' + line;
    }
    return sections;
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function renderNote(note, defaultOpen) {
    const sections = parseNote(note.content);
    const hasContent = Object.values(sections).some(a => a.length > 0);
    if (!hasContent) return '';

    const openClass = defaultOpen ? ' open' : '';
    let html = `<div class="release-note-item${openClass}">`;
    html += `<div class="release-note-header">`;
    html += `<div class="release-note-version">Version ${escapeHtml(note.version)}</div>`;
    if (note.youtubeLink) {
      html += `<button class="youtube-logo-link-release-notes" data-youtube="${escapeHtml(note.youtubeLink)}" data-version="${escapeHtml(note.version)}" aria-label="Watch Tutorial" type="button">`;
      html += `<img src="icons/WatchonYouTube-black-SVG.svg" alt="Watch on YouTube" class="youtube-logo-release-notes">`;
      html += `</button>`;
    }
    html += `</div>`;
    html += `<div class="release-note-content">`;

    const order = ['New Features', 'Bug Fixes', 'Improvements'];
    order.forEach(key => {
      if (sections[key].length) {
        const cls = key.toLowerCase().replace(/\s+/g, '-');
        html += `<h4 data-section="${cls}">${key}</h4><ul>`;
        sections[key].forEach(item => { html += `<li>${escapeHtml(item)}</li>`; });
        html += `</ul>`;
      }
    });

    html += `</div></div>`;
    return html;
  }

  const rnSection = document.getElementById('release-notes');
  if (rnSection) {
    const rnObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadReleaseNotes();
        rnObserver.unobserve(rnSection);
      }
    }, { rootMargin: '200px' });
    rnObserver.observe(rnSection);
  }

  // ============================================================
  // 7. INIT
  // ============================================================
  document.addEventListener('DOMContentLoaded', async () => {
    await buildScreenshots();
    observeFadeElements();
  });

})();
