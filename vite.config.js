import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fromRoot = path => fileURLToPath(new URL(path, import.meta.url));

// The supplied standalone catalog is the source of truth for embedded previews.
// Expose its data separately so visiting the museum never downloads the icons.
function iconResources() {
  function assets() {
    const html = readFileSync(fromRoot('resources/ui-icons/index.html'), 'utf8');
    const embedded = html.match(/<script id="catalog-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!embedded) throw new Error('The UI icon resource is missing its catalog-data script.');
    const catalog = JSON.parse(embedded);
    if (!Array.isArray(catalog.icons) || catalog.icons.length !== catalog.count) throw new Error('Invalid UI icon catalog.');
    return new Map([
      ['/resources/ui-icons/previews.json', { type: 'application/json', source: JSON.stringify(catalog) }],
    ]);
  }
  return {
    name: 'icon-resources',
    configureServer(server) {
      const resources = assets();
      server.middlewares.use((request, response, next) => {
        const asset = resources.get(request.url?.split('?')[0]);
        if (!asset) return next();
        response.setHeader('Content-Type', `${asset.type}; charset=utf-8`);
        response.end(asset.source);
      });
    },
    generateBundle() {
      for (const [path, asset] of assets()) this.emitFile({ type: 'asset', fileName: path.slice(1), source: asset.source });
    },
  };
}

export default defineConfig({
  plugins: [iconResources()],
  build: { rollupOptions: { input: {
    museum: fromRoot('index.html'),
    icons: fromRoot('modding/tools/icon-browser/index.html'),
  } } },
});
