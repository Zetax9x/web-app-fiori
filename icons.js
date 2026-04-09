/**
 * FIORI - Web App per Onoranze Funebri
 * Icons & Assets Module
 *
 * SVG inline icons using a simple sprite system.
 * Usage: Icons.render('flower') returns an <svg> element.
 * Or use Icons.html('flower') for innerHTML assignment.
 */

const Icons = (() => {
  // ─── SVG Sprite Definitions ───────────────────────────────────────────────
  const defs = {

    // Navigation & UI
    menu: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,

    close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,

    back: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,

    chevron_right: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,

    chevron_down: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,

    plus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,

    edit: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,

    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,

    search: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,

    filter: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,

    more_vertical: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,

    // Status & Feedback
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,

    check_circle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,

    alert_circle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,

    info: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,

    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

    // Domain: Defunto / Flower types
    person: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,

    users: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,

    // Flower - custom decorative SVG
    flower: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="6.5" rx="2" ry="3.5"/><ellipse cx="12" cy="17.5" rx="2" ry="3.5"/><ellipse cx="6.5" cy="12" rx="3.5" ry="2"/><ellipse cx="17.5" cy="12" rx="3.5" ry="2"/><ellipse cx="8.1" cy="8.1" rx="2" ry="3.5" transform="rotate(-45 8.1 8.1)"/><ellipse cx="15.9" cy="15.9" rx="2" ry="3.5" transform="rotate(-45 15.9 15.9)"/><ellipse cx="15.9" cy="8.1" rx="2" ry="3.5" transform="rotate(45 15.9 8.1)"/><ellipse cx="8.1" cy="15.9" rx="2" ry="3.5" transform="rotate(45 8.1 15.9)"/></svg>`,

    // Casket cover (copricassa) - simplified rectangle with decoration
    copricassa: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M8 6C8 4.5 9 3 12 3s4 1.5 4 3"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/><circle cx="12" cy="12" r="1.5"/></svg>`,

    // Cushion (cuscino)
    cuscino: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8c0-1.1.9-2 2-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><path d="M4 12c4-3 12-3 16 0"/><circle cx="12" cy="12" r="2"/></svg>`,

    // Bouquet (mazzo)
    mazzo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M9 15c-3-1-5-4-4-7 1-2 3-2 5-1"/><path d="M15 15c3-1 5-4 4-7-1-2-3-2-5-1"/><path d="M12 8c0-3 1-5 0-7-1 2-2 4 0 7z"/><path d="M8 15h8"/></svg>`,

    // Crown/wreath (corona)
    corona: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 5a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/><path d="M19 9a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/><path d="M5 9a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/></svg>`,

    // Composition (composizione) - abstract arrangement
    composizione: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><circle cx="7" cy="15" r="2.5"/><circle cx="17" cy="15" r="2.5"/><line x1="12" y1="11" x2="9" y2="13"/><line x1="12" y1="11" x2="15" y2="13"/></svg>`,

    // Other (altro)
    altro: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,

    // Finance
    euro: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 00-5.2-2A7.9 7.9 0 006 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/></svg>`,

    receipt: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>`,

    // Misc
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,

    archive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,

    list: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,

    home: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  };

  // ─── Tipo Fiore Emoji Map ──────────────────────────────────────────────────
  const tipoEmoji = {
    copricassa:   '⚘',
    cuscino:      '🌸',
    mazzo:        '💐',
    corona:       '🌿',
    composizione: '🌺',
    altro:        '✿',
  };

  const tipoLabel = {
    copricassa:   'Copricassa',
    cuscino:      'Cuscino',
    mazzo:        'Mazzo',
    corona:       'Corona',
    composizione: 'Composizione',
    altro:        'Altro',
  };

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns SVG string for a given icon name.
   * @param {string} name - Icon key from defs
   * @param {number} [size=20] - Override width/height
   * @returns {string} SVG HTML string
   */
  function html(name, size) {
    const svg = defs[name];
    if (!svg) {
      console.warn(`Icon "${name}" not found`);
      return '';
    }
    if (!size) return svg;
    return svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  }

  /**
   * Creates and returns an SVG DOM element.
   * @param {string} name
   * @param {number} [size=20]
   * @returns {Element}
   */
  function render(name, size) {
    const div = document.createElement('div');
    div.innerHTML = html(name, size);
    const el = div.firstElementChild;
    div.remove();
    return el;
  }

  /**
   * Returns emoji character for a tipo fiore.
   * @param {string} tipo - e.g. 'copricassa'
   * @returns {string}
   */
  function tipoIcon(tipo) {
    return tipoEmoji[tipo.toLowerCase()] || tipoEmoji.altro;
  }

  /**
   * Returns display label for a tipo fiore.
   * @param {string} tipo
   * @returns {string}
   */
  function tipoName(tipo) {
    return tipoLabel[tipo.toLowerCase()] || tipo;
  }

  /**
   * Returns all tipo fiore options as array of {value, label, icon}.
   * @returns {Array}
   */
  function getTipiOptions() {
    return Object.keys(tipoLabel).map(k => ({
      value: k,
      label: tipoLabel[k],
      icon:  tipoEmoji[k],
    }));
  }

  return { html, render, tipoIcon, tipoName, getTipiOptions };
})();


// ─── App Logo SVG (inline, no external deps) ──────────────────────────────────
const AppLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#503f34"/>
  <path d="M16 24v-9" stroke="#f5f5f0" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M16 15c0-4 2-7 0-10-2 3-2 6 0 10z" fill="#f5f5f0"/>
  <path d="M16 15c-3-2-6-1-8 1 2 0 5 0 8-1z" fill="rgba(245,245,240,0.7)"/>
  <path d="M16 15c3-2 6-1 8 1-2 0-5 0-8-1z" fill="rgba(245,245,240,0.7)"/>
  <ellipse cx="16" cy="24" rx="6" ry="1" fill="rgba(245,245,240,0.2)"/>
</svg>`;


// ─── Export (ES module) ───────────────────────────────────────────────────────
// If using modules:
// export { Icons, AppLogo };

// If using plain script tags:
if (typeof window !== 'undefined') {
  window.Icons = Icons;
  window.AppLogo = AppLogo;
}
