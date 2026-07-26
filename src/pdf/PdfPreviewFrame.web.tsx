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
      [contenteditable="true"] {
        outline: none;
        transition: background 0.15s ease, box-shadow 0.15s ease;
        cursor: text;
        border-radius: 3px;
      }
      [contenteditable="true"]:hover {
        background: #f0f7ff !important;
        box-shadow: inset 0 0 0 1.5px #3b82f6 !important;
      }
      [contenteditable="true"]:focus {
        background: #ffffff !important;
        box-shadow: inset 0 0 0 2px #2563eb !important;
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
      document.addEventListener('blur', function(e) {
        var el = e.target;
        if (el && el.hasAttribute && el.hasAttribute('data-field')) {
          var field = el.getAttribute('data-field');
          var text = el.innerText ? el.innerText.trim() : '';
          window.parent.postMessage({ type: 'GOATLETA_PDF_EDIT', field: field, text: text }, '*');
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
