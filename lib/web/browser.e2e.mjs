import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const bundle = await readFile(new URL('./index.js', import.meta.url));
const { server, port } = await new Promise((resolve) => {
  const server = createServer(async (request, response) => {
    if (request.url === '/web.js') {
      response.writeHead(200, { 'content-type': 'text/javascript' });
      response.end(bundle);
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<!doctype html>
      <html>
        <head>
          <script type="importmap">{"imports":{"@li3/web":"/web.js"}}</script>
          <script type="module">import '/web.js';</script>
        </head>
        <body>
          <template app>
            <p id="count">Count: {{ count }}</p>
            <template if="count > 0"><p id="visible">Visible</p></template>
            <ul><template for="item of items"><li>{{ item }}</li></template></ul>
            <button id="increment" on-click="increment()">Increment</button>
            <script setup>
              import { ref, onCleanup } from '@li3/web';
              export default function () {
                const count = ref(0);
                const items = ref(['one', 'two']);
                const timer = setInterval(() => {}, 10000);
                onCleanup(() => clearInterval(timer));
                return { count, items, increment: () => count.value++ };
              }
            </script>
          </template>
        </body>
      </html>`);
    });
  server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
});

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage();
page.on('console', (message) => console.log(`browser console: ${message.type()} ${message.text()}`));
page.on('pageerror', (error) => console.error('browser pageerror:', error));
page.on('requestfailed', (request) => console.error('browser request failed:', request.url(), request.failure()?.errorText));

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === 'Count: 0');

  assert.equal(await page.locator('#count').textContent(), 'Count: 0');
  assert.deepEqual(await page.locator('li').allTextContents(), ['one', 'two']);
  assert.equal(await page.locator('#visible').count(), 0);

  await page.click('#increment');
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === 'Count: 1');

  assert.equal(await page.locator('#visible').textContent(), 'Visible');
  assert.equal(await page.locator('template[app]').count(), 0);
  console.log('browser e2e: passed');
} finally {
  await browser.close();
  server.close();
}
