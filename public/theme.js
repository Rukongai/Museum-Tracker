// Shared by both entry pages; apply before paint without requiring storage.
let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
try {
  const saved = JSON.parse(localStorage.getItem('mistria-museum-preferences-v1'));
  if (['light', 'dark'].includes(saved?.theme)) theme = saved.theme;
} catch {}
document.documentElement.dataset.theme = theme;
