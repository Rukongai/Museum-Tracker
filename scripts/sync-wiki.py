"""Refresh the museum catalog from wiki.gg. pip install requests beautifulsoup4.

Caches pages and politely spaces requests. Only structured collection facts are
imported; character dialogue and article prose are intentionally excluded.
"""
import argparse
import json
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, unquote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://fieldsofmistria.wiki.gg'
CACHE = ROOT / '.cache/wiki'
CACHE.mkdir(parents=True, exist_ok=True)
SESSION = requests.Session()
SESSION.headers['User-Agent'] = 'MistriaMuseumTracker/1.0 (personal collection catalog; non-commercial)'
SEASONS = ['Spring', 'Summer', 'Fall', 'Winter']

def fetch(url):
    key = unquote(url.split('/wiki/')[-1]).replace('/', '__')
    path = CACHE / (key + '.html')
    if path.exists() and 'mw-parser-output' in path.read_text():
        return BeautifulSoup(path.read_text(), 'html.parser')
    for attempt in range(6):
        time.sleep(1.1 + attempt * 5)
        response = SESSION.get(url, timeout=40)
        if response.ok and 'mw-parser-output' in response.text:
            path.write_text(response.text)
            return BeautifulSoup(response.text, 'html.parser')
    raise RuntimeError('Could not fetch ' + url)

def clean(node):
    if node is None:
        return ''
    node = BeautifulSoup(str(node), 'html.parser')
    for el in node.select('[style]'):
        if 'display:none' in el['style'].replace(' ', ''):
            el.decompose()
    for el in node.select('br'):
        el.replace_with(' | ')
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True)).strip(' |')

def table_rows(table):
    """Expand rowspans and colspans before assigning columns."""
    spans = {}
    for tr in table.select('tr'):
        row = {}
        for col, (remaining, cell) in list(spans.items()):
            row[col] = cell
            if remaining == 1:
                del spans[col]
            else:
                spans[col] = (remaining - 1, cell)
        col = 0
        for cell in tr.find_all(['td', 'th'], recursive=False):
            while col in row:
                col += 1
            for _ in range(int(cell.get('colspan', 1))):
                row[col] = cell
                if int(cell.get('rowspan', 1)) > 1:
                    spans[col] = (int(cell['rowspan']) - 1, cell)
                col += 1
        yield [row[k] for k in sorted(row)]

def seasons(value):
    if re.search(r'\b(All|Any)\b', value):
        return SEASONS
    return [s for s in SEASONS if s in value]

def catalog():
    result = []
    for wing, page in [('Archaeology', 'Archaeology_Wing'), ('Fish', 'Fish_Wing'), ('Flora', 'Flora_Wing'), ('Insect', 'Insects_Wing')]:
        url = BASE + '/wiki/' + page
        soup = fetch(url)
        for table in soup.select('.mw-parser-output table.wikitable'):
            rows = list(table_rows(table))
            headers = [clean(x) for x in rows[0]]
            if 'Name' not in headers or 'Image' not in headers:
                continue
            heading = table.find_previous(['h2', 'h3'])
            set_name = clean(heading).replace('[ edit ]', '').strip()
            for cells in rows[1:]:
                assert len(cells) == len(headers), (wing, set_name, len(cells))
                fields = dict(zip(headers, cells))
                name = clean(fields['Name'])
                link = fields['Name'].find('a', href=True)
                if not link:
                    raise ValueError('Missing item link: ' + name)
                image = fields['Image'].find('img')
                facts = {k: clean(v) for k, v in fields.items() if k not in ['Name', 'Image', 'Comment']}
                season = seasons(facts.get('Season', '')) or seasons(set_name)
                if not season and 'Multi-Season' not in set_name:
                    season = SEASONS
                result.append(dict(id=unquote(link['href'].split('/wiki/')[-1]).lower().replace('_', '-'), name=name, wing=wing, set=set_name,
                    url=urljoin(BASE, link['href']), wingUrl=url, image=urljoin(BASE, image['src']) if image else '',
                    seasons=season, weather=facts.get('Weather', 'Any'), location=facts.get('Location', facts.get('Known Location(s)', '')),
                    sources=facts.get('Source(s)', ''), rarity=facts.get('Rarity', 'Legendary' if 'Legendary' in set_name else 'Rare' if set_name == 'Rare' else ''),
                    size=facts.get('Size', ''), time=facts.get('Time', ''), facts=facts, details={}))
    assert len(result) == 409, f'Review changed museum total: {len(result)}'
    assert len({x['id'] for x in result}) == len(result)
    assert len({(x['wing'], x['set']) for x in result}) == 82
    return result

def save(items, failures):
    output = dict(updatedAt=datetime.now(timezone.utc).date().isoformat(), source=BASE+'/wiki/Museum',
                  attribution='Fields of Mistria Wiki contributors', license='CC BY-SA 4.0',
                  licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',
                  enrichmentFailures=failures, items=items)
    temporary = ROOT/'data/catalog.json.tmp'
    temporary.write_text(json.dumps(output, indent=2, ensure_ascii=False)+'\n')
    temporary.replace(ROOT/'data/catalog.json')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--enrich', action='store_true')
    args = parser.parse_args()
    items = catalog()
    failures = []
    save(items, failures)
    print('Catalog:', Counter(x['wing'] for x in items), flush=True)
    if not args.enrich:
        return
    for i, item in enumerate(items):
        try:
            soup = fetch(item['url'])
            details = {}
            for node in soup.select('.pi-data'):
                label, value = clean(node.select_one('.pi-data-label')), clean(node.select_one('.pi-data-value'))
                if label and value:
                    details[label] = value
            item['details'] = details
            if details.get('Season'):
                item['seasons'] = seasons(details['Season']) or item['seasons']
            for target, keys in [('sources', ['Sources', 'Source']), ('location', ['Location', 'Location(s)']), ('time', ['Time']), ('size', ['Size']), ('rarity', ['Rarity']), ('weather', ['Weather'])]:
                for key in keys:
                    if details.get(key):
                        # Wing locations often contain helpful floor ranges.
                        if target == 'location' and item[target]:
                            continue
                        item[target] = details[key]
                        break
            # Individual pages can be more specific than the shared wing table.
            # Keep explicit clock ranges alongside the infobox's day/night label.
            if item['wing'] == 'Insect' and item['time'].lower() in ['day', 'night', 'all day']:
                paragraphs = [clean(p) for p in soup.select('.mw-parser-output > p')]
                lead = next((p for p in paragraphs if 'a type of' in p), '')
                clock = re.search(r'(\d{1,2}(?::\d{2})?\s*[AP]M\s*-\s*\d{1,2}(?::\d{2})?\s*[AP]M)', lead)
                if clock:
                    item['time'] = item['time'].title() + ' (' + clock[1] + ')'
                else:
                    item['time'] = item['facts'].get('Time', item['time'])
            if 'Legendary' in item['set'] and item['rarity'].lower() == 'very rare':
                item['details']['Wiki rarity'] = item['rarity']
                item['rarity'] = 'Legendary'
            if item['set'] in ['Honey', 'Terrarium']:
                lead = ' '.join(clean(p) for p in soup.select('.mw-parser-output > p')[:6])
                production = re.search(r'produced in an? (?:Apiary|Terrarium)\s*,?\s*when\s+([^\.]+)', lead)
                if production:
                    item['details']['Production requirement'] = production[1].strip() + '.'
        except Exception as exc:
            failures.append(item['name'])
            print('Could not enrich:', item['name'], str(exc), flush=True)
        if (i + 1) % 20 == 0:
            save(items, failures)
            print(f'Enriched {i+1}/{len(items)}', flush=True)
    save(items, failures)
    print('Complete. Failures:', failures, flush=True)

if __name__ == '__main__':
    main()
