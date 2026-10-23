import { describe, expect, it } from 'vitest';

import {
  IMAGE_CROP_ZOOM_MAX,
  containScale,
  coverScale,
  frameOffsetCorrection,
  minImageCropZoomPct,
  rotatedBounds,
} from './image-crop-fit';

const square = { left: 100, top: 100, width: 400, height: 400 };

describe('rotatedBounds', () => {
  it('is the identity at 0° and swaps axes at 90°', () => {
    expect(rotatedBounds(300, 100, 0)).toEqual({ width: 300, height: 100 });
    const r = rotatedBounds(300, 100, 90);
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(300);
  });

  it('grows the box for an oblique angle', () => {
    const r = rotatedBounds(200, 200, 45);
    expect(r.width).toBeCloseTo(200 * Math.SQRT2);
    expect(r.height).toBeCloseTo(200 * Math.SQRT2);
  });
});

describe('cover / contain scale', () => {
  // A 2282×832 wordmark in a 400×400 slot — the shape from the handoff.
  const wordmark = { width: 2282, height: 832 };

  it('cover scales the SHORT side up to the frame', () => {
    expect(coverScale(square, wordmark)).toBeCloseTo(400 / 832);
  });

  it('contain scales the LONG side down to the frame', () => {
    expect(containScale(square, wordmark)).toBeCloseTo(400 / 2282);
  });

  it('agree when the image already has the frame aspect', () => {
    expect(coverScale(square, { width: 800, height: 800 })).toBe(0.5);
    expect(containScale(square, { width: 800, height: 800 })).toBe(0.5);
  });
});

describe('minImageCropZoomPct', () => {
  const cover = 400 / 832;
  const contain = 400 / 2282;

  it('cover_mode_is_unchanged_by_default: the floor is the cover scale', () => {
    expect(minImageCropZoomPct('cover', cover, contain)).toBe(100);
  });

  it('contain_mode_zooms_below_cover_to_whole_image_fit', () => {
    // 100 × (400/2282) / (400/832) = 36.46… → floored so the slider can reach it
    expect(minImageCropZoomPct('contain', cover, contain)).toBe(36);
  });

  it('never exceeds 100 or drops below 1', () => {
    expect(minImageCropZoomPct('contain', 1, 1)).toBe(100);
    expect(minImageCropZoomPct('contain', 1, 0.0001)).toBe(1);
  });

  it('exposes one ceiling for the slider and the clamp', () => {
    expect(IMAGE_CROP_ZOOM_MAX).toBe(400);
  });
});

describe('frameOffsetCorrection', () => {
  it('cover: pulls an overflowing image back so no gap opens at an edge', () => {
    // Image 800 wide, dragged right so its left edge is inside the frame.
    const b = { left: 150, top: 0, width: 800, height: 800 };
    expect(frameOffsetCorrection(square, b, 'cover')).toEqual({ dx: -50, dy: 0 });
  });

  it('cover: leaves an image that fully covers the frame alone', () => {
    const b = { left: -100, top: -100, width: 800, height: 800 };
    expect(frameOffsetCorrection(square, b, 'cover')).toEqual({ dx: 0, dy: 0 });
  });

  it('contain: a letterboxed image may float inside the frame but not leave it', () => {
    // 300 wide inside a 400 frame: at left 150 it is fully inside → no correction.
    expect(
      frameOffsetCorrection(square, { left: 150, top: 100, width: 300, height: 400 }, 'contain'),
    ).toEqual({ dx: 0, dy: 0 });
    // Dragged so its right edge passes the frame's right edge → pushed back.
    expect(
      frameOffsetCorrection(square, { left: 300, top: 100, width: 300, height: 400 }, 'contain'),
    ).toEqual({ dx: -100, dy: 0 });
    // Dragged past the left edge → pushed back.
    expect(
      frameOffsetCorrection(square, { left: 50, top: 100, width: 300, height: 400 }, 'contain'),
    ).toEqual({ dx: 50, dy: 0 });
  });

  it('contain: an axis that still overflows the frame keeps the cover rule', () => {
    // Taller than the frame: the top edge may not drop below the frame's top.
    expect(
      frameOffsetCorrection(square, { left: 150, top: 120, width: 300, height: 600 }, 'contain'),
    ).toEqual({ dx: 0, dy: -20 });
  });
});
