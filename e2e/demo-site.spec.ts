import { expect, test } from '@playwright/test';

/**
 * The docs site exercises the library the way the README tells people to.
 * These check the showcase flows added for the commit / chrome / fit-mode work.
 */

test('playground: the logo dialog places a wide logo in a square slot and hands back a Blob', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.asp-image-editor').first()).toBeVisible();
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));

  await page.getByRole('button', { name: 'Logo crop dialog' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Place the logo')).toBeVisible();
  // contain fit: the slider floor sits below the cover floor for a wide logo
  const min = Number(await modal.getByLabel('Zoom', { exact: true }).getAttribute('min'));
  expect(min).toBeLessThan(100);
  await modal.getByRole('button', { name: 'Use this logo' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.result')).toContainText('saved image/png');
  await expect(page.locator('.result__thumb')).toBeVisible();
  expect(downloads).toEqual([]);
});

test('playground: commit-only hides the download and relabels the commit button', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.asp-image-editor').first()).toBeVisible();
  await page.getByRole('button', { name: 'Commit only (no download)' }).click();
  await expect(page.getByRole('button', { name: 'Use this image' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Format' })).toBeVisible();
  await page.getByRole('button', { name: 'Show code' }).click();
  await expect(page.locator('.code-modal__code')).toContainText('showDownload={false}');
});

test('configuration: the basic tool set renders in the workspace chrome with a commit button', async ({ page }) => {
  await page.goto('/configuration#chrome');
  const section = page.locator('#chrome');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('.asp-workspace')).toBeVisible();
  await section.getByRole('button', { name: 'Use this image' }).click();
  await expect(section.locator('.note')).toContainText('nothing downloaded');
});

test('export: the letterbox example commits a square logo', async ({ page }) => {
  await page.goto('/export#background');
  const section = page.locator('#background');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('.asp-basic')).toBeVisible();
  await section.getByRole('button', { name: 'Use this logo' }).click();
  await expect(section.locator('.note')).toContainText('committed image/png');
  await expect(section.locator('.thumb')).toBeVisible();
});
