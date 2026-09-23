# Fields of Mistria UI Icon Catalog

Open `index.html` in any modern browser. It contains all previews and works
offline. Switch between **Table** and **Grid**, and use **Dark mode** for a full
page dark theme. The initial theme follows your system preference; your chosen
view and theme are remembered when browser storage is available. Search by
sprite name or source folder, filter by category or small sprites, and use **Copy markup** to paste an `[icon:...]` token into a localized
Mod Menu label, heading, or description. If clipboard access is unavailable,
a dialog provides selectable text.

The generated table contains 9,788 sprites from the local game archive used for
this build (game 1.0.5), with no missing previews or duplicate names. It includes
sprites named `spr_ui_*`, sprites under UI folders, and sprites assigned to the
UI atlas. Consequently it includes item icons, panels, and widget variants as
well as small menu icons. Previews show the first frame at its original aspect
ratio. The frame size and animation frame count are included for reference.

`catalog.json` provides metadata and `icons.csv` provides a spreadsheet-friendly
name/markup table. `build-report.json` records generation checks. No web service,
external font, or network connection is required. These files are a separate
developer resource and are not part of the installed Mod Menu archive.

## Regenerate after a game update

Requires Python 3.11+ and Pillow (`python -m pip install Pillow`). From the
repository root, run:

```sh
python tools/build_ui_icon_catalog.py "/path/to/Fields of Mistria/assets.bak.zip"
```

The archive is read only. Prefer MOMI's pristine `assets.bak.zip` for base-game
icons; use `assets.zip` to include sprites from installed mods. The same command
works on Windows, macOS, and Linux; substitute your local archive path. Use
`--output /path/to/catalog` for a different destination. The HTML template lives
in `tools/ui_icon_catalog_template.html`.

Generated previews come from your local game assets. Rebuild the catalog locally
when sharing the tooling rather than assuming a recipient has the same game
version. Sprite availability can change between game versions; Mod Menu safely
omits unavailable icons.
