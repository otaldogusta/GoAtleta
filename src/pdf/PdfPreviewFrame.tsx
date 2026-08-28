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
  viewportWidth = 0
) => {
  const normalizedZoom = Math.max(70, Math.min(140, Math.round(zoom)));
  const normalizedViewportWidth = Math.max(0, Math.round(viewportWidth));
  const bridge = `
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3, user-scalable=yes" />
    <style>
      html, body {
        min-height: 100%;
        margin: 0;
        padding: 0;
        background: #e9edf2;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      body {
        padding: 8px;
        overflow-x: auto;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm 8mm 8mm;
        transform-origin: top left;
        zoom: var(--goatleta-native-page-scale, 1);
        margin-bottom: 10px;
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
        function updateScale() {
          var page = document.querySelector('.page');
          if (!page) return;
          document.documentElement.style.setProperty('--goatleta-native-page-scale', '1');
          var naturalWidth = Math.max(page.scrollWidth || 0, page.getBoundingClientRect().width || 0, 794);
          var hostViewportWidth = ${normalizedViewportWidth};
          var resolvedViewportWidth = hostViewportWidth || document.documentElement.clientWidth || window.innerWidth;
          var availableWidth = Math.max(1, resolvedViewportWidth - 20);
          var fitScale = Math.min(1, availableWidth / naturalWidth);
          var requestedZoom = ${normalizedZoom / 100};
          document.documentElement.style.setProperty(
            '--goatleta-native-page-scale',
            String(Math.max(0.3, Math.min(1.4, fitScale * requestedZoom)))
          );
        }
        document.addEventListener('focusin', function (event) { publishSelection(event.target); }, true);
        document.addEventListener('click', function (event) { publishSelection(event.target); }, true);
        ${editable ? "document.addEventListener('input', function (event) { publishEdit(event.target); }, true); document.addEventListener('compositionend', function (event) { publishEdit(event.target); }, true);" : ""}
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
        window.addEventListener('resize', updateScale, { passive: true });
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
  onMessage,
  onError,
}: PdfPreviewFrameProps) {
  const [frameWidth, setFrameWidth] = useState(0);
  const previewHtml = useMemo(
    () => (html && frameWidth > 0 ? buildNativePreviewHtml(html, editable, zoom, frameWidth) : undefined),
    [editable, frameWidth, html, zoom]
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
