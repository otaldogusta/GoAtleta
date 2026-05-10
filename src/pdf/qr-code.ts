type QRCodeModule = {
  toDataURL: (
    text: string,
    options?: {
      margin?: number;
      width?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    },
  ) => Promise<string>;
};

function loadBrowserQrCodeModule(): QRCodeModule | null {
  try {
    return require("qrcode/lib/browser") as QRCodeModule;
  } catch {
    return null;
  }
}

function loadServerQrCodeModule(): QRCodeModule | null {
  try {
    const dynamicRequire = Function("return require")() as
      | ((moduleId: string) => QRCodeModule)
      | undefined;
    if (!dynamicRequire) {
      return null;
    }
    return dynamicRequire("qrcode/lib/server");
  } catch {
    return null;
  }
}

function loadQrCodeModule(): QRCodeModule | null {
  const hasBrowserCanvas = (() => {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return false;
    }

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext?.("2d");
      return (
        !!context &&
        typeof context.createImageData === "function" &&
        typeof canvas.toDataURL === "function"
      );
    } catch {
      return false;
    }
  })();

  if (hasBrowserCanvas) {
    return loadBrowserQrCodeModule() ?? loadServerQrCodeModule();
  }

  return loadServerQrCodeModule() ?? loadBrowserQrCodeModule();
}

export function isValidQrValue(value: string): boolean {
  return String(value ?? "").trim().length > 0;
}

export async function generateQrDataUri(value: string): Promise<string | null> {
  if (!isValidQrValue(value)) {
    return null;
  }

  try {
    const qrCodeModule = loadQrCodeModule();
    if (!qrCodeModule) {
      return null;
    }

    const dataUri = await qrCodeModule.toDataURL(String(value).trim(), {
      margin: 0,
      width: 128,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return typeof dataUri === "string" && dataUri.startsWith("data:image/png;base64,")
      ? dataUri
      : null;
  } catch {
    return null;
  }
}
