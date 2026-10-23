<div align="center">

<a href="https://github.com/ascentspark/react-image-editor"><img src="image-editor-logo.png" alt="React Image Editor" height="120"></a>

# @ascentsparksoftware/react-image-editor

A standalone, themeable **React 19** image editor — crop, filter, draw, redact, layers and
**in-browser AI background removal** — built from scratch on **Fabric.js v7**.

by&nbsp;<a href="https://ascentspark.com" target="_blank" rel="noopener"><img src="https://cdn.ascentspark.com/assets/images/asc-logo-full.svg" alt="Ascentspark" height="22" valign="middle"></a>

[![npm version](https://img.shields.io/npm/v/@ascentsparksoftware/react-image-editor.svg?color=087ea4)](https://www.npmjs.com/package/@ascentsparksoftware/react-image-editor)
[![downloads](https://img.shields.io/npm/dm/@ascentsparksoftware/react-image-editor.svg)](https://www.npmjs.com/package/@ascentsparksoftware/react-image-editor)
[![React 19](https://img.shields.io/badge/React-19-087ea4.svg)](https://react.dev)
[![license MIT](https://img.shields.io/github/license/ascentspark/react-image-editor?color=3b82f6)](https://github.com/ascentspark/react-image-editor/blob/main/LICENSE)

**[✨ Features](#features)** &nbsp;·&nbsp;
**[🎨 Theming](#theming)** &nbsp;·&nbsp;
**[🧩 API](#api)** &nbsp;·&nbsp;
**[▲ Next.js](#nextjs--ssr)** &nbsp;·&nbsp;
**[🔒 Security](#security)**

</div>

---

A full image editor you drop into a React app as a single component: crop, rotate, filters, draw,
text, shapes, freehand redaction, layers, and export to PNG / JPEG / WEBP / SVG / PDF / JSON. Put
`<ImageEditor>` on the page, pass your image and options as props, and read results back as a
`Blob`. It targets **React 19**, is StrictMode-safe, **React Compiler**-safe, and works under a
nonce CSP without `unsafe-eval`.

It is the React sibling of
[@ascentsparksoftware/angular-image-editor](https://github.com/ascentspark/angular-image-editor)
with **exact feature parity** — both wrap the same framework-agnostic Fabric.js v7 engine.

It is built from scratch on **[Fabric.js v7](https://fabricjs.com/) (MIT)** — a free, open-source
alternative to commercial editors such as Syncfusion, Pintura and Filerobot. No license keys, no
telemetry, no per-seat pricing. Fabric is the only heavyweight runtime dependency and it is
lazy-loaded, so it never weighs down your initial bundle.

> ## 🆓 In-browser AI background removal, free
>
> One-click background removal is a paid feature in most commercial editors. Here it runs **on-device
> for free** (MIT): the **Remove background** and **Cut out subject** tools run an ONNX model
> entirely in the browser — no image ever leaves the page, no API key, no per-call cost.
> The heavy model packages live **in your app, not in this library** — you opt in by installing them
> and passing a loader prop (`backgroundRemovalLoader={() => import('@imgly/background-removal')}`).
> If you don't, the rest of the editor is unaffected and the AI tools simply don't appear. There's
> also a dependency-free **Magic wand** (flood-fill erase) for clearing flat color regions by click.
> See [Optional heavy features](#optional-heavy-features-ai--heic).

## Features

- **Four modes** — `viewer` · `basic` · `advanced` · `full`, each with sensible default chrome and
  tools.
- **Editing** — crop (preset + custom CMS aspect ratios), rotate / straighten, flip, zoom / **pan**,
  fine-tune adjustments (brightness / contrast / saturation / vibrance / hue / blur / …), filter
  looks (B&W / sepia / invert / sharpen / tint), draw / pen, highlighter, **eraser**, shapes, arrows,
  **text with web fonts**, freehand **redaction** (solid / blur / pixelate), frames, **background
  color / gradient**, and undo / redo history.
- **Smart & AI tools** — **Magic wand** flood-fill erase (no dependencies), plus in-browser AI
  **Remove background** and **Cut out subject**.
- **Layers panel** (persistent companion) — drag-to-reorder z-order, per-layer **lock**, show / hide,
  **opacity**, inline **rename**, plus the object-ops on the selection: **group / ungroup**,
  **align**, **duplicate**, delete, and multi-select (shift / ⌘ / ctrl). Available regardless of the
  active tool.
- **Multiple images** — replace the canvas image or **add an image as its own layer** to composite.
- **Precision** — optional **rulers** with draggable, snapping **guides**, **snapping + alignment
  guides** (magnet toggle), and an **artboard / output size** (presets + custom W×H) for exact-pixel
  raster and PDF export.
- **Export** — PNG / JPEG / WEBP / SVG / **PDF** (lazy `jspdf`) / JSON, plus engine
  `exportScene` / `loadScene` for save-and-reload templates.
- **Usage-based UI** — a grouped, Photoshop-style **flyout toolbar** (tools double as modes), a tool
  **Options** panel that adapts to the selection, and top-bar **actions** (undo / redo, zoom, fit,
  history, image, export).
- **Color anywhere** — preset swatches **plus a custom color picker** for fill, draw, text, shapes,
  frame and background.
- **Web fonts** — a curated Google-font list plus an "add any Google font" search.
- **Correct compositing** — the highlighter is genuinely translucent; **redact** bakes the
  *composited* pixels under the region, concealing everything beneath, not just the base image.
- **Responsive** — the editor adapts to **its own width** via CSS container queries (single column on
  narrow hosts), so it works in a sidebar, a modal or full-page without horizontal overflow.
- **3-prop runtime theming** — `baseColor` + `accentColor` + `themeMode` derive the whole palette as
  scoped `--asp-*` CSS variables, with guaranteed WCAG **AA** contrast — re-skin live, no remount.
- **Robust & accessible** — oversized imports auto-downscale; recoverable failures surface via an
  `onError` callback instead of throwing; keyboard-operable, `:focus-visible` rings,
  `prefers-reduced-motion`. No `any` anywhere.

## Install

```bash
npm install @ascentsparksoftware/react-image-editor fabric
```

- **Peer dependencies:** `react` and `react-dom` (`^19`).
- **Runtime dependency:** `fabric` `^7.4.0` (declared by the package; install it alongside). Fabric
  is lazy-loaded on demand, so it never weighs down your initial bundle.
- **No WASM/ML in the default install.** The core editor's import graph contains only plain-JS
  dynamic imports (`fabric`, `jspdf`), so it loads cleanly in any bundler/dev server out of the box —
  no `optimizeDeps` config, no cache dance. The AI / HEIC features are **opt-in** and live in your
  app (see [Optional heavy features](#optional-heavy-features-ai--heic)). Without them, **Remove
  background**, **Cut out subject**, and HEIC import are simply unavailable; everything else works.

## Quick start

```tsx
import { ImageEditor } from '@ascentsparksoftware/react-image-editor';
import '@ascentsparksoftware/react-image-editor/styles.css';

export function PhotoScreen() {
  return (
    <div style={{ height: 640 }}>
      <ImageEditor
        src="https://example.com/photo.jpg"
        mode="advanced"
        baseColor="#f4f6f9"
        accentColor="#02375e"
        themeMode="light"
        onSaved={(blob) => {
          /* upload or preview the edited image */
        }}
      />
    </div>
  );
}
```

Import the stylesheet once (root layout / entry). Give the host a size — the editor fills its
container. Either set the `width` / `height` props, or size the wrapper in CSS:

```tsx
{/* props accept px numbers, %, vh, or any CSS length / calc() */}
<ImageEditor src={url} width="100%" height="70vh" />
```

## Next.js / SSR

The editor is client-only but **import-safe on the server** (nothing touches `window` at module
scope, and every component ships `"use client"`). In Next.js, load it lazily so the ~1.3 MB Fabric
chunk stays out of your initial bundle:

```tsx
'use client';
import dynamic from 'next/dynamic';

const ImageEditor = dynamic(
  () => import('@ascentsparksoftware/react-image-editor').then((m) => m.ImageEditor),
  { ssr: false },
);
```

Works under React StrictMode (double-mount safe), with the React Compiler enabled, and under a
nonce-based CSP without `unsafe-eval`.

## Modes

`mode` sets the chrome and a sensible default tool set:

| mode | chrome | default tools |
| --- | --- | --- |
| `viewer` | minimal: zoom + export | none (read-only) |
| `basic` | a compact card (also openable as a modal) | crop, rotate, flip, zoom |
| `advanced` *(default)* | full 3-column workspace | curated everyday set |
| `full` | full workspace | every tool + every filter |

```tsx
<ImageEditor mode="viewer" src={url} />
<ImageEditor mode="full" src={url} />
```

## Tool configuration

Resolution order, from easiest to most precise:

1. **`mode`** sets the default tool set.
2. **`tools`** (if provided) is an explicit allowlist that *replaces* the mode default, in the order
   you give.
3. **`disabledTools`** is then subtracted from the result.

```tsx
{/* advanced, but without filters or stickers */}
<ImageEditor mode="advanced" disabledTools={['filters', 'sticker']} />

{/* a bespoke rail (order preserved) */}
<ImageEditor tools={['crop', 'rotate', 'text']} />
```

Filters follow the same idea via `filters`: an explicit `AspFilter[]`, the literal `'all'` (every
Fabric filter), or `null` for the mode default.

```tsx
<ImageEditor mode="advanced" filters={['brightness', 'contrast', 'grayscale']} />
<ImageEditor mode="advanced" filters="all" />
```

## Smart & AI tools

| Tool | What it does | Dependency |
| --- | --- | --- |
| **Magic wand** (`magicwand`) | Click a flat color region to erase it to transparency; tolerance slider. | none |
| **Remove background** (`removebg`) | In-browser AI that replaces the base image's background with transparency. | optional |
| **Cut out subject** (`selectsubject`) | In-browser AI that extracts the subject onto its own layer. | optional |

The magic wand has no dependencies and works everywhere. The two **AI** tools run
`@imgly/background-removal` (an ONNX model, on-device — no image data leaves the browser); HEIC/HEIF
import uses `heic2any`. Both are opt-in — see below.

### Optional heavy features (AI + HEIC)

`@imgly/background-removal` (with `onnxruntime-web`) and `heic2any` ship **WASM, web workers and deep
CJS graphs** that dev-server bundlers cannot pre-bundle reliably. So the core editor **does not
import them**. Instead you opt in by installing the package you want and passing a loader prop. The
heavy `import()` then lives in **your** bundle, where you own the config:

```bash
# only if you want these features
npm install @imgly/background-removal onnxruntime-web   # AI background removal / cut-out
npm install heic2any                                    # HEIC/HEIF import
```

```tsx
<ImageEditor
  src={url}
  backgroundRemovalLoader={() => import('@imgly/background-removal')}
  heicDecoderLoader={() => import('heic2any')}
/>
```

- Pass **only what you need** — pass just `heicDecoderLoader` and the AI tools stay hidden, or
  neither and you get the lean default editor.
- When a loader is absent, the matching tool is **removed from the rail** (and HEIC import throws a
  clear, catchable error) — nothing breaks.
- A progress bar and busy cursor show while the model loads on first AI use.

## Theming

Three props derive the **entire** UI palette at runtime — set them and the editor blends into your
brand in light or dark, with WCAG **AA** text contrast guaranteed (AAA for primary text), no extra
config:

- **`baseColor`** — neutral anchor; surfaces, ink and borders are tinted toward its hue.
- **`accentColor`** — interactive accent; buttons, active tool, focus ring, selection.
- **`themeMode`** — `'light'` or `'dark'`.

The derived values are applied as scoped CSS custom properties on the editor root, so they never
clash with your page — and changing the props re-skins the editor live, without a remount. For fine
control you can override any individual variable:

```css
.asp-image-editor {
  --asp-radius-md: 12px;
  --asp-accent: #ff5a5f;
}
```

<details><summary>All <code>--asp-*</code> tokens</summary>

| token | role |
| --- | --- |
| `--asp-bg` | app/backdrop base |
| `--asp-surface` | card / panel surface |
| `--asp-surface-2` | inset surface (inputs) |
| `--asp-surface-sunk` | sunk wells / hover, checkerboard cell |
| `--asp-ink` | primary text |
| `--asp-ink-700` | secondary text / icons |
| `--asp-ink-muted` | muted labels |
| `--asp-ink-faint` | disabled / faint |
| `--asp-line` | hairline borders |
| `--asp-line-strong` | control borders |
| `--asp-accent` | accent fill |
| `--asp-accent-ink` | on-accent text (AA) |
| `--asp-accent-hover` | accent hover |
| `--asp-accent-soft` | active-tool background |
| `--asp-accent-soft-ink` | text on soft accent (AA) |
| `--asp-ring` | focus ring |
| `--asp-scrim` | modal scrim |
| `--asp-success` / `--asp-warning` / `--asp-error` | status colors |
| `--asp-radius-sm` / `-md` / `-lg` / `-pill` | radii |
| `--asp-ctl-h` / `--asp-ctl-h-sm` | control heights |
| `--asp-font-mono` | numeric readouts |

You can also call the pure helper directly: `deriveTheme(baseColor, accentColor, mode)` returns the
full token map, and `applyTheme(element, tokens)` sets them.
</details>

## Modal dialog

For avatar / quick-edit flows, open the editor as a modal and await the result:

```tsx
import { openImageEditorDialog } from '@ascentsparksoftware/react-image-editor';

async function editAvatar(src: string): Promise<void> {
  const blob = await openImageEditorDialog({
    src,
    heading: 'Update profile photo',
    aspectPresets: ['1:1', '4:3', 'free'],
    initialAspect: '1:1', // open already square & centered
  });
  if (blob) {
    /* user saved — upload `blob` */
  } // else: user cancelled (close, scrim click, or Escape)
}
```

**Every prop is accepted on the config.** `mode` defaults to `'basic'`; pass `mode: 'advanced'`
(or any `chrome`) plus `width` / `height` to host the full workspace in the modal. The overlay traps
Tab focus and returns focus to the element that opened it.

```tsx
const blob = await openImageEditorDialog({
  src,
  mode: 'advanced',
  tools: ['crop', 'rotate', 'adjust'],
  commitLabel: 'Use this image',
  showDownload: false,
  width: 1100,
  height: '80vh',
});
```

**Starting crop.** Pass `initialAspect` (e.g. `'1:1'`) — on `openImageEditorDialog()` or as the
`initialAspect` prop on `<ImageEditor>` — to open already constrained to that ratio. If you omit it
and supply a single non-`free` preset (e.g. `aspectPresets: ['1:1']`), that ratio is auto-selected;
otherwise the crop opens unconstrained (`free`). The frame is live in every chrome that can crop: the
dialog's fixed frame starts at once, the workspace opens in the Crop tool with its movable frame at
that aspect. Where nothing can enforce it (a tool set without `crop`) the chip stays inactive.

### Commit vs. download

Two callbacks for two intents, and they never overlap:

| Action | Where | Callback | Writes a file? |
|---|---|---|---|
| **Commit** — Save / Apply / your `commitLabel` | every chrome | `onSaved(blob)` | **No** |
| **Export → Download image** | workspace / viewer Export menu | `onExported(blob)` | Yes |

A download never fires `onSaved`, so a host collecting the result is never also left with a copy in
the user's Downloads folder. Hosts that only want the Blob pass `showDownload={false}` (the Export
menu then only offers Format / Quality); hosts that only want downloads can pass `showCommit={false}`
in the workspace and viewer. The dialog chrome always has a commit button.

```tsx
<ImageEditor mode="advanced" commitLabel="Use this image" showDownload={false} onSaved={upload} />
```

### Chrome vs. tools

`mode` picks a default tool set **and** a default chrome; `chrome` overrides the second half on its own.

| `chrome` | What renders | Crop model |
|---|---|---|
| `dialog` (default for `basic`) | compact card: heading, aspect chips, rotate/flip, zoom, Cancel / commit | **fixed frame** — the image pans and zooms underneath |
| `workspace` (default for `advanced` / `full`) | rail, options panel, layers, history | **movable frame** over the image |
| `viewer` (default for `viewer`) | zoom + Export + commit bar | — |

```tsx
{/* the basic tool set, but in the full workspace */}
<ImageEditor mode="basic" chrome="workspace" />
{/* the advanced tool set inside the compact dialog card */}
<ImageEditor mode="advanced" chrome="dialog" initialAspect="1:1" />
```

### Logo crop — `fitMode="contain"`

The fixed-frame (dialog) crop is an **avatar crop** by default: `fitMode="cover"` keeps the frame
fully covered, so the zoom floor is the cover scale and the result never has gaps. That is wrong for
a logo: a 2282×832 wordmark in a square slot can only ever be centre-cropped.

`fitMode="contain"` lowers the zoom floor to the **whole-image fit**, so an image of any aspect can be
zoomed out and placed inside the frame. The slider's `min` is that floor — exactly reachable. The area
the image leaves uncovered is filled at export with the **export background**:

- a background set with the Background tool, if any;
- else `exportBackground` (e.g. `'#ffffff'`);
- else PNG / WebP stay **transparent** and JPEG is filled **white** — never black.

```tsx
const logo = await openImageEditorDialog({
  src,
  heading: 'Place the logo',
  aspectPresets: ['1:1', '16:9'],
  initialAspect: '1:1',
  fitMode: 'contain',          // default 'cover' is unchanged for existing callers
  exportBackground: '#ffffff', // omit for a transparent PNG
  exportFormats: ['png'],
  commitLabel: 'Use this logo',
});
```

One zoom floor per interaction: while the fixed frame is active the slider zooms the **image** (100 %
= the image exactly fills the frame); otherwise it zooms the viewport (floor 25 %). The slider's
`min` / `max` always reflect which one it is driving (`state.zoomRange`).


### Export resolution

A cropped export carries the **source image's real pixels**, not the size the crop
happened to be on screen. Pick the size you want in one of three ways:

```tsx
// 1. An exact target for every crop in this editor.
<ImageEditor exportTarget={{ width: 1000, height: 1000 }} />

// 2. Per aspect option — the selected chip's own dimensions win.
<ImageEditor aspectRatios={[aspectOption(1200, 630, 'Social'), aspectOption(1000, 1000, 'Avatar')]} />

// 3. Nothing at all — the crop exports at full source fidelity.
```

The export is always capped at the source's real resolution (a 300px photo never
becomes a 1000px blur) and at a 4096×4096 bitmap so low-end devices can allocate it.

> **Upgrading from 1.0.x:** cropped exports used to come out at the on-screen size
> of the crop frame — a 2400×2400 photo cropped in a 640px dialog produced a ~230px
> image. They are now full resolution, so saved blobs get larger. Set `exportTarget`
> if you want a specific (smaller) size.


## API

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `src` | `string \| Blob \| null` | `null` (sample image) | Image to edit — URL, `Blob`/`File`, or data URL |
| `mode` | `'viewer' \| 'basic' \| 'advanced' \| 'full'` | `'advanced'` | Default tool set + default chrome |
| `chrome` | `'dialog' \| 'workspace' \| 'viewer' \| null` | mode default | Layout, independent of the tool set |
| `width` / `height` | `number \| string \| null` | fill container | px number, `%`, `vh`, any CSS length / `calc()` |
| `tools` | `AspTool[] \| null` | mode default | Explicit tool allowlist (order preserved) |
| `disabledTools` | `AspTool[]` | `[]` | Subtracted from the resolved set |
| `filters` | `AspFilter[] \| 'all' \| null` | mode default | Adjustments + looks offered |
| `aspectPresets` | `AspAspectPreset[]` | `['free','1:1','4:3','16:9']` | Crop preset chips |
| `initialAspect` | `AspAspectPreset \| null` | `null` | Open already cropped to this ratio |
| `aspectRatios` | `AspAspectOption[]` | `[]` | Custom CMS targets, e.g. `aspectOption(1200, 630)` |
| `fitMode` | `'cover' \| 'contain'` | `'cover'` | `contain` = zoom out to the whole-image fit (logo crop) |
| `exportFormats` | `AspExportFormat[]` | `['png','jpeg','webp']` | Offered formats (+ `'svg'`, `'pdf'`, `'json'`) |
| `exportQuality` | `number` | `90` | 10–100 |
| `exportTarget` | `AspExportTarget \| null` | `null` | Exact px size for a cropped export |
| `exportBackground` | `string \| null` | `null` | Fill under unpainted export pixels (JPEG falls back to white) |
| `baseColor` | `string` | `'#f4f6f9'` | Theme neutral anchor |
| `accentColor` | `string` | `'#1f6feb'` | Theme accent |
| `themeMode` | `'light' \| 'dark'` | `'light'` | Theme mode |
| `heading` | `string` | `'Edit image'` | Dialog-chrome title |
| `commitLabel` | `string \| null` | `'Save'` / `'Apply'` | Commit button text |
| `showCommit` | `boolean` | `true` | Commit button in the workspace / viewer |
| `showDownload` | `boolean` | `true` | "Download image" in the Export menu |
| `showHistory` | `boolean` | `true` | Show the history panel |
| `keyboardEnabled` | `boolean` | `true` | Editor keyboard shortcuts |
| `fonts` | `FontOption[]` | `DEFAULT_FONTS` | Text font choices |
| `backgroundRemovalLoader` | `AspBackgroundRemovalLoader \| null` | `null` | Opt-in AI background removal |
| `heicDecoderLoader` | `AspHeicDecoderLoader \| null` | `null` | Opt-in HEIC/HEIF import |
| `onSaved` | `(blob: Blob) => void` | — | The commit action (never a download) |
| `onCanceled` | `() => void` | — | Dialog Cancel / close |
| `onImageLoaded` | `() => void` | — | An image finished loading |
| `onExported` | `(blob: Blob) => void` | — | Export → Download wrote a file (does not fire `onSaved`) |
| `onError` | `(error: AspEditorError) => void` | — | Recoverable load/export/init error |

### Keyboard shortcuts

While the pointer is over the editor (and not typing in a field): **Ctrl/Cmd+Z** undo,
**Ctrl/Cmd+Shift+Z / Ctrl+Y** redo, **Delete/Backspace** remove selection, **Ctrl/Cmd+C / V / D**
copy / paste / duplicate, **Ctrl/Cmd+A** select all, **Esc** deselect (or cancel the basic modal),
**Space** (hold) to pan. Disable with `keyboardEnabled={false}`.

### Headless engine

For headless or advanced use, `EditorEngine` (the Fabric wrapper) and the pure helpers
(`resolveTools`, `resolveFilters`, `deriveTheme`, `applyTheme`, `EditHistory`, `DeltaHistory`) are
all exported. `EditorEngine` exposes scene save/load (`exportScene` / `loadScene`), layers, guides,
artboard sizing and the AI/magic operations directly.

## Accessibility

WCAG AA color contrast (derivation-guaranteed), keyboard-operable controls, `:focus-visible` rings,
`prefers-reduced-motion` honored. Run `axe` against the demo to verify in your own setup.

## Security

This library renders consumer-supplied images and SVGs onto an HTML canvas; SVGs are rasterized
through a sandboxed `<img>` element, so scripts inside an SVG do not execute. Still treat
user-uploaded files as untrusted: validate type and size at your upload boundary, and sanitize any
text you overlay from untrusted sources. Exported blobs and PDFs reflect exactly what was drawn. The
optional AI tools download a model at runtime but never send your image data anywhere. It contains
no `eval` / `new Function` paths and injects no inline styles, so it runs under a nonce CSP without
`unsafe-eval`. Full policy and private reporting:
[SECURITY.md](https://github.com/ascentspark/react-image-editor/blob/main/SECURITY.md).

## Versions

The package version is decoupled from framework majors: `1.x` targets `react@^19`. Within a line we
follow semver — patches are backward-compatible fixes, minors add backward-compatible features. A
future React major that needs a breaking peer bump gets a new package major.

## Documentation

A live playground and full docs for every tool, theming, and the complete API live in the demo app
(`apps/demo` — `npm run dev -w demo`).

## Local development

npm-workspaces monorepo — library in `packages/react-image-editor`, demo in `apps/demo`,
Playwright e2e in `e2e/`:

```bash
npm install
npm run dev -w demo   # serve the demo (http://localhost:5173)
npm run build         # build the library + demo
npm test              # unit tests (Vitest)
npm run lint
npm run e2e           # Playwright end-to-end + visual smoke
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Help keep it healthy

We genuinely try to keep this library current, bug-free and secure, and the best way to get there is
together. If something breaks, please
[open an issue](https://github.com/ascentspark/react-image-editor/issues) with a minimal
reproduction; if you can fix a bug or add something useful, pull requests are very welcome, big or
small. An open-source library stays dependable only when people use it, tell us what's broken, and
pitch in now and then — so thank you in advance for anything you send our way. 💛

## License

[MIT](./LICENSE), by [Ascentspark](https://ascentspark.com).
