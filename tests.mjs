// Smoke test of the board against the live API: node tests.mjs <url>
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:3000';
const b = await chromium.launch();
const p = await b.newPage({ locale: 'en-GB', timezoneId: 'Pacific/Auckland' });
await p.goto(url);
await p.waitForSelector('[data-testid=incident-row]');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
assert(await p.locator('[data-testid=loader]').isHidden(), 'loader gone');
assert((await p.locator('meta[name=build]').getAttribute('content')) === (await p.textContent('[data-testid=build-sha]')), 'sha');
const t = await p.locator('time').first().textContent();
assert(/^\d\d\/\d\d\/\d{4}/.test(t), 'local dd/mm time: ' + t);
await p.locator('[data-testid=ack]').first().click();
await p.waitForSelector('[data-testid=acked]');
console.log('ok', t);
await b.close();
