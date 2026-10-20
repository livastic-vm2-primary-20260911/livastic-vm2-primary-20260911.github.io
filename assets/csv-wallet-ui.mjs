// Optional separate paid checkout interface. FREE local CSV scanner code never fetches,
// signs, uploads, or asks for a wallet. This code only runs on an explicit buyer click.
import {byteSize,MAX_HOSTED_BYTES} from './csv-core.mjs';
import {payCsvOnce,CheckoutError,SELLER,PAY_URL} from './x402-wallet-pay.mjs';

const $=id=>document.getElementById(id);
const ko=document.documentElement.lang==='ko';
const t=(en,kr)=>ko?kr:en;
let busy=false,signStarted=false;
const button=$('wallet-pay');
const status=$('wallet-status');
const report=$('wallet-result');
const statusSet=s=>{status.textContent=s;};
const getRequired=()=>{
  const text=$('required-columns').value.trim();
  return text?text.split(',').map(x=>x.trim()).filter(Boolean):[];
};
async function readBuyerCsv(){
  const source=$('csv-text').value;
  if(source.trim()){
    if(byteSize(source)>MAX_HOSTED_BYTES)throw Object.assign(new Error('HOSTED_INPUT_EXCEEDS_32KB'),{code:'HOSTED_INPUT_EXCEEDS_32KB'});
    return source;
  }
  const selected=$('csv-file').files?.[0];
  if(!selected)throw Object.assign(new Error('EMPTY_CSV'),{code:'EMPTY_CSV'});
  if(selected.size>MAX_HOSTED_BYTES)throw Object.assign(new Error('HOSTED_INPUT_EXCEEDS_32KB'),{code:'HOSTED_INPUT_EXCEEDS_32KB'});
  try{
    return new TextDecoder('utf-8',{fatal:true}).decode(await selected.arrayBuffer());
  }catch{throw Object.assign(new Error('INVALID_UTF8'),{code:'INVALID_UTF8'});}
}
function errorMessage(code){
  const known={
    NO_INJECTED_WALLET:t('No compatible EIP-1193 wallet is installed. Use the manual x402 guide.',
      'EIP-1193 호환 지갑이 없습니다. 수동 x402 구매 안내를 참고하세요.'),
    WALLET_MUST_BE_ON_BASE:t('Switch your wallet to Base Mainnet (chain 8453) yourself; no payment attempted.',
      '지갑에서 직접 Base 메인넷(8453)으로 변경하세요. 결제는 시도하지 않았습니다.'),
    WALLET_CHAIN_CHANGED:t('Wallet network changed; no payment authorized.',
      '지갑 네트워크가 변경되어 결제를 승인하지 않았습니다.'),
    UNTRUSTED_PAYMENT_TERMS:t('Quote does not match the fixed merchant, Base USDC and 0.005 USDC price. Payment refused.',
      '결제 금액·체인·수령인 정보가 기존 VM5 조건과 달라 결제를 거절했습니다.'),
    INVALID_CSV_INPUT:t('CSV is invalid. Nothing paid.',
      'CSV 형식이 잘못됐습니다. 결제하지 않았습니다.'),
    HOSTED_INPUT_EXCEEDS_32KB:t('Paid endpoint allows at most 32 KiB. Reduce input; no charge.',
      '유료 서비스는 최대 32 KiB까지만 지원합니다. 파일을 줄이세요. 결제하지 않았습니다.'),
    EMPTY_CSV:t('Enter nonempty CSV first. Nothing paid.',
      '비어 있지 않은 CSV를 먼저 입력하세요. 결제하지 않았습니다.'),
    INVALID_UTF8:t('Please export the CSV in UTF-8. Nothing paid.',
      'CSV를 UTF-8로 변환한 뒤 다시 시도하세요. 결제하지 않았습니다.'),
    WALLET_SIGNATURE_CANCELLED_OR_FAILED:t('Wallet signature was not confirmed. No new signature will be requested on this page.',
      '지갑 서명이 완료되지 않았습니다. 이 페이지에서 추가 서명을 요청하지 않습니다.'),
    SIGNED_SETTLEMENT_UNKNOWN_DO_NOT_RETRY:t('Signed authorization may have been submitted. Settlement is NOT confirmed. Do not sign or pay twice; check your wallet and contact the merchant.',
      '서명된 결제 요청의 처리 결과를 확인하지 못했습니다. 두 번 서명하거나 결제하지 마세요. 지갑 기록과 판매자에게 확인하세요.'),
    API_UNREACHABLE_NO_SIGNATURE:t('Paid server unreachable; no signature or charge.',
      '유료 서버에 접속하지 못했습니다. 서명·결제하지 않았습니다.'),
    EXPECTED_402_NO_SIGNATURE:t('Unexpected server quote. No signature or payment attempted.',
      '예상과 다른 견적 응답입니다. 서명·결제하지 않았습니다.'),
  };
  return known[code]||t('Checkout stopped safely. If you signed, do not repeat without checking settlement.',
    '결제 절차가 중단됐습니다. 이미 서명했다면 정산 확인 전 재서명하지 마세요.');
}
function showPaid(outcome){
  report.replaceChildren();
  const p=document.createElement('p');
  p.textContent=t('Verified signed payment response and CSV API report: 0.005 USDC on Base. ',
    'Base에서 0.005 USDC 결제·CSV 분석 응답을 확인했습니다. ');
  report.append(p);
  const a=document.createElement('a');
  a.href='https://basescan.org/tx/'+outcome.transaction;
  a.textContent=t('Check on-chain transaction ↗','실제 온체인 거래 확인 ↗');
  a.target='_blank';a.rel='noopener noreferrer';report.append(a);
  const metrics=document.createElement('p');
  const value=Object.entries(outcome.metrics).map(([key,v])=>key+': '+v).join(' · ');
  metrics.textContent=value||t('See your paid API response using the separate buyer guide.',
    '자세한 응답은 별도 구매자 가이드에서 확인하세요.');
  report.append(metrics);
  // Deliberately no raw CSV, payer wallet, signature, nonce or full response rendered.
}
statusSet(t('Optional wallet checkout is idle; free checking does not send your CSV.',
  '선택형 지갑 결제는 대기 중입니다. 무료 검사는 CSV를 전송하지 않습니다.'));
button.addEventListener('click',async()=>{
  if(busy||signStarted)return;
  if(!$('share-consent').checked||!$('payment-consent').checked){
    statusSet(t('Both external CSV consent and explicit 0.005 USDC payment consent are required.',
      'CSV 외부 처리 동의와 0.005 USDC 결제 동의를 각각 체크하세요.'));
    return;
  }
  if(!window.isSecureContext){
    statusSet(t('A secure HTTPS browser context is required for wallet payments.',
      '지갑 결제에는 보안 HTTPS 환경이 필요합니다.'));
    return;
  }
  if(!window.ethereum||typeof window.ethereum.request!=='function'){
    statusSet(errorMessage('NO_INJECTED_WALLET'));return;
  }
  busy=true;button.disabled=true;
  report.replaceChildren();
  try{
    const csv=await readBuyerCsv();
    const required=getRequired();
    statusSet(t('Requesting the exact merchant quote. Your authorized CSV will reach the separate VM5 server once, but no payment signature yet.',
      '기존 VM5 서버에 허가받은 CSV를 보내 정확한 견적을 받습니다. 아직 결제 서명은 없습니다.'));
    const result=await payCsvOnce({
      csvText:csv,expectedColumns:required,provider:window.ethereum,
      fetchFn:(url,options)=>fetch(url,{...options,mode:'cors',credentials:'omit',cache:'no-store'}),
      cryptoSource:crypto,nowSeconds:()=>Math.floor(Date.now()/1000),
      confirmPayment:async details=>window.confirm(t(
        'Authorize a ONE-TIME 0.005 USDC transfer on Base Mainnet (8453) to existing VM5 merchant '+SELLER+
        '?\n\nYour CSV was already sent to '+PAY_URL+' for an unpaid quote. Wallet signature CAN move real USDC. Decline to pay nothing. Never approve a different amount, chain, or recipient.',
        '실제 자금 이동을 승인하시겠습니까?\n금액: 0.005 USDC (단 1회)\n체인: Base 8453\n판매자: '+SELLER+
        '\n\nCSV는 견적 요청으로 VM5에 전송됐습니다. 지갑 서명은 실제 USDC를 이동시킬 수 있습니다. 동의하지 않으면 취소하세요.'
      )),
      onSignStarted:()=>{signStarted=true;statusSet(t(
        'Wallet signature requested. If final status is uncertain, DO NOT sign again.',
        '지갑 서명을 요청했습니다. 결과가 불확실하면 다시 서명하지 마세요.'
      ));}
    });
    if(result.status==='cancelled_no_signature'){
      statusSet(t('Payment declined; no signature was requested.',
        '결제를 취소했습니다. 서명 요청은 하지 않았습니다.'));
    }else if(result.status==='settled_and_delivered'){
      statusSet(t('Paid API delivered a validated settlement receipt. No repeat charge will be requested.',
        '유료 API의 결제 정산 증빙을 확인했습니다. 재결제는 요청하지 않습니다.'));
      showPaid(result);
    }else statusSet(t('Unknown result. Do not retry.', '알 수 없는 결과입니다. 재시도하지 마세요.'));
  }catch(error){
    // Keep response data, CSV source, signature, address, nonce out of UI/logs.
    statusSet(errorMessage(error?.code||'UNKNOWN'));
  }finally{
    busy=false;
    // After any signature request, do not enable again in this session.
    button.disabled=signStarted;
  }
});
