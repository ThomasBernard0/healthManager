/** Barcode formats printed on food packaging (EAN-13 in Europe, UPC-A in North America). */
export const FOOD_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}

/**
 * The browser's own BarcodeDetector when it reads our formats (Android Chrome),
 * else the ZXing WebAssembly ponyfill (iPhone, desktop), loaded only when needed
 * and served from our origin rather than a CDN.
 */
export async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      if (FOOD_FORMATS.every((f) => supported.includes(f))) return new Native({ formats: [...FOOD_FORMATS] })
    } catch {
      // Fall through to the ponyfill.
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  })
  return new BarcodeDetector({ formats: [...FOOD_FORMATS] })
}
