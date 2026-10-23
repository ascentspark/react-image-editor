import {
  EditorEngine,
  type ArtboardSize,
  type LayerInfo,
  type RedactMode,
  type SelectionStyleInfo,
  type ShapeKind,
} from '../engine/editor-engine';
import { type HistoryStep } from '../engine/delta-history';
import { aspectRatioValue } from '../engine/crop';
import { drawRuler, type RulerColors } from '../engine/rulers';
import { type AspBackgroundRemovalLoader, type AspHeicDecoderLoader } from '../engine/loaders';
import { FILTER_REGISTRY } from '../registry/tool-registry';
import { groupForTool } from '../registry/toolbar-groups';
import {
  defaultChromeFor,
  type AspAspectOption,
  type AspAspectPreset,
  type AspEditorError,
  type AspExportFormat,
  type AspExportTarget,
  type AspFilter,
  type AspMode,
  type AspTool,
  type AspChrome,
  type AspFitMode,
} from '../types/editor.types';
import {
  DEFAULT_FONTS,
  ensureFontLoaded,
  isWebFont,
  type FontOption,
} from '../fonts/fonts';
import { buildSampleImages, type SampleImage } from '../samples/sample-images';
import { ANNOTATION_COLORS } from '../ui/OptionsPanel';

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

const ZOOM_STEP = 25;

/**
 * Everything the editor UI renders from. Immutable snapshot semantics: the
 * controller replaces the object on every change, so React's
 * `useSyncExternalStore` sees a new reference and re-renders — the Fabric
 * engine itself never leaks into render state.
 */
export interface EditorUiState {
  readonly engineReady: boolean;
  readonly activeTool: AspTool | null;
  /** Per-toolbar-group last-selected member (drives flyout slot icons). */
  readonly activeMembers: Readonly<Record<string, AspTool>>;
  readonly zoomPct: number;
  /** The zoom slider's bounds for the current interaction (see `EditorEngine.zoomRange`). */
  readonly zoomRange: { readonly min: number; readonly max: number };
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly historyEntries: readonly HistoryStep[];
  readonly historyIndex: number;
  readonly adjustments: Readonly<Record<string, number>>;
  readonly activeLook: AspFilter | null;
  readonly activeCrop: AspAspectPreset;
  readonly activeAspectLabel: string;
  /** Pixel target of the selected custom aspect option, when it declares one. */
  readonly activeAspectTarget: AspExportTarget | null;
  readonly straighten: number;
  readonly annotationColor: string;
  readonly annotationWidth: number;
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly textBold: boolean;
  readonly textItalic: boolean;
  readonly textUnderline: boolean;
  readonly textStrike: boolean;
  readonly textAlign: string;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  /** Custom fonts added at runtime, merged after the host-provided list. */
  readonly customFonts: readonly FontOption[];
  readonly hasSelection: boolean;
  /** Kind of the current selection, so the panel can reflect it under Select. */
  readonly selectionKind: 'text' | 'stroke' | null;
  /** True while a web font for the current choice is still loading. */
  readonly fontLoading: boolean;
  /** Transient error message shown as an in-editor toast (null = hidden). */
  readonly errorToast: string | null;
  readonly activeFrame: string;
  /** Corner radius (px) for the next rectangle, and the selected rectangle. */
  readonly shapeRadius: number;
  /** Pill-cap radius driving the corner-radius slider's max. */
  readonly shapeRadiusMax: number;
  /** True when the current selection is a single rectangle. */
  readonly selectedIsRect: boolean;
  readonly redactMode: RedactMode;
  readonly magicTolerance: number;
  readonly aiBusy: boolean;
  readonly aiStage: string;
  readonly aiProgress: number;
  /** True once a crop region has been applied (enables the panel's Reset). */
  readonly hasCropRegion: boolean;
  /** True while a crop session (frame or fixed-frame image crop) is live. */
  readonly cropActive: boolean;
  readonly layers: readonly LayerInfo[];
  readonly pickerOpen: boolean;
  readonly exportOpen: boolean;
  readonly historyOpen: boolean;
  readonly snapEnabled: boolean;
  readonly rulersEnabled: boolean;
  /** Bumped by the engine's viewport listener to re-render rulers on zoom/pan/resize. */
  readonly rulerVersion: number;
  /** Bumped by the engine's guides listener to repaint the guides overlay. */
  readonly guidesVersion: number;
  readonly artboard: ArtboardSize | null;
  readonly exportFormat: AspExportFormat;
  readonly exportQ: number;
  readonly samples: readonly SampleImage[];
}

/** A writable partial of {@link EditorUiState}, used to build patches. */
export type EditorUiPatch = { -readonly [K in keyof EditorUiState]?: EditorUiState[K] };

/**
 * The reactive inputs + event callbacks the controller reads while handling
 * intent. The hook refreshes this every commit so controller methods always
 * see current props without re-creating the controller.
 */
export interface EditorControllerProps {
  readonly mode: AspMode;
  /** Chrome override; `null` uses the mode's default (see {@link defaultChromeFor}). */
  readonly chrome: AspChrome | null;
  /** The tool keys the hook resolved for this mode / tool list, so the controller knows whether `crop` exists. */
  readonly resolvedToolKeys: readonly AspTool[];
  readonly initialAspect: AspAspectPreset | null;
  /** How the image fits the dialog chrome's fixed crop frame. */
  readonly fitMode: AspFitMode;
  /** Fill under unpainted raster-export pixels when the scene has no background. */
  readonly exportBackground: string | null;
  readonly aspectPresets: readonly AspAspectPreset[];
  readonly exportFormats: readonly AspExportFormat[];
  /** Pixel size a cropped export renders at; a selected aspect option overrides it. */
  readonly exportTarget: AspExportTarget | null;
  readonly keyboardEnabled: boolean;
  readonly fonts: readonly FontOption[];
  readonly backgroundRemovalLoader: AspBackgroundRemovalLoader | null;
  readonly heicDecoderLoader: AspHeicDecoderLoader | null;
  /** The user committed: the commit action in every chrome, never a download. */
  readonly onSaved?: (blob: Blob) => void;
  readonly onCanceled?: () => void;
  readonly onImageLoaded?: () => void;
  /** A file was written: Export → Download. Never fires `onSaved`. */
  readonly onExported?: (blob: Blob) => void;
  readonly onError?: (error: AspEditorError) => void;
}

function defaultAdjustmentValues(): Record<string, number> {
  const values: Record<string, number> = {};
  for (const meta of Object.values(FILTER_REGISTRY)) {
    if (meta.kind === 'adjustment') {
      values[meta.key] = meta.defaultValue ?? 0;
    }
  }
  return values;
}

function stageSize(stage: HTMLElement): { width: number; height: number } {
  const rect = stage.getBoundingClientRect();
  return {
    width: Math.max(120, Math.floor(rect.width)),
    height: Math.max(120, Math.floor(rect.height)),
  };
}

function extensionFor(format: AspExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revoke so browsers that initiate the download asynchronously can read it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True if the keyboard event originates from an editable field, so editor shortcuts should yield. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true ||
    // jsdom does not implement isContentEditable; fall back to the attribute.
    target.getAttribute('contenteditable') === 'true'
  );
}

export function initialEditorUiState(): EditorUiState {
  return {
    engineReady: false,
    activeTool: null,
    activeMembers: {},
    zoomPct: 100,
    zoomRange: { min: 25, max: 400 },
    canUndo: false,
    canRedo: false,
    historyEntries: [],
    historyIndex: 0,
    adjustments: defaultAdjustmentValues(),
    activeLook: null,
    activeCrop: 'free',
    activeAspectLabel: '',
    activeAspectTarget: null,
    straighten: 0,
    annotationColor: ANNOTATION_COLORS[0],
    annotationWidth: 4,
    fontSize: 28,
    fontFamily: DEFAULT_FONTS[0].value,
    textBold: false,
    textItalic: false,
    textUnderline: false,
    textStrike: false,
    textAlign: 'left',
    lineHeight: 1.16,
    letterSpacing: 0,
    customFonts: [],
    hasSelection: false,
    selectionKind: null,
    fontLoading: false,
    errorToast: null,
    activeFrame: 'none',
    shapeRadius: 0,
    shapeRadiusMax: 55,
    selectedIsRect: false,
    redactMode: 'pixelate',
    magicTolerance: 32,
    aiBusy: false,
    aiStage: '',
    aiProgress: 0,
    hasCropRegion: false,
    cropActive: false,
    layers: [],
    pickerOpen: false,
    exportOpen: false,
    historyOpen: false,
    snapEnabled: true,
    rulersEnabled: false,
    rulerVersion: 0,
    guidesVersion: 0,
    artboard: null,
    exportFormat: 'png',
    exportQ: 90,
    samples: [],
  };
}

/**
 * Owns the {@link EditorEngine} and all workspace state for one editor
 * instance. The React layer subscribes via `useSyncExternalStore` and calls
 * these methods from event handlers; every method mirrors its counterpart on
 * the Angular `AspImageEditor` container component (the parity spec).
 */
export class EditorController {
  private state: EditorUiState = initialEditorUiState();
  private readonly listeners = new Set<() => void>();

  /** Reads the latest reactive inputs (the hook refreshes them every commit). */
  private readonly getProps: () => EditorControllerProps;

  /** Latest reactive inputs — always current, never stale closures. */
  get props(): EditorControllerProps {
    return this.getProps();
  }

  private engine: EditorEngine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private boundCanvas: HTMLCanvasElement | null = null;
  private lastSource: string | Blob | null | undefined = undefined;
  private errorToastTimer: ReturnType<typeof setTimeout> | null = null;
  private redactActive = false;
  private pointerInside = false;
  /** Tears down an in-flight ruler→guide drag; also called on destroy. */
  private guideDraftCleanup: (() => void) | null = null;
  /** Serializes engine (re)binding/loading so concurrent effect fires can't race. */
  private opChain: Promise<void> = Promise.resolve();

  constructor(getProps: () => EditorControllerProps) {
    this.getProps = getProps;
  }

  // ---- store contract -------------------------------------------------------
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): EditorUiState => this.state;

  private patch(partial: EditorUiPatch): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** The live engine, for advanced/headless scenarios (may be null before init). */
  get currentEngine(): EditorEngine | null {
    return this.engine;
  }

  /** Resolves once all queued engine operations (bind/load/destroy) settle. */
  whenIdle(): Promise<void> {
    return this.opChain.catch(() => undefined);
  }

  // ---- engine lifecycle ------------------------------------------------------

  /**
   * Bind the engine to the rendered canvas and (re)load the source. Called by
   * the hook's layout effect on first render and again whenever the layout
   * swaps the canvas element (mode change) or the `src` input changes. Queued
   * on the op-chain so concurrent fires can't race.
   */
  requestBind(canvas: HTMLCanvasElement, stage: HTMLElement, src: string | Blob | null): void {
    this.opChain = this.opChain
      .catch(() => undefined)
      .then(() => this.ensureEngineAndLoad(canvas, stage, src));
  }

  /** Destroy the engine + observers (effect cleanup / unmount). */
  destroy(): void {
    this.guideDraftCleanup?.();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.errorToastTimer !== null) {
      clearTimeout(this.errorToastTimer);
      this.errorToastTimer = null;
    }
    const engine = this.engine;
    this.engine = null;
    this.boundCanvas = null;
    this.lastSource = undefined;
    // Reset transient session flags so a StrictMode remount starts clean.
    this.redactActive = false;
    this.patch({ engineReady: false, cropActive: false });
    this.opChain = this.opChain.catch(() => undefined).then(() => void engine?.destroy());
  }

  private async ensureEngineAndLoad(
    canvas: HTMLCanvasElement,
    stage: HTMLElement,
    src: string | Blob | null,
  ): Promise<void> {
    if (this.state.samples.length === 0) {
      this.patch({ samples: buildSampleImages() });
    }

    // (Re)create the engine when the canvas element changes (e.g. mode switch).
    if (canvas !== this.boundCanvas) {
      try {
        this.resizeObserver?.disconnect();
        await this.engine?.destroy();
        const { width, height } = stageSize(stage);
        this.engine = await EditorEngine.create(canvas, {
          width,
          height,
          backgroundRemovalLoader: this.props.backgroundRemovalLoader,
          heicDecoderLoader: this.props.heicDecoderLoader,
        });
        this.engine.setSelectionListener((info) => this.onSelectionChange(info));
        // Full sync (not just layers): the engine notifies here after commits
        // like a finished freehand stroke, and undo/redo/history must follow.
        this.engine.setLayersListener(() => this.sync());
        this.engine.setViewportListener(() =>
          this.patch({ rulerVersion: this.state.rulerVersion + 1 }),
        );
        this.engine.setGuidesListener(() => {
          this.patch({ guidesVersion: this.state.guidesVersion + 1 });
          this.sync();
        });
        this.engine.setTextPlacementListener((point) => {
          this.engine?.addTextAt(point.x, point.y, {
            color: this.state.annotationColor,
            fontSize: this.state.fontSize,
            fontFamily: this.state.fontFamily,
          });
          this.sync();
        });
        // Clicking off a placed text finishes it and returns to the Select tool.
        this.engine.setTextFinishListener(() => {
          this.patch({ activeTool: 'select' });
          this.sync();
        });
        this.engine.setAiProgressListener((info) => {
          this.patch({ aiStage: info.stage, aiProgress: info.progress });
        });
        this.engine.setMagicListener((point) => {
          void this.engine
            ?.magicErase(point, this.state.magicTolerance)
            .then(() => this.sync())
            .catch((error) => this.emitError('magic-erase-failed', error));
        });
        this.engine.setSnapping(this.state.snapEnabled);
        this.engine.setArtboard(this.state.artboard);
        this.applyExportTarget();
        this.engine.setImageCropFitMode(this.props.fitMode);
        this.engine.setExportBackground(this.props.exportBackground);
        this.engine.setRulersEnabled(this.state.rulersEnabled);
        this.boundCanvas = canvas;
        this.lastSource = undefined;
        this.patch({ engineReady: true });
        this.observeResize(stage);
      } catch (error) {
        // No 2D/WebGL context (SSR/headless) — chrome still renders; actions inert.
        console.warn('[asp-image-editor] could not initialize the canvas engine:', error);
        this.emitError('engine-init-failed', error);
        return;
      }
    }

    const source = src ?? this.state.samples[0]?.dataUrl ?? null;
    if (source === null || source === this.lastSource || !this.engine) {
      return;
    }
    this.lastSource = source;
    await this.loadSource(source);
  }

  /** Load a source into the engine, emitting imageLoaded / errorOccurred. */
  private async loadSource(source: string | Blob): Promise<void> {
    try {
      await this.engine?.loadImage(source);
      this.resetUiState();
      this.sync();
      this.applyInitialAspect();
      this.props.onImageLoaded?.();
    } catch (error) {
      this.emitError('load-failed', error);
    }
  }

  /**
   * The aspect a freshly loaded image starts cropped to: an explicit
   * `initialAspect`, else the sole non-`free` `aspectPresets` entry, else
   * `free` (unconstrained).
   */
  private resolveInitialAspect(): AspAspectPreset {
    const explicit = this.props.initialAspect;
    if (explicit) {
      return explicit;
    }
    const presets = this.props.aspectPresets;
    const constrained = presets.filter((p) => p !== 'free');
    // Auto-pin the sole ratio only when the consumer did NOT also offer a Free
    // chip — offering Free means unconstrained is a deliberate, selectable default.
    if (constrained.length === 1 && !presets.includes('free')) {
      return constrained[0];
    }
    return 'free';
  }

  /**
   * After a load, constrain the crop to the resolved initial aspect — with a
   * live frame in EVERY chrome that can crop. The dialog's fixed frame starts
   * at once; the workspace enters the Crop tool, whose session sync opens the
   * movable frame at this aspect. Where nothing can enforce the aspect (the
   * viewer, or a tool set without `crop`) the chip is left inactive: the UI must
   * never assert a constraint it is not applying.
   */
  private applyInitialAspect(): void {
    const aspect = this.resolveInitialAspect();
    if (aspect === 'free') {
      this.patch({ activeCrop: 'free' });
      return;
    }
    const layout = this.layout();
    if (layout === 'dialog') {
      this.patch({ activeCrop: aspect, activeAspectLabel: '', activeAspectTarget: null });
      this.applyExportTarget();
      this.ensureCropSession(this.ratioFromPreset(aspect));
      return;
    }
    if (layout === 'workspace' && this.props.resolvedToolKeys.includes('crop')) {
      this.patch({ activeCrop: aspect, activeAspectLabel: '', activeAspectTarget: null });
      this.applyExportTarget();
      if (this.state.activeTool === 'crop') {
        // Already in the tool (e.g. the source changed): reshape or restart the frame.
        this.patch({ cropActive: this.engine?.isCropping() ?? false });
        this.ensureCropSession(this.ratioFromPreset(aspect));
      } else {
        this.selectTool('crop');
      }
      return;
    }
    this.patch({ activeCrop: 'free' });
  }

  /** The chrome in use: the host's explicit `chrome`, else the mode's default. */
  layout(): AspChrome {
    return this.props.chrome ?? defaultChromeFor(this.props.mode);
  }

  /** Push the fixed-frame fit mode to the engine (hook effect on the `fitMode` prop). */
  syncFitMode(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    engine.setImageCropFitMode(this.props.fitMode);
    this.syncZoom();
  }

  /** Push the export fill to the engine (hook effect on the `exportBackground` prop). */
  syncExportBackground(): void {
    this.engine?.setExportBackground(this.props.exportBackground);
  }

  private emitError(code: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError?.({ code, message });
    // Also show a transient in-editor toast so failures are never silent — the
    // previous behavior on a bad import looked like "nothing happened".
    this.showErrorToast(message);
  }

  /** Surface a dismissible error toast, auto-clearing after a few seconds. */
  private showErrorToast(message: string): void {
    this.patch({ errorToast: message });
    if (this.errorToastTimer !== null) {
      clearTimeout(this.errorToastTimer);
    }
    this.errorToastTimer = setTimeout(() => {
      this.patch({ errorToast: null });
      this.errorToastTimer = null;
    }, 6000);
  }

  dismissErrorToast(): void {
    if (this.errorToastTimer !== null) {
      clearTimeout(this.errorToastTimer);
      this.errorToastTimer = null;
    }
    this.patch({ errorToast: null });
  }

  private observeResize(stage: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = stageSize(stage);
      this.engine?.setSize(width, height);
    });
    this.resizeObserver.observe(stage);
  }

  private resetUiState(): void {
    this.patch({
      adjustments: defaultAdjustmentValues(),
      activeLook: null,
      activeCrop: 'free',
      straighten: 0,
      activeFrame: 'none',
    });
  }

  private sync(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.patch({
      canUndo: engine.canUndo,
      canRedo: engine.canRedo,
      historyEntries: engine.historyEntries,
      historyIndex: engine.historyIndex,
      layers: engine.getLayers(),
      ...this.zoomPatch(engine),
    });
  }

  /** Mirror the engine's zoom value and its honest slider bounds for the current interaction. */
  private syncZoom(): void {
    if (this.engine) {
      this.patch(this.zoomPatch(this.engine));
    }
  }

  private zoomPatch(engine: EditorEngine): EditorUiPatch {
    const range = engine.zoomRange;
    const current = this.state.zoomRange;
    return {
      zoomPct: engine.isImageCropping() ? engine.imageCropZoomPct : engine.zoom,
      zoomRange: current.min === range.min && current.max === range.max ? current : range,
    };
  }

  // ---- keyboard + pointer scope ---------------------------------------------

  setPointerInside(inside: boolean): void {
    this.pointerInside = inside;
    if (!inside) {
      this.engine?.setPanMode(false);
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.props.keyboardEnabled || !this.pointerInside || isTypingTarget(event.target)) {
      return;
    }
    const meta = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (event.key === ' ') {
      event.preventDefault();
      this.engine?.setPanMode(true);
      return;
    }
    if (key === 'escape') {
      if (this.layout() === 'dialog') {
        this.cancel();
      } else {
        this.engine?.discardSelection();
      }
      return;
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      this.deleteSelection();
      return;
    }
    if (!meta) {
      return;
    }
    switch (key) {
      case 'z':
        event.preventDefault();
        void (event.shiftKey ? this.redo() : this.undo());
        break;
      case 'y':
        event.preventDefault();
        void this.redo();
        break;
      case 'c':
        event.preventDefault();
        void this.engine?.copy();
        break;
      // Paste (Ctrl/Cmd+V) is handled by the `paste` event so OS-clipboard
      // images can be detected; do not preventDefault here.
      case 'd':
        event.preventDefault();
        void this.engine?.duplicateActive().then(() => this.sync());
        break;
      case 'a':
        event.preventDefault();
        this.engine?.selectAll();
        break;
      default:
        break;
    }
  }

  handleKeyup(event: KeyboardEvent): void {
    if (event.key === ' ') {
      this.engine?.setPanMode(false);
    }
  }

  handlePaste(event: ClipboardEvent): void {
    if (!this.props.keyboardEnabled || !this.pointerInside || isTypingTarget(event.target)) {
      return;
    }
    let imageFile: File | null = null;
    const items = event.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          imageFile = item.getAsFile();
          break;
        }
      }
    }
    event.preventDefault();
    if (imageFile) {
      void this.engine?.addImageObject(imageFile).then(() => this.sync());
    } else {
      void this.engine?.paste().then(() => this.sync());
    }
  }

  // ---- canvas / view ---------------------------------------------------------

  /** Reset zoom + viewport so the image fits the stage. */
  fitToScreen(): void {
    this.engine?.resetView();
    this.sync();
  }

  toggleSnap(): void {
    const next = !this.state.snapEnabled;
    this.patch({ snapEnabled: next });
    this.engine?.setSnapping(next);
  }

  onArtboardChange(size: ArtboardSize | null): void {
    this.patch({ artboard: size });
    this.engine?.setArtboard(size);
  }

  toggleRulers(): void {
    const next = !this.state.rulersEnabled;
    this.patch({ rulersEnabled: next });
    this.engine?.setRulersEnabled(next);
  }

  /** Clear all user-placed guides (the ruler corner button). */
  clearGuides(): void {
    this.engine?.clearManualGuides();
  }

  /**
   * Begin dragging a new guide out of a ruler. The top ruler pulls a horizontal
   * guide; the left ruler a vertical one. A live preview tracks the pointer;
   * releasing over the canvas commits it, releasing outside cancels.
   */
  startGuideDraft(orientation: 'h' | 'v', event: { clientX: number; clientY: number; preventDefault(): void }): void {
    const engine = this.engine;
    if (!engine || !this.state.rulersEnabled) {
      return;
    }
    event.preventDefault();
    this.guideDraftCleanup?.();

    const scenePosAt = (clientX: number, clientY: number): number => {
      const vp = engine.clientToViewport(clientX, clientY);
      const scene = engine.viewportToScene(vp.x, vp.y);
      return orientation === 'h' ? scene.y : scene.x;
    };
    const onMove = (e: PointerEvent): void => {
      engine.setGuideDraft(orientation, scenePosAt(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent): void => {
      this.guideDraftCleanup?.();
      const vp = engine.clientToViewport(e.clientX, e.clientY);
      const view = engine.getViewport();
      const overCanvas = vp.x >= 0 && vp.y >= 0 && vp.x <= view.width && vp.y <= view.height;
      if (overCanvas) {
        engine.addManualGuide(orientation, scenePosAt(e.clientX, e.clientY));
      } else {
        engine.setGuideDraft(orientation, null);
      }
    };
    this.guideDraftCleanup = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      this.guideDraftCleanup = null;
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    onMove(event as PointerEvent);
  }

  /** Paint both ruler strips from the engine's viewport, scaled for the display. */
  renderRulers(host: HTMLElement, top: HTMLCanvasElement, left: HTMLCanvasElement): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const view = engine.getViewport();
    const styles = getComputedStyle(host);
    const colors: RulerColors = {
      bg: styles.getPropertyValue('--asp-surface-sunk').trim() || '#f1f3f6',
      tick: styles.getPropertyValue('--asp-ink-faint').trim() || '#9aa4b2',
      label: styles.getPropertyValue('--asp-ink-muted').trim() || '#6b7280',
    };
    const dpr = window.devicePixelRatio || 1;

    const paint = (el: HTMLCanvasElement, orientation: 'h' | 'v'): void => {
      const cssW = el.clientWidth;
      const cssH = el.clientHeight;
      if (cssW === 0 || cssH === 0) {
        return;
      }
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      const ctx = el.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (orientation === 'h') {
        drawRuler(ctx, 'h', cssW, cssH, { zoom: view.zoom, pan: view.panX }, colors);
      } else {
        drawRuler(ctx, 'v', cssH, cssW, { zoom: view.zoom, pan: view.panY }, colors);
      }
    };
    paint(top, 'h');
    paint(left, 'v');
  }

  /**
   * Paint the user's guides (and any live draft) onto a dedicated overlay canvas
   * that sits above the Fabric canvas. Drawing here — rather than on Fabric's own
   * overlay context — keeps guides stable, since Fabric clears its overlay on its
   * own schedule (e.g. on mouse-up) without redrawing ours.
   */
  renderGuidesOverlay(el: HTMLCanvasElement): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const cssW = el.clientWidth;
    const cssH = el.clientHeight;
    if (cssW === 0 || cssH === 0) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(cssW * dpr);
    el.height = Math.round(cssH * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const view = engine.getViewport();
    ctx.lineWidth = 1;
    const paintGuide = (orientation: 'h' | 'v', pos: number, color: string): void => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      if (orientation === 'h') {
        const y = Math.round(pos * view.zoom + view.panY) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(cssW, y);
      } else {
        const x = Math.round(pos * view.zoom + view.panX) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssH);
      }
      ctx.stroke();
    };
    for (const guide of engine.getManualGuides()) {
      paintGuide(guide.orientation, guide.pos, '#12b5cb');
    }
    const draft = engine.getGuideDraft();
    if (draft) {
      paintGuide(draft.orientation, draft.pos, '#0a8aa0');
    }
  }

  // ---- session effects driven by the hook -------------------------------------

  /** Free-draw / text / magic-wand mode follows the active tool + brush settings. */
  applyToolModes(): void {
    if (!this.state.engineReady || !this.engine) {
      return;
    }
    const tool = this.state.activeTool;
    const drawing = tool === 'pen' || tool === 'highlighter' || tool === 'eraser';
    this.engine.setFreeDraw(
      drawing,
      { color: this.state.annotationColor, strokeWidth: this.state.annotationWidth },
      tool === 'highlighter',
    );
    // Text tool: click the canvas to drop an editable text box.
    this.engine.setTextMode(tool === 'text');
    // Magic wand: click a region of the image to flood-fill erase it.
    this.engine.setMagicMode(tool === 'magicwand');
  }

  /**
   * Crop tool shows an interactive frame; entering begins a session at the
   * current aspect, leaving without Apply discards the frame (the committed
   * region, if any, persists).
   */
  syncCropSession(): void {
    const isCrop = this.state.activeTool === 'crop' && this.state.engineReady;
    if (isCrop && !this.state.cropActive) {
      this.engine?.beginCrop(this.ratioFromPreset(this.state.activeCrop));
      this.patch({ cropActive: true });
    } else if (!isCrop && this.state.cropActive) {
      this.engine?.cancelCrop();
      this.patch({ cropActive: false });
    }
  }

  /**
   * Redact tool shows a positioning marquee; leaving it discards an unapplied
   * one. While active, clicking the canvas places a fresh box (click-to-place).
   */
  syncRedactSession(): void {
    const isRedact = this.state.activeTool === 'redact' && this.state.engineReady;
    this.engine?.setRedactPlacement(isRedact);
    if (isRedact && !this.redactActive) {
      this.engine?.addRedactionMarquee();
      this.redactActive = true;
    } else if (!isRedact && this.redactActive) {
      this.engine?.cancelRedaction();
      this.redactActive = false;
    }
  }

  /**
   * Keep the active tool valid as the resolved set changes: default to Color
   * (adjust) when available, else the first resolved tool.
   */
  ensureActiveTool(resolvedKeys: readonly AspTool[]): void {
    const current = this.state.activeTool;
    if (resolvedKeys.length === 0) {
      if (current !== null) {
        this.patch({ activeTool: null });
      }
    } else if (current === null || !resolvedKeys.includes(current)) {
      this.patch({ activeTool: resolvedKeys.includes('adjust') ? 'adjust' : resolvedKeys[0] });
    }
  }

  /**
   * Push the effective export target to the engine: the selected aspect option's
   * own dimensions when it declares any, else the host's `exportTarget` prop.
   */
  syncExportTarget(): void {
    this.applyExportTarget();
  }

  private applyExportTarget(): void {
    this.engine?.setExportTarget(this.state.activeAspectTarget ?? this.props.exportTarget);
  }

  /** Sync the export quality from its prop. */
  syncExportQuality(quality: number): void {
    this.patch({ exportQ: quality });
  }

  /**
   * The first allowed format is the default (and, in chromes without a format
   * picker, the commit format), so a new list resets the selection rather than
   * keeping a stale pick.
   */
  syncExportFormats(formats: readonly AspExportFormat[]): void {
    if (formats.length > 0) {
      this.patch({ exportFormat: formats[0] });
    }
  }

  // ---- top bar ----------------------------------------------------------------

  selectTool(tool: AspTool): void {
    const group = groupForTool(tool);
    this.patch({
      activeTool: tool,
      ...(group
        ? { activeMembers: { ...this.state.activeMembers, [group.id]: tool } }
        : {}),
    });
  }

  async undo(): Promise<void> {
    await this.engine?.undo();
    this.sync();
    this.syncUiFromEngine();
  }

  async redo(): Promise<void> {
    await this.engine?.redo();
    this.sync();
    this.syncUiFromEngine();
  }

  /** Pull tool/adjustment/look/frame state from the engine into the panel state. */
  private syncUiFromEngine(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.patch({
      adjustments: engine.getAdjustments(),
      activeLook: engine.activeLook,
      straighten: engine.straightenAngle,
      activeFrame: engine.activeFrame,
      // A crop's source aspect is not recoverable from the flattened scene.
      activeCrop: 'free',
      activeAspectLabel: '',
      activeAspectTarget: null,
    });
    this.applyExportTarget();
  }

  zoomIn(): void {
    this.zoomStep(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomStep(-ZOOM_STEP);
  }

  /** Step whichever zoom the current interaction owns: the image in a fixed-frame crop, else the viewport. */
  private zoomStep(deltaPct: number): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    if (engine.isImageCropping()) {
      engine.zoomImageCrop(engine.imageCropZoomPct + deltaPct);
    } else {
      engine.zoomBy(deltaPct);
    }
    this.sync();
  }

  togglePicker(): void {
    this.patch({ pickerOpen: !this.state.pickerOpen, exportOpen: false, historyOpen: false });
  }

  toggleExport(): void {
    this.patch({ exportOpen: !this.state.exportOpen, pickerOpen: false, historyOpen: false });
  }

  toggleHistory(): void {
    this.patch({ historyOpen: !this.state.historyOpen, pickerOpen: false, exportOpen: false });
  }

  async pickSample(sample: SampleImage): Promise<void> {
    this.patch({ pickerOpen: false });
    this.lastSource = sample.dataUrl;
    await this.loadSource(sample.dataUrl);
  }

  async uploadFile(file: File): Promise<void> {
    this.patch({ pickerOpen: false });
    this.lastSource = file;
    await this.loadSource(file);
  }

  /** Add an uploaded image as a new movable layer (composite, not replace). */
  async addImageLayerFile(file: File): Promise<void> {
    this.patch({ pickerOpen: false });
    try {
      await this.engine?.addImageObject(file);
      this.sync();
    } catch (error) {
      this.emitError('image-add-failed', error);
    }
  }

  /** Download the current scene as a reusable template (JSON). */
  saveTemplate(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.patch({ pickerOpen: false });
    try {
      const json = engine.exportScene();
      triggerDownload(new Blob([json], { type: 'application/json' }), 'template.json');
    } catch (error) {
      this.emitError('template-save-failed', error);
    }
  }

  /** Load a template (JSON) saved by {@link saveTemplate} and sync the UI to it. */
  async loadTemplateFile(file: File): Promise<void> {
    this.patch({ pickerOpen: false });
    try {
      await this.engine?.loadScene(await file.text());
      this.patch({ artboard: this.engine?.getArtboard() ?? null });
      this.sync();
      this.syncUiFromEngine();
    } catch (error) {
      this.emitError('template-load-failed', error);
    }
  }

  setExportFormat(format: AspExportFormat): void {
    this.patch({ exportFormat: format });
  }

  setExportQuality(value: number): void {
    this.patch({ exportQ: value });
  }

  /**
   * Export → Download: write the image to a file and report it through
   * `onExported`. Deliberately NOT `onSaved` — a download is not a commit, and a
   * host listening for the result must never also find a file in Downloads.
   */
  async download(): Promise<void> {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.patch({ exportOpen: false });
    try {
      const blob = await engine.exportImage(
        this.state.exportFormat,
        this.state.exportQ,
        this.props.exportFormats,
      );
      this.props.onExported?.(blob);
      triggerDownload(blob, `image.${extensionFor(this.state.exportFormat)}`);
    } catch (error) {
      this.emitError('export-failed', error);
    }
  }

  // ---- commit / cancel (every chrome) -------------------------------------------

  /**
   * The commit action: export to a Blob in the selected format and hand it to
   * the host through `onSaved`. Writes no file and creates no object URL. An
   * in-progress crop is applied first — the user framed it and pressed commit.
   */
  async save(): Promise<void> {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const format = this.state.exportFormat;
    try {
      if (engine.isImageCropping()) {
        engine.applyImageCrop();
        this.patch({ cropActive: false, hasCropRegion: true });
      } else if (engine.isCropping()) {
        engine.applyCropRegion();
        this.patch({ cropActive: false, hasCropRegion: true });
      }
      const blob = await engine.exportImage(format, this.state.exportQ, this.props.exportFormats);
      this.props.onSaved?.(blob);
    } catch (error) {
      this.emitError('export-failed', error);
    }
  }

  cancel(): void {
    if (this.engine?.isImageCropping()) {
      this.engine.cancelImageCrop();
      this.patch({ cropActive: false });
    } else if (this.engine?.isCropping()) {
      this.engine.cancelCrop();
      this.patch({ cropActive: false });
    }
    this.props.onCanceled?.();
  }

  onZoomSlider(value: number): void {
    // In a fixed-frame crop the slider zooms ONLY the image inside the frame
    // (100% = the image exactly fills it), never the canvas viewport.
    if (this.engine?.isImageCropping()) {
      this.engine.zoomImageCrop(value);
      this.syncZoom();
      return;
    }
    this.engine?.setZoom(value);
    this.sync();
  }

  // ---- options panel handlers ----------------------------------------------------

  reset(): void {
    void this.engine?.reset().then(() => {
      this.sync();
      this.syncUiFromEngine();
    });
  }

  onAdjustInput(change: { key: AspFilter; value: number }): void {
    this.patch({ adjustments: { ...this.state.adjustments, [change.key]: change.value } });
    this.engine?.setAdjustments({ [change.key]: change.value });
  }

  onAdjustCommit(change: { key: AspFilter; value: number }): void {
    this.patch({ adjustments: { ...this.state.adjustments, [change.key]: change.value } });
    this.engine?.setAdjustments({ [change.key]: change.value }, true);
    this.sync();
  }

  selectLook(look: AspFilter | null): void {
    const current = this.state.activeLook;
    // Toggle: clear the previous look, then apply the new one (single-select UI).
    if (current && current !== look) {
      this.engine?.toggleLook(current);
    }
    if (look === null) {
      if (current) {
        this.engine?.toggleLook(current);
      }
      this.patch({ activeLook: null });
    } else if (current === look) {
      this.engine?.toggleLook(look);
      this.patch({ activeLook: null });
    } else {
      this.engine?.toggleLook(look);
      this.patch({ activeLook: look });
    }
    this.sync();
  }

  /** Resolve a crop preset to an aspect ratio (w/h), or null for a free crop. */
  private ratioFromPreset(preset: AspAspectPreset): number | null {
    return aspectRatioValue(preset);
  }

  /** Start the crop frame if one isn't already active (e.g. from the dialog's chips). */
  private ensureCropSession(ratio: number | null): void {
    // Dialog chrome: the crop frame is FIXED; the image pans and zooms
    // underneath it. The workspace keeps the movable-frame crop.
    if (this.layout() === 'dialog') {
      this.engine?.setImageCropRatio(ratio);
      this.patch({ cropActive: this.engine?.isImageCropping() ?? false });
    } else if (this.engine && !this.engine.isCropping()) {
      this.engine.beginCrop(ratio);
      this.patch({ cropActive: true });
    } else {
      this.engine?.setCropRatio(ratio);
    }
    // Entering or leaving a fixed-frame crop changes which zoom the slider owns.
    this.syncZoom();
  }

  /** Choose a crop aspect preset — reshapes (or starts) the live crop frame. */
  selectCrop(preset: AspAspectPreset): void {
    // A preset carries no pixel size, so exports fall back to the host default.
    this.patch({ activeCrop: preset, activeAspectLabel: '', activeAspectTarget: null });
    this.applyExportTarget();
    this.ensureCropSession(this.ratioFromPreset(preset));
    this.sync();
  }

  /** Choose a custom crop aspect (e.g. a CMS target) — reshapes (or starts) the live frame. */
  selectCustomCrop(option: AspAspectOption): void {
    this.patch({
      activeAspectLabel: option.label,
      activeAspectTarget:
        option.width && option.height ? { width: option.width, height: option.height } : null,
    });
    this.applyExportTarget();
    this.ensureCropSession(option.ratio);
    this.sync();
  }

  /** Commit the crop frame as the output region, then return to Select. */
  applyCrop(): void {
    this.engine?.applyCropRegion();
    this.patch({ hasCropRegion: true });
    this.sync();
    this.selectTool('select');
  }

  /** Discard the in-progress crop frame and return to Select. */
  cancelCrop(): void {
    this.engine?.cancelCrop();
    this.patch({ cropActive: false });
    this.selectTool('select');
  }

  /** Clear any applied crop region and restart the frame at the current ratio. */
  resetCrop(): void {
    this.engine?.clearCropRegion();
    this.patch({ hasCropRegion: false });
    this.engine?.beginCrop(this.ratioFromPreset(this.state.activeCrop));
    this.sync();
  }

  rotate(deg: number): void {
    this.engine?.rotateBy(deg);
    this.sync();
  }

  flip(axis: 'h' | 'v'): void {
    this.engine?.flip(axis);
    this.sync();
  }

  onStraightenInput(value: number): void {
    this.patch({ straighten: value });
    this.engine?.setStraighten(value);
  }

  onStraightenCommit(value: number): void {
    this.patch({ straighten: value });
    this.engine?.setStraighten(value, true);
    this.sync();
  }

  addShape(kind: ShapeKind): void {
    this.engine?.addShape(kind, {
      color: this.state.annotationColor,
      strokeWidth: this.state.annotationWidth,
      cornerRadius: kind === 'rect' ? this.state.shapeRadius : undefined,
    });
    this.sync();
  }

  /** Live corner-radius drag: update a selected rectangle without committing. */
  onCornerRadiusInput(radius: number): void {
    this.patch({ shapeRadius: radius });
    if (this.state.selectedIsRect) {
      this.engine?.setSelectedCornerRadius(radius, false);
    }
  }

  /** Corner-radius release: commit the selected rectangle's radius to history. */
  onCornerRadiusCommit(radius: number): void {
    this.patch({ shapeRadius: radius });
    if (this.state.selectedIsRect) {
      this.engine?.setSelectedCornerRadius(radius, true);
    }
    this.sync();
  }

  addText(text: string): void {
    this.engine?.addText(text, {
      color: this.state.annotationColor,
      fontSize: this.state.fontSize,
      fontFamily: this.state.fontFamily,
    });
    this.sync();
  }

  onFontChange(value: string): void {
    this.patch({ fontFamily: value });
    // Apply right away so the selection updates immediately; the family may
    // briefly render in a fallback until the web font loads, at which point the
    // engine re-renders (fonts 'loadingdone'). Re-apply once loaded so Fabric
    // re-measures with the real metrics.
    this.engine?.styleActiveObject({ fontFamily: value });
    // Surface a loading state (spinner + progress cursor) for web fonts. Hold it
    // for a brief minimum so a fast load still registers visually; system stacks
    // need no fetch and show nothing.
    const web = isWebFont(value);
    this.patch({ fontLoading: web });
    this.sync();
    const minVisible = web
      ? new Promise<void>((resolve) => setTimeout(resolve, 300))
      : Promise.resolve();
    void Promise.all([ensureFontLoaded(value), minVisible]).then(() => {
      // Only re-apply if this is still the chosen font — otherwise a slow-loading
      // earlier choice would clobber a newer one (the "2nd change doesn't stick").
      if (this.state.fontFamily !== value) {
        return;
      }
      this.engine?.styleActiveObject({ fontFamily: value });
      this.patch({ fontLoading: false });
      this.sync();
    });
  }

  onAddCustomFont(name: string): void {
    if (!this.state.customFonts.some((f) => f.value === name)) {
      this.patch({ customFonts: [...this.state.customFonts, { label: name, value: name }] });
    }
    this.onFontChange(name);
  }

  groupSelection(): void {
    this.engine?.groupActive();
    this.sync();
  }

  ungroupSelection(): void {
    this.engine?.ungroupActive();
    this.sync();
  }

  alignSelection(mode: AlignMode): void {
    this.engine?.alignActive(mode);
    this.sync();
  }

  duplicate(): void {
    void this.engine?.duplicateActive().then(() => this.sync());
  }

  /** Reflect the selected object's editable style into the panel state. */
  private onSelectionChange(info: SelectionStyleInfo | null): void {
    if (!info) {
      this.patch({ hasSelection: false, selectionKind: null, selectedIsRect: false });
      return;
    }
    const partial: EditorUiPatch = {
      hasSelection: true,
      selectionKind: info.kind,
      annotationColor: info.color,
    };
    // Reflect a selected rectangle's corner radius into the slider.
    const isRect = info.cornerRadiusMax !== undefined;
    partial.selectedIsRect = isRect;
    if (isRect) {
      partial.shapeRadius = Math.round(info.cornerRadius ?? 0);
      partial.shapeRadiusMax = Math.round(info.cornerRadiusMax ?? 55);
    }
    if (info.kind === 'text') {
      partial.fontSize = Math.round(info.size);
      if (info.textStyle) {
        partial.textBold = info.textStyle.bold;
        partial.textItalic = info.textStyle.italic;
        partial.textUnderline = info.textStyle.underline;
        partial.textStrike = info.textStyle.strike;
        partial.textAlign = info.textStyle.align;
        // Reflect the selected text's font in the panel dropdown.
        if (info.textStyle.fontFamily) {
          partial.fontFamily = info.textStyle.fontFamily;
        }
      }
    } else {
      partial.annotationWidth = Math.round(info.size);
    }
    this.patch(partial);
  }

  // ---- rich text ----

  toggleBold(): void {
    const v = !this.state.textBold;
    this.patch({ textBold: v });
    this.engine?.applyTextStyle({ fontWeight: v ? 'bold' : 'normal' });
    this.sync();
  }

  toggleItalic(): void {
    const v = !this.state.textItalic;
    this.patch({ textItalic: v });
    this.engine?.applyTextStyle({ fontStyle: v ? 'italic' : 'normal' });
    this.sync();
  }

  toggleUnderline(): void {
    const v = !this.state.textUnderline;
    this.patch({ textUnderline: v });
    this.engine?.applyTextStyle({ underline: v });
    this.sync();
  }

  toggleStrike(): void {
    const v = !this.state.textStrike;
    this.patch({ textStrike: v });
    this.engine?.applyTextStyle({ linethrough: v });
    this.sync();
  }

  setTextAlign(align: string): void {
    this.patch({ textAlign: align });
    this.engine?.applyTextStyle({ textAlign: align });
    this.sync();
  }

  setLineHeight(value: number): void {
    this.patch({ lineHeight: value });
    this.engine?.applyTextStyle({ lineHeight: value });
    this.sync();
  }

  setLetterSpacing(value: number): void {
    this.patch({ letterSpacing: value });
    this.engine?.applyTextStyle({ charSpacing: value });
    this.sync();
  }

  setTextBg(color: string): void {
    this.engine?.applyTextStyle({ textBackgroundColor: color === 'transparent' ? '' : color });
    this.sync();
  }

  // ---- redact / magic / AI ----

  setRedactMode(mode: RedactMode): void {
    this.patch({ redactMode: mode });
  }

  applyRedaction(): void {
    void this.engine?.applyRedaction(this.state.redactMode).then(() => {
      // The marquee is consumed. We deliberately do NOT spawn a new one — that
      // made a box "jump" onto the canvas. To redact again, click the canvas to
      // place a fresh box where you want it.
      this.sync();
    });
  }

  onMagicTolerance(value: number): void {
    this.patch({ magicTolerance: value });
  }

  /** Run the active AI tool (background removal / subject cut-out) on the image. */
  runAi(): void {
    const engine = this.engine;
    if (!engine || this.state.aiBusy) {
      return;
    }
    const mode = this.state.activeTool === 'selectsubject' ? 'subject' : 'replace';
    this.patch({ aiBusy: true, aiProgress: 0, aiStage: 'loading' });
    void engine
      .removeImageBackground(mode)
      .then((ok) => {
        if (!ok) {
          this.emitError('ai-no-image', new Error('No image to process'));
        }
        this.sync();
      })
      .catch((error) => this.emitError('ai-failed', error))
      .finally(() => this.patch({ aiBusy: false }));
  }

  // ---- fill / color / frame / background ----

  setFill(color: string): void {
    if (this.engine?.setActiveFill(color)) {
      this.sync();
    }
  }

  setAnnotationColor(color: string): void {
    this.patch({ annotationColor: color });
    // Apply to the current selection (no-op + no history entry if nothing selected).
    if (this.engine?.styleActiveObject({ color })) {
      this.sync();
    }
  }

  /** Live size drag — apply to the selection without committing each frame. */
  onSizeInput(size: number): void {
    if (this.state.activeTool === 'text') {
      this.patch({ fontSize: size });
    } else {
      this.patch({ annotationWidth: size });
    }
    this.engine?.styleActiveObject({ size }, false);
  }

  /** Size drag released — commit one history entry. */
  onSizeCommit(size: number): void {
    if (this.state.activeTool === 'text') {
      this.patch({ fontSize: size });
    } else {
      this.patch({ annotationWidth: size });
    }
    if (this.engine?.styleActiveObject({ size }, true)) {
      this.sync();
    }
  }

  selectFrame(frame: string): void {
    this.patch({ activeFrame: frame });
    this.engine?.applyFrame(frame, this.state.annotationColor);
    this.sync();
  }

  setBackgroundColor(color: string): void {
    this.engine?.setBackground(color);
    this.sync();
  }

  setBackgroundGradient(colors: string[]): void {
    this.engine?.setBackgroundGradient(colors);
    this.sync();
  }

  setBackgroundImageFromFile(file: File): void {
    void this.engine?.setBackgroundImage(file).then(() => this.sync());
  }

  deleteSelection(): void {
    this.engine?.deleteActive();
    this.sync();
  }

  // ---- layers ----

  onSelectLayer(event: { id: string; additive: boolean }): void {
    this.engine?.selectLayer(event.id, event.additive);
  }

  onReorderLayers(orderedIds: readonly string[]): void {
    this.engine?.reorderLayers(orderedIds);
    this.sync();
  }

  onRenameLayer(event: { id: string; name: string }): void {
    this.engine?.renameLayer(event.id, event.name);
    this.sync();
  }

  onToggleLayerLock(id: string): void {
    this.engine?.toggleLayerLock(id);
    this.sync();
  }

  onToggleLayerVisible(id: string): void {
    this.engine?.toggleLayerVisible(id);
    this.sync();
  }

  onMoveLayer(id: string, direction: 'up' | 'down'): void {
    this.engine?.moveLayer(id, direction);
    this.sync();
  }

  onDeleteLayer(id: string): void {
    this.engine?.deleteLayer(id);
    this.sync();
  }

  onLayerOpacityInput(change: { id: string; value: number }): void {
    this.engine?.setLayerOpacity(change.id, change.value, false);
  }

  onLayerOpacityCommit(change: { id: string; value: number }): void {
    this.engine?.setLayerOpacity(change.id, change.value, true);
    this.sync();
  }
}
