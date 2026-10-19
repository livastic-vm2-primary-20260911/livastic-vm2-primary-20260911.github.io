import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pages = [
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  readFileSync(new URL('../ko/index.html', import.meta.url), 'utf8'),
];

test('Existing original VM5 paid DNS service offers a free sample and real 402 quote in each language', () => {
  const origin = 'https://vm5-openapi-x402.onrender.com';
  for (const html of pages) {
    assert.equal(html.split(origin + '/v1/email-dns-sample').length - 1, 1);
    assert.equal(html.split(origin + '/v1/email-dns-preflight?domain=gmail.com').length - 1, 1);
    assert.match(html, /0\.005/);
    assert.match(html, /SPF/);
    assert.match(html, /DMARC/);
    assert.match(html, /HTTP 402/);
    assert.match(html, /noopener noreferrer/);
  }
});
test('Both pages clearly deny any DNS paid customers and avoid deliverability promises', () => {
  assert.match(pages[0], /No independent paying DNS customer has been verified/);
  assert.match(pages[0], /not individual mailbox existence/);
  assert.match(pages[1], /실제 결제한 독립 고객은 검증되지 않았습니다/);
  assert.match(pages[1], /메일 도달 여부/);
  for (const html of pages) {
    assert.match(html, /0\.010/);
    assert.match(html, /0\.005/);
    assert.match(html, /vm5-openapi-x402\.onrender\.com\/llms\.txt/);
  }
});
