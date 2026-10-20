// Browser-local CSV preflight. No network APIs, account access, or payload logging.
// Public MIT reference implementation; heuristic report is NOT import certification.
export const MAX_LOCAL_BYTES = 256 * 1024;
export const MAX_HOSTED_BYTES = 32 * 1024;
const MAX_ROWS = 5001;
const MAX_COLUMNS = 80;
const MAX_ISSUES = 120;
const FORMULA_START = /^[\t\r\n\s]*[=+\-@＝＋－＠]/u;
const bad = (code, line=0) => Object.assign(new Error(code),{code,line});

export function byteSize(source) {
  return new TextEncoder().encode(String(source)).byteLength;
}

export function parseCsv(source) {
  if (typeof source !== 'string') throw bad('NOT_TEXT');
  const size = byteSize(source);
  if (size===0) throw bad('EMPTY_CSV');
  if (size>MAX_LOCAL_BYTES) throw bad('LOCAL_FILE_TOO_LARGE');
  const input = source.charCodeAt(0)===0xfeff ? source.slice(1) : source;
  const records=[]; let cells=[]; let field='';
  let state='start'; // start, bare, quoted, after_quote
  let line=1, rowStart=1, justEnded=false;
  function cellDone() {
    cells.push(field); field=''; state='start';
    if(cells.length>MAX_COLUMNS) throw bad('TOO_MANY_COLUMNS',rowStart);
  }
  function rowDone() {
    records.push({line:rowStart,cells});
    if(records.length>MAX_ROWS) throw bad('TOO_MANY_ROWS',rowStart);
    cells=[]; rowStart=line;
  }
  for(let i=0;i<input.length;i++) {
    const c=input[i]; justEnded=false;
    // Always normalize CRLF and CR outside/inside quoted fields.
    if (c==='\n'||c==='\r') {
      if(c==='\r'&&input[i+1]==='\n') i++;
      if(state==='quoted') {
        field+='\n'; line++; continue;
      }
      cellDone(); line++; rowDone(); justEnded=true; continue;
    }
    if(c===',') {
      if(state==='quoted'){field+=c; continue;}
      cellDone(); continue;
    }
    if(c==='"') {
      if(state==='start'){state='quoted';continue;}
      if(state==='quoted'){
        if(input[i+1]==='"'){field+='"';i++;continue;}
        state='after_quote'; continue;
      }
      throw bad('INVALID_QUOTE',line);
    }
    if(state==='after_quote') throw bad('TRAILING_TEXT_AFTER_QUOTE',line);
    field+=c;
    if(state==='start')state='bare';
    if(field.length>MAX_LOCAL_BYTES) throw bad('CELL_TOO_LARGE',line);
  }
  if(state==='quoted') throw bad('UNCLOSED_QUOTE',line);
  if(!justEnded || input.length===0) {
    cellDone();rowDone();
  }
  return records;
}

export function analyzeCsv(source, options={}) {
  const rows=parseCsv(source);
  const columns=rows[0].cells;
  const expected=options.expectedColumns ?? [];
  if(!Array.isArray(expected)||expected.length>40||
     expected.some(x=>typeof x!=='string'||x.length>128))
    throw bad('INVALID_EXPECTED_COLUMNS');
  const issues=[];const counts={}; let truncatedIssues=false;
  let errors=0, warnings=0;
  const add=(severity,code,row,col=0)=>{
    counts[code]=(counts[code]||0)+1;
    if(severity==='error')errors++;
    else warnings++;
    if(issues.length<MAX_ISSUES)issues.push({severity,code,row,column:col});
    else truncatedIssues=true;
  };
  if(columns.length===1 && columns[0].includes(';')) add('warning','POSSIBLE_SEMICOLON_DELIMITER',1);
  const seenCols=new Set();
  for(let i=0;i<columns.length;i++) {
    const normalized=columns[i].trim().toLocaleLowerCase();
    if(!normalized)add('error','EMPTY_HEADER',1,i+1);
    else if(seenCols.has(normalized))add('error','DUPLICATE_HEADER',1,i+1);
    seenCols.add(normalized);
  }
  const headers=new Set(columns.map(c=>c.trim().toLocaleLowerCase()));
  for(let i=0;i<expected.length;i++) {
    if(!headers.has(expected[i].trim().toLocaleLowerCase()))add('error','REQUIRED_HEADER_MISSING',1,i+1);
  }
  if(rows.length===1)add('warning','NO_DATA_ROWS',1);
  const seenRows=new Set();let nonblankRows=0;
  for(let i=1;i<rows.length;i++) {
    const row=rows[i];let parts=row.cells;
    if(parts.length===1&&parts[0].trim()===''){
      add('warning','EMPTY_DATA_ROW',row.line);continue;
    }
    nonblankRows++;
    if(parts.length!==columns.length)add('error','COLUMN_COUNT_MISMATCH',row.line);
    const digest=JSON.stringify(parts);
    if(seenRows.has(digest))add('warning','DUPLICATE_DATA_ROW',row.line);
    else seenRows.add(digest);
    for(let col=0;col<parts.length;col++) {
      const value=parts[col];
      if(!value.trim())add('warning','EMPTY_CELL',row.line,col+1);
      if(FORMULA_START.test(value))add('warning','POSSIBLE_SPREADSHEET_FORMULA',row.line,col+1);
      if(value.includes('\u0000'))add('error','NUL_IN_CELL',row.line,col+1);
    }
  }
  return {
    format:'CSV-local-preflight-v1',
    inputBytes:byteSize(source),
    headerColumns:columns.length,
    dataRows:nonblankRows,
    physicalLines:1+(source.match(/\r\n|\r|\n/g)||[]).length,
    issueCount:Object.values(counts).reduce((a,b)=>a+b,0),
    errors,warnings,
    issueCodes:counts, issues, truncatedIssues,
    // This report intentionally NEVER embeds CSV headers, cell contents, filename,
    // raw rows, or the optional expected column names.
    privateCsvExcluded:true,
    caveat:'Local structure heuristics only. Formula warnings include benign negative numbers; validate with the target importer. No data uploaded.'
  };
}

export function paidRequestPayload(source, expectedColumns=[]) {
  if(typeof source!=='string'||!source.trim())throw bad('EMPTY_CSV');
  if(byteSize(source)>MAX_HOSTED_BYTES)throw bad('HOSTED_INPUT_EXCEEDS_32KB');
  if(!Array.isArray(expectedColumns)||expectedColumns.length>40||
     expectedColumns.some(v=>typeof v!=='string'||!v.trim()||v.length>128))
    throw bad('INVALID_EXPECTED_COLUMNS');
  // This return value CONTAINS original user text. Use only on explicit opt-in
  // and never invoke fetch, auto-sign, transfer, post, analytics or logging.
  return {csvText:source, ...(expectedColumns.length?{expectedColumns}: {})};
}
