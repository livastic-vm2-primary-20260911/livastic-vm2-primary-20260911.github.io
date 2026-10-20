import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeCsv, parseCsv, byteSize, paidRequestPayload, MAX_LOCAL_BYTES, MAX_HOSTED_BYTES} from '../assets/csv-core.mjs';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const codes=csv=>analyzeCsv(csv).issueCodes;

test('quoted RFC4180 fields: comma, escaped quote and CRLF/newline',()=>{
  const a=parseCsv('a,b\r\n"x,y","a""b"\r\n"multiline\nvalue",ok');
  assert.deepEqual(a.map(r=>r.cells),[['a','b'],['x,y','a"b'],['multiline\nvalue','ok']]);
  assert.deepEqual(a.map(r=>r.line),[1,2,3]);
});
test('BOM accepted and multilingual values stay text',()=>{
  const r=analyzeCsv('\ufeff이름,수량\n김민수,2\nSarah,3');
  assert.equal(r.dataRows,2);assert.equal(r.headerColumns,2);assert.equal(r.issueCount,0);
});
test('reject empty and oversized CSV before any output',()=>{
  assert.throws(()=>parseCsv(''),e=>e.code==='EMPTY_CSV');
  assert.throws(()=>parseCsv('a'.repeat(MAX_LOCAL_BYTES+1)),e=>e.code==='LOCAL_FILE_TOO_LARGE');
});
test('reject unterminated, embedded and trailing-quote malformed CSV',()=>{
  for(const [data,reason] of [
    ['a\n"b','UNCLOSED_QUOTE'],
    ['a\na"b','INVALID_QUOTE'],
    ['a\n"b"other','TRAILING_TEXT_AFTER_QUOTE']])
    assert.throws(()=>parseCsv(data),e=>e.code===reason);
});
test('bound column count and logical record count',()=>{
  const header=Array.from({length:81},(_,i)=>'c'+i).join(',');
  assert.throws(()=>parseCsv(header),e=>e.code==='TOO_MANY_COLUMNS');
  assert.throws(()=>parseCsv('x\n'+'y\n'.repeat(5002)),e=>e.code==='TOO_MANY_ROWS');
});
test('duplicate case-insensitive headers, empty headers and missing required header',()=>{
  const r=analyzeCsv('Email,,email\na,b,c',{expectedColumns:['missing']});
  assert.equal(r.issueCodes.EMPTY_HEADER,1);
  assert.equal(r.issueCodes.DUPLICATE_HEADER,1);
  assert.equal(r.issueCodes.REQUIRED_HEADER_MISSING,1);
  assert.equal(r.errors,3);
});
test('detect short and long rows, completely blank records',()=>{
  const x=codes('a,b\na,b\nc\nd,e,f\n');
  assert.equal(x.COLUMN_COUNT_MISMATCH,2);
  assert.equal(x.EMPTY_DATA_ROW,undefined);
  const y=codes('a,b\nc,d\n\ne,f');
  assert.equal(y.EMPTY_DATA_ROW,1);
});
test('detect exact duplicate data and empty cells',()=>{
  const x=codes('a,b\n1,\n1,');
  assert.equal(x.DUPLICATE_DATA_ROW,1);
  assert.equal(x.EMPTY_CELL,2);
});
test('flag formula-like values including fullwidth starts, not execute them',()=>{
  const x=codes('v,x\n"=SUM(1,2)",ok\n-42,ok\n＠suspicious,ok');
  assert.equal(x.POSSIBLE_SPREADSHEET_FORMULA,3);
});
test('detect semicolon delimiter and NUL cells without raw echo',()=>{
  const r=analyzeCsv('a;b;c\nx;y;z\nhello\u0000;z');
  assert.equal(r.issueCodes.POSSIBLE_SEMICOLON_DELIMITER,1);
  assert.equal(r.issueCodes.NUL_IN_CELL,1);
  assert(!JSON.stringify(r).includes('hello'));
});
test('no rows warns accurately and parse type validation',()=>{
  assert.equal(codes('a,b').NO_DATA_ROWS,1);
  assert.throws(()=>parseCsv({notCsv:true}),e=>e.code==='NOT_TEXT');
  assert.throws(()=>analyzeCsv('a,b',{expectedColumns:'string'}),e=>e.code==='INVALID_EXPECTED_COLUMNS');
});
test('do not export row, field, filenames, or raw data in local report',()=>{
  const marker='my-private-pretend-token-do-not-log', header='my-private-header-column-888';
  const r=analyzeCsv(header+',second\n'+marker+',z');
  const serialized=JSON.stringify(r);
  assert.equal(r.privateCsvExcluded,true);
  assert(!serialized.includes(marker));
  assert(!serialized.includes(header));
  assert(!('rows' in r));
});
test('bounded issues preserve counts even after display cap',()=>{
  const r=analyzeCsv('x\n'+Array.from({length:180},()=>',foo').join('\n'));
  assert(r.issueCount>=180);
  assert(r.issues.length<=120);
  assert(r.truncatedIssues);
  assert(r.errors>=180);
  assert.equal(r.errors+r.warnings,r.issueCount);
});
test('request payload only on explicit caller path and <=32KiB; no network',()=>{
  const csv='a,b\n1,2';
  assert.deepEqual(paidRequestPayload(csv,['a','b']),{csvText:csv,expectedColumns:['a','b']});
  assert.deepEqual(paidRequestPayload(csv),{csvText:csv});
  assert.throws(()=>paidRequestPayload('a'.repeat(MAX_HOSTED_BYTES+1)),e=>e.code==='HOSTED_INPUT_EXCEEDS_32KB');
  assert.throws(()=>paidRequestPayload(''),e=>e.code==='EMPTY_CSV');
  assert.throws(()=>paidRequestPayload(csv,['']),e=>e.code==='INVALID_EXPECTED_COLUMNS');
  assert.equal(byteSize('é'),2);
});
test('no hidden upload/telemetry, wallet, form post or payment sign in browser code',()=>{
  const ui=read('assets/csv-checker-ui.mjs');
  const core=read('assets/csv-core.mjs');
  assert.doesNotMatch(ui,/\bfetch\(/);
  assert.doesNotMatch(ui,/navigator\.sendBeacon|XMLHttpRequest|window\.ethereum|eth_sendTransaction|eth_signTypedData/);
  assert.doesNotMatch(core,/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  assert.match(ui,/navigator\.clipboard\.writeText/);
  assert.match(ui,/share-consent/);
});
test('new EN and KO pages are discoverable static privacy-first client tools',()=>{
  const en=read('csv-checker/index.html'), ko=read('ko/csv-checker/index.html');
  for(const [page,path] of [[en,'/csv-checker/'],[ko,'/ko/csv-checker/']]){
    assert(page.includes('<link rel="canonical" href="https://livastic-vm2-primary-20260911.github.io'+path+'">'));
    assert(page.includes('src="/assets/csv-checker-ui.mjs"'));
    assert(page.includes("connect-src https://vm5-openapi-x402.onrender.com;"));
    assert(page.includes('src="/assets/csv-wallet-ui.mjs"'));
    assert(page.includes('id="wallet-pay"')&&page.includes('id="payment-consent"'));
    assert(page.includes('id="wallet-status"')&&page.includes('id="wallet-result"'));
    assert(page.includes('id="analyze"')&&page.includes('id="copy-paid"')&&page.includes('id="share-consent"'));
    assert(page.includes('https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint/blob/main/docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md'));
    assert(page.includes('0.005')&&page.includes('eip155:8453'));
    assert(!page.includes('google-analytics.com')&&!page.includes('gtag('));
    assert(!/<form\b/i.test(page));
    for(const [,tag] of page.matchAll(/(<a\b[^>]*>)/g))
      if(tag.includes('target="_blank"'))assert(tag.includes('rel="noopener noreferrer"'));
  }
});

test('Existing EN/KO homepage and paid API guides visibly link to the new working local checker',()=>{
  const en=read('index.html'),ko=read('ko/index.html');
  const guide=read('csv-preflight/index.html'),guideKo=read('ko/csv-preflight/index.html');
  assert(en.includes('href="/csv-checker/"'));
  assert(ko.includes('href="/ko/csv-checker/"'));
  assert(guide.includes('href="/csv-checker/"'));
  assert(guideKo.includes('href="/ko/csv-checker/"'));
  const links=read('sitemap.xml');
  assert(links.includes('https://livastic-vm2-primary-20260911.github.io/csv-checker/'));
  assert(links.includes('https://livastic-vm2-primary-20260911.github.io/ko/csv-checker/'));
});

test('Free checker source links point to the ACTUAL same-owner CSV analyzer, not unrelated YAML scanner',()=>{
  const exact='https://github.com/livastic-vm2-primary-20260911/livastic-vm2-primary-20260911.github.io/blob/main/assets/csv-core.mjs';
  for(const page of ['csv-checker/index.html','ko/csv-checker/index.html']){
    const html=read(page);
    assert(html.includes('href="'+exact+'"'));
    assert(!html.includes('href="https://github.com/livastic-vm2-primary-20260911/workflow-risk-check"'));
  }
});

test('the local CSV route keeps free checks separate from optional pinned wallet spending',()=>{
  const free=read('assets/csv-checker-ui.mjs');
  const paid=read('assets/csv-wallet-ui.mjs');
  const signer=read('assets/x402-wallet-pay.mjs');
  assert(!/\bfetch\(/.test(free));
  assert(!/eth_signTypedData/.test(free));
  assert.match(paid,/share-consent/);
  assert.match(paid,/payment-consent/);
  assert.match(paid,/window\.confirm/);
  assert.match(paid,/if\(busy\|\|signStarted\)return/);
  assert.match(paid,/button\.disabled=signStarted/);
  assert.match(signer,/PAYMENT-SIGNATURE/);
  assert.match(signer,/eth_signTypedData_v4/);
  assert(!/eth_sendTransaction|eth_sendRawTransaction|wallet_sendCalls/.test(signer));
  assert(!/localStorage|sessionStorage|document\.cookie/.test(paid+signer));
});
