/**
 * Pure geometry for the fixed-frame ("avatar") crop: how far the image may
 * zoom out, and how far it may pan, for each {@link AspFitMode}.
 *
 * Scales are Fabric object scales (source pixels → scene units). Zoom
 * percentages are relative to the COVER scale, so `100` always means "the
 * image exactly fills the frame" whatever the fit mode — `contain` only lowers
 * the floor below it. Kept free of Fabric so it can be unit-tested.
 */

import type { AspFitMode } from '../types/editor.types';
import type { FrameRect } from './crop-session';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Ceiling of the fixed-frame zoom, in cover-relative percent. */
export const IMAGE_CROP_ZOOM_MAX = 400;

/** Axis-aligned bounds of a `width`×`height` rectangle rotated by `angleDeg`. */
export function rotatedBounds(width: number, height: number, angleDeg: number): Size {
  const rad = ((angleDeg % 360) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { width: width * cos + height * sin, height: width * sin + height * cos };
}

/** The smallest scale at which `bounds` still covers every pixel of `frame`. */
export function coverScale(frame: Size, bounds: Size): number {
  return Math.max(frame.width / bounds.width, frame.height / bounds.height);
}

/** The largest scale at which the whole of `bounds` still fits inside `frame`. */
export function containScale(frame: Size, bounds: Size): number {
  return Math.min(frame.width / bounds.width, frame.height / bounds.height);
}

/**
 * The zoom floor in cover-relative percent. `cover` pins it at 100 (the frame
 * is always filled). `contain` lowers it to the whole-image fit, rounded DOWN
 * so the floor is reachable on an integer slider and the whole image is
 * guaranteed inside the frame there; never below 1.
 */
export function minImageCropZoomPct(mode: AspFitMode, cover: number, contain: number): number {
  if (mode === 'cover' || cover <= 0) {
    return 100;
  }
  return Math.max(1, Math.min(100, Math.floor((100 * contain) / cover)));
}

/**
 * The pan correction that keeps the image's bounds `b` legal against `frame`.
 *
 * Per axis: when the image overflows the frame (always, in `cover`), the frame
 * must stay covered — no gap may open at either edge. When it fits inside the
 * frame (only possible in `contain`), it may slide freely within the frame but
 * never past its edges, so a letterboxed image cannot be dragged out of view.
 */
export function frameOffsetCorrection(
  frame: FrameRect,
  b: FrameRect,
  mode: AspFitMode,
): { dx: number; dy: number } {
  return {
    dx: axisCorrection(frame.left, frame.width, b.left, b.width, mode),
    dy: axisCorrection(frame.top, frame.height, b.top, b.height, mode),
  };
}

function axisCorrection(
  frameStart: number,
  frameSize: number,
  start: number,
  size: number,
  mode: AspFitMode,
): number {
  const frameEnd = frameStart + frameSize;
  const end = start + size;
  const fitsInside = mode === 'contain' && size <= frameSize + 1e-6;
  if (fitsInside) {
    if (start < frameStart) {
      return frameStart - start;
    }
    if (end > frameEnd) {
      return frameEnd - end;
    }
    return 0;
  }
  if (start > frameStart) {
    return frameStart - start;
  }
  if (end < frameEnd) {
    return frameEnd - end;
  }
  return 0;
}
