import {MAX_LOCAL_BYTES, MAX_HOSTED_BYTES, analyzeCsv, paidRequestPayload, byteSize} from './csv-core.mjs';

// This module performs client-side event handling only: no network calls or analytics,
// no wallet signing, no uploads, and no platform credentials.
const $ = id => document.getElementById(id);
const lang = document.documentElement.lang === 'ko' ? 'ko' : 'en';
const dict = {
  en:{
    ready:'Ready. Your CSV is never sent to this site.',
    result:'Local scan complete. {rows} data rows, {cols} columns, {issues} findings.',
    error:'Local scan refused: {code} (line {line}). Nothing uploaded.',
    fileSize:'Choose a UTF-8 CSV smaller than 256 KiB.',
    invalidUtf8:'The file was not valid UTF-8. Export it as UTF-8 CSV first.',
    demo:'Fictional example loaded. Click Analyze locally.',
    clean:'No findings in this bounded static check. Import rules may still differ.',
    noResult:'Run a local check before downloading its findings.',
    downloaded:'Local report downloaded without CSV data.',
    consent:'Check the explicit external-sharing consent box first. Nothing is automatically sent.',
    copied:'Buyer-owned JSON copied to the clipboard. No upload or payment occurred.',
    clipboard:'Clipboard unavailable. Use a secure browser and try again.',
    paidTooLarge:'Hosted input allows at most 32 KiB. Reduce the file before opting into paid processing.',
    wrongInput:'Only UTF-8 files are supported.',
    missing:'Enter a CSV or choose a local file.',
  },
  ko:{
    ready:'준비됐습니다. CSV 원본은 사이트로 전송하지 않습니다.',
    result:'로컬 분석 완료: 데이터 {rows}행, {cols}열, 발견 {issues}건.',
    error:'검사 중단: {code} (줄 {line}). 업로드한 데이터는 없습니다.',
    fileSize:'256 KiB 미만의 UTF-8 CSV를 선택하세요.',
    invalidUtf8:'UTF-8로 해독할 수 없습니다. UTF-8 CSV로 다시 저장하세요.',
    demo:'가상 예시를 불러왔습니다. 브라우저에서 검사 버튼을 누르세요.',
    clean:'제한된 정적 검사에서 발견사항이 없습니다. 실제 가져오기 규칙은 다를 수 있습니다.',
    noResult:'먼저 브라우저에서 검사한 뒤 결과를 내려받으세요.',
    downloaded:'원본 CSV가 포함되지 않은 로컬 결과 JSON을 저장했습니다.',
    consent:'외부 서비스 공유 동의란을 먼저 선택하세요. 자동 전송은 하지 않습니다.',
    copied:'원본이 포함된 구매자 JSON을 클립보드에 복사했습니다. 업로드·결제되지 않았습니다.',
    clipboard:'클립보드를 사용할 수 없습니다. 보안 연결의 브라우저에서 다시 시도하세요.',
    paidTooLarge:'외부 유료 API는 32 KiB 이하의 CSV만 허용합니다.',
    wrongInput:'UTF-8 파일만 지원합니다.',
    missing:'CSV를 입력하거나 로컬 파일을 선택하세요.',
  }
}[lang];
const text = (key,v={}) => Object.entries(v).reduce((s,[name,val])=>
  s.replace('{'+name+'}',String(val)),dict[key]);

let lastReport;
const setStatus = s => { $('status').textContent=s; };
setStatus(text('ready'));

$('demo').addEventListener('click',()=>{
  $('csv-text').value='email,amount,date,note\ndemo@example.com,12.50,2026-10-20,ok\ndemo@example.com,12.50,2026-10-20,ok\n,"=SUM(1,2)",2026-10-20,warning';
  $('csv-file').value='';
  $('required-columns').value='email,amount,date';
  lastReport=undefined;
  $('findings').replaceChildren();
  setStatus(text('demo'));
});
async function getInput(){
  const raw=$('csv-text').value;
  if(raw.trim()){
    if(byteSize(raw)>MAX_LOCAL_BYTES)throw Object.assign(new Error('LOCAL_FILE_TOO_LARGE'),{code:'LOCAL_FILE_TOO_LARGE'});
    return raw;
  }
  const file=$('csv-file').files?.[0];
  if(!file)throw Object.assign(new Error('EMPTY_CSV'),{code:'EMPTY_CSV'});
  if(file.size>MAX_LOCAL_BYTES)throw Object.assign(new Error('LOCAL_FILE_TOO_LARGE'),{code:'LOCAL_FILE_TOO_LARGE'});
  try{
    return new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
  }catch {
    throw Object.assign(new Error('INVALID_UTF8'),{code:'INVALID_UTF8'});
  }
}
function expectedColumns() {
  const raw=$('required-columns').value.trim();
  return raw ? raw.split(',').map(t=>t.trim()).filter(Boolean) : [];
}
function render(report){
  const box=$('findings');
  box.replaceChildren();
  const summary=document.createElement('p');
  summary.className='result-summary';
  summary.textContent=text('result',{rows:report.dataRows,cols:report.headerColumns,issues:report.issueCount});
  box.append(summary);
  const items=document.createElement('ul');
  items.className='findings-list';
  for(const entry of report.issues) {
    const li=document.createElement('li');
    li.className=entry.severity==='error'?'problem':'caution';
    li.textContent=(entry.severity==='error'?'ERROR':'CHECK')+' · '+entry.code+
      ' · '+(lang==='ko'?'행 ':'row ')+entry.row+(entry.column?' · '+(lang==='ko'?'열 ':'col ')+entry.column:'');
    items.append(li);
  }
  box.append(items);
  if(report.issueCount===0)setStatus(text('clean'));
  else setStatus(summary.textContent);
  if(report.truncatedIssues){
    const p=document.createElement('p');
    p.textContent=lang==='ko'?'표시 상한 120건을 초과해 일부 항목을 생략했습니다.':'Findings exceed the 120-item display cap; some are omitted.';
    box.append(p);
  }
}
$('analyze').addEventListener('click',async()=>{
  try{
    const raw=await getInput();
    lastReport=analyzeCsv(raw,{expectedColumns:expectedColumns()});
    render(lastReport);
  }catch(error){
    lastReport=undefined;
    $('findings').replaceChildren();
    setStatus(text('error',{code:error.code||'INVALID_CSV',line:error.line||'?'}));
  }
});
$('clear').addEventListener('click',()=>{
  $('csv-text').value='';$('csv-file').value='';$('required-columns').value='';
  $('share-consent').checked=false;$('payment-consent').checked=false;lastReport=undefined;
  $('findings').replaceChildren();setStatus(text('ready'));
});
$('download').addEventListener('click',()=>{
  if(!lastReport){setStatus(text('noResult'));return;}
  const blob=new Blob([JSON.stringify(lastReport,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='csv-local-preflight-no-user-data.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  setStatus(text('downloaded'));
});
$('copy-paid').addEventListener('click',async()=>{
  if(!$('share-consent').checked){setStatus(text('consent'));return;}
  try{
    const csv=await getInput();
    if(byteSize(csv)>MAX_HOSTED_BYTES){setStatus(text('paidTooLarge'));return;}
    const payload=paidRequestPayload(csv,expectedColumns());
    await navigator.clipboard.writeText(JSON.stringify(payload));
    // This explicit click copies the buyer's raw data for their own x402-capable
    // client. It does NOT send it to any endpoint, sign or pay.
    setStatus(text('copied'));
  }catch(error){
    if(error.code)setStatus(text('error',{code:error.code,line:error.line||'?'}));
    else setStatus(text('clipboard'));
  }
});
