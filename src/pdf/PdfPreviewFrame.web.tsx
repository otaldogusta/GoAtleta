import { createElement, useEffect, useMemo, useRef, memo, type CSSProperties } from "react";

type PdfPreviewFrameProps = {
  url: string;
  title: string;
  html?: string;
  editable?: boolean;
  zoom?: number;
  minimumPageWidth?: number;
  onMessage?: (data: unknown) => void;
  onError?: () => void;
};

export const buildPreviewHtml = (html: string, editable?: boolean, zoom = 100, minimumPageWidth = 0) => {
  const normalizedZoom = Math.max(70, Math.min(140, Math.round(zoom)));
  const normalizedMinimumPageWidth = Math.max(0, Math.min(900, Math.round(minimumPageWidth)));
  const stylesAndScript = `
      ${
        editable
          ? `
      .pdf-editable-cell {
        outline: none;
        transition: background 0.15s ease, box-shadow 0.15s ease;
        cursor: text;
      }
      .pdf-editable-cell:hover {
        background: #f0fdf4 !important;
        box-shadow: inset 0 0 0 1px #22c55e;
      }
      .pdf-editable-cell:focus {
        background: #ffffff !important;
        box-shadow: inset 0 0 0 2px #22c55e;
      }
      tr.goatleta-active-block > td,
      tr.goatleta-active-block > th {
        background: #f0fdf4 !important;
        box-shadow: inset 0 2px 0 #22c55e, inset 0 -2px 0 #22c55e;
      }
      tr.goatleta-active-block > td:first-child,
      tr.goatleta-active-block > th:first-child {
        box-shadow: inset 2px 0 0 #22c55e, inset 0 2px 0 #22c55e, inset 0 -2px 0 #22c55e;
      }
      tr.goatleta-active-block > td:last-child,
      tr.goatleta-active-block > th:last-child {
        box-shadow: inset -2px 0 0 #22c55e, inset 0 2px 0 #22c55e, inset 0 -2px 0 #22c55e;
      }
      `
          : ""
      }
      body {
        min-height: 100%;
        padding: 18px;
        overflow-x: auto;
        overflow-y: auto;
        overscroll-behavior: contain;
        touch-action: pan-x pan-y;
        -webkit-overflow-scrolling: touch;
        background: #e9edf2;
      }
      html,
      body {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      html::-webkit-scrollbar,
      body::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
      .page {
        box-sizing: border-box;
        width: 210mm;
        height: 297mm;
        min-height: 297mm;
        aspect-ratio: 210 / 297;
        margin: 0 0 12mm;
        padding: 15mm 8mm 8mm;
        position: relative;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        zoom: var(--goatleta-page-scale, 1);
        transform-origin: top left;
      }
      .page:last-child { margin-bottom: 0; }
      .goatleta-page-number {
        position: absolute;
        right: 8mm;
        bottom: 3mm;
        color: #64748b;
        font: 700 8pt Calibri, Arial, Helvetica, sans-serif;
        pointer-events: none;
      }
      @media (max-width: 640px) {
        body { padding: 10px; }
        .page {
          margin-bottom: 8mm;
        }
      }
    </style>
    ${
      editable
        ? `
    <script>
      var viewportZoom = 1;
      var spaceHeld = false;
      var pan = null;
      var suppressPanClick = false;
      function isTyping(target) {
        return target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      }
      function finishPan() {
        pan = null;
        document.documentElement.style.userSelect = '';
        document.documentElement.style.cursor = spaceHeld ? 'grab' : '';
      }
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'Space' || isTyping(e.target)) return;
        e.preventDefault();
        spaceHeld = true;
        document.documentElement.style.cursor = 'grab';
      });
      document.addEventListener('keyup', function(e) {
        if (e.code !== 'Space') return;
        spaceHeld = false;
        finishPan();
      });
      window.addEventListener('blur', function() { spaceHeld = false; finishPan(); });
      document.addEventListener('pointerdown', function(e) {
        if (!(spaceHeld && e.button === 0) && e.button !== 1) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        pan = { x: e.clientX, y: e.clientY, left: window.scrollX, top: window.scrollY };
        suppressPanClick = true;
        document.documentElement.setPointerCapture(e.pointerId);
        document.documentElement.style.userSelect = 'none';
        document.documentElement.style.cursor = 'grabbing';
      }, true);
      document.addEventListener('pointermove', function(e) {
        if (!pan) return;
        e.preventDefault();
        window.scrollTo(pan.left + pan.x - e.clientX, pan.top + pan.y - e.clientY);
      }, true);
      document.addEventListener('pointerup', function() {
        finishPan();
        setTimeout(function() { suppressPanClick = false; }, 0);
      }, true);
      document.addEventListener('pointercancel', finishPan, true);
      document.addEventListener('click', function(e) {
        if (!suppressPanClick) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      }, true);
      document.addEventListener('wheel', function(e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        var before = Number(document.documentElement.style.getPropertyValue('--goatleta-page-scale')) || 1;
        var oldInset = parseFloat(document.body.style.paddingLeft) || 0;
        var pageX = (window.scrollX + e.clientX - oldInset) / before;
        var pageY = (window.scrollY + e.clientY) / before;
        viewportZoom = Math.max(0.3, Math.min(4, viewportZoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.002)));
        updatePageScale();
        var after = Number(document.documentElement.style.getPropertyValue('--goatleta-page-scale')) || 1;
        var inset = parseFloat(document.body.style.paddingLeft) || 0;
        window.scrollTo(pageX * after + inset - e.clientX, pageY * after - e.clientY);
      }, { passive: false });
      function getEl(target) {
        if (!target) return null;
        return target.nodeType === 1 ? target : target.parentElement;
      }

      function markActiveBlock(cell) {
        document.querySelectorAll('.goatleta-active-block').forEach(function(row) {
          row.classList.remove('goatleta-active-block');
        });
        var row = cell ? cell.closest('tr') : null;
        if (row && cell && cell.getAttribute('data-block-key')) {
          row.classList.add('goatleta-active-block');
        }
      }

      document.addEventListener('focusin', function(e) {
        var el = getEl(e.target);
        var cell = el ? el.closest('[data-block-key], [data-section]') : null;
        if (cell) {
          markActiveBlock(cell);
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
        var el = getEl(e.target);
        var cell = el ? el.closest('[data-block-key], [data-section]') : null;
        if (cell) {
          markActiveBlock(cell);
          var blockKey = cell.getAttribute('data-block-key');
          var section = cell.getAttribute('data-section');
          if (document.activeElement !== cell) {
            if (blockKey) {
              window.parent.postMessage({ type: 'GOATLETA_PDF_BLOCK_CLICK', blockKey: blockKey }, '*');
            } else if (section === 'pedagogy') {
              window.parent.postMessage({ type: 'GOATLETA_PDF_SECTION_CLICK', section: 'pedagogy' }, '*');
            }
          }
          return;
        }

        var card = el ? el.closest('.lesson-card') : null;
        if (!card) {
          markActiveBlock(null);
          window.parent.postMessage({ type: 'GOATLETA_PDF_BACKGROUND_CLICK' }, '*');
        }
      }, true);

      function emitEdit(target) {
        var el = getEl(target);
        if (el && el.hasAttribute && el.hasAttribute('data-field')) {
          var field = el.getAttribute('data-field');
          var text = el.innerText ? el.innerText : '';
          window.parent.postMessage({ type: 'GOATLETA_PDF_EDIT', field: field, text: text }, '*');
        }
      }

      document.addEventListener('input', function(e) {
        emitEdit(e.target);
      }, true);

      document.addEventListener('compositionend', function(e) {
        emitEdit(e.target);
      }, true);

      function makePage(sourcePage, sourceCard, colgroup, continuation) {
        var page = document.createElement('div');
        page.className = sourcePage.className;
        page.setAttribute('data-goatleta-page', 'true');
        var card = document.createElement('section');
        card.className = sourceCard.className;
        var pageLabel = sourceCard.querySelector(':scope > .page-label');
        if (pageLabel) card.appendChild(pageLabel.cloneNode(true));
        var table = document.createElement('table');
        if (colgroup) table.appendChild(colgroup.cloneNode(true));
        var body = document.createElement('tbody');
        table.appendChild(body);
        card.appendChild(table);
        page.appendChild(card);
        if (continuation) page.setAttribute('data-continuation', 'true');
        return { page: page, body: body };
      }

      function pageOverflowed(page) {
        return page.scrollHeight > page.clientHeight + 2;
      }

      function paginateSourcePage(sourcePage) {
        var sourceCard = sourcePage.querySelector('.lesson-card');
        var sourceTable = sourceCard ? sourceCard.querySelector('table') : null;
        var sourceBody = sourceTable ? sourceTable.querySelector('tbody') : null;
        if (!sourceCard || !sourceTable || !sourceBody) return [sourcePage];

        var rows = Array.prototype.slice.call(sourceBody.children);
        if (!rows.length) return [sourcePage];
        var colgroup = sourceTable.querySelector('colgroup');
        var titleTemplate = sourceBody.querySelector('.title-row');
        var tableHeaderTemplate = sourceBody.querySelector('.table-header-row');
        var first = makePage(sourcePage, sourceCard, colgroup, false);
        sourcePage.replaceWith(first.page);
        var pages = [first.page];
        var currentPage = first.page;
        var currentBody = first.body;
        var tableHeaderSeen = false;

        rows.forEach(function(row) {
          currentBody.appendChild(row);
          if (row.classList.contains('table-header-row')) tableHeaderSeen = true;
          if (!pageOverflowed(currentPage) || currentBody.children.length === 1) return;

          currentBody.removeChild(row);
          var next = makePage(sourcePage, sourceCard, colgroup, true);
          currentPage.after(next.page);
          pages.push(next.page);
          currentPage = next.page;
          currentBody = next.body;

          if (titleTemplate && !row.classList.contains('title-row')) {
            currentBody.appendChild(titleTemplate.cloneNode(true));
          }
          if (tableHeaderSeen && tableHeaderTemplate && !row.classList.contains('table-header-row')) {
            currentBody.appendChild(tableHeaderTemplate.cloneNode(true));
          }
          currentBody.appendChild(row);
        });

        return pages;
      }

      function publishCurrentPage(pages) {
        if (!pages.length) return;
        var currentPage = 1;
        var bestDistance = Infinity;
        pages.forEach(function(page, index) {
          var distance = Math.abs(page.getBoundingClientRect().top - 18);
          if (distance < bestDistance) {
            bestDistance = distance;
            currentPage = index + 1;
          }
        });
        window.parent.postMessage({
          type: 'GOATLETA_PDF_PAGE_CHANGE',
          currentPage: currentPage,
          pageCount: pages.length
        }, '*');
      }

      function paginateDocument() {
        var sourcePages = Array.prototype.slice.call(document.querySelectorAll('body > .page'));
        var pages = [];
        sourcePages.forEach(function(sourcePage) {
          pages = pages.concat(paginateSourcePage(sourcePage));
        });
        pages.forEach(function(page, index) {
          var number = document.createElement('div');
          number.className = 'goatleta-page-number';
          number.textContent = 'Página ' + (index + 1) + ' de ' + pages.length;
          page.appendChild(number);
        });
        window.parent.postMessage({
          type: 'GOATLETA_PDF_PAGE_COUNT',
          pageCount: pages.length
        }, '*');
        publishCurrentPage(pages);
        var ticking = false;
        window.addEventListener('scroll', function() {
          if (ticking) return;
          ticking = true;
          window.requestAnimationFrame(function() {
            publishCurrentPage(pages);
            ticking = false;
          });
        }, { passive: true });
      }

      function updatePageScale() {
        var horizontalPadding = window.innerWidth <= 640 ? 20 : 36;
        var a4WidthPx = 210 * 96 / 25.4;
        var fitScale = Math.min(1, Math.max(0.2, (window.innerWidth - horizontalPadding) / a4WidthPx));
        var requestedZoom = ${normalizedZoom / 100};
        var minimumScale = ${normalizedMinimumPageWidth} > 0 ? ${normalizedMinimumPageWidth} / a4WidthPx : 0;
        var effectiveScale = Math.min(4, Math.max(minimumScale, fitScale * requestedZoom) * viewportZoom);
        document.documentElement.style.setProperty('--goatleta-page-scale', String(effectiveScale));
        var scaledWidth = a4WidthPx * effectiveScale;
        var availableWidth = window.innerWidth - horizontalPadding;
        var inset = Math.max(0, (availableWidth - scaledWidth) / 2);
        document.body.style.paddingLeft = (horizontalPadding / 2 + inset) + 'px';
        document.body.style.paddingRight = (horizontalPadding / 2 + inset) + 'px';
      }

      window.requestAnimationFrame(function() {
        window.requestAnimationFrame(function() {
          paginateDocument();
          updatePageScale();
          window.addEventListener('resize', updatePageScale, { passive: true });
          window.parent.postMessage({ type: 'GOATLETA_PDF_READY' }, '*');
        });
      });
    </script>
    `
        : ""
    }`;

  return html.replace("</style>", stylesAndScript);
};

export const PdfPreviewFrame = memo(function PdfPreviewFrame({
  url,
  title,
  html,
  editable,
  zoom = 100,
  minimumPageWidth = 0,
  onError,
}: PdfPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    border: 0,
    display: "block",
    background: "#ffffff",
  };
  const previewHtml = useMemo(
    () => (html ? buildPreviewHtml(html, editable, zoom, minimumPageWidth) : undefined),
    [editable, html, minimumPageWidth, zoom]
  );
  const lastHtmlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!html || !editable) return;
    const forwardSpace = (event: KeyboardEvent) => {
      const frame = iframeRef.current;
      const target = event.target;
      if (event.code !== "Space" || !frame) return;
      if (target instanceof HTMLElement &&
          (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.type === "keydown" && !frame.matches(":hover")) return;
      const forwarded = new KeyboardEvent(event.type, {
        key: event.key, code: event.code, bubbles: true, cancelable: true,
      });
      if (frame.contentDocument?.dispatchEvent(forwarded) === false) event.preventDefault();
    };
    document.addEventListener("keydown", forwardSpace);
    document.addEventListener("keyup", forwardSpace);
    return () => {
      document.removeEventListener("keydown", forwardSpace);
      document.removeEventListener("keyup", forwardSpace);
    };
  }, [editable, html]);

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
    onError,
  });
});
