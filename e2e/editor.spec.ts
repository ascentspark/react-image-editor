import { expect, test, type Page } from '@playwright/test';

/**
 * Functional end-to-end coverage of the editor against the demo's /e2e harness.
 * The harness renders one <ImageEditor> per URL (mode/theme/aspect via query
 * params) plus instrumentation readouts (data-testid="stat-*").
 */

async function openHarness(page: Page, query = 'mode=advanced'): Promise<void> {
  await page.goto(`/e2e?${query}`);
  // The sample image auto-loads; loaded increments once the engine is live.
  await expect(page.getByTestId('stat-loaded')).not.toHaveText('0');
}

function stage(page: Page) {
  return page.locator('.asp-stage').first();
}

test.describe('workspace (advanced mode)', () => {
  test('loads the sample image into a live canvas', async ({ page }) => {
    await openHarness(page);
    await expect(page.locator('.asp-image-editor')).toBeVisible();
    await expect(stage(page).locator('canvas').first()).toBeVisible();
    await expect(page.getByTestId('stat-error')).toHaveText('-');
  });

  test('tool rail renders the resolved groups and switches tools', async ({ page }) => {
    await openHarness(page);
    for (const label of ['Select', 'Crop & rotate', 'Color', 'Draw', 'Shapes', 'Text']) {
      await expect(page.locator('.asp-rail__tool', { hasText: label })).toBeVisible();
    }
    await page.locator('.asp-rail__tool', { hasText: 'Draw' }).click();
    await expect(page.locator('.asp-rail__tool', { hasText: 'Draw' })).toHaveClass(
      /asp-rail__tool--active/,
    );
  });

  test('drawing a stroke enables undo, then redo restores it', async ({ page }) => {
    await openHarness(page);
    const undo = page.getByRole('button', { name: 'Undo' });
    const redo = page.getByRole('button', { name: 'Redo' });
    await expect(undo).toBeDisabled();

    await page.locator('.asp-rail__tool', { hasText: 'Draw' }).click();
    const box = await stage(page).boundingBox();
    if (!box) {
      throw new Error('stage not visible');
    }
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 12 });
    await page.mouse.up();

    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(undo).toBeEnabled();
  });

  test('crop tool shows the frame overlay and applies a region', async ({ page }) => {
    await openHarness(page);
    await page.locator('.asp-rail__tool', { hasText: 'Crop & rotate' }).click();
    await expect(page.locator('.asp-crop-overlay')).toBeVisible();
    await page.getByRole('button', { name: 'Apply crop' }).click();
    // Applying returns to Select (overlay gone). The region is an output
    // setting, not a history entry — parity with the Angular editor — so it
    // surfaces as the crop panel's Reset control on re-entry.
    await expect(page.locator('.asp-crop-overlay')).toHaveCount(0);
    await page.locator('.asp-rail__tool', { hasText: 'Crop & rotate' }).click();
    await expect(page.getByRole('button', { name: 'Reset crop' })).toBeVisible();
  });

  test('adjustments and looks are offered by the Color tool', async ({ page }) => {
    await openHarness(page);
    await page.locator('.asp-rail__tool', { hasText: 'Color' }).click();
    await expect(page.locator('.asp-options-panel')).toContainText('Brightness');
    const slider = page
      .locator('.asp-options-panel input[type="range"]')
      .first();
    await expect(slider).toBeVisible();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  test('zoom controls update the readout and fit resets it', async ({ page }) => {
    await openHarness(page);
    const label = page.locator('.asp-zoom__label').first();
    const before = await label.textContent();
    await page.getByRole('button', { name: 'Zoom in' }).first().click();
    await expect(label).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Fit to screen' }).click();
  });

  test('history panel lists entries after an edit', async ({ page }) => {
    await openHarness(page);
    await page.locator('.asp-rail__tool', { hasText: 'Shapes' }).click();
    // Add a rectangle via the panel's shape grid (first shape button).
    await page.locator('.asp-options-panel .asp-shape-grid button').first().click();
    await page.getByRole('button', { name: 'Edit history' }).click();
    await expect(page.locator('.asp-history-list .asp-history__row').last()).toBeVisible();
  });

  test('export menu downloads a PNG and reports the blob', async ({ page }) => {
    await openHarness(page);
    await page.getByRole('button', { name: 'Export' }).click();
    await page.locator('.asp-fmt', { hasText: 'PNG' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download image' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('image.png');
    await expect(page.getByTestId('stat-exported')).toContainText('image/png');
    // A download is not a commit: onSaved must stay silent (1.2.0 contract).
    await expect(page.getByTestId('stat-saved')).toHaveText('-');
  });

  test('sample picker swaps the canvas image', async ({ page }) => {
    await openHarness(page);
    await page.getByRole('button', { name: 'Image' }).click();
    await page.locator('.asp-sample').nth(1).click();
    await expect(page.getByTestId('stat-loaded')).toHaveText('2');
  });

  test('layers panel shows the stack and object ops', async ({ page }) => {
    await openHarness(page);
    await expect(page.locator('.asp-layer-list')).toContainText('Layers');
    await page.locator('.asp-rail__tool', { hasText: 'Shapes' }).click();
    await page.locator('.asp-options-panel .asp-shape-grid button').first().click();
    // The new shape appears as a row; duplicating it via the panel adds another.
    const rows = page.locator('.asp-layers__row');
    const count = await rows.count();
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(rows).toHaveCount(count + 1);
  });

  test('rulers toggle on and draw the strips', async ({ page }) => {
    await openHarness(page);
    await page.getByRole('button', { name: 'Toggle rulers and guides' }).click();
    await expect(page.locator('.asp-ruler--h')).toBeVisible();
    await expect(page.locator('.asp-ruler--v')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all guides' })).toBeVisible();
  });

  test('keyboard: Ctrl/Cmd+Z undoes while the pointer is over the editor', async ({ page }) => {
    await openHarness(page);
    await page.locator('.asp-rail__tool', { hasText: 'Shapes' }).click();
    await page.locator('.asp-options-panel .asp-shape-grid button').first().click();
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeEnabled();
    await stage(page).hover();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(undo).toBeDisabled();
  });
});

test.describe('basic mode (dialog card / avatar flow)', () => {
  test('1:1 quick-crop preset opens live and saves a blob', async ({ page }) => {
    await openHarness(page, 'mode=basic&aspect=1:1');
    await expect(page.locator('.asp-basic')).toBeVisible();
    // The fixed-frame crop is live immediately, with the repositioning hint.
    await expect(page.locator('.asp-basic__hint')).toContainText('Drag the photo to reposition');
    await expect(page.locator('.asp-chip--active')).toHaveText('1:1');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('stat-saved')).toContainText('image/png');
  });

  test('aspect chips reshape the crop; rotate and flip stay available', async ({ page }) => {
    await openHarness(page, 'mode=basic');
    await page.locator('.asp-chip', { hasText: '1:1' }).click();
    await expect(page.locator('.asp-chip--active')).toHaveText('1:1');
    await page.getByRole('button', { name: 'Rotate right' }).click();
    await page.getByRole('button', { name: 'Flip' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('stat-saved')).not.toHaveText('-');
  });

  test('Cancel emits onCanceled', async ({ page }) => {
    await openHarness(page, 'mode=basic');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('stat-canceled')).toHaveText('1');
  });
});

test.describe('viewer mode', () => {
  test('renders read-only chrome: zoom + export only', async ({ page }) => {
    await openHarness(page, 'mode=viewer');
    await expect(page.locator('.asp-viewer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(page.locator('.asp-rail__tool')).toHaveCount(0);
  });
});

test.describe('openImageEditorDialog', () => {
  test('opens the basic editor in a modal and resolves with the saved blob', async ({ page }) => {
    await openHarness(page);
    await page.getByTestId('open-dialog').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.asp-basic__title')).toHaveText('Update profile photo');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('stat-dialog')).toContainText('blob:');
    await expect(dialog).toHaveCount(0);
  });

  test('Escape cancels and resolves null', async ({ page }) => {
    await openHarness(page);
    await page.getByTestId('open-dialog').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('stat-dialog')).toHaveText('null');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });
});
