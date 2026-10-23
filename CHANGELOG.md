# Changelog

All notable changes to `@ascentsparksoftware/react-image-editor`.

## 1.2.0 — 2026-10-23

The React port of the Angular 22.2.0 release, driven by the Phlebio operator-panel
handoff: a logo of any size and aspect has to be zoomed out, panned and cropped
into a fixed slot, and the host needs the result as a Blob — never a file in
Downloads. The five behavioural contracts are shared with the Angular sibling and
verified by the same-named Playwright tests (`e2e/handoff-contracts.spec.ts`).

> 1.1.0 (export resolution) was tagged but never reached npm — the Trusted
> Publisher was not configured. 1.2.0 is the first release carrying both.

### Changed — `onSaved` no longer fires from a download (**behavioural change**)

`onSaved` means "the user committed, here is the result"; `onExported` means "a
file was written". Export → Download used to call **both**. It now calls
`onExported` only. A host that wants both passes both.

### Added — a commit action in every chrome

The workspace and viewer top bars gain an accent **Apply** button next to Export. It
exports in the selected format, hands the Blob to `onSaved` and writes nothing —
the same path the dialog's **Save** always took.

- `commitLabel` — the button's text; `null` reads "Save" in the dialog, "Apply" elsewhere.
- `showDownload={false}` — removes "Download image" from the Export menu (the button
  then reads **Format** and only offers format / quality).
- `showCommit={false}` — hides the commit button in the workspace and viewer.
- Export is now a secondary (outlined) button so the top bar has one primary action.

### Added — `chrome`: layout independent of the tool set

`chrome: 'dialog' | 'workspace' | 'viewer' | null` picks the chrome on its own;
`null` keeps today's mapping (`basic → dialog`, `viewer → viewer`, else
`workspace`). `defaultChromeFor(mode)` is exported. Host sizing follows the chrome.

### Fixed — `initialAspect` drew no crop frame outside the dialog, and the chip lied

The workspace now opens in the Crop tool with its movable frame at that aspect.
Where nothing can enforce the aspect (no `crop` tool, the viewer) the chip stays
inactive.

### Added — `fitMode="contain"` for the fixed-frame crop (the headline fix)

The dialog crop kept the frame 100 % covered, so a wide wordmark in a square slot
could only ever be centre-cropped. `contain` lowers the zoom floor to the
whole-image fit (the image starts there, centred), keeps a looser pan clamp (a
letterboxed image may float inside the frame but never leave it) and composites
the uncovered area at export. **`cover` stays the default.**

### Added — `exportBackground`, and JPEG never encodes transparency as black

Unpainted export pixels are filled with the Background tool's colour when set;
otherwise with `exportBackground`; otherwise PNG / WebP stay transparent and JPEG
(and the PDF raster) are filled white. `EditorEngine.setExportBackground()`.

### Fixed — one zoom floor per interaction

`EditorEngine.zoomRange` is the single source for the slider's `min` / `max` and
the clamp (image zoom while the fixed frame is active, viewport zoom otherwise),
so the advertised minimum is always reachable. `state.zoomRange` carries it.

### Added — the dialog forwards every prop, and traps focus

`openImageEditorDialog()` takes every editor prop (`mode` defaults to `'basic'`),
plus `width` / `maxWidth` / `height` for the card. The overlay is `aria-label`led,
Tab cycles inside it, and focus returns to the opener on close.
`resolveDialogProps()` / `DIALOG_FORWARDED_PROPS` back a test that fails when a
new prop is not forwarded.

### Internal

Controller: `syncExportDefaults` split into `syncExportQuality` /
`syncExportFormats` (a new format list resets the selection to its first entry);
`layout()` is public; props gain `chrome`, `fitMode`, `exportBackground`,
`resolvedToolKeys`. CI now publishes the runner's visual baselines as an artifact
every run so they can be refreshed after an intentional UI change.

## 1.1.0 — 2026-08-04

### Fixed — cropped exports were silently downsampled to screen resolution

**Every consumer that cropped a photo got a screen-sized export.** The crop region
lives in scene coordinates, and the base image is scaled down to fit the canvas on
screen, so a committed crop rasterised at whatever size the host's dialog happened
to be. A 2400×2400 photo cropped 1:1 in a 640px modal exported at ~230×230. Nothing
in the UI or the API said the resolution had been thrown away, and the loss is
permanent once the blob is stored.

Cropped exports now carry the source image's real pixels. If you crop, expect
larger blobs than before — that is the fix. Use `exportTarget` (below) if you want
a specific, smaller size.

Found in the Angular sibling of this engine (reported by the Hiero CMS team) and
present here identically.

### Fixed — exports were wrong while the canvas was zoomed or panned

Fabric treats the crop rectangle handed to `toDataURL()` as viewport-space, so a
zoomed or panned canvas sampled the wrong area at the wrong scale. The engine now
renders the export at an identity viewport, as the redaction sampler already did.

### Added — `exportTarget`, and real dimensions on aspect options

```tsx
// An exact pixel size for every crop in this editor
<ImageEditor exportTarget={{ width: 1000, height: 1000 }} />

// …or per aspect option — the selected chip's dimensions win while it is selected
<ImageEditor aspectRatios={[aspectOption(1200, 630), aspectOption(1000, 1000)]} />
```

- `AspExportTarget` — new exported type.
- `AspAspectOption` gains optional `width`/`height`; `aspectOption(w, h, label)` now
  keeps them instead of collapsing to `{ label, ratio }`. Additive; hand-built
  `{ label, ratio }` options keep working.
- `EditorEngine.setExportTarget()` / `getExportTarget()` for headless hosts.
- Exports are capped at the source's real resolution (never upscaled) and at a
  4096×4096 bitmap so low-end devices can allocate them.

### Added — custom aspect chips in `basic` mode

`aspectRatios` was documented as "shown after the presets" but the basic (profile
photo) layout only rendered the built-in presets, so a host could not offer a
CMS-sized target in the very mode the export bug hit hardest.

### Changed

- `outputSize()` now reports the delivered export size rather than the crop region
  in scene units, so the PDF page size matches the image it contains.
- The Playwright suite asserts export resolution on decoded blobs, via a `/e2e`
  harness that can generate a source image of a given size.
- Removed a dead private method that kept `tsc --noEmit` from passing.

### Known issue (unchanged)

`svg` export still serialises the whole canvas and ignores the crop region. Tracked
separately.
