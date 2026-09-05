import { execFileSync } from 'node:child_process';

describe('patched navigation query decoder', () => {
  it('preserves links, Unicode, arrays and malformed input in CommonJS consumers', () => {
    const queryString = require('query-string');
    expect(queryString.parse('name=Jo%C3%A3o+Silva&item=a&item=b&empty='))
      .toEqual({ name: 'João Silva', item: ['a', 'b'], empty: '' });
    expect(queryString.parse('broken=%E0%A4%A')).toEqual({ broken: '%E0%A4%A' });
  });
  it('terminates on a large malformed URL instead of recursively splitting input', () => {
    // A separate process imposes a real deadline even if synchronous decoding hangs.
    const output = execFileSync(process.execPath, ['-e',
      "const decode=require('decode-uri-component'); const output=decode('%C2'.repeat(150000)); if(typeof output!=='string'||!output.length)process.exit(2); console.log('ok')",
    ], { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' });
    expect(output.trim()).toBe('ok');
  });
});
