import { useEffect, useState, type ReactElement } from 'react';
import { ImageEditor } from '@ascentsparksoftware/react-image-editor';

import { DocExample, type ExampleSource } from '../../shared/DocExample';
import { DocPage, type PageSection } from '../../shared/DocPage';

const SECTIONS: PageSection[] = [
  { id: 'formats', label: 'Formats & quality' },
  { id: 'commit', label: 'Commit vs. download' },
  { id: 'background', label: 'Letterbox & background' },
  { id: 'resolution', label: 'Export resolution' },
  { id: 'svg', label: 'SVG fonts' },
  { id: 'pdf', label: 'PDF' },
  { id: 'json', label: 'JSON & exact-pixel' },
];

const COMMIT_SOURCES: ExampleSource[] = [
  {
    label: 'TSX',
    lang: 'tsx',
    code: `<ImageEditor
  mode="advanced"
  commitLabel="Use this image"
  showDownload={false}
  onSaved={onCommitted}
  onExported={onDownloaded}
/>`,
  },
  {
    label: 'TS',
    lang: 'ts',
    code: `const onCommitted = (blob: Blob): void => {
  // the commit button: the result, and nothing written to disk
  upload(blob);
};
const onDownloaded = (blob: Blob): void => {
  // Export → Download: a file was written; onSaved did NOT fire
};`,
  },
];

const BACKGROUND_SOURCES: ExampleSource[] = [
  {
    label: 'TSX',
    lang: 'tsx',
    code: `<ImageEditor
  mode="basic"
  src={logoFile}
  initialAspect="1:1"
  fitMode="contain"
  exportBackground="#ffffff"
  exportFormats={['png']}
  commitLabel="Use this logo"
  onSaved={onLogo}
/>`,
  },
  {
    label: 'Dialog',
    lang: 'ts',
    code: `const blob = await openImageEditorDialog({
  src: logoFile,
  heading: 'Place the logo',
  initialAspect: '1:1',
  fitMode: 'contain',        // zoom floor = whole-image fit (default 'cover' is unchanged)
  exportBackground: '#ffffff', // under the letterbox; omit for a transparent PNG
  commitLabel: 'Use this logo',
});`,
  },
];

const RESOLUTION_SOURCES: ExampleSource[] = [
  {
    label: 'TSX',
    lang: 'tsx',
    code: `import { aspectOption } from '@ascentsparksoftware/react-image-editor';

// An exact pixel size for every crop…
<ImageEditor exportTarget={{ width: 1000, height: 1000 }} />

// …or let the selected aspect chip decide — each option carries real dimensions.
<ImageEditor
  aspectRatios={[aspectOption(1200, 630, 'Social'), aspectOption(1000, 1000, 'Avatar')]}
/>`,
  },
];

const FORMAT_SOURCES: ExampleSource[] = [
  {
    label: 'TSX',
    lang: 'tsx',
    code: `<ImageEditor
  exportFormats={['png', 'jpeg', 'webp', 'svg', 'pdf', 'json']}
  exportQuality={90}
  onExported={onExported}
/>`,
  },
  {
    label: 'TS',
    lang: 'ts',
    code: `const onExported = (blob: Blob): void => {
  // download it, upload it, or preview it
  console.log(blob.type, blob.size);
};`,
  },
];

const SVG_SOURCES: ExampleSource[] = [
  { label: 'TSX', lang: 'tsx', code: `<ImageEditor exportFormats={['png', 'svg']} />` },
];

const PDF_SOURCES: ExampleSource[] = [
  { label: 'TSX', lang: 'tsx', code: `<ImageEditor exportFormats={['png', 'pdf']} />` },
];

const JSON_SOURCES: ExampleSource[] = [
  { label: 'TSX', lang: 'tsx', code: `<ImageEditor exportFormats={['png', 'json']} />` },
];

export default function ExportPage(): ReactElement {
  const [result, setResult] = useState('');
  const [logoResult, setLogoResult] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const onExported = (blob: Blob): void => {
    setResult(`exported ${blob.type} — ${blob.size} bytes`);
  };

  const onLogo = (blob: Blob): void => {
    setLogoPreview(URL.createObjectURL(blob));
    setLogoResult(`committed ${blob.type} — ${blob.size} bytes (square, white letterbox)`);
  };

  // Release the previous preview's object URL whenever it is replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  return (
    <DocPage
      heading="Export"
      lead="Choose which formats the Export menu offers, and the editor produces the corresponding Blob. PNG, JPEG, WEBP, a font-embedded SVG, a PDF, or a re-editable JSON scene."
      sections={SECTIONS}
    >
      <DocExample
        anchor="formats"
        title="Formats & quality"
        description="exportFormats lists the offered formats; exportQuality (10–100) sets raster quality. Export → Download writes a file and reports it via onExported; the commit button hands the Blob to onSaved and writes nothing."
        sources={FORMAT_SOURCES}
      >
        <ImageEditor
          mode="advanced"
          exportFormats={['png', 'jpeg', 'webp', 'svg', 'pdf', 'json']}
          exportQuality={90}
          height="500px"
          onExported={onExported}
        />
        {result && <p className="note">{result}</p>}
      </DocExample>

      <DocExample
        anchor="commit"
        title="Commit vs. download"
        description="Two callbacks for two intents. onSaved means the user committed — the commit button in every chrome fires it with the Blob and no file is written. onExported means a file was written from the Export menu. A download never fires onSaved, so a host collecting the result is never also left with a copy in the user's Downloads folder."
        sources={COMMIT_SOURCES}
      >
        <p className="prose">
          Relabel the commit button with <code>commitLabel</code> ("Use this logo"), hide the
          download with <code>showDownload={'{false}'}</code>, or hide the commit in a workspace
          with <code>showCommit={'{false}'}</code>. The dialog chrome always has a commit button.
        </p>
      </DocExample>

      <DocExample
        anchor="background"
        title="Letterboxed crops & export background"
        description="A contain-fit crop (fitMode='contain') lets an image of any aspect zoom OUT to fit the frame — a wide wordmark in a square slot. The area it leaves uncovered is filled with exportBackground at export; without one, PNG/WebP stay transparent and JPEG is filled white, never black."
        sources={BACKGROUND_SOURCES}
      >
        <ImageEditor
          mode="basic"
          src="asc-logo-full.svg"
          heading="Place the logo"
          aspectPresets={['1:1', '16:9']}
          initialAspect="1:1"
          fitMode="contain"
          exportBackground="#ffffff"
          exportFormats={['png']}
          commitLabel="Use this logo"
          onSaved={onLogo}
        />
        {logoPreview && (
          <p className="note">
            <img className="thumb" src={logoPreview} alt="Committed logo" /> {logoResult}
          </p>
        )}
      </DocExample>

      <DocExample
        anchor="resolution"
        title="Export resolution"
        description="A cropped export carries the source image's real pixels, never the on-screen size of the crop frame. Set exportTarget for an exact size, or give an aspect option real dimensions so the selected chip decides. Either way the export is capped at the source's own resolution — the editor never upscales."
        sources={RESOLUTION_SOURCES}
      >
        <p className="prose">
          Without a target, a crop exports at full source fidelity. With one, it is exactly that
          size unless the photo does not hold that many pixels.
        </p>
      </DocExample>

      <DocExample
        anchor="svg"
        title="SVG with embedded fonts"
        description="SVG export inlines the web fonts used by text as base64 @font-face rules, so the file renders the true typeface in any viewer — self-contained, with text kept as real, selectable text."
        sources={SVG_SOURCES}
      >
        <p className="prose">
          Add <code>'svg'</code> to <code>exportFormats</code> and export — the downloaded{' '}
          <code>.svg</code> carries the font data, no network needed to render it correctly.
        </p>
      </DocExample>

      <DocExample
        anchor="pdf"
        title="PDF"
        description="PDF export lazily loads jsPDF and produces a single-page document sized to the artboard (or crop region) — handy for printable proofs."
        sources={PDF_SOURCES}
      />

      <DocExample
        anchor="json"
        title="JSON scene & exact-pixel export"
        description="The json format serializes the full re-editable scene. With an artboard or crop region set, raster/PDF export render at exactly that pixel size — the same machinery the crop tool uses."
        sources={JSON_SOURCES}
      />
    </DocPage>
  );
}
