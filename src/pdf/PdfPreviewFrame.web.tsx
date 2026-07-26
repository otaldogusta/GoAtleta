import { createElement, useEffect, useMemo, useRef, memo, type CSSProperties } from "react";

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
      .pdf-editable-cell {
        outline: none;
        transition: background 0.15s ease, outline 0.15s ease;
        cursor: text;
      }
      .pdf-editable-cell:hover {
        background: #f0f7ff !important;
        outline: 1.5px dashed #2563eb !important;
        outline-offset: -1px;
        border-radius: 2px;
      }
      .pdf-editable-cell:focus {
        background: #ffffff !important;
        outline: 2px solid #2563eb !important;
        outline-offset: -1px;
        border-radius: 2px;
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
      document.addEventListener('focusin', function(e) {
        var cell = e.target ? e.target.closest('[data-block-key], [data-section]') : null;
        if (cell) {
          var blockKey = cell.getAttribute('data-block-key');
          var section = cell.getAttribute('data-section');
          if (blockKey) {
            window.parent.postMessage({ type: 'GOATLETA_PDF_BLOCK_CLICK', blockKey: blockKey }, '*');
          } else if (section === 'pedagogy') {
            window.parent.postMessage({ type: 'GOATLETA_PDF_SECTION_CLICK', section: 'pedagogy' }, '*');
          }
        }
      }, true);

      document.addEventListener('click', function(e) {
        var card = e.target ? e.target.closest('.lesson-card') : null;
        if (!card) {
          window.parent.postMessage({ type: 'GOATLETA_PDF_BACKGROUND_CLICK' }, '*');
          return;
        }

        var cell = e.target ? e.target.closest('[data-block-key], [data-section]') : null;
        if (cell) {
          var blockKey = cell.getAttribute('data-block-key');
          var section = cell.getAttribute('data-section');
          if (blockKey) {
            window.parent.postMessage({ type: 'GOATLETA_PDF_BLOCK_CLICK', blockKey: blockKey }, '*');
          } else if (section === 'pedagogy') {
            window.parent.postMessage({ type: 'GOATLETA_PDF_SECTION_CLICK', section: 'pedagogy' }, '*');
          }
        }
      }, true);

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

export const PdfPreviewFrame = memo(function PdfPreviewFrame({ url, title, html, editable }: PdfPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    border: 0,
    display: "block",
    background: "#ffffff",
  };
  const previewHtml = useMemo(() => (html ? buildPreviewHtml(html, editable) : undefined), [html, editable]);
  const lastHtmlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && previewHtml && previewHtml !== lastHtmlRef.current) {
      lastHtmlRef.current = previewHtml;
      iframe.srcdoc = previewHtml;
    }
  }, [previewHtml]);

  return createElement("iframe", {
    ref: iframeRef,
    src: previewHtml ? undefined : `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`,
    sandbox: editable ? "allow-scripts allow-same-origin" : undefined,
    title,
    style,
  });
});
