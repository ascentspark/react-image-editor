import { describe, expect, it } from 'vitest';

import { OPAQUE_EXPORT_FALLBACK, resolveExportFill } from './export-fill';

describe('resolveExportFill', () => {
  it('adds nothing when the scene already has a background', () => {
    expect(resolveExportFill(true, '#ff0000', 'png')).toBeNull();
    expect(resolveExportFill(true, null, 'jpeg')).toBeNull();
  });

  it('contain_mode_export_composites_the_background_colour: the host colour wins in every format', () => {
    expect(resolveExportFill(false, '#ff0000', 'png')).toBe('#ff0000');
    expect(resolveExportFill(false, '#ff0000', 'webp')).toBe('#ff0000');
    expect(resolveExportFill(false, '#ff0000', 'jpeg')).toBe('#ff0000');
  });

  it('keeps alpha-capable formats transparent when nothing was asked for', () => {
    expect(resolveExportFill(false, null, 'png')).toBeNull();
    expect(resolveExportFill(false, null, 'webp')).toBeNull();
  });

  it('never lets a JPEG encode transparency as black', () => {
    expect(resolveExportFill(false, null, 'jpeg')).toBe(OPAQUE_EXPORT_FALLBACK);
    expect(OPAQUE_EXPORT_FALLBACK).toBe('#ffffff');
  });

  it('treats an empty host colour as unset', () => {
    expect(resolveExportFill(false, '', 'png')).toBeNull();
  });
});
