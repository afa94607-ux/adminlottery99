const PROD_API = 'https://lottery888-api.afa94607.workers.dev';

// Simulate getApiBase() resolution under different environments/hostnames
async function run() {
  const cases = [
    {
      name: 'Personal domain adminlottery99.win',
      hostname: 'adminlottery99.win',
      expected: PROD_API,
    },
    {
      name: 'Personal domain www.adminlottery99.win',
      hostname: 'www.adminlottery99.win',
      expected: PROD_API,
    },
    {
      name: 'Original workers.dev domain',
      hostname: 'adminlottery99.afa94607.workers.dev',
      expected: PROD_API,
    },
    {
      name: 'Localhost dev preserves relative /api proxy',
      hostname: '127.0.0.1',
      expected: '',
    },
    {
      name: 'window.VITE_API_URL override takes priority',
      hostname: '127.0.0.1',
      windowApi: 'https://custom-override.example.com/',
      expected: 'https://custom-override.example.com',
    },
  ];

  let passed = 0;
  for (const tc of cases) {
    globalThis.window = {
      location: { hostname: tc.hostname },
      ...(tc.windowApi ? { VITE_API_URL: tc.windowApi } : {}),
    };
    const mod = await import(`../src/utils/lotteryApi.ts?t=${Date.now()}_${passed}`);
    const actual = mod.getApiBase();
    const ok = actual === tc.expected;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${tc.name}: expected="${tc.expected}" actual="${actual}"`);
    if (ok) passed += 1;
    else process.exitCode = 1;
  }
  console.log(`\nSummary: ${passed}/${cases.length} getApiBase() regression tests PASSED.`);
}

run();
