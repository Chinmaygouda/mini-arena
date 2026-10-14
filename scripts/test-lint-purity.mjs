import { ESLint } from 'eslint';

async function runNegativeTests() {
  console.log('Running ESLint shared-purity negative tests...');
  const eslint = new ESLint();

  const tests = [
    {
      name: 'Import Three.js',
      code: "import * as THREE from 'three';\nconsole.log(THREE);\n",
      expectedError: 'packages/shared must not import Three.js',
    },
    {
      name: 'Import Colyseus',
      code: "import { Room } from 'colyseus';\nconsole.log(Room);\n",
      expectedError: 'packages/shared must not import Colyseus',
    },
    {
      name: 'Access window DOM global',
      code: "export const x = window.location.href;\n",
      expectedError: 'packages/shared has no DOM',
    },
    {
      name: 'Access document DOM global',
      code: "export const el = document.getElementById('root');\n",
      expectedError: 'packages/shared has no DOM',
    },
    {
      name: 'Access fetch DOM/network global',
      code: "export const req = fetch('https://example.com');\n",
      expectedError: 'packages/shared has no DOM/network calls',
    },
  ];

  let passed = 0;
  for (const t of tests) {
    const results = await eslint.lintText(t.code, {
      filePath: 'packages/shared/src/negative-test-fixture.ts',
    });
    const messages = results[0]?.messages || [];
    const matched = messages.some((m) => m.message.includes(t.expectedError));

    if (matched) {
      console.log(`  ✔ [PASS] ${t.name}: caught violation "${t.expectedError}"`);
      passed++;
    } else {
      console.error(`  ✘ [FAIL] ${t.name}: expected error containing "${t.expectedError}"`);
      console.error('    Actual messages:', messages);
    }
  }

  if (passed === tests.length) {
    console.log(`\nAll ${passed}/${tests.length} shared-purity lint negative tests PASSED!\n`);
    process.exit(0);
  } else {
    console.error(`\nFailed: ${tests.length - passed} tests did not trigger expected lint errors.\n`);
    process.exit(1);
  }
}

runNegativeTests().catch((err) => {
  console.error('Lint negative test suite failed with error:', err);
  process.exit(1);
});
