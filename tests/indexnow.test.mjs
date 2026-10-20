import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {makePayload,SITE,ENDPOINT} from "../tools/indexnow.mjs";

test("The root-level IndexNow key scopes six original canonical business and guide pages",()=>{
 const p=makePayload();
 assert.equal(p.host,"livastic-vm2-primary-20260911.github.io");
 assert.equal(p.urlList.length,6);
 assert.deepEqual(p.urlList,[SITE,SITE+"ko/",SITE+"guides/pull-request-target-november-2026/",SITE+"ko/guides/pull-request-target-2026/",SITE+"csv-preflight/",SITE+"ko/csv-preflight/"]);
 assert.match(p.keyLocation,/\.github\.io\/[a-f0-9]{32}\.txt$/);
 assert.equal(ENDPOINT,"https://api.indexnow.org/indexnow");
});
test("The key file content matches its public basename",()=>{
 const files=fs.readdirSync(new URL("../",import.meta.url));
 const keys=files.filter(x=>/^[a-f0-9]{32}\.txt$/.test(x));
 assert.equal(keys.length,1);
 const key=keys[0].replace(".txt","");
 assert.equal(fs.readFileSync(new URL("../"+keys[0],import.meta.url),"utf8").trim(),key);
});
test("Indexer will never be directed to unrelated domains",()=>{
 const f=fs.mkdtempSync(path.join(os.tmpdir(),"vm2-root-indexnow-"));
 const key="f".repeat(32);
 try{
  fs.writeFileSync(path.join(f,key+".txt"),key);
  fs.writeFileSync(path.join(f,"sitemap.xml"),"<loc>https://attacker.example/ko/</loc>");
  assert.throws(()=>makePayload(f),/outside this project/);
 }finally{fs.rmSync(f,{recursive:true,force:true});}
});
test("No unknown external assets or scripts loaded in the business homepage",()=>{
 const css=fs.readFileSync(new URL("../assets/style.css",import.meta.url),"utf8");
 assert(!css.includes("@import"));
 const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert(!/https:\/\/fonts\.googleapis\.com/.test(html));
});
