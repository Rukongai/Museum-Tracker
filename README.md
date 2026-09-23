# Mistria Fieldnotes

Shared Fields of Mistria tools and resources, with a museum progress tracker and a modding Icon Browser.

- **Museum** (`/`): all **409 donations in 82 sets** across Archaeology (110), Fish (109), Flora (95), and Insect (95).
- **Modding → Tools → Icon Browser** (`/modding/tools/icon-browser/`): browse **9,788 sprites** from the supplied game 1.0.5 catalog, filter by name/source folder and size, switch between table and grid, and copy `[icon:…]` markup. **Hide outline sprites** hides names containing `outline`; the setting is remembered across reloads and is kept when resetting search filters. When clipboard access is unavailable (including some LAN connections), a dialog provides selectable markup.

The shared navigation and light/dark theme work across both tools. Existing museum progress, notes, and view preferences keep their original browser storage keys. Table/grid preference also carries over from the standalone icon catalog.

The Icon Browser loads its preview data only when opened. `vite.config.js` extracts the embedded data from `resources/ui-icons/index.html` for development and production. The original standalone resource is preserved. After replacing that resource with a newer generated catalog, restart the dev server or rebuild; update the displayed game version in `src/icon-browser.js` as needed. The resource’s regeneration tools belong to its original project and are not included here.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL Vite prints. Use the same URL and browser each time; browser storage is scoped to the origin, including the port.

```sh
npm run build
npm run preview
```

The production files are written to `dist/`, including both page entry points and icon resources. Serve that directory with a static host that supports directory index pages. Nothing is deployed or published automatically.

## LAN access

Both `npm run dev` and `npm run preview` listen on all IPv4 interfaces on port **5174**. They fail if the port is occupied rather than silently changing the address used for saved progress. Run only one at a time and leave the server running while using the tracker.

On this machine, open **http://10.0.0.165:5174/** from the other device. The host IP may change if its DHCP lease changes.

Allow client **10.0.100.74** through the host's UFW firewall:

```sh
sudo ufw allow proto tcp from 10.0.100.74 to any port 5174 comment 'Museum Tracker'
sudo ufw status numbered
```

This rule allows that source IP to TCP port 5174; it does not remove any existing broader rules. The client is on a different subnet, so the router must also permit traffic from `10.0.100.74` to `10.0.0.165:5174`.

Progress is browser- and origin-local. The LAN address has separate storage from `localhost`, even on the same device. Export/import a progress backup when switching addresses or devices; there is no automatic synchronization between them.

## Tracking and filtering

- **Cards / Table** switches the museum layout and remembers your choice. Both layouts share filters, donation checkboxes, item details, and collapsible sets. Tables scroll horizontally on small screens.
- The site icon is the exact `spr_ui_generic_icon_npc_outline_adeline` sprite extracted from the supplied local UI icon catalog, saved as `public/adeline.png` (game artwork © NPC Studio).
- Personal note editing and collection-status controls have been removed. Legacy notes remain in backup exports for compatibility but are not displayed or searched.

- **Dark mode** in the header switches themes and remembers your choice. On first visit, the tracker follows your device's color preference.
- **Hide donated** removes donated items (and sets with no matching items left) while preserving progress totals and not-donated items. This preference is saved across reloads. Choosing **Donated** in the status filter turns hiding off; enabling hiding while viewing donated items returns the status filter to **All items**. Resetting filters leaves this saved preference unchanged.
- Click a set heading to collapse or expand it. **Expand sets** and **Collapse sets** apply to the sets matching the current filters. These choices survive reloads.
- **Auto-collapse completed sets** collapses existing completed sets when enabled, and collapses a set when its final item is donated. You can still reopen a completed set; it stays open until you close it or complete it again. Completion always uses the full set, even with filters active. Display preferences stay on this device and are separate from progress backups.
- Donation checkboxes update item, wing, and set progress. Items are either donated or not donated. Older collected statuses are treated as not donated.
- Combine season, weather, location, fish shadow size, rarity, time, set, donation status, and text search.
- Multiple values within a filter match **any** selected value; different filters must **all** match. **All Seasons** is a separate category for year-round items: Spring alone excludes year-round items; Spring + All Seasons includes both. Items available in several but not all seasons still match those individual seasons. With no season selected, all seasons are included. **Any Weather** separately selects items without weather restrictions. Rain alone excludes them; Rain + Any Weather includes both. No weather selection includes every weather category.
- Rain/Rainy and Storm/Thunderstorm are grouped in the weather controls. Original conditions and exact insect times are retained in item details.
- Season filtering describes natural collection/growth seasons. Vendors can have separate availability; collection sources retain the wiki's vendor and unlock notes.
- The location filter uses named locations from the wiki. Broad entries such as “Overworld” are their own option; it does not claim that an insect appears in every specific map.
- Search includes item names, locations, and collection facts.
- Progress saves automatically to this browser's local storage, including updates from another tab on the same origin. No account, cloud sync, or game-save integration is involved.
- **Export backup** downloads a JSON file. **Import** validates a backup and asks before replacing current progress. Browser data clearing will erase local progress, so keep backups.

The catalog ships with the app and does not scrape the wiki when you open the tracker. Sprites load from wiki.gg and fonts from Google Fonts; these visual assets need an internet connection, with system-font fallbacks. Progress and filters do not need those services.

## Data provenance and refresh

Collection facts are adapted from the [Museum](https://fieldsofmistria.wiki.gg/wiki/Museum), [Archaeology Wing](https://fieldsofmistria.wiki.gg/wiki/Archaeology_Wing), [Fish Wing](https://fieldsofmistria.wiki.gg/wiki/Fish_Wing), [Flora Wing](https://fieldsofmistria.wiki.gg/wiki/Flora_Wing), [Insects Wing](https://fieldsofmistria.wiki.gg/wiki/Insects_Wing), and linked item pages. Each item includes its original source URL and wing facts; the snapshot date is recorded in `data/catalog.json` and the page footer. This is a snapshot, not a promise of automatic updates to future game versions.

The importer expands table rowspans/colspans, excludes hidden sorting text and character dialogue, and enriches entries using item-page infoboxes. Sources retain unlock requirements, collection methods, and growth/crafting details. Missing enrichment is reported explicitly. It uses a descriptive user agent, a local cache, and paced requests with retries. Existing cached pages are reused; remove `.cache/wiki` when intentionally requesting fresh data.

```sh
python -m pip install -r scripts/requirements.txt
python scripts/sync-wiki.py --enrich
```

The script fails for changed catalog totals so new museum sets can be reviewed before accepting an update. Rebuild afterward.

Adapted wiki data is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), attributed to Fields of Mistria Wiki contributors. Game artwork belongs to NPC Studio and is subject to its own terms.

## Verification

```sh
npm test
# With the dev server running; TEST_URL can override the address:
node tests/browser.mjs
node tests/view-preferences.mjs
node tests/filter-options.mjs
node tests/museum-layout.mjs
node tests/icon-browser.mjs
```

The browser checks use an isolated Playwright context and never change your personal tracker state. If Chromium is not installed for Playwright, run `npx playwright install chromium` first.
