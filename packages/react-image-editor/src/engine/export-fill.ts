/**
 * What goes under the pixels the scene does not paint when a raster is exported:
 * a `contain` crop's letterbox bands, the corners of a rotated image, or a
 * transparent source.
 *
 * Pure so the rule is testable; the engine applies the result by painting the
 * canvas background for the duration of the export only.
 */

export type RasterExportFormat = 'png' | 'jpeg' | 'webp';

/** Formats whose encoding carries an alpha channel. */
const ALPHA_FORMATS: ReadonlySet<RasterExportFormat> = new Set(['png', 'webp']);

/** Opaque fallback for formats that cannot encode alpha — never black. */
export const OPAQUE_EXPORT_FALLBACK = '#ffffff';

/**
 * The colour to composite under the export, or `null` to leave the scene as is.
 *
 * - A background the user set with the Background tool already paints, so
 *   nothing is added (`null`).
 * - Otherwise the host's `exportBackground` wins, in every format.
 * - Otherwise alpha-capable formats stay transparent (the host chose PNG/WebP),
 *   and alpha-less formats are filled white — a JPEG with transparent pixels
 *   encodes them black, which reads as a rendering bug.
 */
export function resolveExportFill(
  sceneHasBackground: boolean,
  exportBackground: string | null,
  format: RasterExportFormat,
): string | null {
  if (sceneHasBackground) {
    return null;
  }
  if (exportBackground) {
    return exportBackground;
  }
  return ALPHA_FORMATS.has(format) ? null : OPAQUE_EXPORT_FALLBACK;
}
