export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const SEASON_FILTERS = [...SEASONS, 'All Seasons'];
export const WEATHERS = ['Sunny', 'Wind', 'Rain', 'Storm', 'Snow', 'Blizzard'];
export const WEATHER_FILTERS = [...WEATHERS, 'Any Weather'];
export const WINGS = ['Archaeology', 'Fish', 'Flora', 'Insect'];
export const SIZES = ['Small', 'Medium', 'Large', 'Giant'];
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
export const STORAGE_KEY = 'mistria-museum-progress-v1';
export const emptyFilters = () => ({ wing: 'All', query: '', seasons: [], weather: [], locations: [], sizes: [], rarities: [], times: [], status: 'all', set: '' });

export function weatherTags(value) {
  if (!value || /\b(any|all)\b/i.test(value)) return ['Any Weather'];
  return [...new Set(value.split(/\s*\|\s*/).map(x => ({ Rainy: 'Rain', Thunderstorm: 'Storm' })[x] || x))];
}

const places = ['The Upper Mines', 'The Tide Caverns', 'The Deep Earth', 'The Lava Caves', 'The Ancient Ruins', 'The Deep Woods', 'The Western Ruins', 'The Eastern Road', 'Sweetwater Farm', 'The Narrows', 'The Beach', 'Mistria', 'Overworld', 'River', 'Pond', 'Ocean', 'Fish Trap', 'Terrarium', 'Apiary'];
export function locationTags(item) {
  const text = item.location + ' ' + (item.details.Location || '');
  const tags = places.filter(place => new RegExp(`\\b${place}\\b`, 'i').test(text));
  if (!tags.length && /Farming/.test(item.sources)) tags.push('Your farm');
  if (/Any Floor Without a Seal/.test(text)) tags.push('Mines · any unsealed floor');
  if (/Any Fishing Location/.test(text)) tags.push('Any fishing location');
  if (/Dig Spots|Digging/i.test(text) && !tags.length) tags.push('Dig spots');
  if (/Diving/i.test(text) && !tags.length) tags.push('Dive spots');
  if (/Mist Spots/i.test(text)) tags.push('Mist spots');
  return tags;
}

export function timeTags(value) {
  if (!value || /All Day/i.test(value)) return ['Day', 'Night'];
  const clocks = [...value.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)/g)];
  if (clocks.length >= 2) {
    const hours = clocks.slice(0,2).map(([, hour, minute, period]) => {
      let number = Number(hour) % 12 + (period === 'PM' ? 12 : 0) + Number(minute || 0) / 60;
      if (number < 6) number += 24;
      return number;
    });
    return [hours[0] < 20 && hours[1] > 6 ? 'Day' : '', hours[0] < 26 && hours[1] > 20 ? 'Night' : ''].filter(Boolean);
  }
  return /Night/i.test(value) ? ['Night'] : ['Day'];
}

export function matches(item, filters, progress = {}, preferences = {}) {
  const record = progress[item.id] || {};
  const overlaps = (selected, values) => !selected.length || selected.some(x => values.includes(x));
  if (filters.wing !== 'All' && item.wing !== filters.wing) return false;
  if (filters.set && item.set !== filters.set) return false;
  const seasonCategories = SEASONS.every(season => item.seasons.includes(season)) ? ['All Seasons'] : item.seasons;
  if (!overlaps(filters.seasons, seasonCategories)) return false;
  if (!overlaps(filters.weather, weatherTags(item.weather))) return false;
  if (!overlaps(filters.locations, locationTags(item))) return false;
  if (!overlaps(filters.sizes, [item.size])) return false;
  if (!overlaps(filters.rarities, [item.rarity])) return false;
  if (!overlaps(filters.times, timeTags(item.time))) return false;
  const status = record.status || 'missing';
  if (preferences.hideDonated && status === 'donated') return false;
  if (filters.status === 'remaining' && status === 'donated') return false;
  if (filters.status === 'donated' && status !== 'donated') return false;
  const haystack = [item.name, item.wing, item.set, item.location, item.sources, item.rarity, item.size, item.time, ...Object.values(item.details)].join(' ').toLowerCase();
  if (filters.query && !filters.query.toLowerCase().trim().split(/\s+/).every(word => haystack.includes(word))) return false;
  return true;
}

export function stats(items, progress) {
  const donated = items.filter(i => progress[i.id]?.status === 'donated').length;
  const sets = new Map();
  for (const item of items) {
    const key = item.wing + ':' + item.set;
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(item);
  }
  return { donated, total: items.length, sets: sets.size, completeSets: [...sets.values()].filter(set => set.every(i => progress[i.id]?.status === 'donated')).length };
}

export function validateBackup(value, items) {
  if (!value || value.app !== 'mistria-museum-tracker' || value.version !== 1 || !value.progress || typeof value.progress !== 'object' || Array.isArray(value.progress)) throw new Error('Choose a Museum Fieldnotes backup file (version 1).');
  const ids = new Set(items.map(i => i.id));
  const result = Object.create(null);
  for (const [id, entry] of Object.entries(value.progress)) {
    if (!ids.has(id)) continue;
    if (!entry || !['missing', 'collected', 'donated'].includes(entry.status) || (entry.notes !== undefined && (typeof entry.notes !== 'string' || entry.notes.length > 10000))) throw new Error('This backup contains invalid progress. Your progress has not changed.');
    // Older backups remain compatible. Preserve existing notes in exports, but
    // a previously collected item is simply not donated in the current UI.
    result[id] = { status: entry.status === 'donated' ? 'donated' : 'missing', ...(entry.notes !== undefined ? { notes: entry.notes } : {}) };
  }
  return result;
}
