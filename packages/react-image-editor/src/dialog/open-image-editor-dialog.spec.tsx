import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DIALOG_FORWARDED_PROPS,
  openImageEditorDialog,
  resolveDialogProps,
  type OpenImageEditorConfig,
} from './open-image-editor-dialog';

/**
 * A config with EVERY forwardable key set. `Required<>` makes adding a key to
 * the config type without adding it here a compile error, so the test below
 * can never silently skip a new prop.
 */
const FULL_CONFIG: Required<Omit<OpenImageEditorConfig, 'width' | 'maxWidth' | 'height'>> = {
  src: 'data:image/png;base64,',
  mode: 'advanced',
  chrome: 'dialog',
  tools: ['crop', 'rotate'],
  disabledTools: ['rotate'],
  filters: ['brightness'],
  heading: 'Pick a logo',
  baseColor: '#ffffff',
  accentColor: '#ff4806',
  themeMode: 'dark',
  aspectPresets: ['1:1'],
  initialAspect: '1:1',
  aspectRatios: [{ label: 'Wide', ratio: 3 }],
  fitMode: 'contain',
  exportFormats: ['png'],
  exportQuality: 80,
  exportTarget: { width: 512, height: 512 },
  exportBackground: '#ffffff',
  commitLabel: 'Use this logo',
  showCommit: true,
  showDownload: false,
  showHistory: false,
  keyboardEnabled: false,
  fonts: [{ label: 'Inter', value: 'Inter' }],
};

describe('resolveDialogProps', () => {
  it('dialog_forwards_every_declared_input', () => {
    const forwarded = resolveDialogProps(FULL_CONFIG) as Record<string, unknown>;
    for (const key of Object.keys(FULL_CONFIG) as (keyof typeof FULL_CONFIG)[]) {
      expect(forwarded[key], `config.${key} must reach the editor`).toEqual(FULL_CONFIG[key]);
    }
    expect(DIALOG_FORWARDED_PROPS).toHaveLength(Object.keys(FULL_CONFIG).length);
  });

  it('defaults to the basic crop dialog with the stock theme when nothing is set', () => {
    const forwarded = resolveDialogProps({});
    expect(forwarded.mode).toBe('basic');
    expect(forwarded.heading).toBe('Edit image');
    expect(forwarded.themeMode).toBe('light');
    expect('fitMode' in forwarded).toBe(false);
    expect('chrome' in forwarded).toBe(false);
  });

  it('forwards an explicit null (e.g. chrome: null) but skips undefined', () => {
    const forwarded = resolveDialogProps({ chrome: null, exportTarget: undefined });
    expect('chrome' in forwarded).toBe(true);
    expect(forwarded.chrome).toBeNull();
    expect('exportTarget' in forwarded).toBe(false);
  });
});

describe('openImageEditorDialog', () => {
  let opener: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('labels the modal, traps focus inside it, and restores focus to the opener on Escape', async () => {
    let result: Promise<Blob | null> = Promise.resolve(null);
    await act(async () => {
      result = openImageEditorDialog({ heading: 'Crop avatar' });
    });
    const scrim = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(scrim).not.toBeNull();
    expect(scrim?.getAttribute('aria-modal')).toBe('true');
    expect(scrim?.getAttribute('aria-label')).toBe('Crop avatar');
    // Focus moved off the opener and into the modal.
    expect(document.activeElement).not.toBe(opener);
    expect(scrim?.contains(document.activeElement)).toBe(true);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await expect(result).resolves.toBeNull();
    expect(document.activeElement).toBe(opener);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('sizes the card for the chrome it opens: hugging card for the dialog, roomy for the workspace', async () => {
    let basic: Promise<Blob | null> = Promise.resolve(null);
    await act(async () => {
      basic = openImageEditorDialog({});
    });
    const basicCard = document.querySelector<HTMLElement>('[role="dialog"] > div');
    expect(basicCard?.style.width).toBe('520px');
    expect(basicCard?.style.height).toBe('auto');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await basic;
    await act(async () => {
      await Promise.resolve();
    });

    let workspace: Promise<Blob | null> = Promise.resolve(null);
    await act(async () => {
      workspace = openImageEditorDialog({ mode: 'advanced', width: 900, height: '80vh' });
    });
    const wsCard = document.querySelector<HTMLElement>('[role="dialog"] > div');
    expect(wsCard?.style.width).toBe('900px');
    expect(wsCard?.style.height).toBe('80vh');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await workspace;
  });
});
