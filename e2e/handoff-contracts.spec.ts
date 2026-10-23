import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The five behavioural contracts from the Phlebio handoff (2026-10), named
 * identically in the React sibling so parity is checkable by grepping:
 *
 * 1. A commit action exists in every chrome, returns the result to the host and
 *    writes no file; `saved` and `exported` are distinct.
 * 2. Chrome is selectable independently of the tool set / mode.
 * 3. An initial aspect either enforces a frame or does not render as active.
 * 4. A `contain` fit mode exists; `cover` stays the default.
 * 5. One zoom floor per interaction state, exposed to the slider.
 */

async function open(page: Page, params: Record<string, string>): Promise<void> {
  await page.goto(`/e2e?${new URLSearchParams(params).toString()}`);
  await expect(page.getByTestId('stat-loaded')).not.toHaveText('0');
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('stat-saved')).not.toHaveText('-');
  await expect(page.getByTestId('stat-saved-size')).not.toHaveText('-');
}

function zoomSlider(page: Page): Locator {
  return page.getByLabel('Zoom', { exact: true });
}

/** `r,g,b,a` from the harness → numbers. */
function rgba(text: string | null): number[] {
  return (text ?? '').split(',').map(Number);
}

function expectRed([r, g, b, a]: number[]): void {
  expect(r).toBeGreaterThan(220);
  expect(g).toBeLessThan(40);
  expect(b).toBeLessThan(40);
  expect(a).toBe(255);
}

test.describe('contract 1 — commit vs export', () => {
  for (const [label, params, button] of [
    ['workspace', { mode: 'advanced' }, 'Apply'],
    ['viewer', { mode: 'viewer' }, 'Apply'],
    ['dialog', { mode: 'basic', aspect: '1:1' }, 'Save'],
  ] as const) {
    test(`commit_action_emits_blob_and_writes_no_file (${label})`, async ({ page }) => {
      await open(page, params);
      const downloads: string[] = [];
      page.on('download', (d) => downloads.push(d.suggestedFilename()));
      await page.getByRole('button', { name: button, exact: true }).click();
      await expectSaved(page);
      await expect(page.getByTestId('stat-downloads')).toHaveText('0');
      await expect(page.getByTestId('stat-object-urls')).toHaveText('0');
      expect(downloads).toEqual([]);
    });
  }

  test('export_action_does_not_emit_the_commit_event', async ({ page }) => {
    await open(page, { mode: 'advanced' });
    await page.getByRole('button', { name: 'Export' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download image' }).click();
    await download;
    await expect(page.getByTestId('stat-exported')).not.toHaveText('-');
    await expect(page.getByTestId('stat-downloads')).toHaveText('1');
    await expect(page.getByTestId('stat-saved')).toHaveText('-');
  });

  test('the commit label is host-defined and the download can be removed', async ({ page }) => {
    await open(page, { mode: 'advanced', commit: 'Use this logo', download: '0' });
    await expect(page.getByRole('button', { name: 'Use this logo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Format' }).click();
    await expect(page.getByRole('button', { name: 'Download image' })).toHaveCount(0);
  });
});

test.describe('contract 2 — chrome is independent of mode', () => {
  test('a basic tool set renders in the full workspace with a commit button', async ({ page }) => {
    await open(page, { mode: 'basic', chrome: 'workspace' });
    await expect(page.locator('.asp-workspace')).toBeVisible();
    await expect(page.locator('.asp-rail__tool')).not.toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeVisible();
  });

  test('an advanced mode renders in the compact dialog and hugs its card width', async ({ page }) => {
    await open(page, { mode: 'advanced', chrome: 'dialog', aspect: '1:1', shell: '900' });
    await expect(page.locator('.asp-basic')).toBeVisible();
    const width = await page.locator('.asp-image-editor').evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(520);
  });
});

test.describe('contract 3 — initial aspect', () => {
  test('initial_aspect_creates_a_crop_frame_in_every_chrome', async ({ page }) => {
    // Workspace: the Crop tool is entered and its movable frame is live at 1:1.
    await open(page, { mode: 'advanced', aspect: '1:1' });
    await expect(page.getByRole('button', { name: 'Apply crop' })).toBeVisible();
    await expect(page.locator('.asp-chip--active', { hasText: '1:1' })).toBeVisible();

    // Dialog: the fixed frame is live (the pan/zoom hint only renders while cropping).
    await open(page, { mode: 'basic', aspect: '1:1' });
    await expect(page.getByText('Drag the photo to reposition')).toBeVisible();
    await expect(page.locator('.asp-chip--active', { hasText: '1:1' })).toBeVisible();
  });

  test('a chip is never active where nothing enforces it (no crop tool)', async ({ page }) => {
    await open(page, { mode: 'advanced', aspect: '1:1', tools: 'rotate,flip' });
    await expect(page.locator('.asp-chip--active', { hasText: '1:1' })).toHaveCount(0);
    // No crop session was started either (the thirds overlay only renders in the Crop tool).
    await expect(page.locator('.asp-crop-overlay')).toHaveCount(0);
  });
});

test.describe('contract 4 — fit mode', () => {
  const wordmark = { mode: 'basic', aspect: '1:1', source: '2282x832', shell: '640' };

  test('cover_mode_is_unchanged_by_default', async ({ page }) => {
    await open(page, { ...wordmark, bg: 'ff0000' });
    await expect(zoomSlider(page)).toHaveAttribute('min', '100');
    await expect(zoomSlider(page)).toHaveValue('100');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectSaved(page);
    // The frame is fully covered, so the corner is image (white/black grid), not the fill.
    const [r, g, b] = rgba(await page.getByTestId('stat-saved-corner').textContent());
    expect(Math.abs(r - g)).toBeLessThan(10);
    expect(Math.abs(g - b)).toBeLessThan(10);
  });

  test('contain_mode_zooms_below_cover_to_whole_image_fit', async ({ page }) => {
    await open(page, { ...wordmark, fit: 'contain' });
    // 100 × (frame/2282) / (frame/832) = 36.46 → floor 36
    await expect(zoomSlider(page)).toHaveAttribute('min', '36');
    await expect(zoomSlider(page)).toHaveValue('36');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectSaved(page);
    const [w, h] = ((await page.getByTestId('stat-saved-size').textContent()) ?? '').split('x').map(Number);
    expect(w).toBe(h);
  });

  for (const format of ['png', 'jpeg'] as const) {
    test(`contain_mode_export_composites_the_background_colour (${format})`, async ({ page }) => {
      await open(page, { ...wordmark, fit: 'contain', bg: 'ff0000', format });
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expectSaved(page);
      await expect(page.getByTestId('stat-saved')).toContainText(`image/${format}`);
      expectRed(rgba(await page.getByTestId('stat-saved-corner').textContent()));
    });
  }

  test('a jpeg of a letterboxed crop is never black when no background was given', async ({ page }) => {
    await open(page, { ...wordmark, fit: 'contain', format: 'jpeg' });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectSaved(page);
    const [r, g, b] = rgba(await page.getByTestId('stat-saved-corner').textContent());
    expect(Math.min(r, g, b)).toBeGreaterThan(240);
  });

  test('a png of a letterboxed crop stays transparent when no background was given', async ({ page }) => {
    await open(page, { ...wordmark, fit: 'contain' });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectSaved(page);
    expect(rgba(await page.getByTestId('stat-saved-corner').textContent())[3]).toBe(0);
  });
});

test.describe('contract 5 — one zoom floor', () => {
  test('zoom_slider_min_is_reachable_in_fixed_frame_crop', async ({ page }) => {
    await open(page, { mode: 'basic', aspect: '1:1', source: '2282x832', shell: '640', fit: 'contain' });
    const slider = zoomSlider(page);
    const min = await slider.getAttribute('min');
    await slider.fill('400');
    await expect(slider).toHaveValue('400');
    await slider.fill(min ?? '0');
    // The clamp honours the same floor the slider advertises: no bounce back up.
    await expect(slider).toHaveValue(min ?? '');
  });

  test('switching the fixed frame to Free restores the viewport zoom floor', async ({ page }) => {
    await open(page, { mode: 'basic', aspect: '1:1' });
    await expect(zoomSlider(page)).toHaveAttribute('min', '100');
    await page.getByRole('button', { name: 'Free' }).click();
    await expect(zoomSlider(page)).toHaveAttribute('min', '25');
  });
});

test.describe('packaged dialog', () => {
  test('dialog_forwards_every_declared_input (fit, label, chrome reach the modal) and traps focus', async ({ page }) => {
    const params = {
      dialog: '1',
      mode: 'advanced',
      chrome: 'dialog',
      aspect: '1:1',
      source: '2282x832',
      fit: 'contain',
      bg: 'ff0000',
      commit: 'Use this logo',
    };
    // No inline editor in this layout — the modal is the thing that loads.
    await page.goto(`/e2e?${new URLSearchParams(params).toString()}`);
    const opener = page.getByTestId('open-dialog');
    await expect(opener).toBeVisible();
    await opener.focus();
    await opener.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.asp-basic')).toBeVisible();
    await expect(modal.getByText('Drag the photo to reposition')).toBeVisible();
    await expect(modal.getByLabel('Zoom', { exact: true })).toHaveAttribute('min', '36');
    // Tab never leaves the modal.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
    }
    await modal.getByRole('button', { name: 'Use this logo' }).click();
    await expectSaved(page);
    expectRed(rgba(await page.getByTestId('stat-saved-corner').textContent()));
    await expect(modal).toHaveCount(0);
    // Focus returned to the opener.
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('open-dialog');
  });
});
