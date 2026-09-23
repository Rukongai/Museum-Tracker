export const PREFERENCES_KEY = 'mistria-museum-preferences-v1';
export const setKey = item => `${item.wing}:${item.set}`;

export function readPreferences(raw, defaultTheme = 'light') {
  let value;
  try { value = JSON.parse(raw); } catch { /* Use defaults for invalid preferences. */ }
  return {
    theme: ['light', 'dark'].includes(value?.theme) ? value.theme : defaultTheme,
    autoCollapse: value?.autoCollapse === true,
    hideDonated: value?.hideDonated === true,
    museumLayout: value?.museumLayout === 'table' ? 'table' : 'cards',
    collapsedSets: Object.fromEntries(Object.entries(value?.collapsedSets && typeof value.collapsedSets === 'object' ? value.collapsedSets : {}).filter(([, collapsed]) => typeof collapsed === 'boolean')),
  };
}

export function isSetCollapsed(key, complete, preferences) {
  return Object.hasOwn(preferences.collapsedSets, key)
    ? preferences.collapsedSets[key]
    : preferences.autoCollapse && complete;
}
