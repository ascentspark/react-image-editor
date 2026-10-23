/*
 * Public API surface of @ascentsparksoftware/react-image-editor
 *
 * Only symbols re-exported here are part of the package's semver contract.
 * Mirrors @ascentsparksoftware/angular-image-editor@22.0.5's public-api.ts —
 * the Angular DI providers are replaced by the `backgroundRemovalLoader` /
 * `heicDecoderLoader` component props.
 */

export { ImageEditor, type ImageEditorProps } from './ui/ImageEditor';

// Modal dialog — open the basic editor and await a Blob (or null on cancel).
export {
  openImageEditorDialog,
  type OpenImageEditorConfig,
} from './dialog/open-image-editor-dialog';

// Core type contract.
export {
  ALL_TOOLS,
  ALL_FILTERS,
  aspectOption,
  defaultChromeFor,
  defaultCropFrameFor,
  isAspectOption,
  type AspMode,
  type AspChrome,
  type AspCropFrame,
  type AspFitMode,
  type AspInitialAspect,
  type AspSize,
  type AspTool,
  type AspFilter,
  type AspExportFormat,
  type AspAspectPreset,
  type AspAspectOption,
  type AspExportTarget,
  type AspEditorError,
} from './types/editor.types';

// Tool/filter catalog + resolution (mode → tools allowlist → minus disabledTools; filters).
export {
  TOOL_REGISTRY,
  FILTER_REGISTRY,
  DEFAULT_TOOLS,
  DEFAULT_FILTERS,
  type ToolMeta,
  type FilterMeta,
  type AspToolGroup,
  type FilterKind,
} from './registry/tool-registry';
export { resolveTools, resolveFilters } from './registry/resolve-tools';

// Engine — advanced/headless access to the Fabric-backed editing surface.
export {
  EditorEngine,
  type EngineOptions,
  type ShapeKind,
  type RedactMode,
  type AnnotationStyle,
  type TextStyle,
  type SelectionStyleInfo,
  type LayerInfo,
  type ArtboardSize,
  type ManualGuide,
  type Viewport,
  type AiProgress,
} from './engine/editor-engine';
export { EditHistory, type HistoryEntry } from './engine/history';
export { DeltaHistory, type HistoryStep } from './engine/delta-history';

// Optional heavy features — opt in by passing a loader PROP so the WASM/ML
// packages live in the consumer's bundle, never the core library's import graph.
export type {
  AspBackgroundRemovalLoader,
  AspBackgroundRemovalModule,
  AspHeicDecoderLoader,
  AspHeicDecoderModule,
  RemoveBackgroundFn,
  Heic2AnyFn,
} from './engine/loaders';

// Theming — derive and apply the editor's --asp-* palette from 3 inputs.
export { deriveTheme, type AspThemeMode } from './theme/derive-theme';
export { applyTheme } from './theme/apply-theme';

// Text fonts — default set + type for customizing the font picker.
export { DEFAULT_FONTS, type FontOption } from './fonts/fonts';
export {
  THEME_TOKEN_NAMES,
  COLOR_TOKEN_NAMES,
  STATIC_TOKEN_NAMES,
  type AspThemeTokens,
  type ThemeTokenName,
} from './theme/tokens';
