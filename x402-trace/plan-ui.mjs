import {inspectPlanMatrix,PLAN_EXAMPLES} from "./plan-seam.mjs";
// UI reports only user-supplied invented labels; never calls a wallet or merchant.
const $=id=>document.getElementById(id);
const source=$("plan-input"),results=$("plan-results"),error=$("plan-error"),body=$("plan-findings");
const count=$("plan-summary"),download=$("plan-download");
let report=null;
function reset(){
 results.hidden=true;error.hidden=true;error.textContent="";body.replaceChildren();report=null;download.disabled=true;
}
for(const button of document.querySelectorAll("[data-plan-example]")){
 button.addEventListener("click",()=>{
  source.value=JSON.stringify(PLAN_EXAMPLES[button.dataset.planExample],null,2);
  reset();
 });
}
$("plan-inspect").addEventListener("click",()=>{
 try{
  const analysis=inspectPlanMatrix(source.value);
  reset();
  report=analysis;
  count.textContent=String(report.planCount)+" invented plans, "+String(report.highRiskPlanCount)+" high-risk mismatches";
  for(const row of report.planFindings) {
   const card=document.createElement("article");card.className="plan-card";
   const heading=document.createElement("h4");heading.textContent=row.plan+" · "+row.severity;
   const prices=document.createElement("p");prices.textContent="Displayed "+row.displayedUSDC+
    " → HTTP 402 "+row.challengeUSDC+" → Verifier "+row.verifyUSDC;
   card.append(heading,prices);
   for(const note of row.findings) {
    const warn=document.createElement("p");warn.className="plan-warning";
    warn.textContent=note.code+": "+note.detail;
    card.append(warn);
   }
   body.append(card);
  }
  if(report.crossChecks.length)for(const finding of report.crossChecks){
   const note=document.createElement("p");note.className="plan-global";
   note.textContent=finding.code+": "+finding.detail;body.append(note);
  }
  const advice=document.createElement("p");advice.className="plan-note";advice.textContent=report.testRecipe;
  body.append(advice);
  results.hidden=false;download.disabled=false;
 } catch(e) {
  reset();error.textContent=String(e.message||"Unknown input error").slice(0,350);error.hidden=false;
 }
});
$("plan-clear").addEventListener("click",()=>{
 source.value="";reset();
});
download.addEventListener("click",()=>{
 if(!report)return;
 const file=new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
 const href=URL.createObjectURL(file);const a=document.createElement("a");
 a.href=href;a.download="x402-fictional-plan-verification-seam.json";
 document.body.append(a);a.click();a.remove();URL.revokeObjectURL(href);
});
source.value=JSON.stringify(PLAN_EXAMPLES.brokenSubscription,null,2);
