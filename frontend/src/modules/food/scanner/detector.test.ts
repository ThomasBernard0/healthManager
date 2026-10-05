import { ZXING_WASM_VERSION } from 'barcode-detector/ponyfill'
import pkg from '../../../../package.json'

describe('scanner wasm', () => {
  // We serve zxing-wasm's .wasm ourselves: it must be the build barcode-detector's JS expects.
  it('pins zxing-wasm to the version barcode-detector was built for', () => {
    expect(pkg.dependencies['zxing-wasm']).toBe(ZXING_WASM_VERSION)
  })
})
