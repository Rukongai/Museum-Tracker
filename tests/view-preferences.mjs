import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.TEST_URL || 'http://localhost:5174';
const toggle = () => page.locator('[data-toggle-set="Archaeology:Dig Site Material Set"]');
const expanded = async () => (await toggle().getAttribute('aria-expanded')) === 'true';
try {
  await page.goto(url);
  await page.locator('#toggle-theme').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('#toggle-theme').getAttribute('aria-pressed'), 'true');
  await toggle().focus();
  await page.keyboard.press('Enter');
  assert.equal(await expanded(), false);
  assert.equal(await page.locator('[data-id="clay"]').isVisible(), false);
  await page.locator('#search').fill('clay');
  assert.equal(await expanded(), false);
  await page.reload();
  assert.equal(await expanded(), false);
  await page.locator('#expand-sets').click();
  assert.equal(await page.locator('.item-grid[hidden]').count(), 0);
  await page.locator('#collapse-sets').click();
  assert.equal(await page.locator('.item-grid[hidden]').count(), 82);
  await page.locator('#expand-sets').click();

  await page.locator('#auto-collapse').check();
  await page.locator('#search').fill('clay');
  await page.locator('[data-donate="clay"]').check();
  // A fully donated filtered subset must not count as a complete museum set.
  assert.equal(await expanded(), true);
  await page.locator('#search').fill('');
  for (const id of ['peat', 'shard-mass', 'shards']) await page.locator(`[data-donate="${id}"]`).check();
  await page.locator('[data-details="sod"]').click();
  assert.equal(await page.locator('[data-status="sod"]').count(), 0);
  assert.equal(await expanded(), true);
  await page.locator('[data-donate="sod"]').check();
  assert.equal(await expanded(), false);
  assert.equal(await toggle().evaluate(node => document.activeElement === node), true);
  assert.match(await page.locator('[data-set="Archaeology:Dig Site Material Set"] .set-progress').innerText(), /5 \/ 5/);
  await toggle().click();
  assert.equal(await expanded(), true);
  await page.reload();
  assert.equal(await expanded(), true); // Manual reopening is remembered.
  assert.equal(await page.locator('#auto-collapse').isChecked(), true);
  await page.locator('[data-donate="sod"]').uncheck();
  await page.locator('[data-donate="sod"]').check();
  assert.equal(await expanded(), false); // A new completion collapses it again.
  await page.locator('#auto-collapse').uncheck();
  assert.equal(await expanded(), true);
  await page.locator('#auto-collapse').check();
  assert.equal(await expanded(), false); // Existing completed sets also collapse.
  await page.screenshot({ path: '.cache/dark-mode.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.cache/dark-mode-mobile.png' });
  await page.locator('#toggle-theme').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  const systemContext = await browser.newContext({ colorScheme: 'dark' });
  const systemPage = await systemContext.newPage();
  await systemPage.goto(url);
  assert.equal(await systemPage.locator('html').getAttribute('data-theme'), 'dark');
  assert.deepEqual(errors, []);
  console.log('View preference checks passed: dark/system theme, reload persistence, keyboard and bulk collapse, filtering, completion and reopening, mobile layout.');
} finally { await browser.close(); }
