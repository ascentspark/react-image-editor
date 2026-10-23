import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactElement,
} from 'react';

import { type ArtboardSize } from '../engine/editor-engine';
import { type AspBackgroundRemovalLoader, type AspHeicDecoderLoader } from '../engine/loaders';
import { applyTheme } from '../theme/apply-theme';
import { deriveTheme, type AspThemeMode } from '../theme/derive-theme';
import { AspIcon } from '../icons/AspIcon';
import { FILTER_REGISTRY, TOOL_REGISTRY, type FilterMeta, type ToolMeta } from '../registry/tool-registry';
import { resolveGroups, type ResolvedGroup } from '../registry/toolbar-groups';
import {
  defaultChromeFor,
  type AspAspectOption,
  type AspAspectPreset,
  type AspChrome,
  type AspEditorError,
  type AspExportFormat,
  type AspExportTarget,
  type AspFilter,
  type AspFitMode,
  type AspMode,
  type AspSize,
  type AspTool,
} from '../types/editor.types';
import { DEFAULT_FONTS, GOOGLE_FONTS, type FontOption } from '../fonts/fonts';
import { useEditorController, type EditorBinding } from '../controller/use-editor-controller';
import { AspHistoryList } from './HistoryList';
import { AspLayerList } from './LayerList';
import { AspOptionsPanel, FRAME_OPTIONS } from './OptionsPanel';
import { AspToolRail } from './ToolRail';

const FALLBACK_BASE = '#f4f6f9';
const FALLBACK_ACCENT = '#1f6feb';

/**
 * Minimum host size per mode, so the chrome (rail, options panel, layers,
 * top bar) always has room to render no matter what size the host requests.
 * `advanced`/`full` carry the rail + canvas + options column; the simpler
 * modes need much less.
 */
const CHROME_MIN: Record<AspChrome, { width: string; height: string }> = {
  viewer: { width: '240px', height: '200px' },
  dialog: { width: '300px', height: '360px' },
  workspace: { width: '640px', height: '460px' },
};

/**
 * Width the `dialog` chrome (the card `basic` mode renders in) hugs by default.
 * MUST stay in sync with `.asp-basic { max-width }` in the stylesheet. The
 * dialog is a self-contained card, so the host sizes to this rather than
 * stretching to fill (and paint) its container — otherwise, mounted in a modal
 * scrim, the host becomes a full-viewport baseColor panel sitting behind the card.
 */
const BASIC_DIALOG_WIDTH = '520px';

/** Resolve a host-supplied size to a CSS length (number → px), or a fallback. */
function toCssSize(value: AspSize | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return typeof value === 'number' ? `${value}px` : value;
}

export interface ImageEditorProps {
  readonly src?: string | Blob | null;
  /** Baseline preset: picks the default tool set AND the default {@link ImageEditorProps.chrome}. */
  readonly mode?: AspMode;
  /**
   * Which chrome renders around the canvas, independently of the tool set the
   * mode (or `tools`) selects. `null` uses the mode's default: `basic` → `dialog`,
   * `viewer` → `viewer`, `advanced`/`full` → `workspace`. Set it to put a small
   * tool set in the full workspace, or the fixed-frame dialog crop around any mode.
   */
  readonly chrome?: AspChrome | null;
  /**
   * Editor width — a number (px) or any CSS length (`'70%'`, `'80vh'`,
   * `'calc(100vw - 320px)'`). Defaults to filling the host's container. A
   * per-mode minimum is always enforced so the chrome stays usable.
   */
  readonly width?: AspSize | null;
  /** Editor height — same shape as {@link ImageEditorProps.width}. */
  readonly height?: AspSize | null;
  readonly tools?: readonly AspTool[] | null;
  readonly disabledTools?: readonly AspTool[];
  readonly filters?: readonly AspFilter[] | 'all' | null;
  readonly aspectPresets?: readonly AspAspectPreset[];
  /**
   * Aspect the crop starts at. When set, the editor opens already constrained to
   * it (in basic mode the crop frame is live immediately; in advanced/full it is
   * the crop tool's starting aspect). When unset, a sole non-`free` preset is
   * auto-selected, otherwise the crop opens unconstrained (`free`).
   */
  readonly initialAspect?: AspAspectPreset | null;
  /** Host-defined crop aspect targets (e.g. CMS sizes); shown after the presets. */
  readonly aspectRatios?: readonly AspAspectOption[];
  /**
   * How the image fits the `dialog` chrome's fixed crop frame. `cover` (default)
   * is the avatar crop — the frame is always filled, so the result has no gaps.
   * `contain` is the logo crop — the zoom floor drops to the whole-image fit, so
   * an image of any aspect can be placed inside the frame; the area it leaves
   * uncovered is filled with {@link ImageEditorProps.exportBackground} at export.
   */
  readonly fitMode?: AspFitMode;
  readonly exportFormats?: readonly AspExportFormat[];
  readonly exportQuality?: number;
  /**
   * Colour composited under every pixel the scene leaves unpainted in a raster
   * export (a `contain` crop's letterbox, a rotated image's corners, a
   * transparent source) when the Background tool set nothing. `null` keeps PNG
   * and WebP transparent and fills JPEG white — never black.
   */
  readonly exportBackground?: string | null;
  /**
   * Pixel size a cropped export should be rendered at, e.g. `{width: 1000,
   * height: 1000}` for a profile photo. Without it a crop exports at the source
   * image's own resolution; with it the export is that size, capped at the
   * source's real pixels (the editor never upscales). An {@link aspectRatios}
   * option carrying `width`/`height` overrides this while it is selected.
   */
  readonly exportTarget?: AspExportTarget | null;
  readonly baseColor?: string;
  readonly accentColor?: string;
  readonly themeMode?: AspThemeMode;
  /** Heading shown by the `dialog` chrome. */
  readonly heading?: string;
  /**
   * Label of the commit action — the button that hands the result to the host
   * through `onSaved` without writing a file. `null` reads "Save" in the dialog
   * chrome and "Apply" elsewhere; the right word is host-specific ("Use this logo").
   */
  readonly commitLabel?: string | null;
  /**
   * Render the commit action in the workspace and viewer chromes. The dialog
   * chrome always has one — committing is what a dialog is for.
   */
  readonly showCommit?: boolean;
  /**
   * Render the "Download image" action in the Export menu. Hosts that only want
   * the Blob back (through the commit action) set `false` so nothing can land in
   * the user's Downloads folder.
   */
  readonly showDownload?: boolean;
  /** Show the edit-history panel in the workspace (hosts that don't want it set false). */
  readonly showHistory?: boolean;
  /** Enable keyboard shortcuts while the pointer is over the editor. */
  readonly keyboardEnabled?: boolean;
  /** Available text fonts (host-overridable). */
  readonly fonts?: readonly FontOption[];
  /**
   * Enable AI background removal / subject cut-out. Install
   * `@imgly/background-removal` in the consuming app and pass its dynamic import:
   * `backgroundRemovalLoader={() => import('@imgly/background-removal')}`.
   * The heavy WASM/worker `import()` then lives in the consumer's bundle, not the
   * library's. Without it the Remove-background / Cut-out tools are hidden.
   */
  readonly backgroundRemovalLoader?: AspBackgroundRemovalLoader | null;
  /**
   * Enable HEIC/HEIF image import. Install `heic2any` in the consuming app and
   * pass its dynamic import: `heicDecoderLoader={() => import('heic2any')}`.
   * Without it, importing a HEIC/HEIF file throws a descriptive error.
   */
  readonly heicDecoderLoader?: AspHeicDecoderLoader | null;
  /**
   * The user committed: here is the result. Fired by the commit action in every
   * chrome, never by a download — a host listening here is never also left with
   * a file in the user's Downloads folder.
   */
  readonly onSaved?: (blob: Blob) => void;
  readonly onCanceled?: () => void;
  /** Fired after an image successfully loads (initial, picker, or upload). */
  readonly onImageLoaded?: () => void;
  /** A file was written: fired with the Blob when the user downloads from the Export menu. */
  readonly onExported?: (blob: Blob) => void;
  /** Fired on a recoverable error (load/export/engine init) instead of throwing. */
  readonly onError?: (error: AspEditorError) => void;
}

/**
 * `<ImageEditor>` — the editor's root/container component.
 *
 * Owns the {@link EditorController} (and through it the Fabric engine), the
 * resolved tool/filter sets, theming, and all workspace state. Presentational
 * children (rail, options panel, history, layers) render data and emit intent;
 * this container is the only place that drives the engine.
 */
export function ImageEditor({
  src = null,
  mode = 'advanced',
  chrome = null,
  width = null,
  height = null,
  tools = null,
  disabledTools = [],
  filters = null,
  aspectPresets = ['free', '1:1', '4:3', '16:9'],
  initialAspect = null,
  aspectRatios = [],
  fitMode = 'cover',
  exportFormats = ['png', 'jpeg', 'webp'],
  exportQuality = 90,
  exportTarget = null,
  exportBackground = null,
  baseColor = FALLBACK_BASE,
  accentColor = FALLBACK_ACCENT,
  themeMode = 'light',
  heading = 'Edit image',
  commitLabel = null,
  showCommit = true,
  showDownload = true,
  showHistory = true,
  keyboardEnabled = true,
  fonts = DEFAULT_FONTS,
  backgroundRemovalLoader = null,
  heicDecoderLoader = null,
  onSaved,
  onCanceled,
  onImageLoaded,
  onExported,
  onError,
}: ImageEditorProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);

  const binding = useEditorController({
    src,
    mode,
    chrome,
    tools,
    disabledTools,
    filters,
    aspectPresets,
    initialAspect,
    fitMode,
    exportFormats,
    exportQuality,
    exportTarget,
    exportBackground,
    keyboardEnabled,
    fonts,
    backgroundRemovalLoader,
    heicDecoderLoader,
    onSaved,
    onCanceled,
    onImageLoaded,
    onExported,
    onError,
  });
  const { controller, state, resolvedToolKeys, resolvedFilters, allFonts, setCanvasEl, setStageEl } =
    binding;

  // Ruler/guides canvases are swapped in and out with the rulers toggle; their
  // element instances live in state so the paint effects re-run on swap.
  const [rulerTopEl, setRulerTopEl] = useState<HTMLCanvasElement | null>(null);
  const [rulerLeftEl, setRulerLeftEl] = useState<HTMLCanvasElement | null>(null);
  const [guidesOverlayEl, setGuidesOverlayEl] = useState<HTMLCanvasElement | null>(null);

  // Apply the derived theme to the host element whenever the inputs change.
  // Invalid hex inputs are a developer error; rather than throwing and breaking
  // the host app, fall back to the default palette (keeping the requested mode)
  // and warn.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let theme;
    try {
      theme = deriveTheme(baseColor, accentColor, themeMode);
    } catch (error) {
      console.warn('[asp-image-editor] invalid theme color, using defaults:', error);
      theme = deriveTheme(FALLBACK_BASE, FALLBACK_ACCENT, themeMode);
    }
    applyTheme(host, theme);
  }, [baseColor, accentColor, themeMode]);

  // Re-render the rulers whenever they are toggled on, their canvases appear,
  // or the viewport changes (rulerVersion is bumped by the engine listener).
  useEffect(() => {
    const host = hostRef.current;
    if (state.rulersEnabled && state.engineReady && host && rulerTopEl && rulerLeftEl) {
      controller.renderRulers(host, rulerTopEl, rulerLeftEl);
    }
  }, [
    controller,
    state.rulersEnabled,
    state.engineReady,
    state.rulerVersion,
    rulerTopEl,
    rulerLeftEl,
  ]);

  // Repaint the guides overlay on guide changes or viewport changes.
  useEffect(() => {
    if (state.rulersEnabled && state.engineReady && guidesOverlayEl) {
      controller.renderGuidesOverlay(guidesOverlayEl);
    }
  }, [
    controller,
    state.rulersEnabled,
    state.engineReady,
    state.guidesVersion,
    state.rulerVersion,
    guidesOverlayEl,
  ]);

  // ---- resolved configuration (derived per render) ---------------------------
  const resolvedGroups: readonly ResolvedGroup[] = resolveGroups([...resolvedToolKeys]);
  const adjustmentDefs: readonly FilterMeta[] = resolvedFilters
    .map((f) => FILTER_REGISTRY[f])
    .filter((m) => m.kind === 'adjustment');
  const lookDefs: readonly FilterMeta[] = resolvedFilters
    .map((f) => FILTER_REGISTRY[f])
    .filter((m) => m.kind === 'look');

  const activeToolMeta: ToolMeta | null = state.activeTool ? TOOL_REGISTRY[state.activeTool] : null;
  // Under the neutral Select tool, title the panel by what's selected.
  const toolTitle =
    state.activeTool === 'select' && state.selectionKind === 'text'
      ? 'Text'
      : state.activeTool === 'select' && state.selectionKind === 'stroke'
        ? 'Object'
        : (activeToolMeta?.label ?? '');
  const zoomLabel = `${state.zoomPct}%`;
  /** The chrome in use: the host's explicit `chrome`, else the mode's default. */
  const layout: AspChrome = chrome ?? defaultChromeFor(mode);
  /** Text of the commit action: the host's label, else "Save" in the dialog and "Apply" elsewhere. */
  const commitText = commitLabel ?? (layout === 'dialog' ? 'Save' : 'Apply');
  /**
   * Show the corner-radius slider when defining the next rectangle (Shapes tool,
   * nothing selected) or when a rectangle is selected.
   */
  const showCornerRadius =
    (state.activeTool === 'shapes' && !state.hasSelection) || state.selectedIsRect;

  // ---- host sizing (per-chrome minimum; the dialog hugs its card width) --------
  const isDialog = layout === 'dialog';
  const min = CHROME_MIN[layout];
  const hostStyle: CSSProperties = {
    width: toCssSize(width, isDialog ? `min(${BASIC_DIALOG_WIDTH}, 100%)` : '100%'),
    height: toCssSize(height, isDialog ? 'auto' : '100%'),
    // Cap the min-width to the available space so the editor never forces
    // horizontal overflow on a narrow screen; the layout reflows instead.
    minWidth: `min(${min.width}, 100%)`,
    // No min-height in the dialog, or a modal scrim would show a baseColor strip
    // below the card (the host's background extending past the card's content).
    minHeight: isDialog ? '0px' : min.height,
    // Show a progress cursor over the editor while a web font is fetching.
    cursor: state.fontLoading ? 'progress' : undefined,
  };

  const onUploadInput = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file) {
      void controller.uploadFile(file);
    }
    input.value = '';
  };

  return (
    <div
      ref={hostRef}
      className="asp-image-editor"
      style={hostStyle}
      onMouseEnter={() => controller.setPointerInside(true)}
      onMouseLeave={() => controller.setPointerInside(false)}
    >
      {state.errorToast !== null && (
        <div className="asp-toast" role="alert">
          <AspIcon name="info" size={16} />
          <span className="asp-toast__msg">{state.errorToast}</span>
          <button
            type="button"
            className="asp-toast__close"
            aria-label="Dismiss"
            onClick={() => controller.dismissErrorToast()}
          >
            <AspIcon name="x" size={15} />
          </button>
        </div>
      )}

      {layout === 'workspace' && (
        <div className="asp-workspace">
          <AspToolRail
            groups={resolvedGroups}
            activeTool={state.activeTool}
            activeMembers={{ ...state.activeMembers }}
            onToolSelect={(tool) => controller.selectTool(tool)}
          />

          <div className="asp-workspace__canvas asp-card">
            <div className="asp-topbar">
              <button
                type="button"
                className="asp-iconbtn"
                disabled={!state.canUndo}
                title="Undo"
                aria-label="Undo"
                onClick={() => void controller.undo()}
              >
                <AspIcon name="undo-2" size={17} />
              </button>
              <button
                type="button"
                className="asp-iconbtn"
                disabled={!state.canRedo}
                title="Redo"
                aria-label="Redo"
                onClick={() => void controller.redo()}
              >
                <AspIcon name="redo-2" size={17} />
              </button>
              <span className="asp-divider"></span>
              <ZoomControl binding={binding} zoomLabel={zoomLabel} />
              <button
                type="button"
                className="asp-iconbtn"
                title="Fit to screen"
                aria-label="Fit to screen"
                onClick={() => controller.fitToScreen()}
              >
                <AspIcon name="scaling" size={16} />
              </button>
              <button
                type="button"
                className={state.snapEnabled ? 'asp-iconbtn asp-iconbtn--on' : 'asp-iconbtn'}
                aria-pressed={state.snapEnabled}
                title={state.snapEnabled ? 'Snapping on' : 'Snapping off'}
                aria-label="Toggle snapping"
                onClick={() => controller.toggleSnap()}
              >
                <AspIcon name="magnet" size={16} />
              </button>
              <button
                type="button"
                className={state.rulersEnabled ? 'asp-iconbtn asp-iconbtn--on' : 'asp-iconbtn'}
                aria-pressed={state.rulersEnabled}
                title={state.rulersEnabled ? 'Rulers & guides on' : 'Rulers & guides off'}
                aria-label="Toggle rulers and guides"
                onClick={() => controller.toggleRulers()}
              >
                <AspIcon name="ruler" size={16} />
              </button>
              {showHistory && (
                <div className="asp-pop">
                  <button
                    type="button"
                    className="asp-iconbtn"
                    title="History"
                    aria-label="Edit history"
                    onClick={() => controller.toggleHistory()}
                  >
                    <AspIcon name="history" size={17} />
                  </button>
                  {state.historyOpen && (
                    <>
                      <button
                        type="button"
                        className="asp-pop__scrim"
                        aria-label="Close history"
                        onClick={() => controller.toggleHistory()}
                      ></button>
                      <div className="asp-menu asp-menu--history">
                        <AspHistoryList
                          entries={state.historyEntries}
                          currentIndex={state.historyIndex}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              <span className="asp-spacer"></span>
              <ImageMenu binding={binding} onUploadInput={onUploadInput} />
              <ExportMenu binding={binding} exportFormats={exportFormats} showDownload={showDownload} />
              {showCommit && <CommitButton binding={binding} label={commitText} />}
            </div>

            <div
              className={
                state.rulersEnabled ? 'asp-stagewrap asp-stagewrap--rulers' : 'asp-stagewrap'
              }
            >
              {state.rulersEnabled && (
                <>
                  <button
                    type="button"
                    className="asp-ruler-corner"
                    title="Clear all guides"
                    aria-label="Clear all guides"
                    onClick={() => controller.clearGuides()}
                  ></button>
                  <canvas
                    ref={setRulerTopEl}
                    className="asp-ruler asp-ruler--h"
                    aria-hidden="true"
                    onPointerDown={(event) => controller.startGuideDraft('h', event.nativeEvent)}
                  ></canvas>
                  <canvas
                    ref={setRulerLeftEl}
                    className="asp-ruler asp-ruler--v"
                    aria-hidden="true"
                    onPointerDown={(event) => controller.startGuideDraft('v', event.nativeEvent)}
                  ></canvas>
                </>
              )}
              <div ref={setStageEl} className="asp-stage">
                <canvas ref={setCanvasEl}></canvas>
                {state.rulersEnabled && (
                  <canvas
                    ref={setGuidesOverlayEl}
                    className="asp-guides-overlay"
                    aria-hidden="true"
                  ></canvas>
                )}
                {state.activeTool === 'crop' && (
                  <div className="asp-crop-overlay" aria-hidden="true">
                    <span className="asp-crop-overlay__v" style={{ left: '33.33%' }}></span>
                    <span className="asp-crop-overlay__v" style={{ left: '66.66%' }}></span>
                    <span className="asp-crop-overlay__h" style={{ top: '33.33%' }}></span>
                    <span className="asp-crop-overlay__h" style={{ top: '66.66%' }}></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="asp-workspace__panel asp-card">
            <AspOptionsPanel
              activeTool={state.activeTool}
              toolTitle={toolTitle}
              adjustmentDefs={adjustmentDefs}
              adjustments={state.adjustments}
              lookDefs={lookDefs}
              activeLook={state.activeLook}
              aspectPresets={aspectPresets}
              activeCrop={state.activeCrop}
              aspectRatios={aspectRatios}
              activeAspectLabel={state.activeAspectLabel}
              straighten={state.straighten}
              annotationColor={state.annotationColor}
              annotationWidth={state.annotationWidth}
              fontSize={state.fontSize}
              fonts={allFonts}
              activeFont={state.fontFamily}
              googleFonts={GOOGLE_FONTS}
              selectionKind={state.selectionKind}
              fontLoading={state.fontLoading}
              magicTolerance={state.magicTolerance}
              onMagicToleranceChange={(value) => controller.onMagicTolerance(value)}
              aiBusy={state.aiBusy}
              aiStage={state.aiStage}
              aiProgress={state.aiProgress}
              onRunAi={() => controller.runAi()}
              textBold={state.textBold}
              textItalic={state.textItalic}
              textUnderline={state.textUnderline}
              textStrike={state.textStrike}
              textAlign={state.textAlign}
              lineHeight={state.lineHeight}
              letterSpacing={state.letterSpacing}
              frameOptions={FRAME_OPTIONS}
              activeFrame={state.activeFrame}
              redactMode={state.redactMode}
              cornerRadius={state.shapeRadius}
              cornerRadiusMax={state.shapeRadiusMax}
              showCornerRadius={showCornerRadius}
              onCornerRadiusInput={(radius) => controller.onCornerRadiusInput(radius)}
              onCornerRadiusCommit={(radius) => controller.onCornerRadiusCommit(radius)}
              onResetRequested={() => controller.reset()}
              onAdjustInput={(change) => controller.onAdjustInput(change)}
              onAdjustCommit={(change) => controller.onAdjustCommit(change)}
              onSelectLook={(look) => controller.selectLook(look)}
              onRequestTool={(tool) => controller.selectTool(tool)}
              onFillChange={(color) => controller.setFill(color)}
              hasCropRegion={state.hasCropRegion}
              onSelectCrop={(preset) => controller.selectCrop(preset)}
              onSelectCustomCrop={(option) => controller.selectCustomCrop(option)}
              onApplyCrop={() => controller.applyCrop()}
              onCancelCrop={() => controller.cancelCrop()}
              onResetCrop={() => controller.resetCrop()}
              onRotate={(deg) => controller.rotate(deg)}
              onFlip={(axis) => controller.flip(axis)}
              onStraightenInput={(value) => controller.onStraightenInput(value)}
              onStraightenCommit={(value) => controller.onStraightenCommit(value)}
              onAddShape={(kind) => controller.addShape(kind)}
              onAddText={(text) => controller.addText(text)}
              onFontChange={(value) => controller.onFontChange(value)}
              onAddFont={(name) => controller.onAddCustomFont(name)}
              onToggleBold={() => controller.toggleBold()}
              onToggleItalic={() => controller.toggleItalic()}
              onToggleUnderline={() => controller.toggleUnderline()}
              onToggleStrike={() => controller.toggleStrike()}
              onTextAlignChange={(align) => controller.setTextAlign(align)}
              onLineHeightChange={(value) => controller.setLineHeight(value)}
              onLetterSpacingChange={(value) => controller.setLetterSpacing(value)}
              onTextBgChange={(color) => controller.setTextBg(color)}
              onRedactModeChange={(redactMode) => controller.setRedactMode(redactMode)}
              onApplyRedaction={() => controller.applyRedaction()}
              onAnnotationColorChange={(color) => controller.setAnnotationColor(color)}
              onSizeInput={(size) => controller.onSizeInput(size)}
              onSizeCommit={(size) => controller.onSizeCommit(size)}
              onSelectFrame={(frame) => controller.selectFrame(frame)}
              onSetBackgroundColor={(color) => controller.setBackgroundColor(color)}
              onSetBackgroundGradient={(colors) => controller.setBackgroundGradient(colors)}
              onSetBackgroundImageFile={(file) => controller.setBackgroundImageFromFile(file)}
              artboard={state.artboard}
              onArtboardChange={(size: ArtboardSize | null) => controller.onArtboardChange(size)}
            />
            <AspLayerList
              layers={state.layers}
              onSelectLayer={(event) => controller.onSelectLayer(event)}
              onToggleLock={(id) => controller.onToggleLayerLock(id)}
              onToggleVisible={(id) => controller.onToggleLayerVisible(id)}
              onMoveUp={(id) => controller.onMoveLayer(id, 'up')}
              onMoveDown={(id) => controller.onMoveLayer(id, 'down')}
              onRemoveLayer={(id) => controller.onDeleteLayer(id)}
              onGroupSelection={() => controller.groupSelection()}
              onUngroupSelection={() => controller.ungroupSelection()}
              onDuplicateSelection={() => controller.duplicate()}
              onDeleteSelection={() => controller.deleteSelection()}
              onAlignSelection={(alignMode) => controller.alignSelection(alignMode)}
              onOpacityInput={(change) => controller.onLayerOpacityInput(change)}
              onOpacityCommit={(change) => controller.onLayerOpacityCommit(change)}
              onReorderLayers={(orderedIds) => controller.onReorderLayers(orderedIds)}
              onRenameLayer={(event) => controller.onRenameLayer(event)}
            />
          </div>
        </div>
      )}

      {layout === 'viewer' && (
        <div className="asp-viewer asp-card">
          <div className="asp-topbar">
            <ZoomControl binding={binding} zoomLabel={zoomLabel} />
            <span className="asp-spacer"></span>
            <ExportMenu binding={binding} exportFormats={exportFormats} showDownload={showDownload} />
            {showCommit && <CommitButton binding={binding} label={commitText} />}
          </div>
          <div ref={setStageEl} className="asp-stage">
            <canvas ref={setCanvasEl}></canvas>
          </div>
        </div>
      )}

      {layout === 'dialog' && (
        <div className="asp-basic asp-card">
          <div className="asp-basic__head">
            <div className="asp-basic__title">{heading}</div>
            <button
              type="button"
              className="asp-iconbtn-plain"
              aria-label="Close"
              onClick={() => controller.cancel()}
            >
              <AspIcon name="x" size={19} />
            </button>
          </div>

          <div className="asp-basic__body">
            <div ref={setStageEl} className="asp-stage asp-stage--rounded">
              <canvas ref={setCanvasEl}></canvas>
            </div>

            {state.cropActive && (
              <p className="asp-basic__hint">
                Drag the photo to reposition · use the slider to zoom
              </p>
            )}

            <div>
              <div className="asp-section-label">Aspect ratio</div>
              <div className="asp-chip-row">
                {aspectPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={
                      state.activeCrop === preset && !state.activeAspectLabel
                        ? 'asp-chip asp-chip--active'
                        : 'asp-chip'
                    }
                    onClick={() => controller.selectCrop(preset)}
                  >
                    {preset === 'free' ? 'Free' : preset === 'original' ? 'Original' : preset}
                  </button>
                ))}
                {aspectRatios.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={
                      state.activeAspectLabel === option.label
                        ? 'asp-chip asp-chip--active'
                        : 'asp-chip'
                    }
                    onClick={() => controller.selectCustomCrop(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="asp-basic__controls">
              <button
                type="button"
                className="asp-iconbtn"
                title="Rotate left"
                onClick={() => controller.rotate(-90)}
              >
                <AspIcon name="rotate-ccw" size={17} />
              </button>
              <button
                type="button"
                className="asp-iconbtn"
                title="Rotate right"
                onClick={() => controller.rotate(90)}
              >
                <AspIcon name="rotate-cw" size={17} />
              </button>
              <button
                type="button"
                className="asp-iconbtn"
                title="Flip"
                onClick={() => controller.flip('h')}
              >
                <AspIcon name="flip-horizontal-2" size={17} />
              </button>
              <div className="asp-zoomslider">
                <AspIcon name="plus" size={16} />
                <input
                  type="range"
                  className="asp-range"
                  min={state.zoomRange.min}
                  max={state.zoomRange.max}
                  value={state.zoomPct}
                  onChange={(event) => controller.onZoomSlider(Number(event.currentTarget.value))}
                  aria-label="Zoom"
                />
              </div>
              <label className="asp-upload asp-upload--inline">
                <AspIcon name="upload" size={15} /> Replace
                <input type="file" accept="image/*" onChange={onUploadInput} />
              </label>
            </div>
          </div>

          <div className="asp-basic__foot">
            <button type="button" className="asp-btn-line" onClick={() => controller.cancel()}>
              Cancel
            </button>
            <button
              type="button"
              className="asp-btn-accent asp-commit"
              onClick={() => void controller.save()}
            >
              {commitText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- shared sub-templates ----------------------------------------------------

function ZoomControl({
  binding,
  zoomLabel,
}: {
  binding: EditorBinding;
  zoomLabel: string;
}): ReactElement {
  const { controller } = binding;
  return (
    <div className="asp-zoom">
      <button
        type="button"
        className="asp-zoom__btn"
        aria-label="Zoom out"
        onClick={() => controller.zoomOut()}
      >
        <AspIcon name="minus" size={15} />
      </button>
      <span className="asp-zoom__label">{zoomLabel}</span>
      <button
        type="button"
        className="asp-zoom__btn"
        aria-label="Zoom in"
        onClick={() => controller.zoomIn()}
      >
        <AspIcon name="plus" size={15} />
      </button>
    </div>
  );
}

function ImageMenu({
  binding,
  onUploadInput,
}: {
  binding: EditorBinding;
  onUploadInput: (event: ChangeEvent<HTMLInputElement>) => void;
}): ReactElement {
  const { controller, state } = binding;

  const onAddImageLayer = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void controller.addImageLayerFile(file);
    }
  };

  const onLoadTemplate = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void controller.loadTemplateFile(file);
    }
  };

  return (
    <div className="asp-pop">
      <button
        type="button"
        className="asp-btn-line asp-topbtn"
        onClick={() => controller.togglePicker()}
      >
        <AspIcon name="image-plus" size={16} /> Image
      </button>
      {state.pickerOpen && (
        <>
          <button
            type="button"
            className="asp-pop__scrim"
            aria-label="Close image menu"
            onClick={() => controller.togglePicker()}
          ></button>
          <div className="asp-menu asp-menu--right">
            <div className="asp-menu__title">Sample images</div>
            <div className="asp-sample-grid">
              {state.samples.map((sample) => (
                <button
                  key={sample.key}
                  type="button"
                  className="asp-sample"
                  style={{ backgroundImage: `url(${sample.dataUrl})` }}
                  title={sample.label}
                  aria-label={sample.label}
                  onClick={() => void controller.pickSample(sample)}
                ></button>
              ))}
            </div>
            <label className="asp-upload">
              <AspIcon name="upload" size={15} /> Replace canvas image
              <input type="file" accept="image/*" onChange={onUploadInput} />
            </label>
            <label className="asp-upload asp-mt-sm">
              <AspIcon name="image-plus" size={15} /> Add image as a layer
              <input type="file" accept="image/*" onChange={onAddImageLayer} />
            </label>
            <div className="asp-menu__divider"></div>
            <div className="asp-menu__title">Template</div>
            <button
              type="button"
              className="asp-upload asp-upload--btn"
              onClick={() => controller.saveTemplate()}
            >
              <AspIcon name="download" size={15} /> Save template
            </button>
            <label className="asp-upload">
              <AspIcon name="upload" size={15} /> Load template
              <input type="file" accept="application/json,.json" onChange={onLoadTemplate} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

/** The commit action: hands the result to the host through `onSaved`, writes no file. */
function CommitButton({ binding, label }: { binding: EditorBinding; label: string }): ReactElement {
  const { controller } = binding;
  return (
    <button
      type="button"
      className="asp-btn-accent asp-topbtn asp-commit"
      onClick={() => void controller.save()}
    >
      <AspIcon name="check" size={16} /> {label}
    </button>
  );
}

function ExportMenu({
  binding,
  exportFormats,
  showDownload,
}: {
  binding: EditorBinding;
  exportFormats: readonly AspExportFormat[];
  showDownload: boolean;
}): ReactElement {
  const { controller, state } = binding;
  return (
    <div className="asp-pop">
      <button
        type="button"
        className="asp-btn-line asp-topbtn"
        onClick={() => controller.toggleExport()}
      >
        <AspIcon name={showDownload ? 'download' : 'sliders-horizontal'} size={16} />{' '}
        {showDownload ? 'Export' : 'Format'}
      </button>
      {state.exportOpen && (
        <>
          <button
            type="button"
            className="asp-pop__scrim"
            aria-label="Close export menu"
            onClick={() => controller.toggleExport()}
          ></button>
          <div className="asp-menu asp-menu--right asp-menu--export">
            <div className="asp-menu__label">Format</div>
            <div className="asp-fmt-row">
              {exportFormats.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={state.exportFormat === fmt ? 'asp-fmt asp-fmt--active' : 'asp-fmt'}
                  onClick={() => controller.setExportFormat(fmt)}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="asp-menu__row">
              <span className="asp-menu__label">Quality</span>
              <span className="asp-menu__value">{state.exportQ}</span>
            </div>
            <input
              type="range"
              className="asp-range"
              min={10}
              max={100}
              value={state.exportQ}
              onChange={(event) => controller.setExportQuality(Number(event.currentTarget.value))}
              aria-label="Export quality"
            />
            {showDownload && (
              <button
                type="button"
                className="asp-btn-accent asp-download"
                onClick={() => void controller.download()}
              >
                Download image
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
