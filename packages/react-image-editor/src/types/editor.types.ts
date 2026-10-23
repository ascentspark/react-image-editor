/**
 * Public type contract for the editor.
 *
 * The tool and filter unions are derived from `as const` source arrays so the
 * registry (and any exhaustiveness check) is structurally guaranteed to cover
 * every member — there is one source of truth, not a union plus a parallel list
 * that can drift.
 */

/** Layout/baseline preset — sets the default chrome and a default tool set. */
export type AspMode = 'viewer' | 'basic' | 'advanced' | 'full';

/**
 * Which chrome renders around the canvas, independent of the tool set:
 * `dialog` is the compact card with a fixed crop frame (the image pans and
 * zooms underneath it), `workspace` the full rail + options + layers surface
 * with a movable crop frame, `viewer` a read-only zoom + export bar.
 * Each {@link AspMode} has a default chrome — see {@link defaultChromeFor}.
 */
export type AspChrome = 'dialog' | 'workspace' | 'viewer';

/** The chrome a mode renders in unless the host overrides it with `chrome`. */
export function defaultChromeFor(mode: AspMode): AspChrome {
  switch (mode) {
    case 'basic':
      return 'dialog';
    case 'viewer':
      return 'viewer';
    default:
      return 'workspace';
  }
}

/**
 * How the image fits the fixed crop frame of the `dialog` chrome.
 * `cover` (default, avatar crop): the image always fills the frame — the zoom
 * floor is the cover scale and the result never has gaps. `contain` (logo /
 * artwork crop): the zoom floor is the whole-image fit, so an image of any
 * aspect can be placed inside the frame; uncovered area is filled with the
 * export background at export time.
 */
export type AspFitMode = 'cover' | 'contain';


/**
 * A host-controllable size: a number (interpreted as `px`) or any CSS length —
 * `'600px'`, `'70%'`, `'80vh'`, `'calc(100vh - 120px)'`. Used for the editor's
 * `width`/`height` inputs. A per-mode minimum is always enforced on top so the
 * toolbars and panels keep enough room to render.
 */
export type AspSize = number | string;

/** Every tool the editor can expose, grouped by capability. Source of truth for {@link AspTool}. */
export const ALL_TOOLS = [
  // transform
  'crop',
  'rotate',
  'straighten',
  'flip',
  'resize',
  // draw / annotate
  'pen',
  'highlighter',
  'eraser',
  'shapes',
  'arrow',
  'line',
  'text',
  'sticker',
  'redact',
  'magicwand',
  'removebg',
  'selectsubject',
  // adjust / color
  'adjust',
  'filters',
  // object ops (Fabric object model)
  'select',
  'layers',
  'duplicate',
  'delete',
  'opacity',
  'align',
  'group',
  // canvas
  'background',
  'frame',
] as const;

export type AspTool = (typeof ALL_TOOLS)[number];

/** Fabric.js built-in filters exposed by the editor. Source of truth for {@link AspFilter}. */
export const ALL_FILTERS = [
  'brightness',
  'contrast',
  'saturation',
  'vibrance',
  'hue',
  'blur',
  'sharpen',
  'grayscale',
  'sepia',
  'invert',
  'pixelate',
  'noise',
  'gamma',
  'blendColor',
] as const;

export type AspFilter = (typeof ALL_FILTERS)[number];

/** Export formats. `json` serializes the re-editable Fabric scene; `pdf` embeds a raster. */
export type AspExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'json' | 'pdf';

/** A structured error surfaced via the `errorOccurred` output. */
export interface AspEditorError {
  /** Stable machine code, e.g. `'load-failed'`, `'export-failed'`, `'engine-init-failed'`. */
  readonly code: string;
  readonly message: string;
}

/** Crop aspect-ratio presets. */
export type AspAspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'original';

/**
 * A host-defined crop aspect option — e.g. a CMS target like a 1200×630 social
 * image. `ratio` is width / height; build it from explicit dimensions with
 * {@link aspectOption}.
 */
export interface AspAspectOption {
  readonly label: string;
  readonly ratio: number;
  /**
   * Target export width in real pixels. When set, cropping to this option
   * exports at these dimensions (capped by the source image's real resolution)
   * instead of at the on-screen size of the crop.
   */
  readonly width?: number;
  /** Target export height in px. See {@link AspAspectOption.width}. */
  readonly height?: number;
}

/** Build an {@link AspAspectOption} from explicit pixel dimensions. */
export function aspectOption(width: number, height: number, label?: string): AspAspectOption {
  return { label: label ?? `${width}×${height}`, ratio: width / height, width, height };
}

/**
 * A concrete pixel target for the exported crop. The export is rendered at this
 * size unless the source image does not hold that many real pixels, in which
 * case it is capped at the source's resolution — the editor never upscales.
 */
export interface AspExportTarget {
  readonly width: number;
  readonly height: number;
}
