import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  ImageEditor,
  openImageEditorDialog,
  aspectOption,
  type AspAspectOption,
  type AspExportFormat,
  type AspMode,
  type AspThemeMode,
  type AspTool,
} from '@ascentsparksoftware/react-image-editor';

import './playground.scss';

const CUSTOM_RAIL: readonly AspTool[] = ['crop', 'rotate', 'text', 'filters'];
const DISABLED_SET: readonly AspTool[] = ['filters', 'frame', 'redact'];

interface ThemePreset {
  readonly label: string;
  readonly base: string;
  readonly accent: string;
}

const PRESETS: readonly ThemePreset[] = [
  { label: 'Default blue', base: '#f4f6f9', accent: '#1f6feb' },
  { label: 'Wazure navy', base: '#f4f6f9', accent: '#02375e' },
  { label: 'Warm orange', base: '#fff7ed', accent: '#ea580c' },
  { label: 'Forest green', base: '#f0fdf4', accent: '#16a34a' },
  { label: 'Royal purple', base: '#faf5ff', accent: '#7c3aed' },
];

const EDITOR_MODES: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];
const ALL_FORMATS: readonly AspExportFormat[] = ['png', 'jpeg', 'webp', 'svg', 'pdf', 'json'];

const SIZE_PRESETS: readonly { label: string; value: string }[] = [
  { label: '70vh', value: '70vh' },
  { label: '600px', value: '600px' },
  { label: '520px', value: '520px' },
  { label: '460px (min)', value: '460px' },
];

const CMS_ASPECTS: readonly AspAspectOption[] = [
  aspectOption(1200, 630, 'OG 1200×630'),
  aspectOption(1080, 1080, 'Square 1080'),
  aspectOption(1920, 1080, 'HD 16:9'),
];

interface SnippetOptions {
  readonly mode: AspMode;
  readonly base: string;
  readonly accent: string;
  readonly themeMode: AspThemeMode;
  readonly height: string;
  readonly tools: readonly AspTool[] | null;
  readonly disabled: readonly AspTool[];
  /** Commit-only hosting: no download, a host-worded commit button. */
  readonly commitOnly: boolean;
}

/** Live React snippet that renders the editor with the current demo options. */
function buildCodeSnippet(options: SnippetOptions): string {
  const arr = (xs: readonly string[]): string => `[${xs.map((x) => `'${x}'`).join(', ')}]`;

  const attrs: string[] = [
    `mode="${options.mode}"`,
    `baseColor="${options.base}"`,
    `accentColor="${options.accent}"`,
    `themeMode="${options.themeMode}"`,
    `height="${options.height}"`,
    `exportFormats={${arr(ALL_FORMATS)}}`,
  ];
  if (options.tools) {
    attrs.push(`tools={${arr(options.tools)}}`);
  }
  if (options.disabled.length) {
    attrs.push(`disabledTools={${arr(options.disabled)}}`);
  }
  if (options.commitOnly) {
    attrs.push('commitLabel="Use this image"', 'showDownload={false}');
  }
  attrs.push('onSaved={onSaved}');

  return [
    '// Use it in a component',
    "import { ImageEditor } from '@ascentsparksoftware/react-image-editor';",
    '',
    'export function EditorExample() {',
    '  const onSaved = (blob: Blob): void => {',
    '    // the committed image — upload it, preview it, etc. Nothing was downloaded.',
    "    console.log('saved', blob.type, blob.size);",
    '  };',
    '',
    '  return (',
    '    <ImageEditor',
    ...attrs.map((a) => `      ${a}`),
    '    />',
    '  );',
    '}',
  ].join('\n');
}

/**
 * The landing page: an interactive playground for the editor. Live controls drive
 * the editor's mode, theme, size and tool set, and a "Show code" modal mirrors the
 * exact component snippet. The editor itself mounts when the stage scrolls into
 * view (the React counterpart of the Angular demo's `@defer (on viewport)`).
 */
export default function Playground(): ReactElement {
  const [base, setBase] = useState(PRESETS[0].base);
  const [accent, setAccent] = useState(PRESETS[0].accent);
  const [themeMode, setThemeMode] = useState<AspThemeMode>('light');
  const [editorMode, setEditorMode] = useState<AspMode>('advanced');
  const [lastResult, setLastResult] = useState('');
  /** Object URL of the last committed Blob, previewed as a thumbnail (proof the host got pixels back). */
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  /** Commit-only hosting: the Export menu loses its Download action and the commit button carries the host's label. */
  const [commitOnly, setCommitOnly] = useState(false);
  const [customTools, setCustomTools] = useState<readonly AspTool[] | null>(null);
  const [disabled, setDisabled] = useState<readonly AspTool[]>([]);
  const [editorHeight, setEditorHeight] = useState('600px');

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Defer the editor mount until the stage is in the viewport, keeping the
  // Angular demo's skeleton UX (and its instant first paint) intact.
  const stageRef = useRef<HTMLElement>(null);
  const [editorVisible, setEditorVisible] = useState(false);

  useEffect(() => {
    if (editorVisible) {
      return undefined;
    }
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === 'undefined') {
      setEditorVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setEditorVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [editorVisible]);

  const codeSnippet = buildCodeSnippet({
    mode: editorMode,
    base,
    accent,
    themeMode,
    height: editorHeight,
    tools: customTools,
    disabled,
    commitOnly,
  });

  // Release the previous preview's object URL whenever it is replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (lastPreview) {
        URL.revokeObjectURL(lastPreview);
      }
    };
  }, [lastPreview]);

  const showResult = (blob: Blob | null): void => {
    setLastPreview(blob ? URL.createObjectURL(blob) : null);
    setLastResult(blob ? `saved ${blob.type} (${blob.size} bytes)` : 'canceled');
  };

  const toggleCustomRail = (): void => {
    setCustomTools((tools) => (tools ? null : [...CUSTOM_RAIL]));
  };

  const toggleDisabled = (): void => {
    setDisabled((current) => (current.length ? [] : [...DISABLED_SET]));
  };

  const toggleCode = (): void => {
    setCodeOpen((open) => !open);
    setCodeCopied(false);
  };

  const copyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCodeCopied(true);
    } catch {
      setCodeCopied(false);
    }
  };

  const openDialog = async (): Promise<void> => {
    const blob = await openImageEditorDialog({
      heading: 'Update profile photo',
      baseColor: base,
      accentColor: accent,
      themeMode,
      aspectPresets: ['1:1', '4:3', 'free'],
      initialAspect: '1:1',
    });
    showResult(blob);
  };

  /**
   * The logo flow from the Phlebio handoff: a wide wordmark placed into a square
   * slot. `fitMode: 'contain'` lets it zoom OUT to fit, the letterbox is filled
   * white at export, and the commit button says what it does.
   */
  const openLogoDialog = async (): Promise<void> => {
    const blob = await openImageEditorDialog({
      src: 'asc-logo-full.svg',
      heading: 'Place the logo',
      baseColor: base,
      accentColor: accent,
      themeMode,
      aspectPresets: ['1:1', '16:9'],
      initialAspect: '1:1',
      fitMode: 'contain',
      exportBackground: '#ffffff',
      exportFormats: ['png'],
      commitLabel: 'Use this logo',
    });
    showResult(blob);
  };

  const applyPreset = (preset: ThemePreset): void => {
    setBase(preset.base);
    setAccent(preset.accent);
  };

  const toggleMode = (): void => {
    setThemeMode((mode) => (mode === 'light' ? 'dark' : 'light'));
  };

  const onBaseInput = (event: ChangeEvent<HTMLInputElement>): void => {
    setBase(event.target.value);
  };

  const onAccentInput = (event: ChangeEvent<HTMLInputElement>): void => {
    setAccent(event.target.value);
  };

  const onSaved = (blob: Blob): void => {
    showResult(blob);
  };

  return (
    <div className={themeMode === 'dark' ? 'playground pg pg--dark' : 'playground pg'}>
      <section className="hero">
        <h1 className="hero__title">React Image Editor</h1>
        <p className="hero__lead">
          A standalone, themeable <strong>React 19</strong> image editor built on{' '}
          <strong>Fabric.js v7</strong> — crop, filters, draw, text, redact, shapes, layers,
          in-browser AI background removal, and PNG/JPEG/WEBP/SVG/PDF export. Free and open-source
          (MIT).
        </p>
        <pre className="hero__install">npm i @ascentsparksoftware/react-image-editor fabric</pre>
        <div className="hero__actions">
          <Link className="hero__btn hero__btn--primary" to="/getting-started">
            Getting started →
          </Link>
          <a
            className="hero__btn"
            href="https://github.com/ascentspark/react-image-editor"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </section>

      <section className="toolbar">
        <div className="group">
          <span className="group__label">Theme</span>
          <div className="chips">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={
                  base === preset.base && accent === preset.accent
                    ? 'chip chip--active'
                    : 'chip'
                }
                onClick={() => applyPreset(preset)}
              >
                <span className="chip__dot" style={{ background: preset.accent }} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <span className="group__label">Editor theme</span>
          <div className="theme-cluster">
            <label className="swatch" title="Base color">
              <input type="color" value={base} onChange={onBaseInput} aria-label="Base color" />
              <span className="swatch__txt">Base</span>
            </label>
            <label className="swatch" title="Accent color">
              <input
                type="color"
                value={accent}
                onChange={onAccentInput}
                aria-label="Accent color"
              />
              <span className="swatch__txt">Accent</span>
            </label>
            <button type="button" className="mode-toggle" onClick={toggleMode}>
              {themeMode === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

        <div className="group">
          <span className="group__label">Mode</span>
          <div className="segmented" role="group" aria-label="Editor mode">
            {EDITOR_MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={
                  editorMode === m ? 'segmented__item segmented__item--active' : 'segmented__item'
                }
                onClick={() => setEditorMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <span className="group__label">Canvas size</span>
          <div className="chips">
            {SIZE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={editorHeight === preset.value ? 'chip chip--active' : 'chip'}
                onClick={() => setEditorHeight(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="group group--end">
          <span className="group__label">Demo options</span>
          <div className="opts">
            <button
              type="button"
              className={customTools ? 'toggle toggle--on' : 'toggle'}
              onClick={toggleCustomRail}
            >
              Custom tools
            </button>
            <button
              type="button"
              className={disabled.length ? 'toggle toggle--on' : 'toggle'}
              onClick={toggleDisabled}
            >
              Disable filters / frame / redact
            </button>
            <button
              type="button"
              className={commitOnly ? 'toggle toggle--on' : 'toggle'}
              onClick={() => setCommitOnly((v) => !v)}
            >
              Commit only (no download)
            </button>
            <button type="button" className="toggle" onClick={toggleCode}>
              {'</>'} Show code
            </button>
            <button type="button" className="btn-brand" onClick={() => void openDialog()}>
              Profile photo dialog
            </button>
            <button type="button" className="btn-brand" onClick={() => void openLogoDialog()}>
              Logo crop dialog
            </button>
            {lastResult && (
              <span className="result">
                {lastPreview && (
                  <img className="result__thumb" src={lastPreview} alt="Committed image preview" />
                )}
                {lastResult}
              </span>
            )}
          </div>
        </div>
      </section>

      {codeOpen && (
        <div className="code-modal" role="dialog" aria-modal="true" aria-label="Render code">
          <button
            type="button"
            className="code-modal__scrim"
            aria-label="Close"
            onClick={toggleCode}
          />
          <div className="code-modal__panel">
            <div className="code-modal__head">
              <div>
                <strong>Render with these options</strong>
                <p>This snippet reflects the controls above — copy it into your app.</p>
              </div>
              <div className="code-modal__actions">
                <button type="button" className="toggle" onClick={() => void copyCode()}>
                  {codeCopied ? 'Copied ✓' : 'Copy'}
                </button>
                <button type="button" className="toggle" onClick={toggleCode}>
                  Close
                </button>
              </div>
            </div>
            <pre className="code-modal__code">
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </div>
      )}

      <main className="stage" ref={stageRef}>
        {editorVisible ? (
          <ImageEditor
            mode={editorMode}
            tools={customTools}
            disabledTools={disabled}
            aspectRatios={CMS_ASPECTS}
            exportFormats={ALL_FORMATS}
            height={editorHeight}
            baseColor={base}
            accentColor={accent}
            themeMode={themeMode}
            commitLabel={commitOnly ? 'Use this image' : null}
            showDownload={!commitOnly}
            onSaved={onSaved}
          />
        ) : (
          <div className="editor-skeleton">Loading editor…</div>
        )}
      </main>
    </div>
  );
}
