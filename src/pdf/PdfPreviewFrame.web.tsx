import { createElement, useMemo, type CSSProperties } from "react";

type PdfPreviewFrameProps = {
  url: string;
  title: string;
  html?: string;
  editable?: boolean;
};

const buildPreviewHtml = (html: string, editable?: boolean) => {
  const stylesAndScript = `
      ${
        editable
          ? `
      .pdf-interactive-block {
        cursor: pointer;
        transition: background 0.15s ease, outline 0.15s ease;
      }
      .pdf-interactive-block:hover {
        background: #eef6ff !important;
        outline: 2px dashed #2563eb !important;
        outline-offset: -2px;
      }
      .pdf-interactive-block:hover td, .pdf-interactive-block:hover th {
        background: #eef6ff !important;
      }
      `
          : ""
      }
      body {
        min-height: 100%;
        padding: 18px;
        background: #e9edf2;
      }
      .page {
        width: min(100%, 210mm);
        min-height: auto;
        margin: 0 auto;
        padding: 15mm 8mm 8mm;
        background: #fff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      }
      @media (max-width: 640px) {
        body { padding: 10px; }
        .page { padding: 8mm 4mm 5mm; }
      }
    </style>
    ${
      editable
        ? `
    <script>
      document.addEventListener('click', function(e) {
        var target = e.target ? e.target.closest('[data-block-key]') : null;
        if (target) {
          var blockKey = target.getAttribute('data-block-key');
          window.parent.postMessage({ type: 'GOATLETA_PDF_BLOCK_CLICK', blockKey: blockKey }, '*');
        } else {
          window.parent.postMessage({ type: 'GOATLETA_PDF_BACKGROUND_CLICK' }, '*');
        }
      }, true);
    </script>
    `
        : ""
    }`;

  return html.replace("</style>", stylesAndScript);
};

export function PdfPreviewFrame({ url, title, html, editable }: PdfPreviewFrameProps) {
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    border: 0,
    display: "block",
    background: "#ffffff",
  };
  const previewHtml = useMemo(() => (html ? buildPreviewHtml(html, editable) : undefined), [html, editable]);

  return createElement("iframe", {
    src: previewHtml ? undefined : `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`,
    srcDoc: previewHtml,
    sandbox: editable ? "allow-scripts allow-same-origin" : undefined,
    title,
    style,
  });
}
