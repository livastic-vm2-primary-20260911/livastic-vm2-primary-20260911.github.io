import {analyze,EXAMPLES} from "./engine.mjs";
const $=id=>document.getElementById(id);
const box=$("trace"),err=$("error"),results=$("results"),reports=$("reports"),download=$("download");
let latest=null;
function fail(message){
 err.textContent=String(message).slice(0,300);err.hidden=false;results.hidden=true;download.disabled=true;latest=null;
}
function print(report){
 err.hidden=true;reports.replaceChildren();results.hidden=false;
 $("summary").textContent=report.requestCount+" requests · "+report.eventCount+" synthetic events";
 for(const row of report.requests){
  const section=document.createElement("section");section.className="report";
  const title=document.createElement("h3");title.textContent=row.request+" — "+row.status;section.append(title);
  const counts=document.createElement("p");
  counts.textContent=row.claimedSettlementEvents+" settlement claims · "+row.distinctPaymentLabels+" payment labels · "+row.deliveryEntries+" deliveries";
  section.append(counts);
  for(const issue of row.findings){
   const f=document.createElement("div");f.className="finding "+issue.severity;
   const name=document.createElement("strong");name.textContent=issue.code;
   const sev=document.createElement("small");sev.textContent=issue.severity+" · synthetic evidence only";
   const detail=document.createElement("p");detail.textContent=issue.detail;
   f.append(name,sev,detail);section.append(f);
  }
  reports.append(section);
 }
}
function inspect(){
 try{
  const found=analyze(box.value);
  latest=found;print(found);download.disabled=false;
 }catch(e){fail(e.message)}
}
for(const button of document.querySelectorAll("button[data-example]")){
 button.addEventListener("click",()=>{
  box.value=JSON.stringify(EXAMPLES[button.dataset.example],null,2);
  results.hidden=true;err.hidden=true;download.disabled=true;latest=null;
 });
}
$("inspect").addEventListener("click",inspect);
$("clear").addEventListener("click",()=>{
 box.value="";reports.replaceChildren();results.hidden=true;err.hidden=true;download.disabled=true;latest=null;
});
download.addEventListener("click",()=>{
 if(!latest)return;
 const file=new Blob([JSON.stringify(latest,null,2)+"\n"],{type:"application/json"});
 const uri=URL.createObjectURL(file);
 const anchor=document.createElement("a");anchor.href=uri;anchor.download="x402-fictional-retry-check.json";
 document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(uri);
});
box.value=JSON.stringify(EXAMPLES.missingDelivery,null,2);
