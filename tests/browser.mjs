import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.cache', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:5174');
  await page.locator('.item-card').first().waitFor();
  assert.equal(await page.locator('.item-card').count(), 409);
  await page.locator('[data-wing="Fish"]').click();
  await page.locator('[data-filter="seasons"][value="Spring"]').check();
  await page.locator('[data-filter="weather"][value="Wind"]').check();
  assert.equal(await page.locator('[data-id="cherry-fish"]').count(), 1);
  await page.locator('[data-filter="weather"][value="Wind"]').uncheck();
  await page.locator('[data-filter="weather"][value="Rain"]').check();
  assert.equal(await page.locator('[data-id="cherry-fish"]').count(), 0);
  assert.ok(await page.locator('.item-card').count() > 0);
  await page.screenshot({ path: '.cache/fish-filters.png' });

  await page.locator('#reset').click();
  await page.locator('#search').fill('cherry fish');
  assert.equal(await page.locator('.item-card').count(), 1);
  await page.locator('[data-details="cherry-fish"]').click();
  assert.match(await page.locator('.item-details').innerText(), /Small/);
  assert.equal(await page.locator('[data-notes], [data-status]').count(), 0);
  assert.match(await page.locator('.item-status').innerText(), /Not donated/);
  await page.locator('[data-donate="cherry-fish"]').check();
  await page.reload();
  await page.locator('#search').fill('cherry fish');
  assert.equal(await page.locator('[data-donate="cherry-fish"]').isChecked(), true);
  await page.locator('[data-details="cherry-fish"]').click();
  assert.equal(await page.locator('[data-notes], [data-status]').count(), 0);
  assert.match(await page.locator('#overall').innerText(), /1/);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /mistria-fieldnotes/);
  await download.saveAs('.cache/test-backup.json');
  await page.locator('[data-donate="cherry-fish"]').uncheck();
  await page.locator('#backup-file').setInputFiles('.cache/test-backup.json');
  await page.locator('#confirm-import').click();
  assert.equal(await page.locator('[data-donate="cherry-fish"]').isChecked(), true);

  await page.locator('#backup-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"oops":true}') });
  assert.equal(await page.locator('[data-donate="cherry-fish"]').isChecked(), true);
  await page.locator('#search').fill('no possible match xyz');
  assert.equal(await page.locator('.empty-state').count(), 1);
  await page.locator('#clear-results').click();
  assert.equal(await page.locator('.item-card').count(), 409);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.cache/mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#mobile-filters').click();
  await page.locator('[data-filter="seasons"][value="Winter"]').check();
  await page.locator('#mobile-filters').click();
  assert.equal(await page.locator('#filters').isVisible(), false);
  assert.ok(await page.locator('.item-card').count() < 409);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: combined filters, details, saved donations, export/import, invalid import, empty state, mobile layout.');
} finally { await browser.close(); }
