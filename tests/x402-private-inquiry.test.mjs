import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const get=(name)=>fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");
const form="https://docs.google.com/forms/d/e/1FAIpQLScomGy3-YIsF-xMFYc-RaRAuA3XbrHdNe2GueYyL5ApHJ9OQg/viewform";
test("direct private firstparty owned buyer inquiry appears as separate opt-in contact on free checker and bilingual owner landing",()=>{
  for(const file of ["x402-trace/index.html","index.html","ko/index.html"]){
    const html=get(file);
    assert.equal(html.split(form).length-1,1,file+" private form once");
    assert(html.includes('href="'+form+'" target="_blank" rel="noopener noreferrer"'),file+" safe external");
    assert(html.includes("29 "),file+" actual prior fixed offer price");
  }
  assert(get("x402-trace/index.html").includes('id="private-qa-inquiry"'));
  assert.match(get("x402-trace/index.html"),/no Google login required/);
});
test("do not confuse an inquiry with payment, secret upload or settled USDC",()=>{
  const h=get("x402-trace/index.html");
  assert.match(h,/Submitting is NOT an order/);
  assert.match(h,/Google may process submitted information/);
  assert.match(h,/No personal data leaves this browser-local free checker until you independently choose/);
  assert.match(h,/form-action 'none'/);
  assert.match(h,/connect-src 'none'/);
  assert.match(h,/View the separate 29 USDC fixed-price marketplace offer/);
  assert.match(h,/clawlancer.ai\/marketplace\/84efd440-a7cd-4932-8d5d-415e7f05d33b/);
  assert(h.includes("mailto:onecursor1@gmail.com"));
});
test("CSS private contact paragraph and README accurately describe four non-custodial fields",()=>{
  const css=get("x402-trace/styles.css"),readme=get("x402-trace/README.md");
  assert.match(css,/\.privacy-note/);
  assert(readme.includes(form));
  for(const text of ["reply email","public URL","nonbinding","NOT an order","buyer responses0"])assert(readme.includes(text),text);
});
