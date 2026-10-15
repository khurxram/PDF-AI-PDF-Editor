import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph } from 'docx';
import html2canvas from 'html2canvas';
import { openPdf } from './pdfjs-setup';

type Tool = { name:string; mode:string; limitation?:string };
type Entry = { i:number; rot:number; removed:boolean };
type Chosen = { i:number; rot:number };
type Output = { name:string; blob:Blob; type:string };
type Step = 'upload'|'setup'|'result';
const STEPS: Step[] = ['upload','setup','result'];

const $ = <T extends Element>(root: Element, selector:string) => root.querySelector(selector) as T;
const safe = (name:string) => name.replace(/[^a-z0-9]+/gi,'-').replace(/(^-|-$)/g,'').toLowerCase() || 'file';
const delay = (ms:number) => new Promise<void>(r=>setTimeout(r,ms));
const CHECK = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 4.5"/></svg>';

async function pdf(file:File) { return PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption:false, updateMetadata:false }); }
async function renderPdf(file:File, scale=1.25, pages?:number[], maxPx=1500) {
	const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
	const list = pages?.length ? pages : [...Array(doc.numPages).keys()];
	const result:HTMLCanvasElement[] = [];
	for (const n of list) { const page = await doc.getPage(n+1); result.push(await drawPage(page, scale, maxPx)); }
	return result;
}
/** Render one page. Scale is clamped so the canvas never exceeds `maxPx` on its longest
 *  side — a 300dpi scan produces an 8-megapixel canvas, and dozens of those run the
 *  browser out of memory (blank, never-rendered previews). */
async function drawPage(page:pdfjsPage, scale:number, maxPx=1500) {
	const base = page.getViewport({ scale: 1 });
	const s = Math.min(scale, maxPx / base.width, maxPx / base.height);
	const view = page.getViewport({ scale: s });
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(view.width));
	canvas.height = Math.max(1, Math.round(view.height));
	await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: view }).promise;
	return canvas;
}
type pdfjsPage = Awaited<ReturnType<Awaited<ReturnType<typeof openPdf>>['getPage']>>;
async function text(file:File) {
	const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
	let out = '';
	for (let i = 1; i <= doc.numPages; i++) { const content = await (await doc.getPage(i)).getTextContent(); out += content.items.map((x:any)=>x.str||'').join(' ')+'\n\n'; }
	return out.trim();
}
async function imagesToPdf(files:File[]) { const doc = await PDFDocument.create(); for (const file of files){ const data=new Uint8Array(await file.arrayBuffer()); const image=file.type==='image/png'?await doc.embedPng(data):await doc.embedJpg(data); const page=doc.addPage([image.width,image.height]); page.drawImage(image,{x:0,y:0,width:image.width,height:image.height}); } return doc.save(); }
async function simplePdf(content:string) { const out=new jsPDF(); const lines=out.splitTextToSize(content || 'No readable text found.', 175); out.text(lines,18,20); return out.output('arraybuffer'); }
const hexColor = (h:string) => { const n=parseInt((h||'').replace('#',''),16)||0; return rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255); };
// pdf-lib is bottom-up: compute the draw origin for a text box of size tw×size at a named position
const place = (pos:string,w:number,h:number,pad:number,tw:number,size:number) => { const parts=pos.split('-'), v=parts.length>1?parts[0]!:'center', d=parts.length>1?parts[1]!:'center'; return { x: d==='right'?w-pad-tw : d==='left'?pad : (w-tw)/2, y: v==='top'?h-pad-size : v==='bottom'?pad : (h-size)/2 }; };

document.querySelectorAll<HTMLElement>('.workspace[data-tool]').forEach(root => {
 const tool=JSON.parse(root.dataset.tool!) as Tool, mode=tool.mode, flow=root.dataset.flow as 'single'|'multi'|'compare'|'unavailable';
 if(flow==='unavailable') return;
 const btn=$<HTMLButtonElement>(root,'#continue'), backUpload=$<HTMLButtonElement>(root,'#back-upload'), backSetup=$<HTMLButtonElement>(root,'#back-setup'), dlBtn=$<HTMLButtonElement>(root,'#download');
 const status=$<HTMLElement>(root,'#file-status'), error=$<HTMLElement>(root,'#error'), preview=$<HTMLElement>(root,'#result-preview'), resultMessage=$<HTMLElement>(root,'#result-message'), progressWrap=$<HTMLElement>(root,'#progress-wrap'), progress=$<HTMLProgressElement>(root,'#progress');
 const list=root.querySelector<HTMLElement>('#file-list'), inputPreview=root.querySelector<HTMLElement>('#input-preview'), inputs=[...root.querySelectorAll<HTMLInputElement>('input[type=file]')];
 if(!btn||!status||!error||!preview||!progressWrap||!progress)return;
 const isCompare=mode==='compare', multi=mode==='merge'||mode==='images-pdf';
 const picker=root.querySelector<HTMLElement>('#page-picker'), grid=root.querySelector<HTMLElement>('#page-grid'), count=root.querySelector<HTMLElement>('#page-count'), loading=root.querySelector<HTMLElement>('#page-picker-loading'), hint=root.querySelector<HTMLElement>('#page-picker-hint');
 const pickMode: 'pick'|'reorder'|'none' = (picker?.dataset.pagesMode as 'pick'|'reorder'|'none') ?? 'none';
 let slots:(File|null)[] = isCompare?[null,null]:[null];
 let entries:Entry[]=[], sel=new Set<number>(), pickerFile:File|null=null, pickerLoading=false, pickerBroken=false, token=0;
 let step:Step='upload', outputs:Output[]=[], previewUrls:string[]=[], inputUrls:string[]=[], previewToken=0, previewKey='';
 const initialStatus=status.textContent||'';
 const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]!);
 const filesize=(n:number)=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
 const fileIcon='<span class="file-row-icon" aria-hidden="true"><svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M11.5 2.5H6A1.5 1.5 0 0 0 4.5 4v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z"/><path d="M11.5 2.5v4h4"/></svg></span>';
  const row=(f:File,i:number,total=0)=>{const move=total?`<span class="file-move-group"><button type="button" class="file-move" data-move="${i}" data-dir="-1" ${i===0?'disabled':''} aria-label="Move ${esc(f.name)} up">↑</button><button type="button" class="file-move" data-move="${i}" data-dir="1" ${i===total-1?'disabled':''} aria-label="Move ${esc(f.name)} down">↓</button></span>`:'';return `<div class="file-row">${fileIcon}<span class="file-row-text"><span class="file-row-name" title="${esc(f.name)}">${esc(f.name)}</span><span class="file-row-meta">${filesize(f.size)}</span></span>${move}<button type="button" class="file-remove" data-remove="${i}" aria-label="Remove ${esc(f.name)}"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>`;};
 const ready=()=>slots.filter(Boolean) as File[];
 const fail=(message:string)=>{error.hidden=false;error.textContent=message;status.textContent='Nothing was changed — adjust your settings and try again.';progressWrap.hidden=true;};
 const val=(id:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>(`#${id}`)?.value;
 const num=(id:string,d:number)=>{const raw=val(id);if(raw==null||raw==='')return d;const v=Number(raw);return Number.isFinite(v)?v:d;};
 const str=(id:string,d:string)=>val(id)||d;
 const track=(blob:Blob)=>{const u=URL.createObjectURL(blob);previewUrls.push(u);return u;};
 const revokePreviews=()=>{previewUrls.forEach(u=>URL.revokeObjectURL(u));previewUrls=[];};
 // ---------------- step navigation ----------------
 const goToStep=(s:Step)=>{
  step=s;
  root.querySelectorAll<HTMLElement>('.step').forEach(el=>{el.hidden=el.dataset.step!==s;});
  root.querySelectorAll<HTMLElement>('[data-step-ind]').forEach(el=>{
   const ind=el.dataset.stepInd as Step;
   el.classList.toggle('is-current',ind===s);
   el.classList.toggle('is-done',STEPS.indexOf(ind)<STEPS.indexOf(s));
  });
  if(s!=='result'){revokePreviews();outputs=[];dlBtn.disabled=true;}
 };
 // ---------------- page picker state helpers ----------------
 const chosen=():Chosen[]=>{ if(pickMode==='reorder'){ if(!grid)return[]; return [...grid.querySelectorAll<HTMLElement>('.page-thumb')].map(t=>Number(t.dataset.index)).filter(i=>entries[i]&&!entries[i]!.removed).map(i=>({i,rot:entries[i]!.rot})); } return [...sel].sort((a,b)=>a-b).map(i=>({i,rot:0})); };
 const pagesOK=()=>pickMode==='none'||!pickerFile||(pickerLoading||pickerBroken?false:pickMode==='reorder'?chosen().length>0:sel.size>0);
 const canProcess=()=>{const active=ready();return !!(active.length&&active.every(f=>f.size>0&&f.size<=100*1024*1024)&&(isCompare?active.length===2:multi?active.length>=1:active.length===1)&&pagesOK());};
 const updateCount=()=>{if(!count)return; if(!pickerFile||!entries.length){count.textContent='';return;} count.textContent=pickMode==='reorder'?`${chosen().length} of ${entries.length} pages`:`${sel.size} of ${entries.length} pages selected`;};
 const renumber=()=>{ if(!grid)return; let pos=0; grid.querySelectorAll<HTMLElement>('.page-thumb').forEach(t=>{const b=t.querySelector<HTMLElement>('.page-order');if(!b)return;b.textContent=t.hasAttribute('data-removed')?'–':String(++pos);}); };
 const thumb=(n:number,canvas:HTMLCanvasElement):HTMLElement=>{
  const img=document.createElement('div');img.className='page-thumb-img';img.append(canvas);
  const label=`Page ${n+1}`;
  if(pickMode==='reorder'){
   const el=document.createElement('div');el.className='page-thumb';el.dataset.index=String(n);el.draggable=true;
   const badge=document.createElement('span');badge.className='page-order';badge.textContent=String(n+1);
   const meta=document.createElement('div');meta.className='page-thumb-meta';
   const name=document.createElement('span');name.className='page-thumb-label';name.textContent=label;
   const rot=document.createElement('span');rot.className='page-rot';rot.hidden=true;
   meta.append(name,rot);
   const acts=document.createElement('div');acts.className='page-thumb-acts';
   for(const [act,glyph,verb] of [['left','‹','Move earlier'],['right','›','Move later'],['rotate','↻','Rotate'],['remove','✕','Remove']] as const){
    const b=document.createElement('button');b.type='button';b.className='page-mini';b.dataset.act=act;b.textContent=glyph;b.setAttribute('aria-label',`${verb} ${label}`);acts.append(b);
   }
   el.append(badge,img,meta,acts);return el;
  }
  const el=document.createElement('button');el.type='button';el.className='page-thumb';el.dataset.index=String(n);el.setAttribute('aria-pressed','false');
  const check=document.createElement('span');check.className='page-check';check.innerHTML=CHECK;
  const name=document.createElement('span');name.className='page-thumb-label';name.textContent=label;
  el.append(check,img,name);return el;
 };
 const clearPicker=()=>{token++;pickerFile=null;pickerLoading=false;pickerBroken=false;sel.clear();entries=[];if(grid)grid.innerHTML='';if(picker)picker.hidden=true;if(loading)loading.hidden=false;if(hint){hint.hidden=true;hint.textContent='';}updateCount();};
 const loadPicker=async(f:File)=>{
  const t=++token;pickerFile=f;pickerLoading=true;pickerBroken=false;sel.clear();entries=[];
  if(picker)picker.hidden=false; if(loading)loading.hidden=false; if(hint){hint.hidden=true;hint.textContent='';} if(grid)grid.innerHTML='';
  updateCount();
  try{
   const doc=await openPdf(new Uint8Array(await f.arrayBuffer()));
   if(t!==token)return;
   const total=doc.numPages, cap=Math.min(total,80);
   entries=[...Array(total).keys()].map(i=>({i,rot:0,removed:false}));
   // every tool starts with a sensible default: all pages selected (except Remove, where that would delete everything)
   if(mode!=='remove')entries.forEach(e=>sel.add(e.i));
   for(let n=0;n<cap;n++){
    if(t!==token)return;
    try{
     const page=await doc.getPage(n+1);
     // fit each page into the card: a scan-sized page renders at ~250px tall, not 1200
     const base=page.getViewport({scale:1});
     grid?.append(thumb(n,await drawPage(page,Math.min(190/base.width,240/base.height))));
    }catch{ /* one unreadable page must not blank the whole grid */ }
    if(n%4===3)await delay(0);
   }
   grid?.querySelectorAll<HTMLElement>('.page-thumb').forEach(el=>{const i=Number(el.dataset.index);if(sel.has(i)){el.classList.add('is-selected');el.setAttribute('aria-pressed','true');}});
   if(cap<total&&hint){hint.hidden=false;hint.textContent=`Showing the first ${cap} of ${total} pages.`;}
  }catch{ if(t!==token)return; pickerBroken=true; if(hint){hint.hidden=false;hint.textContent='This PDF could not be read. It may be password protected or damaged.';} }
  finally{ if(t===token){pickerLoading=false;if(loading)loading.hidden=true;render();} }
 };
 const selectAll=(on:boolean)=>{ sel.clear(); grid?.querySelectorAll<HTMLElement>('.page-thumb').forEach(t=>{const i=Number(t.dataset.index);t.classList.toggle('is-selected',on);t.setAttribute('aria-pressed',String(on));if(on)sel.add(i);}); updateCount();render(); };
 // ---- preview of the chosen file(s) for tools that have no page grid ----
 const firstPageThumb=async(f:File)=>{const doc=await openPdf(new Uint8Array(await f.arrayBuffer()));const page=await doc.getPage(1);const base=page.getViewport({scale:1});return drawPage(page,Math.min(1,220/base.width,280/base.height));};
 const renderInputPreview=async()=>{
  if(!inputPreview)return;
  const active=ready();
  const key=active.map(f=>`${f.name}:${f.size}`).join('|');
  if(pickMode!=='none'||!active.length){ if(pickMode!=='none'||previewKey)clearInputPreview(); return; }
  if(key===previewKey)return;
  previewKey=key;
  const t=++previewToken;
  inputUrls.forEach(u=>URL.revokeObjectURL(u)); inputUrls=[];
  inputPreview.hidden=false;
  inputPreview.innerHTML=`<div class="input-preview-head">Preview <span>${active.length} file${active.length===1?'':'s'} chosen — nothing is uploaded</span></div><div class="input-preview-grid"></div>`;
  const gridEl=inputPreview.querySelector<HTMLElement>('.input-preview-grid')!;
  for(const f of active.slice(0,6)){
   if(t!==previewToken)return;
   const card=document.createElement('div'); card.className='input-preview-card';
   const frame=document.createElement('div'); frame.className='input-preview-frame';
   card.append(frame);
   if(f.type.startsWith('image/')){
    const url=URL.createObjectURL(f); inputUrls.push(url);
    const img=document.createElement('img'); img.src=url; img.alt=`Preview of ${f.name}`; frame.append(img);
   }else if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
    try{ frame.append(await firstPageThumb(f)); }catch{ frame.innerHTML='<p class="input-preview-note">Preview unavailable</p>'; }
   }else{
    frame.innerHTML=`<p class="input-preview-note">${esc((f.name.split('.').pop()||'FILE').toUpperCase())}<br>${filesize(f.size)}</p>`;
   }
   const name=document.createElement('span'); name.className='input-preview-name'; name.textContent=f.name; name.title=f.name;
   card.append(name); gridEl.append(card);
   await delay(0);
  }
  if(active.length>6){const more=document.createElement('p');more.className='input-preview-note';more.textContent=`…and ${active.length-6} more file${active.length-6===1?'':'s'}.`;inputPreview.append(more);}
 };
 const clearInputPreview=()=>{previewToken++;previewKey='';inputUrls.forEach(u=>URL.revokeObjectURL(u));inputUrls=[];if(inputPreview){inputPreview.hidden=true;inputPreview.innerHTML='';}};
 const render=()=>{
  error.hidden=true;
  void renderInputPreview();
  const active=ready();
  if(isCompare){
   root.querySelectorAll<HTMLElement>('.upload-slot').forEach((slot,idx)=>{
    const file=slots[idx], zone=slot.querySelector<HTMLElement>('.dropzone'), holder=slot.querySelector<HTMLElement>('.slot-file')!;
    zone!.hidden=!!file;holder.hidden=!file;holder.innerHTML=file?row(file,idx):'';
   });
  }
  if(list){
   list.innerHTML=active.map((f,i)=>row(f,i,multi?active.length:0)).join('')+(multi&&active.length?'<button type="button" class="add-more" data-add>+ Add another file</button>':'');
   list.hidden=active.length===0;
  }
  if(pickMode!=='none'){
   const f=active[0]??null;
   if(f&&f!==pickerFile)void loadPicker(f);
   else if(!f&&pickerFile)clearPicker();
  }
  const sizeOK=active.every(f=>f.size>0&&f.size<=100*1024*1024);
  const countOK=isCompare?active.length===2:multi?active.length>=1:active.length===1;
  btn.disabled=!canProcess();
  updateCount();
  if(!active.length)status.textContent=initialStatus;
  else if(!sizeOK)status.textContent='Files must be smaller than 100 MB.';
  else if(!countOK){
   let message='Add a supported file to continue.';
   if(isCompare)message=active.length?'Both files are needed — add the second one.':'Add both files to begin.';
   else if(multi)message='Add at least one file to continue.';
   status.textContent=message;
  }
  else if(pickerBroken)status.textContent='This PDF could not be read. It may be password protected or damaged.';
  else if(pickerLoading)status.textContent='Rendering the preview…';
  else if(pickMode==='pick'&&!sel.size)status.textContent=mode==='remove'?'Select the pages you want to remove.':'Select at least one page to continue.';
  else if(pickMode==='reorder'&&!chosen().length)status.textContent='Keep at least one page.';
  else status.textContent='Looks good — press Continue to create your file.';
  if(step==='upload'&&countOK&&sizeOK&&!pickerBroken)goToStep('setup');
 };
 inputs.forEach((field,idx)=>field.addEventListener('change',()=>{
  const chosenFiles=Array.from(field.files||[]);field.value='';
  if(isCompare)slots[idx]=chosenFiles[0]??null;
  else if(multi)slots.push(...chosenFiles);
  else slots=[chosenFiles[0]??null];
  render();
 }));
 root.addEventListener('dragover',e=>{e.preventDefault();root.classList.add('is-dragging');});
 root.addEventListener('dragleave',e=>{if(!root.contains(e.relatedTarget as Node))root.classList.remove('is-dragging');});
 root.addEventListener('drop',e=>{
  e.preventDefault();root.classList.remove('is-dragging');
  const dropped=Array.from(e.dataTransfer?.files||[]);if(!dropped.length)return;
  inputs.forEach(f=>f.value='');
  if(isCompare)dropped.forEach(f=>{const i=slots.indexOf(null);if(i>-1)slots[i]=f;});
  else if(multi)slots.push(...dropped);
  else slots=[dropped[0]];
  if(step==='result')goToStep('setup');
  render();
 });
 root.addEventListener('click',e=>{
  const el=(e.target as Element).closest<HTMLElement>('[data-remove],[data-add],[data-select],[data-move]');if(!el)return;
  if(el.hasAttribute('data-select')){selectAll(el.dataset.select==='all');return;}
  if(el.hasAttribute('data-move')){const i=Number(el.dataset.move),j=i+Number(el.dataset.dir);if(j>=0&&j<slots.length&&slots[i]&&slots[j]){const swap=slots[i]!;slots[i]=slots[j]!;slots[j]=swap;}render();return;}
  inputs.forEach(f=>f.value='');
  if(el.hasAttribute('data-add')){inputs[0]?.click();return;}
  const i=Number(el.dataset.remove);
  if(isCompare)slots[i]=null;else if(multi)slots.splice(i,1);else slots=[null];
  clearPicker();render();
 });
 if(grid&&pickMode!=='none'){
  let dragging:HTMLElement|null=null;
  grid.addEventListener('click',e=>{
   const t=e.target as Element, thumbEl=t.closest<HTMLElement>('.page-thumb');if(!thumbEl)return;
   const idx=Number(thumbEl.dataset.index), st=entries[idx];if(!st)return;
   const act=t.closest<HTMLElement>('[data-act]')?.dataset.act;
   if(pickMode==='pick'){ if(act)return; const on=!thumbEl.classList.contains('is-selected'); thumbEl.classList.toggle('is-selected',on);thumbEl.setAttribute('aria-pressed',String(on));on?sel.add(idx):sel.delete(idx);updateCount();render();return; }
   if(act==='rotate'){st.rot=(st.rot+90)%360;const chip=thumbEl.querySelector<HTMLElement>('.page-rot');if(chip){chip.hidden=!st.rot;chip.textContent=`${st.rot}°`;}return;}
   if(act==='remove'){st.removed=!st.removed;thumbEl.toggleAttribute('data-removed',st.removed);thumbEl.draggable=!st.removed;const b=thumbEl.querySelector<HTMLElement>('[data-act="remove"]');if(b){b.textContent=st.removed?'↩':'✕';b.setAttribute('aria-label',`${st.removed?'Restore':'Remove'} Page ${idx+1}`);}renumber();updateCount();render();return;}
   if(act==='left'||act==='right'){const sib=act==='left'?thumbEl.previousElementSibling:thumbEl.nextElementSibling;if(sib)grid.insertBefore(thumbEl,act==='left'?sib:sib.nextElementSibling);renumber();updateCount();render();}
  });
  grid.addEventListener('dragstart',e=>{const el=(e.target as Element).closest<HTMLElement>('.page-thumb[draggable="true"]');if(!el)return;dragging=el;el.classList.add('is-dragging');if(e.dataTransfer){e.dataTransfer.setData('text/plain','');e.dataTransfer.effectAllowed='move';}});
  grid.addEventListener('dragover',e=>{if(!dragging)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';const over=(e.target as Element).closest<HTMLElement>('.page-thumb');if(!over||over===dragging)return;const r=over.getBoundingClientRect();const before=e.clientX<r.left+r.width/2;grid.insertBefore(dragging,before?over:over.nextElementSibling);});
  grid.addEventListener('dragend',()=>{if(dragging)dragging.classList.remove('is-dragging');dragging=null;renumber();updateCount();});
 }
 // live value labels for every slider in the settings step
 root.querySelectorAll<HTMLElement>('.range-row').forEach(row=>{
  const input=row.querySelector<HTMLInputElement>('input[type=range]'), output=row.querySelector<HTMLOutputElement>('output');
  if(!input||!output)return;
  input.addEventListener('input',()=>{output.value=input.value;});
 });
 // ---------------- navigation buttons ----------------
 backUpload.addEventListener('click',()=>{
  inputs.forEach(f=>f.value=''); slots=isCompare?[null,null]:[null]; clearPicker(); clearInputPreview(); revokePreviews(); outputs=[];
  preview.innerHTML=''; error.hidden=true; goToStep('upload'); render();
 });
 backSetup.addEventListener('click',()=>{ goToStep('setup'); render(); });
 // ---------------- result preview ----------------
 const describe=(o:Output)=>o.type==='application/pdf'?'PDF document':o.type.startsWith('image/')?o.type.split('/')[1]!.toUpperCase()+' image':o.name.split('.').pop()?.toUpperCase()+' file';
 const showResult=async()=>{
  resultMessage.textContent = outputs.length>1
   ? `We created ${outputs.length} files. Check the preview, then download them.`
   : 'Check the preview below — download it if it looks right.';
  dlBtn.textContent = outputs.length>1 ? `Download all (${outputs.length})` : 'Download';
  dlBtn.disabled=false;
  status.textContent='Done — nothing was uploaded.';
  await renderPreview();
 };
 const renderPreview=async()=>{
  revokePreviews(); preview.innerHTML='';
  const many=outputs.length>1, list=outputs.slice(0,24);
  const gridEl=document.createElement('div'); gridEl.className=many?'preview-grid preview-grid-many':'preview-grid';
  for(const o of list){
   const card=document.createElement('div'); card.className='preview-card';
   const frame=document.createElement('div'); frame.className='preview-frame';
   card.append(frame);
   if(o.type==='application/pdf'){
    try{
     const doc=await openPdf(new Uint8Array(await o.blob.arrayBuffer()));
     const pages=many?1:Math.min(doc.numPages,8);
     for(let i=1;i<=pages;i++){const w=document.createElement('div');w.className='preview-page';w.append(await drawPage(await doc.getPage(i),many?0.5:0.8));const l=document.createElement('span');l.className='preview-page-num';l.textContent=String(i);w.append(l);frame.append(w);}
    }catch{ frame.innerHTML='<p class="preview-note">Preview unavailable.</p>'; }
   }else if(o.type.startsWith('image/')){
    const img=document.createElement('img'); img.className='preview-img'; img.src=track(o.blob); img.alt=`Preview of ${o.name}`; frame.append(img);
   }else{
    frame.innerHTML=`<p class="preview-note">${esc(describe(o))}<br>${filesize(o.blob.size)}</p>`;
   }
   const meta=document.createElement('div'); meta.className='preview-meta';
   const name=document.createElement('span'); name.className='preview-name'; name.textContent=o.name; name.title=o.name;
   meta.append(name); card.append(meta);
   if(many){
    const b=document.createElement('button'); b.type='button'; b.className='button secondary preview-dl'; b.textContent='Download';
    b.addEventListener('click',()=>{downloadOutput(o);}); card.append(b);
   }
   gridEl.append(card);
  }
  preview.append(gridEl);
  if(outputs.length>list.length){const more=document.createElement('p');more.className='preview-note';more.textContent=`Showing the first ${list.length} of ${outputs.length} files.`;preview.append(more);}
 };
 const downloadOutput=(o:Output)=>{const url=URL.createObjectURL(o.blob);const a=document.createElement('a');a.href=url;a.download=o.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
 dlBtn.addEventListener('click',async()=>{
  if(!outputs.length)return;
  dlBtn.disabled=true;
  for(let i=0;i<outputs.length;i++){downloadOutput(outputs[i]!);await delay(350);}
  dlBtn.disabled=false;
  status.textContent=outputs.length>1?`Downloaded ${outputs.length} files. Nothing was uploaded.`:'Downloaded. Nothing was uploaded.';
 });
 // ---------------- processing ----------------
 btn.addEventListener('click',async()=>{
  const active=ready(); if(!active.length)return;
  btn.disabled=true; backUpload.disabled=true; backSetup.disabled=true; error.hidden=true; preview.innerHTML=''; outputs=[]; dlBtn.disabled=true;
  progressWrap.hidden=false; progress.value=8; status.textContent='Working on your file locally…';
  try{
   outputs=await run(active);
   if(!outputs.length)throw Error('Nothing was created — check your settings.');
   progress.value=100;
   await showResult();
   goToStep('result');
  }catch(e:any){ fail(e?.message||'Unable to process this file. Check that it is valid and not password protected.'); }
  finally{ backUpload.disabled=false; backSetup.disabled=false; btn.disabled=!canProcess(); setTimeout(()=>{progressWrap.hidden=true;},700); }
 });
 const run=async(active:File[]):Promise<Output[]>=>{
  const f=active[0]!, label=safe(tool.name), base=safe(f.name.replace(/\.[^.]+$/,''));
  const picks=()=>{const list=chosen();if(!list.length)throw Error(pickMode==='reorder'?'Keep at least one page.':mode==='remove'?'Select the pages you want to remove.':'Select at least one page.');return list;};
  const blobOf=(data:Uint8Array|ArrayBuffer,type='application/pdf')=>new Blob([data as BlobPart],{type});
  const pdfOutput=async(doc:PDFDocument,name=`${base}-${label}.pdf`):Promise<Output[]>=>[{name,blob:blobOf(await doc.save()),type:'application/pdf'}];
  if(mode==='split'){
   const pages=picks();if(pages.length>30)throw Error(`Choose up to 30 pages at a time — you picked ${pages.length}.`);
   const src=await pdf(f), outs:Output[]=[];
   for(let k=0;k<pages.length;k++){const out=await PDFDocument.create();const copied=await out.copyPages(src,[pages[k]!.i]);out.addPage(copied[0]);outs.push({name:`${base}-page-${pages[k]!.i+1}.pdf`,blob:blobOf(await out.save()),type:'application/pdf'});progress.value=Math.round(((k+1)/pages.length)*90)+5;await delay(120);}
   return outs;
  }
  if(mode==='pdf-jpg'){
   const pages=picks();if(pages.length>30)throw Error(`Convert up to 30 pages at a time — you picked ${pages.length}.`);
   const canvases=await renderPdf(f,num('jpg-scale',1.5),pages.map(p=>p.i),3200), q=Number(root.querySelector<HTMLInputElement>('#quality')?.value||75)/100, outs:Output[]=[];
   for(let k=0;k<canvases.length;k++){const blob=await new Promise<Blob>(r=>canvases[k]!.toBlob(b=>r(b!),'image/jpeg',q));outs.push({name:`${base}-page-${pages[k]!.i+1}.jpg`,blob,type:'image/jpeg'});progress.value=Math.round(((k+1)/canvases.length)*90)+5;await delay(120);}
   return outs;
  }
  let data:Uint8Array|ArrayBuffer|Blob, type='application/pdf', outName=`${base}-${label}.pdf`;
  if(mode==='merge'){const out=await PDFDocument.create();for(let i=0;i<active.length;i++){const src=await pdf(active[i]!);const copied=await out.copyPages(src,src.getPageIndices());copied.forEach(p=>out.addPage(p));progress.value=15+(i/active.length)*75;}data=await out.save();}
  else if(mode==='remove'){const drop=new Set(picks().map(p=>p.i)),src=await pdf(f);if(drop.size>=src.getPageCount())throw Error('That would remove every page — select fewer pages.');const out=await PDFDocument.create();const copied=await out.copyPages(src,src.getPageIndices().filter(i=>!drop.has(i)));copied.forEach(p=>out.addPage(p));data=await out.save();}
  else if(mode==='extract'){const pages=picks(),src=await pdf(f);const out=await PDFDocument.create();const copied=await out.copyPages(src,pages.map(p=>p.i));copied.forEach(p=>out.addPage(p));data=await out.save();}
  else if(mode==='organize'){const pages=chosen();if(!pages.length)throw Error('Keep at least one page.');const src=await pdf(f),out=await PDFDocument.create();const copied=await out.copyPages(src,pages.map(p=>p.i));copied.forEach((p,k)=>{out.addPage(p);if(pages[k]!.rot)p.setRotation(degrees((p.getRotation().angle+pages[k]!.rot)%360));});data=await out.save();}
  else if(mode==='rotate'){const set=new Set(picks().map(p=>p.i)),doc=await pdf(f),angle=num('rotate-angle',90);doc.getPages().forEach((p,i)=>{if(set.has(i))p.setRotation(degrees((p.getRotation().angle+angle)%360));});data=await doc.save();}
  else if(mode==='crop'){const pages=picks(),doc=await pdf(f);const t=num('crop-top',18),r=num('crop-right',18),b=num('crop-bottom',18),l=num('crop-left',18);if([t,r,b,l].some(v=>v<0))throw Error('Margins cannot be negative.');pages.forEach(p=>{const page=doc.getPage(p.i),{width,height}=page.getSize();if(width-l-r<=0||height-t-b<=0)throw Error('Those margins are larger than the page.');page.setCropBox(l,b,width-l-r,height-t-b);});data=await doc.save();}
  else if(mode==='numbers'){const pages=picks(),doc=await pdf(f),font=await doc.embedFont(StandardFonts.Helvetica),size=num('num-size',12),start=Math.max(0,num('num-start',1)),pos=str('num-position','bottom-right');pages.forEach((p,k)=>{const page=doc.getPage(p.i),{width,height}=page.getSize(),value=String(start+k),tw=font.widthOfTextAtSize(value,size);page.drawText(value,{...place(pos,width,height,18,tw,size),size,font,color:rgb(0.12,0.12,0.12)});});data=await doc.save();}
  else if(mode==='watermark'){const v=(root.querySelector<HTMLInputElement>('#annotation')?.value||'').trim();if(!v)throw Error('Enter some watermark text.');const pages=picks(),doc=await pdf(f),font=await doc.embedFont(StandardFonts.Helvetica);const size=num('wm-size',32),op=num('wm-opacity',30)/100,ang=num('wm-angle',35),color=hexColor(str('wm-color','#333333')),rad=ang*Math.PI/180;pages.forEach(p=>{const page=doc.getPage(p.i),{width,height}=page.getSize(),tw=font.widthOfTextAtSize(v,size);const ox=tw/2*Math.cos(rad)-size/2*Math.sin(rad),oy=tw/2*Math.sin(rad)+size/2*Math.cos(rad);page.drawText(v,{x:width/2-ox,y:height/2-oy,size,font,color,opacity:op,rotate:degrees(ang)});});data=await doc.save();}
  else if(mode==='edit'||mode==='sign'){const v=(root.querySelector<HTMLInputElement>('#annotation')?.value||'').trim();if(!v)throw Error(`Enter some ${mode==='sign'?'signature':'text'} to add.`);const pages=picks(),doc=await pdf(f),font=await doc.embedFont(StandardFonts.Helvetica);const size=mode==='sign'?num('sign-size',18):num('edit-size',16),color=hexColor(str(mode==='sign'?'sign-color':'edit-color',mode==='sign'?'#111111':'#171717')),pos=str(mode==='sign'?'sign-position':'edit-position',mode==='sign'?'bottom-right':'top-left');pages.forEach(p=>{const page=doc.getPage(p.i),{width,height}=page.getSize(),tw=font.widthOfTextAtSize(v,size);page.drawText(v,{...place(pos,width,height,16,tw,size),size,font,color});});data=await doc.save();}
  else if(mode==='metadata'){const doc=await pdf(f);doc.setTitle('');doc.setAuthor('');doc.setSubject('');doc.setKeywords([]);doc.setProducer('');doc.setCreator('');data=await doc.save();}
  else if(['images-pdf','scan'].includes(mode)){data=await imagesToPdf(active);}
  else if(mode==='image'){const image=await createImageBitmap(f), canvas=document.createElement('canvas'), q=Number(root.querySelector<HTMLInputElement>('#quality')?.value||75)/100;const max=1600;const factor=Math.min(1,max/Math.max(image.width,image.height));canvas.width=Math.round(image.width*factor);canvas.height=Math.round(image.height*factor);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);type=f.type==='image/png'?'image/png':'image/jpeg';outName=`${base}-${label}.${type==='image/png'?'png':'jpg'}`;data=await new Promise<Blob>(r=>canvas.toBlob(b=>r(b!),type,q));}
  else if(mode==='word-pdf'){const converted=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});data=blobOf(await simplePdf(converted.value));}
  else if(mode==='html-pdf'){const html=await f.text(), frame=document.createElement('iframe');frame.setAttribute('sandbox','');frame.style.cssText='position:fixed;left:-10000px;width:800px;height:1000px';document.body.append(frame);frame.srcdoc=html;await new Promise(r=>frame.onload=r);const canvas=await html2canvas(frame.contentDocument!.body,{backgroundColor:'#fff'});frame.remove();const out=new jsPDF({unit:'px',format:[canvas.width,canvas.height]});out.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);data=out.output('arraybuffer');}
  else if(mode==='pdf-word'){const extracted=await text(f);const document=new Document({sections:[{children:extracted.split(/\n+/).map(t=>new Paragraph(t))}]});outName=`${base}-${label}.docx`;data=await Packer.toBlob(document);type='application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
  else if(mode==='markdown'){data='# Extracted PDF text\n\n'+await text(f);type='text/markdown';outName=`${base}-${label}.md`;}
  else if(mode==='compress'){const pages=picks(),canvases=await renderPdf(f,1,pages.map(p=>p.i),3200),out=await PDFDocument.create();for(let i=0;i<canvases.length;i++){const blob=await new Promise<Blob>(r=>canvases[i]!.toBlob(b=>r(b!),'image/jpeg',Number(root.querySelector<HTMLInputElement>('#quality')?.value||65)/100));const image=await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));const page=out.addPage([canvases[i]!.width,canvases[i]!.height]);page.drawImage(image,{x:0,y:0,width:canvases[i]!.width,height:canvases[i]!.height});progress.value=20+(i/canvases.length)*70;}data=await out.save();}
  else if(mode==='compare'){const [a,b]=await Promise.all(active.map(text));type='text/plain';outName=`${base}-comparison.txt`;data=`PDF comparison report\n\nIdentical extracted text: ${a===b?'Yes':'No'}\n\nFirst document:\n${a}\n\nSecond document:\n${b}`;}
  else if(mode==='ocr'){throw Error('Local English OCR language data is not bundled in this build yet, so no file was sent anywhere.');}
  else throw Error('This tool is not available.');
  progress.value=100;
  const blob=data instanceof Blob?data:blobOf(data as Uint8Array|ArrayBuffer,type);
  return [{name:outName,blob,type}];
 };
 render();
});
