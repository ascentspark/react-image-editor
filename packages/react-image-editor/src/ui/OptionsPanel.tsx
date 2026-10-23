import { type ChangeEvent, type ReactElement, useId, useState } from 'react';

import { AspIcon } from '../icons/AspIcon';
import { AspColorField } from './ColorField';
import { type ArtboardSize, type RedactMode, type ShapeKind } from '../engine/editor-engine';
import { type FilterMeta } from '../registry/tool-registry';
import {
  type AspAspectOption,
  type AspAspectPreset,
  type AspCropFrame,
  type AspFilter,
  type AspTool,
} from '../types/editor.types';
import { type FontOption } from '../fonts/fonts';

export type { RedactMode } from '../engine/editor-engine';

/** Frame styles offered in the frame panel. */
export interface FrameOption {
  readonly key: string;
  readonly label: string;
}

export const FRAME_OPTIONS: readonly FrameOption[] = [
  { key: 'none', label: 'None' },
  { key: 'mat', label: 'Mat' },
  { key: 'line', label: 'Line' },
  { key: 'inset', label: 'Inset' },
  { key: 'hook', label: 'Hook' },
  { key: 'bead', label: 'Bead' },
];

export type PanelKind =
  | 'color'
  | 'transform'
  | 'annotate'
  | 'frame'
  | 'background'
  | 'magic'
  | 'ai'
  | 'select'
  | 'none';

/** Background color swatches (`transparent` clears to the checkerboard). */
export const BACKGROUND_COLORS: readonly string[] = [
  'transparent',
  '#ffffff',
  '#000000',
  '#f4f6f9',
  '#1f6feb',
  '#0b0f1a',
];

/** A named artboard / output-size preset. */
export interface ArtboardPreset {
  readonly label: string;
  readonly size: ArtboardSize;
}

/** Common social / CMS output sizes offered in the Canvas panel. */
export const ARTBOARD_PRESETS: readonly ArtboardPreset[] = [
  { label: 'Square 1080', size: { width: 1080, height: 1080 } },
  { label: 'Portrait 4:5', size: { width: 1080, height: 1350 } },
  { label: 'Story 9:16', size: { width: 1080, height: 1920 } },
  { label: 'HD 16:9', size: { width: 1920, height: 1080 } },
  { label: 'OG 1200×630', size: { width: 1200, height: 630 } },
];

/** Named linear-gradient background presets. */
export const BACKGROUND_GRADIENTS: readonly { label: string; colors: string[] }[] = [
  { label: 'Sunset', colors: ['#f59e0b', '#ec4899', '#7c3aed'] },
  { label: 'Ocean', colors: ['#0ea5e9', '#2563eb', '#1e3a8a'] },
  { label: 'Forest', colors: ['#84cc16', '#15803d', '#064e3b'] },
];

export interface AdjustChange {
  readonly key: AspFilter;
  readonly value: number;
}

/** Preset swatch colors offered for annotations (matches the design reference). */
export const ANNOTATION_COLORS: readonly string[] = [
  '#f1416c',
  '#009ef6',
  '#50cd89',
  '#181c32',
  '#ffffff',
];

/** Shape-fill swatches — includes transparent (no fill). */
const FILL_COLORS: readonly string[] = ['transparent', ...ANNOTATION_COLORS];

export interface AspOptionsPanelProps {
  readonly activeTool: AspTool | null;
  readonly toolTitle?: string;

  // adjust
  readonly adjustmentDefs?: readonly FilterMeta[];
  readonly adjustments?: Readonly<Record<string, number>>;

  // filters (looks)
  readonly lookDefs?: readonly FilterMeta[];
  readonly activeLook?: AspFilter | null;

  // crop
  readonly aspectPresets?: readonly AspAspectPreset[];
  readonly activeCrop?: AspAspectPreset;
  readonly aspectRatios?: readonly AspAspectOption[];
  readonly activeAspectLabel?: string;

  // transform
  readonly straighten?: number;

  // annotate
  readonly annotationColor?: string;
  readonly annotationWidth?: number;
  readonly fontSize?: number;
  readonly fonts?: readonly FontOption[];
  readonly activeFont?: string;
  /** Google font family names offered as autocomplete in the "add font" box. */
  readonly googleFonts?: readonly string[];
  /** True while the chosen web font is still loading (shows a spinner). */
  readonly fontLoading?: boolean;
  /**
   * Kind of the current canvas selection (`null` when nothing is selected). When
   * the neutral Select tool is active, the panel reflects this so a selected text
   * shows its type controls and a selected shape shows fill/stroke.
   */
  readonly selectionKind?: 'text' | 'stroke' | null;
  readonly textBold?: boolean;
  readonly textItalic?: boolean;
  readonly textUnderline?: boolean;
  readonly textStrike?: boolean;
  readonly textAlign?: string;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  /** Current rectangle corner radius (px) — drives the sharp → pill slider. */
  readonly cornerRadius?: number;
  /** Pill-cap radius: the slider's maximum for the current rectangle. */
  readonly cornerRadiusMax?: number;
  /** Show the corner-radius slider (new rectangle, or a selected rectangle). */
  readonly showCornerRadius?: boolean;
  readonly redactMode?: RedactMode;
  readonly magicTolerance?: number;
  /** True while an in-browser AI op is running (disables the button, shows progress). */
  readonly aiBusy?: boolean;
  /** AI stage label + 0–1 progress for the status line. */
  readonly aiStage?: string;
  readonly aiProgress?: number;

  readonly frameOptions?: readonly FrameOption[];
  readonly activeFrame?: string;

  /** True once a crop region is applied — enables the Reset control. */
  readonly hasCropRegion?: boolean;
  /**
   * Which frame the Crop tool drives. A `fixed` frame is a slot the image pans
   * under: no Apply/Cancel, the chips are the whole control. A `movable` frame
   * is a session with Apply / Cancel / Reset.
   */
  readonly cropFrame?: AspCropFrame;
  /** Current artboard size (null = full canvas), and changes to it. */
  readonly artboard?: ArtboardSize | null;

  readonly onResetRequested?: () => void;
  readonly onAdjustInput?: (change: AdjustChange) => void;
  readonly onAdjustCommit?: (change: AdjustChange) => void;
  readonly onSelectLook?: (look: AspFilter | null) => void;
  readonly onSelectCrop?: (preset: AspAspectPreset) => void;
  readonly onSelectCustomCrop?: (option: AspAspectOption) => void;
  readonly onApplyCrop?: () => void;
  readonly onCancelCrop?: () => void;
  readonly onResetCrop?: () => void;
  readonly onRotate?: (degrees: number) => void;
  readonly onFlip?: (axis: 'h' | 'v') => void;
  readonly onStraightenInput?: (value: number) => void;
  readonly onStraightenCommit?: (value: number) => void;
  readonly onAddShape?: (kind: ShapeKind) => void;
  readonly onAddText?: (text: string) => void;
  readonly onFontChange?: (font: string) => void;
  /** Add + apply a custom Google font family by name. */
  readonly onAddFont?: (name: string) => void;
  readonly onToggleBold?: () => void;
  readonly onToggleItalic?: () => void;
  readonly onToggleUnderline?: () => void;
  readonly onToggleStrike?: () => void;
  readonly onTextAlignChange?: (align: string) => void;
  readonly onLineHeightChange?: (value: number) => void;
  readonly onLetterSpacingChange?: (value: number) => void;
  readonly onTextBgChange?: (color: string) => void;
  readonly onRedactModeChange?: (mode: RedactMode) => void;
  readonly onApplyRedaction?: () => void;
  readonly onMagicToleranceChange?: (value: number) => void;
  readonly onRunAi?: () => void;
  readonly onAnnotationColorChange?: (color: string) => void;
  /** Live size change (slider drag) — apply without committing history. */
  readonly onSizeInput?: (value: number) => void;
  /** Final size change (slider release) — commit to history. */
  readonly onSizeCommit?: (value: number) => void;
  /** Live corner-radius change (slider drag). */
  readonly onCornerRadiusInput?: (value: number) => void;
  /** Final corner-radius change (slider release) — commit to history. */
  readonly onCornerRadiusCommit?: (value: number) => void;
  readonly onSelectFrame?: (key: string) => void;
  /** Switch the Color panel sub-tool (Adjust ⟷ Filters tabs). */
  readonly onRequestTool?: (tool: AspTool) => void;
  /** Fill color for the selected shape. */
  readonly onFillChange?: (color: string) => void;
  readonly onSetBackgroundColor?: (color: string) => void;
  readonly onSetBackgroundGradient?: (colors: string[]) => void;
  readonly onSetBackgroundImageFile?: (file: File) => void;
  readonly onArtboardChange?: (size: ArtboardSize | null) => void;
}

/**
 * The right-hand contextual options panel. Presentational: it renders the
 * controls for the active tool and emits intent; the container applies changes
 * to the engine. Live slider drags emit `adjustInput`; the final value emits
 * `adjustCommit` (so a drag is one undo step, not dozens).
 */
export function AspOptionsPanel({
  activeTool,
  toolTitle = '',
  adjustmentDefs = [],
  adjustments = {},
  lookDefs = [],
  activeLook = null,
  aspectPresets = [],
  activeCrop = 'free',
  aspectRatios = [],
  activeAspectLabel = '',
  straighten = 0,
  annotationColor = ANNOTATION_COLORS[0],
  annotationWidth = 4,
  fontSize = 28,
  fonts = [],
  activeFont = '',
  googleFonts = [],
  fontLoading = false,
  selectionKind = null,
  textBold = false,
  textItalic = false,
  textUnderline = false,
  textStrike = false,
  textAlign = 'left',
  lineHeight = 1.16,
  letterSpacing = 0,
  cornerRadius = 0,
  cornerRadiusMax = 55,
  showCornerRadius = false,
  redactMode = 'pixelate',
  magicTolerance = 32,
  aiBusy = false,
  aiStage = '',
  aiProgress = 0,
  frameOptions = FRAME_OPTIONS,
  activeFrame = 'none',
  hasCropRegion = false,
  cropFrame = 'movable',
  artboard = null,
  onResetRequested,
  onAdjustInput,
  onAdjustCommit,
  onSelectLook,
  onSelectCrop,
  onSelectCustomCrop,
  onApplyCrop,
  onCancelCrop,
  onResetCrop,
  onRotate,
  onFlip,
  onStraightenInput,
  onStraightenCommit,
  onAddShape,
  onAddText,
  onFontChange,
  onAddFont,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onToggleStrike,
  onTextAlignChange,
  onLineHeightChange,
  onLetterSpacingChange,
  onTextBgChange,
  onRedactModeChange,
  onApplyRedaction,
  onMagicToleranceChange,
  onRunAi,
  onAnnotationColorChange,
  onSizeInput,
  onSizeCommit,
  onCornerRadiusInput,
  onCornerRadiusCommit,
  onSelectFrame,
  onRequestTool,
  onFillChange,
  onSetBackgroundColor,
  onSetBackgroundGradient,
  onSetBackgroundImageFile,
  onArtboardChange,
}: AspOptionsPanelProps): ReactElement {
  const [textValue, setTextValue] = useState('Add a label');
  const [customFontValue, setCustomFontValue] = useState('');
  const [customW, setCustomW] = useState('1080');
  const [customH, setCustomH] = useState('1080');

  /** Unique per-instance id for the Google-fonts autocomplete datalist. */
  const googleFontsListId = useId();

  const kind: PanelKind = (() => {
    const tool = activeTool;
    if (tool === null) {
      return 'none';
    }
    // With the neutral Select tool, reflect the selection: a selected text or
    // shape shows its editing controls instead of the bare "select" hint.
    if (tool === 'select') {
      return selectionKind === 'text' || selectionKind === 'stroke' ? 'annotate' : 'select';
    }
    switch (tool) {
      case 'adjust':
      case 'filters':
        return 'color';
      case 'crop':
      case 'rotate':
      case 'straighten':
      case 'flip':
      case 'resize':
        return 'transform';
      case 'frame':
        return 'frame';
      case 'background':
        return 'background';
      case 'magicwand':
        return 'magic';
      case 'removebg':
      case 'selectsubject':
        return 'ai';
      case 'pen':
      case 'highlighter':
      case 'eraser':
      case 'shapes':
      case 'arrow':
      case 'line':
      case 'text':
      case 'sticker':
      case 'redact':
        return 'annotate';
      default:
        return 'none';
    }
  })();

  const isColorFilters = activeTool === 'filters';

  /** True for the Text tool, or a selected text under the Select tool. */
  const isText = activeTool === 'text' || (activeTool === 'select' && selectionKind === 'text');
  /** True for the Shapes tool, or a selected shape under the Select tool. */
  const isShape =
    activeTool === 'shapes' || (activeTool === 'select' && selectionKind === 'stroke');
  const isRedact = activeTool === 'redact';
  /** Label for the AI action button, by which AI tool is active. */
  const aiActionLabel = activeTool === 'selectsubject' ? 'Cut out subject' : 'Remove background';
  const aiPercent = Math.round(aiProgress * 100);
  /** Whether the panel is reflecting a selection rather than an active tool. */
  const fromSelection = activeTool === 'select';

  const strokeLabel = isText ? 'Font size' : 'Thickness';
  const sizeValue = isText ? fontSize : annotationWidth;
  const sizeMin = isText ? 8 : 1;
  const sizeMax = isText ? 120 : 48;

  const displayValue = (def: FilterMeta): string => {
    const value = adjustments[def.key] ?? def.defaultValue ?? 0;
    if (def.unit) {
      return `${value}${def.unit}`;
    }
    return String(value);
  };

  const valueOf = (def: FilterMeta): number => adjustments[def.key] ?? def.defaultValue ?? 0;

  /** True when the given preset is the active artboard (exact W×H match). */
  const isArtboardActive = (size: ArtboardSize): boolean =>
    artboard !== null && artboard.width === size.width && artboard.height === size.height;

  /** Apply the custom width/height, clamped to a sane 1–10000px range. */
  const applyCustomArtboard = (): void => {
    const w = Math.round(Number(customW));
    const h = Math.round(Number(customH));
    if (Number.isFinite(w) && Number.isFinite(h) && w >= 1 && h >= 1 && w <= 10000 && h <= 10000) {
      onArtboardChange?.({ width: w, height: h });
    }
  };

  const handleAddFont = (): void => {
    const name = customFontValue.trim();
    if (name.length > 0) {
      onAddFont?.(name);
      setCustomFontValue('');
    }
  };

  const handleAddText = (): void => {
    const text = textValue.trim();
    onAddText?.(text.length > 0 ? text : 'Text');
  };

  const handleBackgroundImage = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file) {
      onSetBackgroundImageFile?.(file);
    }
    input.value = '';
  };

  return (
    <div className="asp-options-panel">
      <div className="asp-panel__head">
        <div className="asp-panel__title">{toolTitle}</div>
        <button type="button" className="asp-panel__reset" onClick={() => onResetRequested?.()}>
          <AspIcon name="rotate-ccw" size={13} /> Reset
        </button>
      </div>

      <div className="asp-panel__body">
        {kind === 'color' && (
          <>
            <div className="asp-tabs">
              <button
                type="button"
                className={`asp-tab${!isColorFilters ? ' asp-tab--active' : ''}`}
                onClick={() => onRequestTool?.('adjust')}
              >
                Adjust
              </button>
              <button
                type="button"
                className={`asp-tab${isColorFilters ? ' asp-tab--active' : ''}`}
                onClick={() => onRequestTool?.('filters')}
              >
                Filters
              </button>
            </div>

            {!isColorFilters ? (
              <div className="asp-stack">
                {adjustmentDefs.map((def) => (
                  <div key={def.key}>
                    <div className="asp-field-row">
                      <span className="asp-field-label">{def.label}</span>
                      <span className="asp-field-value">{displayValue(def)}</span>
                    </div>
                    <input
                      type="range"
                      className="asp-range"
                      min={def.min ?? 0}
                      max={def.max ?? 100}
                      value={valueOf(def)}
                      onChange={(event) =>
                        onAdjustInput?.({ key: def.key, value: Number(event.currentTarget.value) })
                      }
                      onPointerUp={(event) =>
                        onAdjustCommit?.({ key: def.key, value: Number(event.currentTarget.value) })
                      }
                      onKeyUp={(event) =>
                        onAdjustCommit?.({ key: def.key, value: Number(event.currentTarget.value) })
                      }
                      onBlur={(event) =>
                        onAdjustCommit?.({ key: def.key, value: Number(event.currentTarget.value) })
                      }
                      aria-label={def.label}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="asp-filter-grid">
                <button
                  type="button"
                  className={`asp-filter${activeLook === null ? ' asp-filter--active' : ''}`}
                  onClick={() => onSelectLook?.(null)}
                >
                  <span className="asp-filter__thumb asp-filter__thumb--none"></span>
                  <span className="asp-filter__label">Original</span>
                </button>
                {lookDefs.map((def) => (
                  <button
                    key={def.key}
                    type="button"
                    className={`asp-filter${activeLook === def.key ? ' asp-filter--active' : ''}`}
                    onClick={() => onSelectLook?.(def.key)}
                  >
                    <span className="asp-filter__thumb" data-look={def.key}></span>
                    <span className="asp-filter__label">{def.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {kind === 'transform' && (
          <div className="asp-stack">
            <div>
              <div className="asp-section-label">Aspect ratio</div>
              <div className="asp-chip-row">
                {aspectPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`asp-chip${
                      activeCrop === preset && !activeAspectLabel ? ' asp-chip--active' : ''
                    }`}
                    onClick={() => onSelectCrop?.(preset)}
                  >
                    {preset === 'free' ? 'Free' : preset === 'original' ? 'Original' : preset}
                  </button>
                ))}
                {aspectRatios.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`asp-chip${
                      activeAspectLabel === option.label ? ' asp-chip--active' : ''
                    }`}
                    onClick={() => onSelectCustomCrop?.(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {cropFrame === 'fixed' ? (
              <p className="asp-hint">
                <AspIcon name="info" size={13} /> Drag the photo to reposition · zoom with the − / +
                controls. Pick Free to remove the frame.
              </p>
            ) : (
              <>
                <p className="asp-hint">
                  <AspIcon name="info" size={13} /> Drag the frame and its handles to choose the
                  area to keep, then Apply.
                </p>
                <div className="asp-btn-row">
                  <button type="button" className="asp-btn-accent" onClick={() => onApplyCrop?.()}>
                    Apply crop
                  </button>
                  <button type="button" className="asp-btn-line" onClick={() => onCancelCrop?.()}>
                    Cancel
                  </button>
                </div>
                {hasCropRegion && (
                  <button type="button" className="asp-btn-line" onClick={() => onResetCrop?.()}>
                    Reset crop
                  </button>
                )}
              </>
            )}

            <div className="asp-section-label asp-mt">Rotate &amp; flip</div>
            <div className="asp-btn-row">
              <button type="button" className="asp-btn-line" onClick={() => onRotate?.(-90)}>
                <AspIcon name="rotate-ccw" size={16} /> 90°
              </button>
              <button type="button" className="asp-btn-line" onClick={() => onRotate?.(90)}>
                <AspIcon name="rotate-cw" size={16} /> 90°
              </button>
            </div>
            <div className="asp-btn-row">
              <button type="button" className="asp-btn-line" onClick={() => onFlip?.('h')}>
                <AspIcon name="flip-horizontal-2" size={16} /> Flip H
              </button>
              <button type="button" className="asp-btn-line" onClick={() => onFlip?.('v')}>
                <AspIcon name="flip-vertical-2" size={16} /> Flip V
              </button>
            </div>
            <div>
              <div className="asp-field-row">
                <span className="asp-field-label">Straighten</span>
                <span className="asp-field-value">{straighten}°</span>
              </div>
              <input
                type="range"
                className="asp-range"
                min={-45}
                max={45}
                value={straighten}
                onChange={(event) => onStraightenInput?.(Number(event.currentTarget.value))}
                onPointerUp={(event) => onStraightenCommit?.(Number(event.currentTarget.value))}
                onKeyUp={(event) => onStraightenCommit?.(Number(event.currentTarget.value))}
                onBlur={(event) => onStraightenCommit?.(Number(event.currentTarget.value))}
                aria-label="Straighten angle"
              />
            </div>
          </div>
        )}

        {kind === 'annotate' && (
          <div className="asp-stack">
            {isText && (
              <>
                {!fromSelection && (
                  <>
                    <p className="asp-hint">
                      <AspIcon name="info" size={13} /> Click anywhere on the canvas to add text,
                      then type. Or add a labelled box below.
                    </p>
                    <div>
                      <label className="asp-field-label" htmlFor="asp-text-input">
                        Text
                      </label>
                      <div className="asp-text-add">
                        <input
                          id="asp-text-input"
                          className="asp-input"
                          value={textValue}
                          onChange={(event) => setTextValue(event.currentTarget.value)}
                        />
                        <button type="button" className="asp-btn-accent" onClick={handleAddText}>
                          Add
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {fonts.length > 0 && (
                  <div>
                    <div className="asp-field-row">
                      <label className="asp-field-label" htmlFor="asp-font-select">
                        Font
                      </label>
                      {fontLoading && (
                        <span className="asp-font-loading">
                          <span className="asp-spinner" aria-hidden="true"></span> Loading…
                        </span>
                      )}
                    </div>
                    <select
                      id="asp-font-select"
                      className="asp-input asp-select"
                      value={activeFont}
                      onChange={(event) => onFontChange?.(event.currentTarget.value)}
                    >
                      {fonts.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                    <div className="asp-text-add asp-mt">
                      <input
                        className="asp-input"
                        list={googleFontsListId}
                        placeholder="Search Google fonts…"
                        value={customFontValue}
                        onChange={(event) => setCustomFontValue(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleAddFont();
                          }
                        }}
                        aria-label="Search and add a Google font"
                      />
                      <datalist id={googleFontsListId}>
                        {googleFonts.map((name) => (
                          <option key={name} value={name}></option>
                        ))}
                      </datalist>
                      <button type="button" className="asp-btn-line" onClick={handleAddFont}>
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="asp-btn-row">
                  <button
                    type="button"
                    className={`asp-icon-btn${textBold ? ' asp-icon-btn--on' : ''}`}
                    title="Bold"
                    onClick={() => onToggleBold?.()}
                  >
                    <AspIcon name="bold" size={16} />
                  </button>
                  <button
                    type="button"
                    className={`asp-icon-btn${textItalic ? ' asp-icon-btn--on' : ''}`}
                    title="Italic"
                    onClick={() => onToggleItalic?.()}
                  >
                    <AspIcon name="italic" size={16} />
                  </button>
                  <button
                    type="button"
                    className={`asp-icon-btn${textUnderline ? ' asp-icon-btn--on' : ''}`}
                    title="Underline"
                    onClick={() => onToggleUnderline?.()}
                  >
                    <AspIcon name="underline" size={16} />
                  </button>
                  <button
                    type="button"
                    className={`asp-icon-btn${textStrike ? ' asp-icon-btn--on' : ''}`}
                    title="Strikethrough"
                    onClick={() => onToggleStrike?.()}
                  >
                    <AspIcon name="strikethrough" size={16} />
                  </button>
                </div>
                <div className="asp-btn-row">
                  <button
                    type="button"
                    className={`asp-icon-btn${textAlign === 'left' ? ' asp-icon-btn--on' : ''}`}
                    title="Align left"
                    onClick={() => onTextAlignChange?.('left')}
                  >
                    <AspIcon name="align-left" size={16} />
                  </button>
                  <button
                    type="button"
                    className={`asp-icon-btn${textAlign === 'center' ? ' asp-icon-btn--on' : ''}`}
                    title="Align center"
                    onClick={() => onTextAlignChange?.('center')}
                  >
                    <AspIcon name="align-center" size={16} />
                  </button>
                  <button
                    type="button"
                    className={`asp-icon-btn${textAlign === 'right' ? ' asp-icon-btn--on' : ''}`}
                    title="Align right"
                    onClick={() => onTextAlignChange?.('right')}
                  >
                    <AspIcon name="align-right" size={16} />
                  </button>
                </div>
                <div>
                  <div className="asp-field-row">
                    <span className="asp-field-label">Line height</span>
                    <span className="asp-field-value">{lineHeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    className="asp-range"
                    min={80}
                    max={300}
                    value={lineHeight * 100}
                    onChange={(event) =>
                      onLineHeightChange?.(Number(event.currentTarget.value) / 100)
                    }
                    aria-label="Line height"
                  />
                </div>
                <div>
                  <div className="asp-field-row">
                    <span className="asp-field-label">Letter spacing</span>
                    <span className="asp-field-value">{letterSpacing}</span>
                  </div>
                  <input
                    type="range"
                    className="asp-range"
                    min={-50}
                    max={800}
                    value={letterSpacing}
                    onChange={(event) => onLetterSpacingChange?.(Number(event.currentTarget.value))}
                    aria-label="Letter spacing"
                  />
                </div>
                <div>
                  <span className="asp-field-label">Text background</span>
                  <div className="asp-mt">
                    <AspColorField
                      colors={FILL_COLORS}
                      value=""
                      onColorChange={(color) => onTextBgChange?.(color)}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <span className="asp-field-label">{isText ? 'Text color' : 'Color'}</span>
              <div className="asp-mt">
                <AspColorField
                  colors={ANNOTATION_COLORS}
                  value={annotationColor}
                  onColorChange={(color) => onAnnotationColorChange?.(color)}
                />
              </div>
            </div>

            {isShape && (
              <div>
                <span className="asp-field-label">Fill</span>
                <div className="asp-mt">
                  <AspColorField
                    colors={FILL_COLORS}
                    value=""
                    onColorChange={(color) => onFillChange?.(color)}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="asp-field-row">
                <span className="asp-field-label">{strokeLabel}</span>
                <span className="asp-field-value">{sizeValue} px</span>
              </div>
              <input
                type="range"
                className="asp-range"
                min={sizeMin}
                max={sizeMax}
                value={sizeValue}
                onChange={(event) => onSizeInput?.(Number(event.currentTarget.value))}
                onPointerUp={(event) => onSizeCommit?.(Number(event.currentTarget.value))}
                onKeyUp={(event) => onSizeCommit?.(Number(event.currentTarget.value))}
                onBlur={(event) => onSizeCommit?.(Number(event.currentTarget.value))}
                aria-label={strokeLabel}
              />
            </div>

            {showCornerRadius && (
              <div>
                <div className="asp-field-row">
                  <span className="asp-field-label">Corner radius</span>
                  <span className="asp-field-value">{cornerRadius} px</span>
                </div>
                <input
                  type="range"
                  className="asp-range"
                  min={0}
                  max={cornerRadiusMax}
                  value={cornerRadius}
                  onChange={(event) => onCornerRadiusInput?.(Number(event.currentTarget.value))}
                  onPointerUp={(event) => onCornerRadiusCommit?.(Number(event.currentTarget.value))}
                  onKeyUp={(event) => onCornerRadiusCommit?.(Number(event.currentTarget.value))}
                  onBlur={(event) => onCornerRadiusCommit?.(Number(event.currentTarget.value))}
                  aria-label="Corner radius"
                />
              </div>
            )}

            {isShape && !fromSelection && (
              <div className="asp-shape-grid">
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Rectangle"
                  onClick={() => onAddShape?.('rect')}
                >
                  <AspIcon name="square" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Ellipse"
                  onClick={() => onAddShape?.('ellipse')}
                >
                  <AspIcon name="circle" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Triangle"
                  onClick={() => onAddShape?.('triangle')}
                >
                  <AspIcon name="triangle" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Diamond"
                  onClick={() => onAddShape?.('diamond')}
                >
                  <AspIcon name="diamond" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Pentagon"
                  onClick={() => onAddShape?.('pentagon')}
                >
                  <AspIcon name="pentagon" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Hexagon"
                  onClick={() => onAddShape?.('hexagon')}
                >
                  <AspIcon name="hexagon" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Star"
                  onClick={() => onAddShape?.('star')}
                >
                  <AspIcon name="star" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Line"
                  onClick={() => onAddShape?.('line')}
                >
                  <AspIcon name="minus" size={17} />
                </button>
                <button
                  type="button"
                  className="asp-icon-btn"
                  title="Arrow"
                  onClick={() => onAddShape?.('arrow')}
                >
                  <AspIcon name="arrow-up-right" size={17} />
                </button>
              </div>
            )}

            {isRedact && (
              <>
                <div className="asp-chip-row">
                  <button
                    type="button"
                    className={`asp-chip${redactMode === 'blur' ? ' asp-chip--active' : ''}`}
                    onClick={() => onRedactModeChange?.('blur')}
                  >
                    Blur
                  </button>
                  <button
                    type="button"
                    className={`asp-chip${redactMode === 'pixelate' ? ' asp-chip--active' : ''}`}
                    onClick={() => onRedactModeChange?.('pixelate')}
                  >
                    Pixelate
                  </button>
                  <button
                    type="button"
                    className={`asp-chip${redactMode === 'solid' ? ' asp-chip--active' : ''}`}
                    onClick={() => onRedactModeChange?.('solid')}
                  >
                    Solid
                  </button>
                </div>
                <button
                  type="button"
                  className="asp-btn-accent asp-redact-apply"
                  onClick={() => onApplyRedaction?.()}
                >
                  Apply redaction
                </button>
              </>
            )}

            <p className="asp-hint">
              <AspIcon name="info" size={13} />{' '}
              {fromSelection ? (
                <>
                  Editing the selected {isText ? 'text' : 'object'}. Adjust its properties here;
                  use the Layers panel to reorder or delete.
                </>
              ) : isShape ? (
                <>Pick a shape to drop it on the canvas, then drag to position or resize.</>
              ) : isRedact ? (
                <>
                  Position the box over the area, then Apply to conceal it. After applying, click
                  the canvas to place another box.
                </>
              ) : isText ? (
                <>Click the canvas to add text and edit in place. Double-click later to re-edit.</>
              ) : (
                <>Draw directly on the canvas. Manage objects in the Layers panel.</>
              )}
            </p>
          </div>
        )}

        {kind === 'frame' && (
          <div className="asp-stack">
            <div className="asp-frame-grid">
              {frameOptions.map((frame) => (
                <button
                  key={frame.key}
                  type="button"
                  className={`asp-chip asp-frame${
                    activeFrame === frame.key ? ' asp-chip--active' : ''
                  }`}
                  onClick={() => onSelectFrame?.(frame.key)}
                >
                  {frame.label}
                </button>
              ))}
            </div>
            <div>
              <span className="asp-field-label">Frame color</span>
              <div className="asp-mt">
                <AspColorField
                  colors={ANNOTATION_COLORS}
                  value={annotationColor}
                  onColorChange={(color) => onAnnotationColorChange?.(color)}
                />
              </div>
            </div>
          </div>
        )}

        {kind === 'background' && (
          <div className="asp-stack">
            <div>
              <div className="asp-section-label">Output size</div>
              <div className="asp-chip-row">
                <button
                  type="button"
                  className={`asp-chip${artboard === null ? ' asp-chip--active' : ''}`}
                  onClick={() => onArtboardChange?.(null)}
                >
                  Full canvas
                </button>
                {ARTBOARD_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`asp-chip${isArtboardActive(preset.size) ? ' asp-chip--active' : ''}`}
                    onClick={() => onArtboardChange?.(preset.size)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="asp-dim-row">
                <input
                  type="number"
                  className="asp-dim-input"
                  min={1}
                  max={10000}
                  aria-label="Output width in pixels"
                  value={customW}
                  onChange={(event) => setCustomW(event.currentTarget.value)}
                />
                <span className="asp-dim-x">×</span>
                <input
                  type="number"
                  className="asp-dim-input"
                  min={1}
                  max={10000}
                  aria-label="Output height in pixels"
                  value={customH}
                  onChange={(event) => setCustomH(event.currentTarget.value)}
                />
                <button type="button" className="asp-btn-line" onClick={applyCustomArtboard}>
                  Set
                </button>
              </div>
            </div>
            <div>
              <div className="asp-section-label">Color</div>
              <AspColorField
                colors={BACKGROUND_COLORS}
                value=""
                onColorChange={(color) => onSetBackgroundColor?.(color)}
              />
            </div>
            <div>
              <div className="asp-section-label">Gradient</div>
              <div className="asp-chip-row">
                {BACKGROUND_GRADIENTS.map((gradient) => (
                  <button
                    key={gradient.label}
                    type="button"
                    className="asp-chip"
                    onClick={() => onSetBackgroundGradient?.(gradient.colors)}
                  >
                    {gradient.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="asp-section-label">Image</div>
              <label className="asp-upload">
                <AspIcon name="image-plus" size={15} /> Upload background image
                <input type="file" accept="image/*" onChange={handleBackgroundImage} />
              </label>
            </div>
          </div>
        )}

        {kind === 'ai' && (
          <div className="asp-stack">
            <p className="asp-hint">
              <AspIcon name="info" size={13} /> {aiActionLabel} runs an AI model entirely in your
              browser — no upload. The model (~tens of MB) downloads once on first use, then is
              cached.
            </p>
            <button
              type="button"
              className="asp-btn-accent asp-redact-apply"
              disabled={aiBusy}
              onClick={() => onRunAi?.()}
            >
              {aiBusy ? 'Working…' : aiActionLabel}
            </button>
            {aiBusy && (
              <div>
                <div className="asp-field-row">
                  <span className="asp-field-label">
                    {aiStage === 'loading' ? 'Downloading model…' : 'Processing…'}
                  </span>
                  <span className="asp-field-value">{aiPercent}%</span>
                </div>
                <div className="asp-ai-bar">
                  <span style={{ width: `${aiProgress * 100}%` }}></span>
                </div>
              </div>
            )}
          </div>
        )}

        {kind === 'magic' && (
          <div className="asp-stack">
            <p className="asp-hint">
              <AspIcon name="info" size={13} /> Click a color region on the image to erase it
              (e.g. a solid background). Raise the tolerance to catch more shades; undo if it
              grabs too much.
            </p>
            <div>
              <div className="asp-field-row">
                <span className="asp-field-label">Tolerance</span>
                <span className="asp-field-value">{magicTolerance}</span>
              </div>
              <input
                type="range"
                className="asp-range"
                min={1}
                max={100}
                value={magicTolerance}
                onChange={(event) => onMagicToleranceChange?.(Number(event.currentTarget.value))}
                aria-label="Magic wand tolerance"
              />
            </div>
          </div>
        )}

        {kind === 'select' && (
          <p className="asp-hint">
            <AspIcon name="info" size={13} /> Click an object on the canvas to select it. Use the
            Layers panel to lock, reorder, group, align, or change opacity. Shift-click to
            multi-select.
          </p>
        )}

        {kind === 'none' && <p className="asp-hint">Select a tool to see its options.</p>}
      </div>
    </div>
  );
}
