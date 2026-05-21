// Forge function handlers. Currently just supplies a default JSON spec for
// freshly-inserted macros — everything else (view + edit modal) is
// client-side Custom UI.

const DEFAULT_SPEC = {
  signal: [
    { name: 'clk',  wave: 'p......' },
    { name: 'data', wave: 'x.345x.', data: ['A', 'B', 'C'] },
    { name: 'vld',  wave: '0.1...0' },
  ],
  head: { text: 'WaveDrom diagram' },
};

export async function defaultConfig() {
  return { body: JSON.stringify(DEFAULT_SPEC, null, 2) };
}
