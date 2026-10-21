const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('/srv/multi-vm-agent/workspace/make_money/work/qa-manifestscope-20261021/node_modules/playwright-core');
const home='/srv/multi-vm-agent/workspace/make_money/work/vm2-x402-plan-verify-parity-20261021';
const types={'.html':'text/html; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const allowed=new Set(['/x402-trace/index.html','/x402-trace/engine.mjs','/x402-trace/app.mjs','/x402-trace/styles.css','/x402-trace/plan-seam.css','/x402-trace/plan-seam.mjs','/x402-trace/plan-ui.mjs']);
const server=http.createServer((req,res)=>{
 const uri=(req.url||'').split('?')[0];
 const u=uri==='/x402-trace/'?'/x402-trace/index.html':uri;
 if(req.method!=='GET'||!allowed.has(u)){res.writeHead(404);res.end('not found');return}
 const filename=path.join(home,u);
 res.setHeader('Content-Type',types[path.extname(filename)]||'text/plain');res.end(fs.readFileSync(filename));
});
const results={vm:'vm-02',scope:'original local-only synthetic Chrome E2E',passCount:0,widths:[],privacyErrors:[],errors:[],newMoneyClaim:false};
(async()=>{
 let browser;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
  for(const width of [320,390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:880}});const page=await ctx.newPage();
   const requests=[],errors=[];
   page.on('request',request=>requests.push(request.url()));
   page.on('pageerror',error=>errors.push(error.message));
   const response=await page.goto(origin+'/x402-trace/',{waitUntil:'load',timeout:15000});
   assert.equal(response.status(),200);results.passCount++;
   assert.equal(await page.locator('#inspect').isVisible(),true);results.passCount++;
   assert.match(await page.locator('#trace').inputValue(),/missingDelivery|jobA|payA/);results.passCount++;
   await page.locator('button[data-example="missingDelivery"]').click();
   await page.locator('#inspect').click();
   assert.equal(await page.locator('#results').isVisible(),true);results.passCount++;
   assert.match(await page.locator('#reports').innerText(),/SETTLED_NO_DELIVERY_ENTRY/);results.passCount++;
   assert.match(await page.locator('#reports').innerText(),/RETRY_AFTER_SETTLEMENT_CLAIM/);results.passCount++;
   assert.equal(await page.locator('#download').isEnabled(),true);results.passCount++;
   await page.locator('button[data-example="doublePayment"]').click();
   await page.locator('#inspect').click();
   assert.match(await page.locator('#reports').innerText(),/POSSIBLE_DUPLICATE_SETTLEMENT/);results.passCount++;
   await page.locator('button[data-example="matchingClaims"]').click();
   await page.locator('#inspect').click();
   assert.match(await page.locator('#reports').innerText(),/NO_CONTRADICTION_DETECTED/);results.passCount++;
   assert.match(await page.locator('#results').innerText(),/NOT PAYMENT PROOF/);results.passCount++;
   await page.locator('#trace').fill('{not-valid-json');
   await page.locator('#inspect').click();
   assert.equal(await page.locator('#error').isVisible(),true);results.passCount++;
   assert.equal(await page.locator('#results').isVisible(),false);results.passCount++;
   assert.equal(await page.locator('#download').isEnabled(),false);results.passCount++;
   await page.locator('#clear').click();
   assert.equal(await page.locator('#trace').inputValue(),'');results.passCount++;
   await page.locator('[data-plan-example="brokenSubscription"]').click();
   await page.locator('#plan-inspect').click();
   assert.equal(await page.locator('#plan-results').isVisible(),true);results.passCount++;
   assert.match(await page.locator('#plan-findings').innerText(),/CHALLENGE_VS_VERIFIER_MISMATCH/);results.passCount++;
   assert.match(await page.locator('#plan-findings').innerText(),/SHARED_VERIFIER_DEFAULT_ACROSS_MULTIPLE_PRICES/);results.passCount++;
   assert.match(await page.locator('#plan-summary').innerText(),/2 high-risk mismatches/);results.passCount++;
   assert.equal(await page.locator('#plan-download').isEnabled(),true);results.passCount++;
   await page.locator('[data-plan-example="correctedPrices"]').click();
   await page.locator('#plan-inspect').click();
   assert.equal(await page.locator('#plan-results').isVisible(),true);results.passCount++;
   assert.match(await page.locator('#plan-findings').innerText(),/AMOUNTS_MATCH_IN_THIS_SCENARIO_ONLY/);results.passCount++;
   assert.doesNotMatch(await page.locator('#plan-findings').innerText(),/CHALLENGE_VS_VERIFIER_MISMATCH/);results.passCount++;
   await page.locator('#plan-input').fill('{INVALID');
   await page.locator('#plan-inspect').click();
   assert.equal(await page.locator('#plan-error').isVisible(),true);results.passCount++;
   assert.equal(await page.locator('#plan-results').isVisible(),false);results.passCount++;
   assert.equal(await page.locator('#plan-download').isEnabled(),false);results.passCount++;
   await page.locator('#plan-clear').click();
   assert.equal(await page.locator('#plan-input').inputValue(),'');results.passCount++;
   const m=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,win:innerWidth,policy:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content}));
   assert.ok(m.doc<=m.win+1,'horizontal overflow at width='+width+' values '+m.doc+'/'+m.win);results.passCount++;
   assert.match(m.policy,/connect-src 'none'/);results.passCount++;
   assert.deepEqual(errors,[]);results.passCount++;
   assert.equal(requests.filter(u=>!u.startsWith(origin+'/')).length,0);results.passCount++;
   results.widths.push({width,pass:true,overflowPx:Math.max(0,m.doc-m.win),externalRequests:0,errors:errors.length});
   await ctx.close();
  }
 }catch(err){results.errors.push(err.stack||err.message);process.exitCode=1}
 finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
  console.log(JSON.stringify(results,null,2));
 }
})().catch(err=>{console.error(err);process.exitCode=1});
