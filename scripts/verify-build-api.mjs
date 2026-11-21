import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_API_URL = 'https://lottery888-api.afa94607.workers.dev';
const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error(`[VERIFY:API] FAIL — dist/assets directory not found: ${assetsDir}`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error('[VERIFY:API] FAIL — No built JavaScript bundles found in dist/assets.');
  process.exit(1);
}

const found = jsFiles.some((file) => {
  const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  return content.includes(EXPECTED_API_URL);
});

if (!found) {
  console.error(
    `[VERIFY:API] FAIL — Built bundle does not contain expected production API URL: ${EXPECTED_API_URL}`
  );
  process.exit(1);
}

console.log(`[VERIFY:API] PASS — Built JS bundle embeds ${EXPECTED_API_URL}`);
