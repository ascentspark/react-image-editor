import { createRoot } from 'react-dom/client';

import { type AspThemeMode } from '../theme/derive-theme';
import {
  defaultChromeFor,
  type AspAspectOption,
  type AspAspectPreset,
  type AspChrome,
  type AspExportFormat,
  type AspExportTarget,
  type AspFilter,
  type AspFitMode,
  type AspMode,
  type AspSize,
  type AspTool,
} from '../types/editor.types';
import { type FontOption } from '../fonts/fonts';
import { ImageEditor, type ImageEditorProps } from '../ui/ImageEditor';
import { createFocusTrap } from './focus-trap';

/**
 * Options for {@link openImageEditorDialog}.
 *
 * Every editor prop the dialog can meaningfully forward is here under its
 * prop's name — `mode` defaults to `'basic'`, everything else to the editor's
 * own default when unset. `width` / `maxWidth` / `height` size the card.
 */
export interface OpenImageEditorConfig {
  readonly src?: string | Blob | null;
  /** Baseline preset. Defaults to `'basic'` (the compact crop dialog). */
  readonly mode?: AspMode;
  /** Chrome override — e.g. `'workspace'` to open the full editor in the modal. */
  readonly chrome?: AspChrome | null;
  readonly tools?: readonly AspTool[] | null;
  readonly disabledTools?: readonly AspTool[];
  readonly filters?: readonly AspFilter[] | 'all' | null;
  readonly heading?: string;
  readonly baseColor?: string;
  readonly accentColor?: string;
  readonly themeMode?: AspThemeMode;
  readonly aspectPresets?: readonly AspAspectPreset[];
  /** Aspect the crop opens constrained to (e.g. `'1:1'` for an avatar). */
  readonly initialAspect?: AspAspectPreset;
  readonly aspectRatios?: readonly AspAspectOption[];
  /** `'contain'` lets an image of any aspect zoom out to fit the crop frame (logo crop). */
  readonly fitMode?: AspFitMode;
  readonly exportFormats?: readonly AspExportFormat[];
  readonly exportQuality?: number;
  readonly exportTarget?: AspExportTarget | null;
  readonly exportBackground?: string | null;
  /** Label of the commit button, e.g. `'Use this logo'`. */
  readonly commitLabel?: string | null;
  readonly showCommit?: boolean;
  readonly showDownload?: boolean;
  readonly showHistory?: boolean;
  readonly keyboardEnabled?: boolean;
  readonly fonts?: readonly FontOption[];
  /** Card width. Defaults to 520px for the dialog chrome, `min(1100px, 100%)` otherwise. */
  readonly width?: AspSize;
  /** Card max-width. Defaults to `100%` of the scrim's padded area. */
  readonly maxWidth?: AspSize;
  /** Card height. Defaults to content height for the dialog chrome, `min(720px, 100vh - 48px)` otherwise. */
  readonly height?: AspSize;
}

/** Config keys that are forwarded verbatim to the editor prop of the same name. */
type ForwardedProp = Exclude<keyof OpenImageEditorConfig, 'width' | 'maxWidth' | 'height'>;

/**
 * Every forwarded prop, so the forwarding loop and the test that guards it
 * share one list. `satisfies` keeps the list honest against both the config
 * type and the component's props.
 */
export const DIALOG_FORWARDED_PROPS = [
  'src',
  'mode',
  'chrome',
  'tools',
  'disabledTools',
  'filters',
  'heading',
  'baseColor',
  'accentColor',
  'themeMode',
  'aspectPresets',
  'initialAspect',
  'aspectRatios',
  'fitMode',
  'exportFormats',
  'exportQuality',
  'exportTarget',
  'exportBackground',
  'commitLabel',
  'showCommit',
  'showDownload',
  'showHistory',
  'keyboardEnabled',
  'fonts',
] as const satisfies readonly (ForwardedProp & keyof ImageEditorProps)[];

/** The editor props for `config`: defaults applied, unset keys left out. */
export function resolveDialogProps(config: OpenImageEditorConfig): Partial<ImageEditorProps> {
  const withDefaults: OpenImageEditorConfig = {
    mode: 'basic',
    heading: 'Edit image',
    baseColor: '#f4f6f9',
    accentColor: '#1f6feb',
    themeMode: 'light',
    ...config,
  };
  const props: Record<string, unknown> = {};
  for (const key of DIALOG_FORWARDED_PROPS) {
    if (withDefaults[key] !== undefined) {
      props[key] = withDefaults[key];
    }
  }
  return props as Partial<ImageEditorProps>;
}

/** Resolve a card size: a number is px, a string is a CSS length. */
function cssSize(value: AspSize | undefined, fallback: string): string {
  if (value === undefined || value === '') {
    return fallback;
  }
  return typeof value === 'number' ? `${value}px` : value;
}

/** The chrome the dialog will render, which decides the card's default size. */
function chromeOf(config: OpenImageEditorConfig): AspChrome {
  return config.chrome ?? defaultChromeFor(config.mode ?? 'basic');
}

/**
 * Opens the editor in a modal overlay and resolves with the committed image
 * Blob, or `null` if the user cancels (close button, scrim click, or Escape).
 * The overlay traps Tab focus and returns focus to the opener on close.
 * Implemented with a dedicated React root on a detached scrim so it works from
 * any event handler without a host component.
 */
export function openImageEditorDialog(config: OpenImageEditorConfig = {}): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const scrim = document.createElement('div');
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.setAttribute('aria-label', config.heading ?? 'Edit image');
    Object.assign(scrim.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(2px)',
    } satisfies Partial<CSSStyleDeclaration>);

    const isDialogChrome = chromeOf(config) === 'dialog';
    const card = document.createElement('div');
    card.style.width = cssSize(config.width, isDialogChrome ? '520px' : 'min(1100px, 100%)');
    card.style.maxWidth = cssSize(config.maxWidth, '100%');
    card.style.height = cssSize(
      config.height,
      isDialogChrome ? 'auto' : 'min(720px, calc(100vh - 48px))',
    );
    card.style.maxHeight = 'calc(100vh - 48px)';
    card.style.boxShadow = '0 30px 80px rgba(0, 0, 0, 0.4)';
    card.style.borderRadius = '14px';
    card.style.overflow = 'hidden';
    card.style.outline = 'none';
    scrim.appendChild(card);
    document.body.appendChild(scrim);

    const root = createRoot(card);
    const trap = createFocusTrap(card);

    let settled = false;
    const finish = (result: Blob | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      trap.deactivate();
      // Defer unmount out of the React event that triggered finish() —
      // unmounting synchronously from inside a render/event is not allowed.
      queueMicrotask(() => {
        root.unmount();
        scrim.remove();
      });
      resolve(result);
    };

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        finish(null);
      }
    };
    scrim.addEventListener('mousedown', (event) => {
      if (event.target === scrim) {
        finish(null);
      }
    });
    document.addEventListener('keydown', onKeydown);

    root.render(
      <ImageEditor
        {...resolveDialogProps(config)}
        onSaved={(blob) => finish(blob)}
        onCanceled={() => finish(null)}
      />,
    );
    // The editor mounts on the next React commit; trapping now puts focus on
    // the card itself, and Tab then lands on the first control once it exists.
    trap.activate();
  });
}
