import { inject } from '@vercel/analytics';
import './style.css';
import './icon-browser.css';
import { siteHeader, initNavigation, applyTheme } from './shell.js';
import { PREFERENCES_KEY, readPreferences } from './preferences.js';

// Initialize Vercel Web Analytics
inject();

const $ = id => document.getElementById(id);
let data = [];
let filtered = [];
let page = 0;
let view = 'table';
let toastTimer;
try { if (localStorage.getItem('ui-icon-catalog-view') === 'grid') view = 'grid'; } catch {}

$('app').innerHTML = `${siteHeader('icons')}
  <main id="main-content" class="icon-browser" tabindex="-1">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li>Modding</li><li>Tools</li><li aria-current="page">Icon Browser</li></ol></nav>
    <section class="overview" aria-labelledby="title">
      <div><p class="eyebrow">Modder’s Workbench</p><h1 id="title">Icon Browser</h1></div>
      <div class="icon-total"><strong id="total">—</strong><span>game sprites</span></div>
    </section>
    <div class="icon-guide"><span class="guide-symbol" aria-hidden="true">▦</span><p>Paste <code>[icon:sprite_name]</code> into a Mod Menu label, heading, or description. Previews show the first animation frame.</p><span class="version-badge">Game 1.0.5</span></div>
    <fieldset id="browser-controls" class="icon-controls" disabled>
      <legend class="sr-only">Filter icons</legend>
      <div class="icon-toolbar">
        <label class="field-label icon-search-field">Search sprites<span class="search"><span aria-hidden="true">⌕</span><input id="query" type="search" placeholder="Try fish, heart, arrow, or museum…" autocomplete="off"></span></label>
        <label class="field-label icon-category-field">Source folder<select id="category"><option value="">All categories</option></select></label>
        <div class="icon-filter-options"><label class="auto-collapse-option"><input id="compact" type="checkbox">Small sprites only <span class="muted">(≤64 px)</span></label>
        <label class="auto-collapse-option" title="Hide sprites with outline in their name"><input id="hide-outlines" type="checkbox">Hide outline sprites</label></div>
      </div>
      <div class="icon-presentation"><div class="view-picker" role="group" aria-label="Catalog view"><button id="table-view" class="quiet" aria-pressed="true" aria-controls="table-results">☰ Table</button><button id="grid-view" class="quiet" aria-pressed="false" aria-controls="grid-results">▦ Grid</button></div><button id="reset-icons" class="text-button">Reset filters</button></div>
    </fieldset>
    <div class="icon-summary"><span id="icon-results" role="status" aria-live="polite">Loading the icon collection…</span></div>
    <div id="load-error" class="empty-state" hidden><h2>The icons couldn’t be loaded.</h2><p>Check your connection and try again.</p><button id="retry-icons" class="primary">Try again</button></div>
    <div id="table-results" class="icon-table-wrap" tabindex="0" role="region" aria-label="Scrollable icon table" hidden><table><caption class="sr-only">UI icons and copyable settings markup</caption><thead><tr><th scope="col">Preview</th><th scope="col">Sprite / markup</th><th scope="col" class="icon-category">Source folder</th><th scope="col">Frame size</th><th scope="col"><span class="sr-only">Copy markup</span></th></tr></thead><tbody id="rows"></tbody></table></div>
    <ul id="grid-results" class="icon-grid" aria-label="UI icons" hidden></ul>
    <div id="icon-pagination" class="icon-pagination" hidden><label class="field-label">Items per page<select id="page-size"><option>40</option><option selected>80</option><option>160</option></select></label><div class="icon-pages"><button id="previous" class="quiet">← Previous</button><span id="page-label"></span><button id="next" class="quiet">Next →</button></div></div>
    <p class="icon-hint">Includes menu widgets, item icons, panels, and state variants from UI folders and the UI atlas. Mod Menu fits icons into a 14 px box. Sprite availability may change between game versions.</p>
    <footer>Fields of Mistria modding resources · Game artwork © NPC Studio<br>Catalog snapshot: game 1.0.5 · Previews included locally</footer>
  </main>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="copy-dialog" aria-labelledby="copy-title"><h2 id="copy-title">Copy icon markup</h2><p>Automatic copying isn’t available in this browser. Copy the selected text below.</p><label class="field-label">Icon markup<input id="copy-text" readonly></label><div class="dialog-actions"><button id="close-dialog" class="primary">Done</button></div></dialog>`;

try { $('hide-outlines').checked = localStorage.getItem('ui-icon-catalog-hide-outlines') === 'true'; } catch {}

initNavigation();
applyTheme(document.documentElement.dataset.theme);
$('toggle-theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try {
    // Read the latest museum settings so changing theme cannot reset them.
    const preferences = readPreferences(localStorage.getItem(PREFERENCES_KEY), theme);
    preferences.theme = theme;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch { toast('The theme could not be saved in this browser.'); }
});
window.addEventListener('storage', event => {
  if (event.key === PREFERENCES_KEY) applyTheme(readPreferences(event.newValue, document.documentElement.dataset.theme).theme);
});
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
function node(tag, text = '', className = '') {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}
function preview(entry) {
  const box = node('div', '', 'icon-checker');
  const image = document.createElement('img');
  image.src = entry.image;
  image.alt = entry.name;
  image.loading = 'lazy';
  image.width = entry.width;
  image.height = entry.height;
  image.style.width = `${entry.width * 2}px`;
  image.style.height = `${entry.height * 2}px`;
  box.append(image);
  return box;
}
function dimensions(entry, tag) {
  const el = node(tag, `${entry.width} × ${entry.height}`, 'icon-dimensions');
  if (entry.frames > 1) el.append(node('small', `${entry.frames} frames`));
  return el;
}
function copyButton(entry) {
  const button = node('button', 'Copy markup', 'quiet icon-copy');
  button.setAttribute('aria-label', `Copy markup for ${entry.name}`);
  button.addEventListener('click', () => copyMarkup(entry.markup));
  return button;
}
function render() {
  const size = Number($('page-size').value);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  page = Math.min(page, pages - 1);
  const fragment = document.createDocumentFragment();
  for (const entry of filtered.slice(page * size, (page + 1) * size)) {
    if (view === 'grid') {
      const card = node('li', '', 'icon-card');
      card.append(preview(entry), node('h2', entry.name, 'icon-name'), node('div', entry.category, 'icon-category'), dimensions(entry, 'div'), copyButton(entry));
      fragment.append(card);
    } else {
      const row = node('tr');
      const imageCell = node('td');
      const nameCell = node('td', '', 'icon-name-cell');
      const action = node('td');
      imageCell.append(preview(entry));
      nameCell.append(node('span', entry.name, 'icon-name'), node('code', entry.markup, 'icon-markup'));
      action.append(copyButton(entry));
      row.append(imageCell, nameCell, node('td', entry.category, 'icon-category'), dimensions(entry, 'td'), action);
      fragment.append(row);
    }
  }
  if (!filtered.length) {
    const message = 'No matching sprites. Try a shorter search or reset your filters.';
    if (view === 'grid') fragment.append(node('li', message, 'icon-empty'));
    else { const row = node('tr'); const cell = node('td', message, 'icon-empty'); cell.colSpan = 5; row.append(cell); fragment.append(row); }
  }
  $('rows').replaceChildren();
  $('grid-results').replaceChildren();
  $(view === 'grid' ? 'grid-results' : 'rows').append(fragment);
  $('table-results').hidden = view !== 'table';
  $('grid-results').hidden = view !== 'grid';
  $('table-view').setAttribute('aria-pressed', String(view === 'table'));
  $('grid-view').setAttribute('aria-pressed', String(view === 'grid'));
  $('icon-results').textContent = filtered.length ? `${(page * size + 1).toLocaleString()}–${Math.min((page + 1) * size, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()} sprites` : '0 matching sprites';
  $('page-label').textContent = `Page ${page + 1} of ${pages}`;
  $('previous').disabled = page === 0;
  $('next').disabled = page === pages - 1;
}
function filter() {
  const words = $('query').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const category = $('category').value;
  filtered = data.filter(entry => (!category || entry.category === category) && (!$('compact').checked || entry.compact) && (!$('hide-outlines').checked || !entry.name.toLowerCase().includes('outline')) && words.every(word => `${entry.name} ${entry.category} ${entry.markup} ${entry.source}`.toLowerCase().includes(word)));
  page = 0;
  render();
}
async function copyMarkup(value) {
  try { await navigator.clipboard.writeText(value); toast(`Copied ${value}`); }
  catch { $('copy-text').value = value; $('copy-dialog').showModal(); $('copy-text').focus(); $('copy-text').select(); }
}
async function loadCatalog() {
  $('load-error').hidden = true;
  $('icon-results').textContent = 'Loading the icon collection…';
  try {
    const response = await fetch('/resources/ui-icons/previews.json');
    if (!response.ok) throw new Error('Catalog request failed');
    const catalog = await response.json();
    if (!Array.isArray(catalog.icons) || !catalog.icons.length) throw new Error('Invalid catalog');
    data = catalog.icons;
    const groups = new Map();
    for (const entry of data) groups.set(entry.category, (groups.get(entry.category) || 0) + 1);
    for (const [group, count] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const option = node('option', `${group} (${count})`);
      option.value = group;
      $('category').append(option);
    }
    $('total').textContent = data.length.toLocaleString();
    $('browser-controls').disabled = false;
    $('icon-pagination').hidden = false;
    filter();
  } catch {
    $('icon-results').textContent = 'Icon collection unavailable';
    $('load-error').hidden = false;
  }
}
$('query').addEventListener('input', filter);
$('category').addEventListener('change', filter);
$('compact').addEventListener('change', filter);
$('hide-outlines').addEventListener('change', () => {
  try { localStorage.setItem('ui-icon-catalog-hide-outlines', String($('hide-outlines').checked)); }
  catch { toast('The outline setting could not be saved in this browser.'); }
  filter();
});
$('reset-icons').addEventListener('click', () => { $('query').value = ''; $('category').value = ''; $('compact').checked = false; filter(); });
for (const mode of ['table', 'grid']) $(mode + '-view').addEventListener('click', () => {
  view = mode;
  try { localStorage.setItem('ui-icon-catalog-view', view); } catch {}
  render();
});
$('page-size').addEventListener('change', () => { page = 0; render(); });
$('previous').addEventListener('click', () => { page--; render(); });
$('next').addEventListener('click', () => { page++; render(); });
$('close-dialog').addEventListener('click', () => $('copy-dialog').close());
$('retry-icons').addEventListener('click', loadCatalog);
loadCatalog();
