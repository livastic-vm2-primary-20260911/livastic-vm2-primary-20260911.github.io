#!/usr/bin/env node
/** IndexNow notices for this project's own canonical GitHub Pages URLs only.
 * A 200 means submitted, 202 means pending key verification, not indexed.
 * Run without --submit to validate/dry-run; never submit unrelated github.io paths.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const SITE = "https://livastic-vm2-primary-20260911.github.io/";
const DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export const ENDPOINT = "https://api.indexnow.org/indexnow";
const KEY_RE = /^[a-f0-9]{32}\.txt$/;
const hostname = new URL(SITE).hostname;

export function makePayload(dir=DIRECTORY){
  const candidates=fs.readdirSync(dir).filter(name=>KEY_RE.test(name));
  if(candidates.length!==1)throw Error("Expected exactly one root-owner 32-hex IndexNow key file");
  const key=candidates[0].slice(0,-4);
  if(fs.readFileSync(path.join(dir,candidates[0]),"utf8").trim()!==key)
    throw Error("IndexNow key file must contain only its own filename stem");
  const raw=fs.readFileSync(path.join(dir,"sitemap.xml"),"utf8");
  const urls=[...raw.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  if(urls.length<1||urls.length>25||new Set(urls).size!==urls.length)
    throw Error("Sitemap needs 1-25 unique, current canonical URLs");
  for(const url of urls){
    let parsed;
    try{parsed=new URL(url)}catch{throw Error("Bad URL in sitemap")}
    if(parsed.origin!==new URL(SITE).origin||!url.startsWith(SITE)||parsed.search||parsed.hash)
      throw Error("Refusing URL outside this project site's subfolder");
  }
  const keyLocation=SITE+candidates[0];
  return {host:hostname,key,keyLocation,urlList:urls};
}
const run=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(run){
  const submit=process.argv.includes("--submit");
  if(process.argv.length>3||process.argv.some((v,i)=>i>1&&v!=="--submit"))
    throw Error("Only optional --submit is supported; without it the command is a dry run.");
  const body=makePayload();
  if(!submit){
    console.log(JSON.stringify({mode:"dry-run",count:body.urlList.length,valid:true,
      keyLocation:body.keyLocation,host:body.host},null,2));
  } else {
    // Validate that the deployed project owns the key and all sitemapped URLs
    // before dispatching one payment-free IndexNow batch.
    const keyResp=await fetch(body.keyLocation,{signal:AbortSignal.timeout(12000)});
    if(!keyResp.ok||((await keyResp.text()).trim()!==body.key))
      throw Error("Hosted key file is not live and exact. No notification dispatched.");
    for(const url of body.urlList){
      const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:"follow"});
      if(!response.ok)throw Error("Not publishing a nonexistent URL: "+new URL(url).pathname);
    }
    const result=await fetch(ENDPOINT,{method:"POST",headers:{
      "Content-Type":"application/json; charset=utf-8",
      "User-Agent":"Workflow-Risk-Check-authorized-site-notice/1.0"
    },body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const responseText=(await result.text()).slice(0,240);
    console.log(JSON.stringify({mode:"submit",endpoint:ENDPOINT,submittedUrls:body.urlList.length,
      status:result.status,meaning:result.status===200?"submission received (not necessarily indexed)":
        result.status===202?"received, key verification pending (not indexed)":"error: see response",
      response:responseText},null,2));
    if(result.status!==200&&result.status!==202)process.exitCode=1;
  }
}
