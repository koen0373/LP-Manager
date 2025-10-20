// Minimal test script
const { publicClient } = require('./src/lib/viemClient.ts');
const { readTokenMeta } = require('./src/lib/readTokenMeta.ts');

(async () => {
  try {
    const WFLR = '0x1d80c49BbBCd1C0911346656B529DF9E5c2F783d';
    console.log('Testing token metadata for WFLR...');
    const result = await readTokenMeta(WFLR);
    console.log('Result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
})();
