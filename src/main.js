import { inject } from '@vercel/analytics';
import catalog from '../data/catalog.json';
import { SEASON_FILTERS, WEATHER_FILTERS, WINGS, SIZES, RARITIES, STORAGE_KEY, emptyFilters, weatherTags, locationTags, matches, stats, validateBackup } from './model.js';
import './style.css';
import { siteHeader, initNavigation, applyTheme } from './shell.js';
import { PREFERENCES_KEY, setKey, readPreferences, isSetCollapsed } from './preferences.js';

// Initialize Vercel Web Analytics
inject();

const items = catalog.items;
const filters = emptyFilters();
const expanded = new Set();
const museumSets = new Map();
for (const item of items) {
  const key = setKey(item);
  if (!museumSets.has(key)) museumSets.set(key, []);
  museumSets.get(key).push(item);
}
let preferences = readPreferences(null, document.documentElement.dataset.theme || 'light');
try { preferences = readPreferences(localStorage.getItem(PREFERENCES_KEY), preferences.theme); } catch {}
const isComplete = key => museumSets.get(key).every(item => progress[item.id]?.status === 'donated');
let progress = Object.create(null);
let storageWarning = '';
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) progress = validateBackup(JSON.parse(raw), items);
} catch { storageWarning = 'Saved progress could not be read. Export a backup of this session before closing it.'; }
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
const icons = { Archaeology: '◇', Fish: '≈', Flora: '✿', Insect: '⋈' };
const backup = () => ({ app: 'mistria-museum-tracker', version: 1, exportedAt: new Date().toISOString(), progress });

$('#app').innerHTML = `
  ${siteHeader('museum', '<span id="save-state">Saved on this device</span><button id="export" class="quiet">↓ Export backup</button><button id="import" class="quiet">↑ Import</button><input type="file" id="backup-file" accept="application/json,.json" hidden>')}
  <main id="main-content" tabindex="-1">
    <section class="overview" aria-labelledby="title"><div><p class="eyebrow">MUSEUM FIELDNOTES</p><h1 id="title">Finish your Museum</h1></div><div id="overall"></div></section>
    <nav id="wings" aria-label="Museum wing"></nav>
    <div class="workspace"><aside class="filters" id="filters" aria-label="Collection filters"></aside>
      <section class="collection" aria-label="Museum collection"><div class="search-row"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search items or places…" aria-label="Search collection"></label><button id="mobile-filters" class="quiet" aria-expanded="false" aria-controls="filters">Filters</button></div>
      <div id="active-filters" class="active-filters"></div>
      <div class="view-options"><div class="view-toggles"><label class="auto-collapse-option"><input id="hide-donated" type="checkbox">Hide donated</label><label class="auto-collapse-option"><input id="auto-collapse" type="checkbox">Auto-collapse completed sets</label></div><div class="set-actions"><button id="expand-sets" class="quiet">Expand sets</button><button id="collapse-sets" class="quiet">Collapse sets</button></div></div>
      <div class="results-bar"><h2 id="result-title" tabindex="-1">All donations</h2><div class="result-display"><span id="result-count" role="status" aria-live="polite"></span><div class="layout-switch" role="group" aria-label="Collection layout"><button data-layout="cards" aria-pressed="true">Cards</button><button data-layout="table" aria-pressed="false">Table</button></div></div></div>
      <div id="results"></div></section>
    </div>
    <footer>Collection facts adapted from the <a href="https://fieldsofmistria.wiki.gg/wiki/Museum" target="_blank" rel="noreferrer">Fields of Mistria Wiki</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a><br>Wiki snapshot ${escape(catalog.updatedAt)} · 409 donations, 82 sets · Game artwork © NPC Studio<br>Progress stays in this browser. Export a backup before clearing browser data or moving devices.</footer>
  </main><div id="toast" role="status" aria-live="polite"></div>
  <dialog id="import-dialog"><h2>Import your fieldnotes?</h2><p>This replaces the saved progress on this device. Export a backup first if you want to keep it.</p><p id="import-summary"></p><div class="dialog-actions"><button id="cancel-import" class="quiet">Cancel</button><button id="confirm-import" class="primary">Replace with backup</button></div></dialog>`;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backup()));
    $('#save-state').textContent = 'Saved on this device';
  } catch {
    $('#save-state').textContent = 'Not saved · export a backup';
    toast('Browser storage is unavailable. Export a backup to keep your progress.');
  }
}
function applyPreferences() {
  applyTheme(preferences.theme);
  $('#auto-collapse').checked = preferences.autoCollapse;
  $('#hide-donated').checked = preferences.hideDonated;
  document.querySelectorAll('[data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === preferences.museumLayout)));
  if (preferences.hideDonated && filters.status === 'donated') {
    filters.status = 'all';
    if ($('#status')) $('#status').value = 'all';
  }
}
function savePreferences() {
  applyPreferences();
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }
  catch { toast('View settings could not be saved in this browser.'); }
}
function autoCollapseNewCompletions(previous) {
  // Clear a manual expansion only when a set has just become complete.
  if (!preferences.autoCollapse) return;
  for (const key of museumSets.keys()) if (!previous.has(key) && isComplete(key)) delete preferences.collapsedSets[key];
  savePreferences();
}
function completeSets() { return new Set([...museumSets.keys()].filter(isComplete)); }
function focusItemOrSet(id, selector) {
  const target = document.querySelector(selector);
  if (target?.offsetParent !== null && target) target.focus({ preventScroll: true });
  else {
    const key = setKey(items.find(item => item.id === id));
    (document.querySelector(`[data-toggle-set="${CSS.escape(key)}"]`) || $('#result-title')).focus({ preventScroll: true });
  }
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
function progressBar(done, total) { return `<progress value="${done}" max="${total}" aria-label="${done} of ${total} donated"></progress>`; }

function renderSummary() {
  const s = stats(items, progress);
  $('#overall').innerHTML = `<div class="total"><strong>${s.donated}<span> / ${s.total}</span></strong><span>items donated</span></div><div class="overall-meter">${progressBar(s.donated, s.total)}<div><span>${Math.round(s.donated / s.total * 100)}% complete</span><span>${s.completeSets} / ${s.sets} sets</span></div></div>`;
  $('#wings').innerHTML = ['All', ...WINGS].map(wing => {
    const s = stats(wing === 'All' ? items : items.filter(i => i.wing === wing), progress);
    return `<button class="wing ${wing.toLowerCase()} ${filters.wing === wing ? 'selected' : ''}" data-wing="${wing}" aria-pressed="${filters.wing === wing}"><span class="wing-icon" aria-hidden="true">${icons[wing] || '▤'}</span><span class="wing-info"><strong>${wing === 'All' ? 'All wings' : wing}</strong><span>${s.donated} / ${s.total} donated</span>${progressBar(s.donated, s.total)}</span></button>`;
  }).join('');
}
function filterGroup(title, key, options, open = true) {
  return `<details class="filter-group" ${open ? 'open' : ''}><summary>${title}<span>${filters[key].length || ''}</span></summary><div class="filter-options ${key === 'locations' ? 'locations' : ''}">${options.map(option => `<label class="filter-option"><input type="checkbox" data-filter="${key}" value="${escape(option)}" ${filters[key].includes(option) ? 'checked' : ''}><span>${escape(option)}</span></label>`).join('')}</div></details>`;
}
function renderFilters() {
  const relevant = filters.wing === 'All' ? items : items.filter(i => i.wing === filters.wing);
  const sets = [...new Set(relevant.map(i => i.set))];
  const locations = [...new Set(relevant.flatMap(locationTags))].sort();
  $('#filters').innerHTML = `<div class="filters-heading"><h2>Filter collection</h2><button id="reset" class="text-button">Reset</button></div>
    <label class="field-label donation-filter">Donation status<select id="status">${Object.entries({all:'All items',remaining:'Not donated',donated:'Donated'}).map(([value,label]) => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    ${filterGroup('Season', 'seasons', SEASON_FILTERS)}${filterGroup('Weather', 'weather', WEATHER_FILTERS)}
    ${filterGroup('Location', 'locations', locations, false)}
    ${filterGroup('Fish shadow size', 'sizes', SIZES, false)}
    ${filterGroup('Rarity', 'rarities', RARITIES, false)}
    ${filterGroup('Time of day', 'times', ['Day', 'Night'], false)}
    <label class="field-label set-filter">Museum set<select id="set"><option value="">All sets</option>${sets.map(s => `<option ${filters.set === s ? 'selected' : ''}>${escape(s)}</option>`).join('')}</select></label>
    <div class="filter-note">Values within a filter match <strong>any</strong>; different filters must <strong>all</strong> match.<br><br><strong>All Seasons</strong> and <strong>Any Weather</strong> are separate categories. Select them alongside a season or weather to include both. Leave a filter empty to include every category.<br><br>Rain includes Rainy; Storm includes Thunderstorm.</div>`;
}
function activeFilters() {
  const active = [];
  for (const key of ['seasons', 'weather', 'locations', 'sizes', 'rarities', 'times']) for (const value of filters[key]) active.push(`<button class="active-chip" data-remove="${key}" data-value="${escape(value)}">${escape(value)} <span aria-hidden="true">×</span><span class="sr-only">Remove filter</span></button>`);
  $('#active-filters').innerHTML = active.join('');
}

function usefulFacts(item) {
  const result = new Map();
  result.set('Where to collect', item.location || (/Farming/.test(item.sources) ? 'Grow on your farm' : 'See collection sources below'));
  if (item.sources) result.set('How to collect', item.sources);
  result.set('Seasons', item.seasons.length === 4 ? 'All seasons' : item.seasons.join(', ') || 'See wiki');
  result.set('Weather', [...new Set(item.weather.split(' | '))].join(', '));
  if (item.size) result.set('Fish shadow', item.size);
  if (item.time) result.set('Time', item.time.replaceAll(' | ', ' '));
  if (item.rarity) result.set('Rarity', item.rarity);
  const skip = ['Sources','Source','Season','Weather','Size','Rarity','Time','Location','Location(s)','Donatable','Museum Set','Type','Fishing Pole'];
  for (const [key, value] of Object.entries(item.details)) if (!skip.includes(key)) result.set(key, value);
  if (item.details.Location && item.details.Location !== item.location) result.set('Item location details', item.details.Location);
  if (item.wing === 'Fish' && item.set === 'Legendary Fish Set') result.set('Requirement', 'Legendary fishing skill perk. Check the wiki for its unlock requirements.');
  return result;
}
function itemView(item) {
  return {
    donated: progress[item.id]?.status === 'donated',
    season: item.seasons.length === 4 ? 'All Seasons' : item.seasons.join(' / ') || 'Season: see wiki',
    weather: weatherTags(item.weather).join(' / '),
    location: item.location || (/Farming/.test(item.sources) ? 'Grow on your farm' : item.sources),
  };
}
function donationCheckbox(item, donated) {
  return `<label class="donation-check" title="${donated ? 'Mark as not donated' : 'Mark as donated'}"><input type="checkbox" data-donate="${escape(item.id)}" ${donated ? 'checked' : ''} aria-label="Donate ${escape(item.name)}"><span aria-hidden="true">✓</span></label>`;
}
function detailsButton(item) {
  return `<button class="details-toggle" data-details="${escape(item.id)}" aria-label="Details for ${escape(item.name)}" aria-expanded="${expanded.has(item.id)}" aria-controls="details-${escape(item.id)}">Details <span aria-hidden="true">${expanded.has(item.id) ? '−' : '+'}</span></button>`;
}
function itemDetails(item) {
  return `<div class="item-details" id="details-${escape(item.id)}"><dl>${[...usefulFacts(item)].map(([key,value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value).replaceAll(' | ', '<br>')}</dd></div>`).join('')}</dl><a class="wiki-link" href="${escape(item.url)}" target="_blank" rel="noreferrer">Open ${escape(item.name)} on the wiki ↗</a></div>`;
}
function itemCard(item) {
  const { donated, season, weather, location } = itemView(item);
  return `<article class="item-card ${donated ? 'donated' : ''}" data-id="${escape(item.id)}">
    <div class="item-top"><div class="item-art"><img src="${escape(item.image)}" alt="" loading="lazy" width="48" height="48" referrerpolicy="no-referrer"></div><div class="item-name"><h4>${escape(item.name)}</h4><span class="rarity ${item.rarity.toLowerCase()}">${escape(item.rarity || item.wing)}</span></div>${donationCheckbox(item, donated)}</div>
    <p class="item-location" title="${escape(location)}">${escape(location.replaceAll(' | ', ' · '))}</p>
    <div class="item-tags"><span class="season-tag ${item.seasons.length === 1 ? item.seasons[0].toLowerCase() : ''}">${escape(season)}</span>${item.size ? `<span>${escape(item.size)} shadow</span>` : ''}</div>
    <p class="conditions">${escape(weather)}${item.time ? ` <span>·</span> ${escape(item.time.replaceAll(' | ', ' '))}` : ''}</p>
    <div class="card-bottom"><span class="item-status ${donated ? 'donated' : ''}">${donated ? '✓ Donated' : 'Not donated'}</span>${detailsButton(item)}</div>
    ${expanded.has(item.id) ? itemDetails(item) : ''}
  </article>`;
}
function itemTable(group) {
  return `<div class="table-scroll" role="region" aria-label="${escape(group[0].wing + ': ' + group[0].set)} table" tabindex="0"><table class="museum-table"><caption class="sr-only">${escape(group[0].wing + ': ' + group[0].set)}</caption><thead><tr><th scope="col">Donated</th><th scope="col">Item</th><th scope="col">Where to collect</th><th scope="col">Season</th><th scope="col">Weather / time</th><th scope="col">Shadow</th><th scope="col"><span class="sr-only">Item details</span></th></tr></thead><tbody>${group.map(item => {
    const { donated, season, weather, location } = itemView(item);
    return `<tr class="museum-row ${donated ? 'donated' : ''}" data-id="${escape(item.id)}"><td>${donationCheckbox(item, donated)}</td><th scope="row"><div class="table-item"><div class="item-art"><img src="${escape(item.image)}" alt="" loading="lazy" width="32" height="32" referrerpolicy="no-referrer"></div><div>${escape(item.name)}<span class="rarity ${item.rarity.toLowerCase()}">${escape(item.rarity || item.wing)}</span></div></div></th><td>${escape(location).replaceAll(' | ', '<br>')}</td><td>${escape(season)}</td><td>${escape(weather)}${item.time ? `<small>${escape(item.time.replaceAll(' | ', ' '))}</small>` : ''}</td><td>${escape(item.size || '—')}</td><td>${detailsButton(item)}</td></tr>${expanded.has(item.id) ? `<tr class="table-details-row"><td colspan="7">${itemDetails(item)}</td></tr>` : ''}`;
  }).join('')}</tbody></table></div>`;
}
function renderResults() {
  const visible = items.filter(item => matches(item, filters, progress, preferences));
  $('#result-title').textContent = filters.wing === 'All' ? 'All donations' : filters.wing + ' collection';
  $('#result-count').textContent = `${visible.length} of ${items.length} items`;
  const groups = new Map();
  for (const item of visible) { const key = item.wing + ':' + item.set; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
  $('#results').innerHTML = visible.length ? [...groups.values()].map(group => {
    const first = group[0];
    const key = setKey(first);
    const all = museumSets.get(key);
    const s = stats(all, progress);
    const collapsed = isSetCollapsed(key, s.donated === s.total, preferences);
    const regionId = `set-items-${all[0].id}`;
    return `<section class="set-group ${collapsed ? 'set-collapsed' : ''}" data-set="${escape(key)}"><div class="set-heading"><h3><button class="set-toggle" data-toggle-set="${escape(key)}" aria-expanded="${!collapsed}" aria-controls="${escape(regionId)}"><span class="set-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span><span class="set-wing ${first.wing.toLowerCase()}">${escape(first.wing)}</span><span>${escape(first.set.replace(/ (Artifact|Fish)?\s?Set$/, ''))}</span></button></h3><div class="set-progress"><span>${s.donated === s.total ? '✓ ' : ''}${s.donated} / ${s.total}</span>${progressBar(s.donated,s.total)}</div></div><div class="${preferences.museumLayout === 'table' ? 'set-table' : 'item-grid'}" id="${escape(regionId)}" ${collapsed ? 'hidden' : ''}>${preferences.museumLayout === 'table' ? itemTable(group) : group.map(itemCard).join('')}</div></section>`;
  }).join('') : `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>No matching discoveries</h3><p>Try removing a filter or using a broader search.${preferences.hideDonated ? ' Donated items are hidden.' : ''}</p><button id="clear-results" class="primary">Clear filters & search</button>${preferences.hideDonated ? ' <button id="show-donated" class="quiet">Show donated</button>' : ''}</div>`;
  activeFilters();
}
function render() { renderSummary(); renderFilters(); renderResults(); }
function updateItem(id, changes) {
  const previous = completeSets();
  progress[id] = { status: 'missing', ...progress[id], ...changes };
  if (changes.status) autoCollapseNewCompletions(previous);
  save();
}
function reset() { Object.assign(filters, emptyFilters()); $('#search').value = ''; render(); }

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (!button) return;
  if (button.id === 'toggle-theme') { preferences.theme = preferences.theme === 'dark' ? 'light' : 'dark'; savePreferences(); }
  if (button.dataset.layout) { preferences.museumLayout = button.dataset.layout; savePreferences(); renderResults(); }
  if (button.id === 'show-donated') { preferences.hideDonated = false; savePreferences(); renderResults(); $('#hide-donated').focus(); }
  if (button.dataset.toggleSet) {
    const key = button.dataset.toggleSet;
    preferences.collapsedSets[key] = !isSetCollapsed(key, isComplete(key), preferences);
    savePreferences(); renderResults();
    document.querySelector(`[data-toggle-set="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  if (['expand-sets', 'collapse-sets'].includes(button.id)) {
    const keys = new Set(items.filter(item => matches(item, filters, progress, preferences)).map(setKey));
    for (const key of keys) preferences.collapsedSets[key] = button.id === 'collapse-sets';
    savePreferences(); renderResults();
  }
  if (button.dataset.wing) { filters.wing = button.dataset.wing; filters.set = ''; render(); }
  if (button.dataset.remove) { filters[button.dataset.remove] = filters[button.dataset.remove].filter(x => x !== button.dataset.value); renderFilters(); renderResults(); }
  if (button.dataset.details) { const id = button.dataset.details; expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderResults(); document.querySelector(`[data-details="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); }
  if (['reset','clear-results'].includes(button.id)) reset();
  if (button.id === 'mobile-filters') { const isOpen = $('#filters').classList.toggle('mobile-open'); button.setAttribute('aria-expanded', String(isOpen)); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'hide-donated') { preferences.hideDonated = el.checked; savePreferences(); renderResults(); }
  if (el.id === 'auto-collapse') {
    preferences.autoCollapse = el.checked;
    if (el.checked) for (const key of completeSets()) delete preferences.collapsedSets[key];
    savePreferences(); renderResults();
  }
  if (el.dataset.filter) { const values = filters[el.dataset.filter]; if (el.checked) values.push(el.value); else values.splice(values.indexOf(el.value),1); renderResults(); }
  if (el.id === 'status' || el.id === 'set') {
    filters[el.id] = el.value;
    if (el.id === 'status' && el.value === 'donated' && preferences.hideDonated) { preferences.hideDonated = false; savePreferences(); }
    renderResults();
  }
  if (el.dataset.donate) { updateItem(el.dataset.donate, { status: el.checked ? 'donated' : 'missing' }); renderSummary(); renderResults(); focusItemOrSet(el.dataset.donate, `[data-donate="${CSS.escape(el.dataset.donate)}"]`); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'search') { filters.query = e.target.value; renderResults(); }
});
$('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup(), null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `mistria-fieldnotes-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); toast('Your fieldnotes backup has been exported.');
};
let pendingImport;
$('#import').onclick = () => $('#backup-file').click();
$('#backup-file').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('That file is too large to be a fieldnotes backup.');
    pendingImport = validateBackup(JSON.parse(await file.text()), items);
    const s = stats(items, pendingImport);
    $('#import-summary').textContent = `Backup contains ${s.donated} donated items.`;
    $('#import-dialog').showModal();
  } catch (error) { toast(error instanceof SyntaxError ? 'That file is not valid JSON. Your progress has not changed.' : error.message); }
};
$('#cancel-import').onclick = () => { pendingImport = null; $('#import-dialog').close(); };
$('#confirm-import').onclick = () => { if (!pendingImport) return; const previous = completeSets(); progress = pendingImport; pendingImport = null; autoCollapseNewCompletions(previous); save(); render(); $('#import-dialog').close(); toast('Your fieldnotes have been restored.'); };
window.addEventListener('storage', event => {
  if (event.key === PREFERENCES_KEY) { preferences = readPreferences(event.newValue, preferences.theme); applyPreferences(); renderResults(); return; }
  if (event.key !== STORAGE_KEY) return;
  try { const previous = completeSets(); progress = event.newValue ? validateBackup(JSON.parse(event.newValue), items) : Object.create(null); autoCollapseNewCompletions(previous); render(); toast('Progress updated from another tab.'); } catch { toast('Could not read progress from another tab.'); }
});
document.addEventListener('error', event => {
  if (event.target.matches?.('.item-art img')) event.target.style.visibility = 'hidden';
}, true);
initNavigation();
applyPreferences(); render();
if (storageWarning) { $('#save-state').textContent = 'Storage issue · export a backup'; toast(storageWarning); }
