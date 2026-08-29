import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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

export const buildNativePreviewHtml = (
  html: string,
  editable = false,
  zoom = 100,
  viewportWidth = 0,
  minimumPageWidth = 0
) => {
  const normalizedZoom = Math.max(70, Math.min(140, Math.round(zoom)));
  const normalizedViewportWidth = Math.max(0, Math.round(viewportWidth));
  const normalizedMinimumPageWidth = Math.max(0, Math.min(900, Math.round(minimumPageWidth)));
  const bridge = `
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3, user-scalable=yes" />
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #e9edf2;
        overflow: hidden;
        overscroll-behavior: contain;
      }
      body {
        position: relative;
      }
      .goatleta-native-scroll-canvas {
        position: absolute;
        inset: 0;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        padding: 8px;
        overflow-x: auto;
        overflow-y: auto;
        touch-action: pan-x pan-y pinch-zoom;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .goatleta-native-scroll-canvas::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
      .goatleta-native-document-track {
        position: relative;
        min-width: 100%;
        min-height: 100%;
      }
      .goatleta-native-page-shell {
        position: relative;
        margin: 0 auto 10px;
        overflow: visible;
      }
      .page {
        box-sizing: border-box;
        width: 210mm;
        min-height: 297mm;
        aspect-ratio: 210 / 297;
        padding: 15mm 8mm 8mm;
        transform-origin: top left;
        transform: scale(var(--goatleta-native-page-scale, 1));
        margin: 0;
        background: #fff;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14);
      }
      .pdf-editable-cell {
        outline: none;
        cursor: text;
        -webkit-user-select: text;
        user-select: text;
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
    </style>
    <script>
      (function () {
        function hasNativeBridge() {
          return Boolean(
            window.ReactNativeWebView &&
            typeof window.ReactNativeWebView.postMessage === 'function'
          );
        }
        function send(payload) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        function elementFrom(target) {
          if (!target) return null;
          return target.nodeType === 1 ? target : target.parentElement;
        }
        function markActive(cell) {
          document.querySelectorAll('.goatleta-active-block').forEach(function (row) {
            row.classList.remove('goatleta-active-block');
          });
          var row = cell ? cell.closest('tr') : null;
          if (row && cell && cell.getAttribute('data-block-key')) {
            row.classList.add('goatleta-active-block');
          }
        }
        function publishSelection(target) {
          var element = elementFrom(target);
          var cell = element ? element.closest('[data-block-key], [data-section]') : null;
          if (!cell) return;
          markActive(cell);
          var blockKey = cell.getAttribute('data-block-key');
          var section = cell.getAttribute('data-section');
          if (blockKey) send({ type: 'GOATLETA_PDF_BLOCK_CLICK', blockKey: blockKey });
          if (section === 'pedagogy') send({ type: 'GOATLETA_PDF_SECTION_CLICK', section: section });
        }
        function publishEdit(target) {
          var element = elementFrom(target);
          if (!element || !element.hasAttribute || !element.hasAttribute('data-field')) return;
          send({
            type: 'GOATLETA_PDF_EDIT',
            field: element.getAttribute('data-field'),
            text: element.innerText || ''
          });
        }
        function ensurePageShell(page) {
          var parent = page.parentElement;
          if (parent && parent.classList.contains('goatleta-native-page-shell')) return parent;
          var shell = document.createElement('div');
          shell.className = 'goatleta-native-page-shell';
          page.parentNode.insertBefore(shell, page);
          shell.appendChild(page);
          return shell;
        }
        function ensureScrollCanvas() {
          var existingCanvas = document.querySelector('.goatleta-native-scroll-canvas');
          if (existingCanvas) {
            return {
              canvas: existingCanvas,
              track: existingCanvas.querySelector('.goatleta-native-document-track')
            };
          }
          var canvas = document.createElement('div');
          var track = document.createElement('div');
          canvas.className = 'goatleta-native-scroll-canvas';
          track.className = 'goatleta-native-document-track';
          while (document.body.firstChild) {
            track.appendChild(document.body.firstChild);
          }
          canvas.appendChild(track);
          document.body.appendChild(canvas);
          return { canvas: canvas, track: track };
        }
        function isEditableTarget(target) {
          var element = elementFrom(target);
          return Boolean(
            element &&
            element.closest &&
            element.closest('[contenteditable="true"], .pdf-editable-cell, input, textarea, select')
          );
        }
        function enableCanvasDrag(canvas) {
          if (!canvas || canvas.getAttribute('data-goatleta-drag-ready') === 'true') return;
          canvas.setAttribute('data-goatleta-drag-ready', 'true');
          var drag = null;
          canvas.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1 || isEditableTarget(event.target)) {
              drag = null;
              return;
            }
            var touch = event.touches[0];
            drag = {
              x: touch.clientX,
              y: touch.clientY,
              left: canvas.scrollLeft,
              top: canvas.scrollTop,
              active: false
            };
          }, { passive: true });
          canvas.addEventListener('touchmove', function (event) {
            if (!drag || event.touches.length !== 1) return;
            var touch = event.touches[0];
            var deltaX = touch.clientX - drag.x;
            var deltaY = touch.clientY - drag.y;
            if (!drag.active && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
            drag.active = true;
            event.preventDefault();
            canvas.scrollLeft = drag.left - deltaX;
            canvas.scrollTop = drag.top - deltaY;
          }, { passive: false });
          canvas.addEventListener('touchend', function () { drag = null; }, { passive: true });
          canvas.addEventListener('touchcancel', function () { drag = null; }, { passive: true });
        }
        var scaleUpdateFrame = 0;
        function scheduleScaleUpdate() {
          if (scaleUpdateFrame) return;
          scaleUpdateFrame = window.requestAnimationFrame(function () {
            scaleUpdateFrame = 0;
            updateScale();
          });
        }
        var pageResizeObserver = typeof ResizeObserver === 'function'
          ? new ResizeObserver(scheduleScaleUpdate)
          : null;
        function observePageResize(page) {
          if (!pageResizeObserver || page.getAttribute('data-goatleta-resize-observed') === 'true') return;
          page.setAttribute('data-goatleta-resize-observed', 'true');
          pageResizeObserver.observe(page);
        }
        function updateScale() {
          var viewport = ensureScrollCanvas();
          enableCanvasDrag(viewport.canvas);
          var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
          if (!pages.length) return;
          pages.forEach(observePageResize);
          document.documentElement.style.setProperty('--goatleta-native-page-scale', '1');
          pages.forEach(function (page) {
            page.style.transform = 'none';
          });
          var referencePage = pages[0];
          var naturalWidth = Math.max(referencePage.scrollWidth || 0, referencePage.offsetWidth || 0, 794);
          var hostViewportWidth = ${normalizedViewportWidth};
          var resolvedViewportWidth = viewport.canvas.clientWidth || document.documentElement.clientWidth || window.innerWidth || hostViewportWidth;
          var availableWidth = Math.max(1, resolvedViewportWidth - 20);
          var fitScale = Math.min(1, availableWidth / naturalWidth);
          var requestedZoom = ${normalizedZoom / 100};
          var minimumScale = ${normalizedMinimumPageWidth} > 0 ? ${normalizedMinimumPageWidth} / naturalWidth : 0;
          var resolvedScale = Math.min(1.4, Math.max(minimumScale, fitScale * requestedZoom));
          document.documentElement.style.setProperty('--goatleta-native-page-scale', String(resolvedScale));
          var widestPage = 0;
          pages.forEach(function (page) {
            var shell = ensurePageShell(page);
            var pageWidth = Math.max(page.scrollWidth || 0, page.offsetWidth || 0, naturalWidth);
            var pageHeight = Math.max(page.scrollHeight || 0, page.offsetHeight || 0, 1123);
            var scaledPageWidth = Math.ceil(pageWidth * resolvedScale);
            widestPage = Math.max(widestPage, scaledPageWidth);
            shell.style.width = scaledPageWidth + 'px';
            shell.style.height = Math.ceil(pageHeight * resolvedScale) + 'px';
            page.style.transform = 'scale(' + resolvedScale + ')';
          });
          viewport.track.style.width = Math.max(
            widestPage,
            Math.max(1, viewport.canvas.clientWidth - 16)
          ) + 'px';
        }
        document.addEventListener('focusin', function (event) { publishSelection(event.target); }, true);
        document.addEventListener('click', function (event) { publishSelection(event.target); }, true);
        ${editable ? "document.addEventListener('input', function (event) { publishEdit(event.target); scheduleScaleUpdate(); }, true); document.addEventListener('compositionend', function (event) { publishEdit(event.target); scheduleScaleUpdate(); }, true);" : ""}
        var readySent = false;
        var readyRetryTimer = 0;
        function scheduleReadyRetry() {
          if (readySent || readyRetryTimer) return;
          readyRetryTimer = window.setTimeout(function () {
            readyRetryTimer = 0;
            publishReady();
          }, 100);
        }
        function publishReady() {
          if (readySent) return;
          if (!hasNativeBridge()) {
            scheduleReadyRetry();
            return;
          }
          updateScale();
          var pages = document.querySelectorAll('.page').length || 1;
          try {
            send({ type: 'GOATLETA_PDF_PAGE_COUNT', pageCount: pages });
            send({ type: 'GOATLETA_PDF_READY' });
            readySent = true;
          } catch (error) {
            scheduleReadyRetry();
          }
        }
        function scheduleReady() {
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(publishReady);
          });
          window.setTimeout(publishReady, 300);
        }
        window.addEventListener('resize', scheduleScaleUpdate, { passive: true });
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', scheduleReady, { once: true });
        } else {
          scheduleReady();
        }
      })();
    </script>
  `;

  return html.includes("</head>")
    ? html.replace("</head>", `${bridge}</head>`)
    : `${bridge}${html}`;
};

export function PdfPreviewFrame({
  title,
  html,
  editable = false,
  zoom = 100,
  minimumPageWidth = 0,
  onMessage,
  onError,
}: PdfPreviewFrameProps) {
  const [frameWidth, setFrameWidth] = useState(0);
  const previewHtml = useMemo(
    () =>
      html && frameWidth > 0
        ? buildNativePreviewHtml(html, editable, zoom, frameWidth, minimumPageWidth)
        : undefined,
    [editable, frameWidth, html, minimumPageWidth, zoom]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(0, Math.floor(event.nativeEvent.layout.width));
    setFrameWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      onMessage?.(JSON.parse(event.nativeEvent.data));
    } catch {
      onMessage?.(event.nativeEvent.data);
    }
  };

  if (!html) {
    return (
      <View style={styles.fileFallback}>
        <Text style={styles.fileFallbackText} accessibilityRole="text">
          PDF selecionado. Abra no editor para continuar.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.frame} onLayout={handleLayout}>
      {previewHtml ? (
        <WebView
          accessibilityLabel={title}
          source={{ html: previewHtml, baseUrl: "about:blank" }}
          originWhitelist={["about:blank"]}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          scalesPageToFit={false}
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          nestedScrollEnabled
          setSupportMultipleWindows={false}
          keyboardDisplayRequiresUserAction={false}
          onMessage={handleMessage}
          onError={onError}
          onHttpError={onError}
          onRenderProcessGone={onError}
          onContentProcessDidTerminate={onError}
          onShouldStartLoadWithRequest={(request) => request.url === "about:blank" || request.url.startsWith("data:text/html")}
          style={styles.webView}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: "#e9edf2",
  },
  webView: {
    flex: 1,
    backgroundColor: "#e9edf2",
  },
  fileFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fileFallbackText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
