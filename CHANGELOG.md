# Changelog

All notable changes to `@ascentsparksoftware/react-image-editor`.

## 1.3.0 — 2026-10-23

The React port of the Angular 22.3.0 release. Closes the two gaps found when
reviewing the 1.2.0 handoff work: the fixed-slot crop was still welded to the
dialog chrome, and a custom ratio could be a chip but not the opening frame. Both
are additive; defaults are unchanged. Contracts 6 and 7 in
`e2e/handoff-contracts.spec.ts` are shared by name with the Angular sibling.

### Added — `cropFrame`: the crop model is independent of the chrome

`chrome` (1.2.0) decoupled the layout from the tool set, but the crop model still
followed the chrome: the dialog got the fixed slot, everything else the movable
editing frame. So "advanced tool set **and** a fixed-slot `contain` crop" was not a
reachable combination.

`cropFrame: 'fixed' | 'movable' | null` picks it on its own. `null` (default) keeps
each chrome's default — `fixed` in the dialog, `movable` elsewhere — so nothing
changes for existing callers.

- A **fixed** frame is a slot, not a session: in the workspace it persists while
  other tools are used, the options panel shows the aspect chips only (no
  Apply / Cancel — *Free* removes the frame, the −/+ controls zoom the image inside
  it with the `fitMode` floor) and the commit button exports the slot.
- A **movable** frame in the dialog chrome is the editing crop: drag the frame,
  the slider zooms the viewport, Save commits the region.
- Flipping `cropFrame` at runtime swaps a live frame in place; no stale frame of
  the other kind is left on the canvas.
- `AspCropFrame`, `defaultCropFrameFor(chrome)` are exported; the dialog config
  forwards `cropFrame` like every other prop.

### Added — `initialAspect` accepts a custom ratio

`initialAspect` now takes `AspAspectPreset | AspAspectOption` (`AspInitialAspect`),
so `aspectOption(1200, 630, 'Social')` can be the opening frame — its chip is active
from the start and its pixel size is the export target from the start, not only
once the chip is clicked. The auto-pin rule widens to match: a **sole** constrained
chip offered without `free`, preset *or* custom, is the opening frame. `isAspectOption()`
is exported for hosts that branch on the union.

### Fixed

- Re-entering the Crop tool (or resetting the crop) after a custom chip was chosen
  reopened the frame at the last *preset* ratio instead of the custom one.
- The `basic` dialog opened with a stray **movable** crop frame (handles and all)
  at *Free*, because its initial tool is Crop and the session sync did not know
  the dialog's frame is fixed. With `cropFrame` resolved per chrome, *Free* in
  the dialog is the whole image — as in the Angular sibling. Visual baselines
  for `basic × light / dark` are refreshed accordingly.

### Compatibility

Additive. `cropFrame` defaults to the previous behaviour; `initialAspect` widens
its accepted type. Peer ranges unchanged.

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
