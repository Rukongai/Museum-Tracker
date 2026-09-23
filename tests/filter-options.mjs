import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const season = value => page.locator(`[data-filter="seasons"][value="${value}"]`);
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:5174');
  await page.locator('[data-wing="Fish"]').click();
  await season('Spring').check();
  assert.equal(await page.locator('[data-id="koi"]').count(), 0);
  assert.equal(await page.locator('[data-id="cherry-fish"]').count(), 1);
  await season('All Seasons').check();
  assert.equal(await page.locator('[data-id="koi"]').count(), 1);
  await page.locator('[data-filter="weather"][value="Rain"]').check();
  await page.locator('[data-filter="weather"][value="Any Weather"]').check();
  assert.equal(await page.locator('[data-id="koi"]').count(), 1);
  assert.equal(await page.locator('[data-id="cherry-fish"]').count(), 0);
  await page.locator('[data-remove="seasons"][data-value="All Seasons"]').click();
  assert.equal(await page.locator('[data-id="koi"]').count(), 0);
  await season('Spring').uncheck();
  await season('All Seasons').check();
  assert.equal(await page.locator('[data-id="walleye"]').count(), 0);
  await page.locator('#reset').click();

  await page.locator('[data-donate="clay"]').check();
  await page.locator('[data-details="peat"]').click();
  assert.equal(await page.locator('[data-status="peat"]').count(), 0);
  const totals = await page.locator('#overall').innerText();
  await page.locator('#hide-donated').check();
  assert.equal(await page.locator('[data-id="clay"]').count(), 0);
  assert.equal(await page.locator('[data-id="peat"]').count(), 1);
  assert.equal(await page.locator('#overall').innerText(), totals);
  await page.reload();
  assert.equal(await page.locator('#hide-donated').isChecked(), true);
  assert.equal(await page.locator('[data-id="clay"]').count(), 0);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#hide-donated').isChecked(), true);
  await page.locator('#status').selectOption('donated');
  assert.equal(await page.locator('#hide-donated').isChecked(), false);
  assert.equal(await page.locator('.item-card').count(), 1);
  await page.locator('#hide-donated').check();
  assert.equal(await page.locator('#status').inputValue(), 'all');
  assert.equal(await page.locator('[data-id="clay"]').count(), 0);

  await page.locator('#auto-collapse').check();
  // Donating removes the checkbox immediately, so assert the resulting view
  // instead of asking Playwright to re-read its checked state after the click.
  for (const id of ['peat', 'shard-mass', 'shards', 'sod']) await page.locator(`[data-donate="${id}"]`).click();
  assert.equal(await page.locator('[data-set="Archaeology:Dig Site Material Set"]').count(), 0);
  assert.match(await page.locator('#overall').innerText(), /1 \/ 82 sets/);
  assert.equal(await page.locator('#result-title').evaluate(node => document.activeElement === node), true);
  await page.locator('#search').fill('Dig Site Material Set');
  assert.equal(await page.locator('.empty-state').count(), 1);
  await page.locator('#show-donated').click();
  assert.equal(await page.locator('#hide-donated').isChecked(), false);
  assert.equal(await page.locator('[data-toggle-set="Archaeology:Dig Site Material Set"]').getAttribute('aria-expanded'), 'false');
  await page.locator('#reset').click();
  await page.locator('#hide-donated').check();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.cache/filter-options-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Filter option checks passed: separate All Seasons, combined weather, hide donated persistence, not-donated items, status conflicts, full-set totals, focus, and mobile layout.');
} finally { await browser.close(); }
