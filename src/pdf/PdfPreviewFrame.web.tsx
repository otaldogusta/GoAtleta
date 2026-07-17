import { createElement, useMemo, type CSSProperties } from "react";

type PdfPreviewFrameProps = {
  url: string;
  title: string;
  html?: string;
};

const buildPreviewHtml = (html: string) =>
  html.replace(
    "</style>",
    `
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
    </style>`
  );

export function PdfPreviewFrame({ url, title, html }: PdfPreviewFrameProps) {
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    border: 0,
    display: "block",
    background: "#ffffff",
  };
  const previewHtml = useMemo(() => (html ? buildPreviewHtml(html) : undefined), [html]);

  return createElement("iframe", {
    src: previewHtml ? undefined : `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`,
    srcDoc: previewHtml,
    sandbox: "",
    title,
    style,
  });
}
