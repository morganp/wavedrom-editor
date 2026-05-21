// samples.js — common waveform templates
window.WAVEDROM_SAMPLES = [
  {
    id: 'basic',
    label: 'Basic clock + data',
    sub: 'A clock with two data signals',
    spec: {
      signal: [
        { name: 'clk',  wave: 'p.....' },
        { name: 'req',  wave: '0.1..0' },
        { name: 'ack',  wave: '0..1.0' },
      ],
    },
  },
  {
    id: 'bus',
    label: 'Data bus transfer',
    sub: 'Bus values with valid strobe',
    spec: {
      signal: [
        { name: 'clk',   wave: 'p........' },
        { name: 'valid', wave: '0.1...0..' },
        { name: 'data',  wave: 'x.=.=.x..', data: ['A0', 'A1'] },
      ],
    },
  },
  {
    id: 'phase',
    label: 'Phase + period demo',
    sub: 'Different clock periods and phase shifts',
    spec: {
      signal: [
        { name: 'clk',     wave: 'p.......', period: 1 },
        { name: 'clk_div2', wave: 'p.......', period: 2 },
        { name: 'sample',  wave: '0.1.0.1.', phase: 0.25 },
      ],
    },
  },
  {
    id: 'group',
    label: 'Grouped signals',
    sub: 'Nested arrays',
    spec: {
      signal: [
        { name: 'clk', wave: 'p......' },
        ['ctrl',
          { name: 'req', wave: '0.1..0.' },
          { name: 'ack', wave: '0..1.0.' },
        ],
        ['data',
          { name: 'addr', wave: 'x.=..x.', data: ['0x4'] },
          { name: 'din',  wave: 'x.=.=x.', data: ['D0','D1'] },
        ],
      ],
      edge: ['a~>b request to ack'],
    },
  },
  {
    id: 'states',
    label: 'All wave states',
    sub: 'Every supported character',
    spec: {
      signal: [
        { name: 'p',  wave: 'p......' },
        { name: 'P',  wave: 'P......' },
        { name: 'n',  wave: 'n......' },
        { name: 'N',  wave: 'N......' },
        { name: '0/1',wave: '01010.1' },
        { name: 'l/h',wave: 'lhlh.l.' },
        { name: 'x/z',wave: 'xzxz.x.' },
        { name: 'bus',wave: '=2345.=', data: ['a','b','c','d','e','f'] },
        { name: 'gap',wave: '0.1|0.1' },
      ],
    },
  },
];
