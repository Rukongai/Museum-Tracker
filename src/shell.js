export function siteHeader(active, actions = '') {
  return `<a class="skip-link" href="#main-content">Skip to content</a>
    <header class="masthead">
      <a class="brand" href="/"><img class="site-icon" src="/adeline.png" alt="" width="48" height="40"><span>Mistria Fieldnotes<small>TOOLS & RESOURCES</small></span></a>
      <div class="backup-actions"><button id="toggle-theme" class="quiet" aria-pressed="false">☾ Dark mode</button>${actions}</div>
    </header>
    <nav class="site-nav" aria-label="Tools and resources">
      <div class="site-nav-inner">
        <a class="site-nav-link" href="/" ${active === 'museum' ? 'aria-current="page"' : ''}>Museum</a>
        <details class="nav-group ${active === 'icons' ? 'active' : ''}">
          <summary>Modding <span aria-hidden="true">⌄</span></summary>
          <div class="nav-dropdown"><span class="nav-section">Tools</span><a href="/modding/tools/icon-browser/" ${active === 'icons' ? 'aria-current="page"' : ''}>▦ <span>Icon Browser<small>Find sprites & copy markup</small></span></a></div>
        </details>
        <span class="nav-caption">A companion for Fields of Mistria</span>
      </div>
    </nav>`;
}

export function initNavigation() {
  const menu = document.querySelector('.nav-group');
  document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
  });
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#172128' : '#242d39';
  document.querySelector('#toggle-theme').setAttribute('aria-pressed', String(theme === 'dark'));
}
