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

    // The grid is pre-rendered in index.html (static markup for crawlers and
    // no-JS visitors). When it is present, just wire up the lightbox and skip
    // the fetch-based build below, which remains as a fallback.
    const preRendered = Array.from(grid.querySelectorAll('.screenshot-item'));
    if (preRendered.length) {
      screenshotItems = preRendered;
      initLightbox();
      return;
    }

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
  // 6b. DESKTOP RELEASES — downloads/desktop-releases.json + GitHub
  // ============================================================
  // Two sources, merged by version:
  //  - downloads/desktop-releases.json, written by the release pipeline
  //    after it has checked GitHub's signature on the checksum commit. Only
  //    these entries get the "Verified" line.
  //  - the public repo's releases from api.github.com, so a release the
  //    manifest does not list yet still shows, with GitHub's own SHA-256 per
  //    file. When both list a file and the hashes differ, the release is
  //    flagged and its download buttons are withheld.
  // Built with DOM nodes, not HTML strings, and every URL, hash and key ID
  // is checked before use: a link on this page is a download someone will
  // install.
  const DESKTOP_REPO = 'https://github.com/briskwire/briskwire-releases';
  const DESKTOP_API = 'https://api.github.com/repos/briskwire/briskwire-releases/releases?per_page=30';
  const DESKTOP_FORMATS = {
    'deb': { label: '.deb', hint: 'Ubuntu, Debian, Mint' },
    'rpm': { label: '.rpm', hint: 'Fedora, openSUSE' },
    'tar.gz': { label: '.tar.gz', hint: 'Portable, any distro' }
  };

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v; else node.setAttribute(k, v);
    });
    children.flat().forEach(c => { if (c != null) node.append(c); });
    return node;
  }

  const isRepoUrl = u => typeof u === 'string' && u.startsWith(DESKTOP_REPO + '/');
  const isSha256 = h => /^[0-9a-f]{64}$/.test(h || '');
  const isKeyId = k => /^[0-9A-F]{16}$/.test(k || '');

  function formatSize(bytes) {
    if (!(bytes > 0)) return '';
    return bytes >= 1048576 ? `${Math.round(bytes / 1048576)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function formatDate(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function copyButton(text, label) {
    const btn = el('button', { type: 'button', class: 'desktop-copy', 'aria-label': `Copy ${label}` }, 'Copy');
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
      catch { btn.textContent = 'Select it'; }
      setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
    });
    return btn;
  }

  function formatOf(name) {
    if (name.endsWith('.deb')) return 'deb';
    if (name.endsWith('.rpm')) return 'rpm';
    if (name.endsWith('.tar.gz')) return 'tar.gz';
    if (name.endsWith('.cdx.json')) return 'sbom';
    return null;
  }

  // One GitHub API release in the manifest's shape. `digest` is GitHub's own
  // "sha256:<hex>" for each uploaded file; a file without one is skipped
  // rather than shown with no checksum.
  function fromGitHub(r) {
    const m = /^v(\d+\.\d+\.\d+)$/.exec(r.tag_name || '');
    if (!m || r.draft || r.prerelease) return null;
    const files = r.assets || [];
    const sums = files.find(a => a.name === 'SHA256SUMS-desktop.txt');
    return {
      version: m[1], tag: r.tag_name, date: (r.published_at || '').slice(0, 10),
      release_url: r.html_url, sums_url: sums && sums.browser_download_url,
      source: 'github',
      assets: files.map(a => ({
        format: formatOf(a.name || ''), name: a.name, size: a.size,
        sha256: /^sha256:([0-9a-f]{64})$/.exec(a.digest || '')?.[1], url: a.browser_download_url
      })).filter(a => a.format && a.sha256)
    };
  }

  // Manifest entries win: they carry the checked signature. A GitHub-only
  // version is added as it is. Where both list a file, the hashes must agree.
  function mergeReleases(signed, github) {
    const byVersion = new Map();
    github.forEach(r => byVersion.set(r.version, r));
    signed.forEach(r => {
      const gh = byVersion.get(r.version);
      const mismatch = !!gh && (r.assets || []).some(a => {
        const other = gh.assets.find(b => b.name === a.name);
        return other && other.sha256 !== a.sha256;
      });
      byVersion.set(r.version, { ...r, release_url: r.release_url || gh?.release_url, mismatch });
    });
    const key = v => v.split('.').map(Number);
    return [...byVersion.values()].sort((a, b) => {
      const pa = key(a.version), pb = key(b.version);
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
      return 0;
    });
  }

  function renderDesktopBody(rel) {
    const assets = (rel.assets || []).filter(a => isRepoUrl(a.url) && isSha256(a.sha256));
    const body = el('div', { class: 'desktop-release-body' });

    if (rel.mismatch) {
      body.append(el('p', { class: 'desktop-warn', role: 'alert' },
        'Do not install this version: a file on GitHub does not match the signed checksum list. Please report it to ',
        el('a', { href: 'mailto:briskwire@gmail.com?subject=Security%3A%20checksum%20mismatch' }, 'briskwire@gmail.com'), '.'));
      return body;
    }

    body.append(el('div', { class: 'desktop-dl-buttons' },
      assets.filter(a => DESKTOP_FORMATS[a.format]).map(a =>
        el('a', { class: 'desktop-dl-btn', href: a.url, rel: 'noopener' },
          el('span', { class: 'desktop-dl-label' }, DESKTOP_FORMATS[a.format].label),
          el('span', { class: 'desktop-dl-hint' }, [DESKTOP_FORMATS[a.format].hint, formatSize(a.size)].filter(Boolean).join(' · '))))));

    body.append(el('ul', { class: 'desktop-sums', 'aria-label': `SHA-256 checksums, version ${rel.version}` },
      assets.map(a => el('li', null,
        el('span', { class: 'desktop-sum-name' }, a.name),
        el('code', { class: 'desktop-sum-hash' }, a.sha256),
        copyButton(a.sha256, `SHA-256 of ${a.name}`)))));

    const sig = rel.signature || {};
    if (rel.source === 'github') {
      body.append(el('p', { class: 'desktop-links' },
        'Checksums from GitHub. This release is not yet in the signed list; verify it with the steps below.'));
    } else if (sig.verified === true && isKeyId(sig.key_id) && isRepoUrl(sig.commit_url)) {
      body.append(el('p', { class: 'desktop-sig' },
        el('span', { class: 'desktop-sig-mark', 'aria-hidden': 'true' }, '\u2713'),
        el('span', null,
          'Verified: the checksum list is in a ',
          el('a', { href: sig.commit_url, rel: 'noopener' }, 'commit signed by GitHub'),
          ', GPG key ID ', el('code', null, sig.key_id), '.')));
    }

    const links = [];
    if (isRepoUrl(rel.sums_url)) links.push(el('a', { href: rel.sums_url, rel: 'noopener' }, 'SHA256SUMS-desktop.txt'));
    const sbom = assets.find(a => a.format === 'sbom');
    if (sbom) links.push(el('a', { href: sbom.url, rel: 'noopener' }, 'SBOM (CycloneDX)'));
    if (isRepoUrl(rel.release_url)) links.push(el('a', { href: rel.release_url, rel: 'noopener' }, 'This release on GitHub'));
    if (links.length) {
      body.append(el('p', { class: 'desktop-links' }, links.flatMap((l, i) => i ? [' · ', l] : [l])));
    }
    return body;
  }

  function renderVerifyHelp(tag) {
    const cmds = [
      'sha256sum -c SHA256SUMS-desktop.txt --ignore-missing',
      `git clone ${DESKTOP_REPO}.git && cd briskwire-releases`,
      'curl -s https://github.com/web-flow.gpg | gpg --import',
      `git verify-commit ${tag}`
    ].join('\n');
    return el('details', { class: 'desktop-verify' },
      el('summary', null, 'How to verify a download'),
      el('pre', null, el('code', null, cmds)),
      el('p', null,
        'The first line checks your files against the list. The rest checks that GitHub signed the commit holding that list, with its ',
        el('a', { href: 'https://github.com/web-flow.gpg', rel: 'noopener' }, 'web-flow key'),
        '. Together they show the files are the ones the Briskwire™ release bot published, unchanged since. They do not show which build produced them.'));
  }

  async function loadDesktopReleases() {
    const container = document.getElementById('desktop-releases-container');
    if (!container || container.dataset.loaded === 'true') return;
    const fallback = () => {
      container.replaceChildren(el('div', { class: 'release-notes-loading' },
        'Desktop downloads: ', el('a', { href: `${DESKTOP_REPO}/releases`, rel: 'noopener' }, 'github.com/briskwire/briskwire-releases')));
    };
    try {
      const getJson = async (url, opts) => { const r = await fetch(url, opts); if (!r.ok) throw new Error(url); return r.json(); };
      const [signedRes, githubRes] = await Promise.allSettled([
        getJson('downloads/desktop-releases.json', { cache: 'no-cache' }),
        getJson(DESKTOP_API, { headers: { Accept: 'application/vnd.github+json' } })
      ]);
      const valid = r => r && /^\d+\.\d+\.\d+$/.test(r.version || '');
      const signed = signedRes.status === 'fulfilled' ? (signedRes.value.releases || []).filter(valid) : [];
      const github = githubRes.status === 'fulfilled' && Array.isArray(githubRes.value)
        ? githubRes.value.map(fromGitHub).filter(valid) : [];
      const releases = mergeReleases(signed, github).filter(r => (r.assets || []).length);
      if (!releases.length) { fallback(); return; }

      const [latest, ...older] = releases;
      const card = el('div', { class: 'desktop-release latest' },
        el('div', { class: 'desktop-release-head' },
          el('span', { class: 'release-note-version' }, `Version ${latest.version}`),
          el('span', { class: 'desktop-release-date' }, formatDate(latest.date))),
        renderDesktopBody(latest),
        latest.mismatch ? null : renderVerifyHelp(latest.tag || `v${latest.version}`));
      const nodes = [card];

      if (older.length) {
        nodes.push(el('h4', { class: 'desktop-older-title' }, 'Earlier versions'));
        older.forEach(rel => {
          const header = el('div', { class: 'release-note-header', role: 'button', tabindex: '0', 'aria-expanded': 'false' },
            el('div', { class: 'release-note-version' }, `Version ${rel.version}`),
            el('span', { class: 'desktop-release-date' }, formatDate(rel.date)));
          const item = el('div', { class: 'release-note-item' }, header,
            el('div', { class: 'release-note-content' }, renderDesktopBody(rel)));
          const toggle = () => header.setAttribute('aria-expanded', String(item.classList.toggle('open')));
          header.addEventListener('click', toggle);
          header.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
          nodes.push(item);
        });
      }
      container.replaceChildren(...nodes);
      container.dataset.loaded = 'true';
    } catch {
      fallback();
    }
  }

  const dlSection = document.getElementById('download');
  if (dlSection) {
    const dlObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadDesktopReleases();
        dlObserver.unobserve(dlSection);
      }
    }, { rootMargin: '200px' });
    dlObserver.observe(dlSection);
  }

  // ============================================================
  // 7. INIT
  // ============================================================
  document.addEventListener('DOMContentLoaded', async () => {
    await buildScreenshots();
    observeFadeElements();
  });

})();
