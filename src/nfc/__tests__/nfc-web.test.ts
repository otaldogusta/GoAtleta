import { Platform } from "react-native";
import { isNfcSupported, readTagUid } from "../nfc";

type Listener = (event: Event & { serialNumber?: string }) => void;

describe("Web NFC capability detection", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
    delete (globalThis as typeof globalThis & { NDEFReader?: unknown }).NDEFReader;
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { NDEFReader?: unknown }).NDEFReader;
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
  });

  it("explains when the browser does not expose Web NFC", async () => {
    await expect(isNfcSupported()).resolves.toEqual({
      available: false,
      enabled: false,
      reason: "Este navegador ou aparelho não oferece leitura NFC. Use o app ou o Chrome em um celular Android com NFC.",
    });
  });

  it("reads and normalizes the tag serial number when Web NFC is available", async () => {
    class FakeNdefReader {
      private listeners = new Map<string, Listener>();

      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, listener);
      }

      async scan() {
        queueMicrotask(() => {
          this.listeners.get("reading")?.(Object.assign(new Event("reading"), { serialNumber: "01:ab-CD" }));
        });
      }
    }

    (globalThis as typeof globalThis & { NDEFReader?: unknown }).NDEFReader = FakeNdefReader;

    await expect(isNfcSupported()).resolves.toEqual({ available: true, enabled: true });
    await expect(readTagUid()).resolves.toMatchObject({ uid: "01ABCD" });
  });

  it("reports when the browser exposes Web NFC but the device cannot scan", async () => {
    class UnsupportedNdefReader {
      addEventListener() {}

      async scan() {
        throw Object.assign(new Error("NFC adapter unavailable"), { name: "NotSupportedError" });
      }
    }

    (globalThis as typeof globalThis & { NDEFReader?: unknown }).NDEFReader = UnsupportedNdefReader;

    await expect(readTagUid()).rejects.toThrow("Este aparelho não oferece leitura NFC pelo navegador.");
  });
});
