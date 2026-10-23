import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ImageEditor,
  aspectOption,
  openImageEditorDialog,
  type AspAspectPreset,
  type AspChrome,
  type AspCropFrame,
  type AspEditorError,
  type AspExportFormat,
  type AspFitMode,
  type AspInitialAspect,
  type AspMode,
  type AspTool,
  type OpenImageEditorConfig,
} from '@ascentsparksoftware/react-image-editor';

const MODES: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];
const CHROMES: readonly AspChrome[] = ['dialog', 'workspace', 'viewer'];
const ALL_FORMATS: readonly AspExportFormat[] = ['png', 'jpeg', 'webp', 'svg', 'json', 'pdf'];
const PRESETS: readonly AspAspectPreset[] = ['free', '1:1', '4:3', '16:9', '3:2', 'original'];
const CROP_FRAMES: readonly AspCropFrame[] = ['fixed', 'movable'];
const DEFAULT_PRESETS: readonly AspAspectPreset[] = ['free', '1:1', '4:3', '16:9'];

/**
 * Build a deterministic test image: white with a black grid and a diagonal.
 * Gridlines are 1 source pixel wide, so an export that truly carries source
 * pixels stays high-contrast while an upscaled one visibly blurs — which is
 * what {@link measureSharpness} measures. Non-square sizes model a wordmark.
 */
function gridImageDataUrl(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d context unavailable');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  const step = Math.max(4, Math.round(Math.max(width, height) / 24));
  for (let x = 0; x < width; x += step) {
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += step) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

/**
 * Mean absolute horizontal luminance gradient across the bitmap, 0–255. A
 * bitmap that still holds 1px gridlines scores far higher than the same image
 * upscaled from a screen-sized raster, so the tests can tell real source pixels
 * from a blur.
 */
function measureSharpness(data: Uint8ClampedArray, width: number, height: number): number {
  let total = 0;
  let samples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const p = (y * width + x) * 4;
      total += Math.abs(data[p] - data[p - 4]);
      samples += 1;
    }
  }
  return samples === 0 ? 0 : total / samples;
}

/** Parse `1000x1000` into a size; `null` when the param is absent or malformed. */
function parseSize(raw: string | null): { width: number; height: number } | null {
  const m = /^(\d+)x(\d+)$/i.exec(raw ?? '');
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

interface BlobFacts {
  readonly size: string;
  readonly sharpness: string;
  /** `r,g,b,a` of the top-left pixel — the letterbox band in a contain crop. */
  readonly corner: string;
}

/** Decode a blob to its pixel size, sharpness and corner colour (PDFs report page size). */
async function describeBlob(blob: Blob): Promise<BlobFacts> {
  if (blob.type === 'application/pdf') {
    // The page is sized from the engine's reported output size, so the MediaBox
    // is how a host would see that number.
    const box = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(await blob.text());
    return {
      size: box ? `${Math.round(Number(box[1]))}x${Math.round(Number(box[2]))}` : 'no-mediabox',
      sharpness: 'n/a',
      corner: 'n/a',
    };
  }
  if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') {
    return { size: 'n/a', sharpness: 'n/a', corner: 'n/a' };
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { size: 'no-context', sharpness: 'no-context', corner: 'no-context' };
    }
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const result = {
      size: `${bitmap.width}x${bitmap.height}`,
      sharpness: measureSharpness(data, bitmap.width, bitmap.height).toFixed(2),
      corner: `${data[0]},${data[1]},${data[2]},${data[3]}`,
    };
    bitmap.close();
    return result;
  } catch {
    return { size: 'decode-failed', sharpness: 'decode-failed', corner: 'decode-failed' };
  }
}

/**
 * Hidden deterministic surface for the Playwright suite (not in the nav).
 * `/e2e?mode=basic&aspect=1:1&source=2400&shell=640&target=1000x1000` renders
 * one editor in a fixed-width shell over a generated grid image, plus
 * instrumentation readouts the tests assert on — including the decoded pixel
 * size, sharpness and corner colour of the saved blob, and counters for file
 * downloads (`a[download]` clicks) and object URLs so "writes no file" is a
 * checkable claim. The "Open editor dialog" launcher opens the packaged modal
 * with the same configuration; `dialog=1` hides the inline editor so only the
 * modal is on the page.
 */
export default function E2eHarness(): ReactElement {
  const [params] = useSearchParams();
  const modeParam = params.get('mode');
  const mode: AspMode = MODES.includes(modeParam as AspMode) ? (modeParam as AspMode) : 'advanced';
  const chromeParam = params.get('chrome');
  const chrome: AspChrome | null = CHROMES.includes(chromeParam as AspChrome)
    ? (chromeParam as AspChrome)
    : null;
  const toolsParam = params.get('tools');
  const tools = useMemo<readonly AspTool[] | null>(
    () => (toolsParam ? (toolsParam.split(',') as AspTool[]) : null),
    [toolsParam],
  );
  const themeMode = params.get('theme') === 'dark' ? 'dark' : 'light';
  // `aspect=1:1` opens at a preset; `aspect=1200x630` at a custom option (same label as `chip=`).
  const aspectParam = params.get('aspect');
  const initialAspect = useMemo<AspInitialAspect | null>(() => {
    if (PRESETS.includes(aspectParam as AspAspectPreset)) {
      return aspectParam as AspAspectPreset;
    }
    const size = parseSize(aspectParam);
    return size ? aspectOption(size.width, size.height) : null;
  }, [aspectParam]);
  // `presets=1:1,16:9` replaces the preset chips; `presets=` (empty) removes them all.
  const presetsParam = params.get('presets');
  const aspectPresets = useMemo<readonly AspAspectPreset[]>(
    () =>
      presetsParam === null
        ? DEFAULT_PRESETS
        : presetsParam
            .split(',')
            .filter((p): p is AspAspectPreset => PRESETS.includes(p as AspAspectPreset)),
    [presetsParam],
  );
  // `frame=fixed` / `frame=movable` overrides the chrome's default crop frame.
  const frameParam = params.get('frame');
  const cropFrame: AspCropFrame | null = CROP_FRAMES.includes(frameParam as AspCropFrame)
    ? (frameParam as AspCropFrame)
    : null;
  const fitMode: AspFitMode = params.get('fit') === 'contain' ? 'contain' : 'cover';
  const bgParam = params.get('bg');
  const exportBackground = bgParam && /^[0-9a-f]{6}$/i.test(bgParam) ? `#${bgParam}` : null;
  const commitLabel = params.get('commit');
  const showDownload = params.get('download') !== '0';
  const dialogOnly = params.get('dialog') === '1';
  const shellWidth = Number(params.get('shell')) > 0 ? Number(params.get('shell')) : undefined;
  const exportTarget = parseSize(params.get('target'));
  const chip = parseSize(params.get('chip'));
  const aspectRatios = useMemo(
    () => (chip ? [aspectOption(chip.width, chip.height)] : []),
    [chip?.width, chip?.height], // eslint-disable-line react-hooks/exhaustive-deps -- keyed by value
  );
  // `source=2400` generates a 2400x2400 grid image, `source=2282x832` a wordmark-
  // shaped one; without it the demo's own sample auto-loads, which is what the
  // pre-existing suite expects.
  const sourceParam = params.get('source');
  const src = useMemo(() => {
    const rect = parseSize(sourceParam);
    if (rect) {
      return gridImageDataUrl(rect.width, rect.height);
    }
    const square = Number(sourceParam);
    return Number.isFinite(square) && square > 0 ? gridImageDataUrl(square, square) : null;
  }, [sourceParam]);
  // `format=jpeg` puts that format first, which is what the commit action uses.
  const formatParam = params.get('format') as AspExportFormat | null;
  const exportFormats = useMemo<readonly AspExportFormat[]>(
    () =>
      formatParam && ALL_FORMATS.includes(formatParam)
        ? [formatParam, ...ALL_FORMATS.filter((f) => f !== formatParam)]
        : ALL_FORMATS,
    [formatParam],
  );

  const [loaded, setLoaded] = useState(0);
  const [savedBytes, setSavedBytes] = useState<number | null>(null);
  const [savedType, setSavedType] = useState('');
  const [exportedInfo, setExportedInfo] = useState('-');
  const [canceled, setCanceled] = useState(0);
  const [lastError, setLastError] = useState('');
  const [dialogResult, setDialogResult] = useState('');
  const [savedSize, setSavedSize] = useState('-');
  const [savedSharpness, setSavedSharpness] = useState('-');
  const [savedCorner, setSavedCorner] = useState('-');
  const [exportedSize, setExportedSize] = useState('-');
  const [exportedSharpness, setExportedSharpness] = useState('-');
  const [downloads, setDownloads] = useState(0);
  const [objectUrls, setObjectUrls] = useState(0);

  // Count clicks on download anchors (capture phase, so the editor's synthetic
  // click is seen) and object URLs created — the two things a "writes no file"
  // commit must never do.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest('a[download]')) {
        setDownloads((n) => n + 1);
      }
    };
    document.addEventListener('click', onClick, true);
    const native = URL.createObjectURL;
    URL.createObjectURL = (object: Blob | MediaSource): string => {
      setObjectUrls((n) => n + 1);
      return native.call(URL, object);
    };
    return () => {
      document.removeEventListener('click', onClick, true);
      URL.createObjectURL = native;
    };
  }, []);

  const onSaved = useCallback((blob: Blob) => {
    setSavedBytes(blob.size);
    setSavedType(blob.type);
    void describeBlob(blob).then((facts) => {
      setSavedSize(facts.size);
      setSavedSharpness(facts.sharpness);
      setSavedCorner(facts.corner);
    });
  }, []);
  const onExported = useCallback((blob: Blob) => {
    setExportedInfo(`${blob.type}:${blob.size}`);
    void describeBlob(blob).then((facts) => {
      setExportedSize(facts.size);
      setExportedSharpness(facts.sharpness);
    });
  }, []);
  const onImageLoaded = useCallback(() => setLoaded((n) => n + 1), []);
  const onCanceled = useCallback(() => setCanceled((n) => n + 1), []);
  const onError = useCallback((e: AspEditorError) => setLastError(e.code), []);

  /** Open the packaged modal with the same configuration as the inline editor. */
  const openDialog = async (): Promise<void> => {
    const config: OpenImageEditorConfig = {
      src,
      // The launcher opens the profile-photo dialog; in dialog-only pages the
      // mode/chrome params configure the modal instead (the contract suite).
      mode: dialogOnly ? mode : 'basic',
      chrome: dialogOnly ? chrome : null,
      tools,
      heading: 'Update profile photo',
      themeMode,
      aspectPresets: dialogOnly ? aspectPresets : ['1:1', '4:3', 'free'],
      initialAspect: initialAspect ?? undefined,
      aspectRatios,
      cropFrame,
      fitMode,
      exportBackground,
      exportTarget,
      exportFormats,
      commitLabel,
      showDownload,
    };
    const blob = await openImageEditorDialog(config);
    setDialogResult(blob ? `blob:${blob.size}` : 'null');
    if (blob) {
      onSaved(blob);
    } else {
      onCanceled();
    }
  };

  return (
    // Full-bleed overlay: escapes the docs shell's max-width/sidebar so the
    // editor gets a realistic desktop width (no wrapped topbar) for the tests.
    <div
      data-testid="e2e-harness"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        overflow: 'auto',
        padding: 16,
        background: themeMode === 'dark' ? '#0e1116' : '#f6f7f9',
      }}
    >
      {!dialogOnly && (
        <div style={{ height: 640, width: shellWidth, maxWidth: '100%' }}>
          <ImageEditor
            src={src}
            mode={mode}
            chrome={chrome}
            tools={tools}
            themeMode={themeMode}
            baseColor={themeMode === 'dark' ? '#10151d' : '#f4f6f9'}
            accentColor="#1f6feb"
            aspectPresets={aspectPresets}
            initialAspect={initialAspect}
            aspectRatios={aspectRatios}
            cropFrame={cropFrame}
            fitMode={fitMode}
            exportBackground={exportBackground}
            exportTarget={exportTarget}
            exportFormats={exportFormats}
            commitLabel={commitLabel}
            showDownload={showDownload}
            onSaved={onSaved}
            onExported={onExported}
            onImageLoaded={onImageLoaded}
            onCanceled={onCanceled}
            onError={onError}
          />
        </div>
      )}
      <dl style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <dt>loaded</dt>
        <dd data-testid="stat-loaded">{loaded}</dd>
        <dt>saved</dt>
        <dd data-testid="stat-saved">{savedBytes === null ? '-' : `${savedType}:${savedBytes}`}</dd>
        <dt>saved-size</dt>
        <dd data-testid="stat-saved-size">{savedSize}</dd>
        <dt>saved-sharpness</dt>
        <dd data-testid="stat-saved-sharpness">{savedSharpness}</dd>
        <dt>saved-corner</dt>
        <dd data-testid="stat-saved-corner">{savedCorner}</dd>
        <dt>exported</dt>
        <dd data-testid="stat-exported">{exportedInfo}</dd>
        <dt>exported-size</dt>
        <dd data-testid="stat-exported-size">{exportedSize}</dd>
        <dt>exported-sharpness</dt>
        <dd data-testid="stat-exported-sharpness">{exportedSharpness}</dd>
        <dt>downloads</dt>
        <dd data-testid="stat-downloads">{downloads}</dd>
        <dt>object-urls</dt>
        <dd data-testid="stat-object-urls">{objectUrls}</dd>
        <dt>canceled</dt>
        <dd data-testid="stat-canceled">{canceled}</dd>
        <dt>error</dt>
        <dd data-testid="stat-error">{lastError || '-'}</dd>
        <dt>dialog</dt>
        <dd data-testid="stat-dialog">{dialogResult || '-'}</dd>
      </dl>
      <button type="button" data-testid="open-dialog" onClick={() => void openDialog()}>
        Open editor dialog
      </button>
    </div>
  );
}
