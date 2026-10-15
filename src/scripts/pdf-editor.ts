import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { pdfjs, openPdf } from './pdfjs-setup';

/* ============================================================
   PDF AI Editor — a local, in-browser PDF editor.
   Rendering is done with pdf.js; edits are stored as overlay
   annotations and page ops; export is done with pdf-lib.
   ============================================================ */

type Tool = 'select'|'edittext'|'addtext'|'draw'|'eraser'|'highlight'|'shape'|'redact'|'image'|'sign'|'watermark'|'crop';
type Mode = 'edit'|'organize'|'pages';
type ShapeKind = 'rect'|'ellipse'|'line'|'arrow';
type FontKey = 'helvetica'|'times'|'courier';

interface BaseAnn { id:string; page:number }
interface TextAnn extends BaseAnn { kind:'text'; x:number;y:number;w:number;h:number; text:string; size:number; color:string; bold:boolean; italic:boolean; align:'left'|'center'|'right'; font:FontKey; cover:string|null }
interface DrawAnn extends BaseAnn { kind:'draw'; pts:{x:number;y:number}[]; color:string; width:number; opacity:number }
interface BoxAnn extends BaseAnn { kind:'highlight'|'redact'|'shape'; shape:ShapeKind; x:number;y:number;w:number;h:number; color:string; width:number; fill:string; dashed:boolean; opacity:number }
interface ImageAnn extends BaseAnn { kind:'image'; x:number;y:number;w:number;h:number; data:Uint8Array; mime:string; rot:number }
interface WatermarkAnn { id:string; kind:'watermark'; text:string; size:number; color:string; opacity:number; angle:number; bold:boolean }
interface CropAnn extends BaseAnn { kind:'crop'; x:number;y:number;w:number;h:number }

type Ann = TextAnn|DrawAnn|BoxAnn|ImageAnn|CropAnn;

interface PageMeta { width:number; height:number; rotation:number }

const $ = <T extends Element>(sel:string) => document.querySelector<T>(sel);
const $$ = <SEL extends Element>(sel:string) => [...document.querySelectorAll<SEL>(sel)];
const uid = () => Math.random().toString(36).slice(2,10);
const clamp = (v:number,a:number,b:number) => Math.min(b,Math.max(a,v));
const hex = (h:string) => { const n=h.replace('#',''); return rgb(parseInt(n.slice(0,2),16)/255,parseInt(n.slice(2,4),16)/255,parseInt(n.slice(4,6),16)/255); };

/* ---------- DOM refs ---------- */
const el = {
	app:$('.editor-app') as HTMLElement,
	workspace:$('#ed-workspace') as HTMLElement,
	file:$('#ed-file') as HTMLInputElement,
	imageFile:$('#ed-imagefile') as HTMLInputElement,
	mergeFile:$('#ed-mergefile') as HTMLInputElement,
	docName:$('#ed-doc-name') as HTMLElement,
	docMeta:$('#ed-doc-meta') as HTMLElement,
	btnOpen:$('#ed-open') as HTMLButtonElement,
	btnOpenEmpty:$('#ed-open-empty') as HTMLButtonElement,
	btnUndo:$('#ed-undo') as HTMLButtonElement,
	btnRedo:$('#ed-redo') as HTMLButtonElement,
	btnDownload:$('#ed-download') as HTMLButtonElement,
	thumbs:$('#ed-thumbs') as HTMLElement,
	sidebarFoot:$('#ed-sidebar-foot') as HTMLElement,
	toolbar:$('#ed-toolbar') as HTMLElement,
	options:$('#ed-options') as HTMLElement,
	viewport:$('#ed-viewport') as HTMLElement,
	canvasWrap:$('#ed-canvas-wrap') as HTMLElement,
	canvas:$('#ed-canvas') as HTMLCanvasElement,
	overlay:$('#ed-overlay') as HTMLElement,
	cropMask:$('#ed-crop-mask') as HTMLElement,
	selbar:$('#ed-selbar') as HTMLElement,
	empty:$('#ed-empty') as HTMLElement,
	panel:$('#ed-panel') as HTMLElement,
	prev:$('#ed-prev') as HTMLButtonElement,
	next:$('#ed-next') as HTMLButtonElement,
	pageInput:$('#ed-pageinput') as HTMLInputElement,
	pageCount:$('#ed-pagecount') as HTMLElement,
	zoomIn:$('#ed-zoomin') as HTMLButtonElement,
	zoomOut:$('#ed-zoomout') as HTMLButtonElement,
	zoomFit:$('#ed-zoomfit') as HTMLButtonElement,
	zoomVal:$('#ed-zoomval') as HTMLElement,
	bottombar:$('#ed-bottombar') as HTMLElement,
	sigModal:$('#ed-sigmodal') as HTMLElement,
	sigCanvas:$('#ed-sigcanvas') as HTMLCanvasElement,
	sigText:$('#ed-sigtext') as HTMLInputElement,
	sigPreview:$('#ed-sigpreview') as HTMLElement,
	toast:$('#ed-toast') as HTMLElement,
};

/* ---------- State ---------- */
let pdfDoc:PDFDocument|null = null;         // pdf-lib doc used for export
let pdfjsDoc:pdfjs.PDFDocumentProxy|null = null; // pdf.js doc used for rendering
let srcBytes:Uint8Array|null = null;        // original file bytes
let fileName = 'document.pdf';
let pageCount = 0;
/** pageOrder[i] = original page index shown at position i (after deletes/reorder) */
let pageOrder:number[] = [];
let pageMeta:Record<number,PageMeta> = {};
let anns:Ann[] = [];
let watermark:WatermarkAnn|null = null;
let current = 0;          // current view position in pageOrder
let zoom = 1;
let fitMode = true;
let tool:Tool = 'select';
let mode:Mode = 'edit';
let selected:string|null = null;
let undoStack:string[] = [];
let redoStack:string[] = [];
let renderToken = 0;
let renderTask: { cancel():void }|null = null; // in-flight pdf.js render, cancelled when a new one starts
let pendingImage:Uint8Array|null = null;
let pendingImageMime = 'image/png';
let pendingImageSize = {w:200,h:200};
let sigDataUrl:string|null = null;
let dirty = false;

const baseScale = 1.35; // pdf.js render scale baseline

/* ---------- tool option state ---------- */
const opt = {
	color:'#0070f3', shapeColor:'#0070f3', shapeFill:'none', shapeKind:'rect' as ShapeKind, shapeWidth:2, shapeDashed:false,
	hlColor:'#ffe066', hlOpacity:40, drawColor:'#e03131', drawWidth:3, penOpacity:100, textSize:16, textColor:'#111111', fontFamily:'helvetica' as FontKey,
	textBold:false, textItalic:false, textAlign:'left' as 'left'|'center'|'right',
	wmText:'CONFIDENTIAL', wmSize:48, wmColor:'#888888', wmOpacity:25, wmAngle:35, wmBold:true,
	cropM:{l:0,r:0,t:0,b:0},
};
const SWATCHES = ['#111111','#4d4d4d','#e03131','#ff922b','#f59f00','#2f9e44','#1c7ed6','#7048e8','#ffffff'];
const FONT_CSS: Record<FontKey,string> = {
	helvetica:'Arial, Helvetica, sans-serif',
	times:'"Times New Roman", Times, serif',
	courier:'"Courier New", Courier, monospace',
};
const FONT_LABEL: Record<FontKey,string> = { helvetica:'Sans-serif', times:'Serif', courier:'Monospace' };

/* ============================================================
   Helpers
   ============================================================ */
function toast(msg:string, isErr=false){
	el.toast.textContent=msg; el.toast.classList.toggle('error',isErr); el.toast.hidden=false;
	clearTimeout((toast as any)._t); (toast as any)._t=setTimeout(()=>{el.toast.hidden=true;},2600);
}
async function sha(file:File){ return file.arrayBuffer(); }

function pushUndo(){ undoStack.push(JSON.stringify({anns,pageOrder,watermark})); if(undoStack.length>60)undoStack.shift(); redoStack.length=0; syncUndoButtons(); dirty=true; }
function syncUndoButtons(){ el.btnUndo.disabled=!undoStack.length; el.btnRedo.disabled=!redoStack.length; }
function applySnapshot(s:string){ const o=JSON.parse(s); anns=o.anns; pageOrder=o.pageOrder; watermark=o.watermark; if(current>=pageOrder.length)current=pageOrder.length-1; selected=null; renderThumbs(); renderPage(); renderOverlay(); }
function undo(){ if(!undoStack.length)return; redoStack.push(JSON.stringify({anns,pageOrder,watermark})); applySnapshot(undoStack.pop()!); syncUndoButtons(); }
function redo(){ if(!redoStack.length)return; undoStack.push(JSON.stringify({anns,pageOrder,watermark})); applySnapshot(redoStack.pop()!); syncUndoButtons(); }

const originalOf = (pos:number) => pageOrder[pos];
const posOfOriginal = (orig:number) => pageOrder.indexOf(orig);
const annsFor = (orig:number) => anns.filter(a=>a.page===orig);

/* ============================================================
   File loading
   ============================================================ */
async function openFile(file:File){
	if(!file || !/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)){ toast('Please choose a PDF file.',true); return; }
	try{
		toast('Opening PDF…');
		const buf = new Uint8Array(await sha(file));
		fileName=file.name;
		await reloadDoc(buf);
		pageMeta={}; anns=[]; watermark=null; current=0; zoom=1; fitMode=true; selected=null;
		el.cropMask.hidden=true; el.cropMask.innerHTML='';   // no crop carries over to a new file
		undoStack=[]; redoStack=[]; syncUndoButtons();
		// cache page sizes
		for(let i=1;i<=pageCount;i++){ const p=await pdfjsDoc!.getPage(i); const vp=p.getViewport({scale:1}); pageMeta[i-1]={width:vp.width,height:vp.height,rotation:p.rotate||0}; }
		el.app.classList.remove('is-empty');
		el.workspace.hidden=false; el.empty.hidden=true; el.bottombar.hidden=false;
		el.btnDownload.disabled=false;
		el.docName.textContent=fileName;
		el.docMeta.textContent=`${pageCount} page${pageCount===1?'':'s'}`;
		opt.cropM = {l:0,r:0,t:0,b:0};
		setMode('edit');
		await renderThumbs();
		await renderPage();
		updatePageIndicator();
		toast('Ready — your file stays in this browser.');
	}catch(e:any){
		console.error(e);
		toast(e?.message?.includes('encrypt')||String(e).includes('encrypt')?'That PDF is password protected — cannot open.':'Could not open that PDF. It may be damaged.',true);
	}
}

/** (re)load the source bytes into both pdf-lib (export) and pdf.js (render) */
async function reloadDoc(bytes:Uint8Array){
	srcBytes = bytes;
	pdfDoc = await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
	pdfjsDoc = await openPdf(bytes.slice(0));
	pageCount = pdfjsDoc.numPages;
	pageOrder = Array.from({length:pageCount},(_,i)=>i);
}

/* ============================================================
   Rendering (pdf.js)
   ============================================================ */
async function renderPage(){
	if(!pdfjsDoc) return;
	const token=++renderToken;
	// drop any pinch preview: this render defines the real size again
	const wrap=el.canvasWrap as HTMLElement;
	wrap.style.transform=''; wrap.style.width=''; wrap.style.height='';
	const orig=originalOf(current);
	const page=await pdfjsDoc.getPage(orig+1);
	if(token!==renderToken) return;
	const meta=pageMeta[orig];
	const scale = fitMode ? computeFit(meta) : zoom;
	const vp=page.getViewport({scale: baseScale*scale});
	const dpr=Math.min(2,window.devicePixelRatio||1);
	// only one render may run on this canvas at a time
	if(renderTask){ try{ renderTask.cancel(); }catch{ /* ignore */ } renderTask=null; }
	el.canvas.width=Math.floor(vp.width*dpr);
	el.canvas.height=Math.floor(vp.height*dpr);
	el.canvas.style.width=vp.width+'px';
	el.canvas.style.height=vp.height+'px';
	const ctx=el.canvas.getContext('2d')!;
	ctx.setTransform(dpr,0,0,dpr,0,0);
	ctx.fillStyle='#fff'; ctx.fillRect(0,0,vp.width,vp.height);
	const task=page.render({canvas:el.canvas,canvasContext:ctx,viewport:vp} as any);
	renderTask=task as any;
	try{ await task.promise; }
	catch(e:any){ if(token!==renderToken||e?.name==='RenderingCancelledException') return; throw e; }
	finally{ if(renderTask===task) renderTask=null; }
	if(token!==renderToken) return;
	// store scale for coordinate mapping
	(el.canvasWrap as any)._scale = scale*baseScale;
	el.zoomVal.textContent=Math.round(scale*100)+'%';
	if(selected) renderOverlay();
}
function computeFit(meta:PageMeta){
	const availW = el.viewport.clientWidth - 56;
	const availH = el.viewport.clientHeight - 56;
	const s = Math.min(availW/(meta.width*baseScale), availH/(meta.height*baseScale));
	return clamp(s,0.2,4);
}
function mapScale(){ return (el.canvasWrap as any)._scale as number || baseScale; }
/** convert overlay (css px, top-left) -> pdf pt (bottom-left) */
function toPdf(x:number,y:number){ const s=mapScale(); const meta=pageMeta[originalOf(current)]; return {x:x/s, y:meta.height - y/s}; }
function toCss(px:number,py:number){ const s=mapScale(); const meta=pageMeta[originalOf(current)]; return {x:px*s, y:(meta.height-py)*s}; }

/* ============================================================
   Thumbnails + organize
   ============================================================ */
let thumbToken = 0;
async function renderThumbs(){
	if(!pdfjsDoc) return;
	const t = ++thumbToken;
	el.thumbs.innerHTML='';
	for(let pos=0; pos<pageOrder.length; pos++){
		if(t!==thumbToken) return;
		const orig=pageOrder[pos]!;
		const item=document.createElement('div');
		item.className='ed-thumb'+(pos===current?' is-active':'');
		item.setAttribute('role','option');
		item.setAttribute('aria-selected',String(pos===current));
		item.dataset.pos=String(pos);
		const c=document.createElement('canvas');
		item.appendChild(c);
		const num=document.createElement('span'); num.className='ed-thumb-num'; num.textContent=String(pos+1); item.appendChild(num);
		if(mode!=='edit'){
			const acts=document.createElement('div'); acts.className='ed-thumb-acts';
			acts.innerHTML=`<button data-act="rot" title="Rotate">⟳</button><button data-act="dup" title="Duplicate">⧉</button><button data-act="del" class="danger" title="Delete">✕</button>`;
			item.appendChild(acts);
		}
		el.thumbs.appendChild(item);
		item.addEventListener('click',(e)=>{
			const btn=(e.target as HTMLElement).closest('button[data-act]') as HTMLButtonElement|null;
			if(btn){ e.stopPropagation(); thumbAction(btn.dataset.act!,pos); return; }
			goTo(pos);
		});
		if(mode!=='edit') wireDrag(item,pos);
		// draw one thumbnail at a time: many concurrent pdf.js renders thrash the canvas pool
		try{ await drawThumb(c,orig); }catch{ /* page could not be drawn */ }
		if(pos%3===2) await new Promise(r=>setTimeout(r,0));
	}
	if(t!==thumbToken) return;
	// add-page button
	const add=document.createElement('button');
	add.className='ed-thumb-add'; add.type='button'; add.textContent='+ Add page';
	add.addEventListener('click',()=>{ el.mergeFile.click(); });
	el.thumbs.appendChild(add);
	updateSidebarFoot();
}
async function drawThumb(canvas:HTMLCanvasElement,orig:number){
	if(!pdfjsDoc) return;
	const page=await pdfjsDoc.getPage(orig+1);
	// derive the box from the page itself so rotated or unusual pages never get squashed.
	// Rendered at ~2x the display size: the browser scales it down, so text stays crisp on retina.
	const base=page.getViewport({scale:1});
	// fit inside a fixed box: tall scans and huge pages stay cheap and never blow up memory
	const s=Math.min(300/base.width, 400/base.height);
	const vp=page.getViewport({scale:s});
	canvas.width=Math.max(1,Math.floor(vp.width));
	canvas.height=Math.max(1,Math.floor(vp.height));
	canvas.style.aspectRatio=`${vp.width} / ${vp.height}`;
	const ctx=canvas.getContext('2d')!; ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
	await page.render({canvas,canvasContext:ctx,viewport:vp} as any).promise;
}
function thumbAction(act:string,pos:number){
	pushUndo();
	const orig=pageOrder[pos]!;
	if(act==='rot'){ pageMeta[orig].rotation=(pageMeta[orig].rotation+90)%360; renderThumbs(); if(pos===current)renderPage(); }
	else if(act==='dup'){ pageOrder.splice(pos+1,0,orig); renderThumbs(); toast('Page duplicated.'); }
	else if(act==='del'){
		if(pageOrder.length<=1){ toast('A document needs at least one page.',true); undoStack.pop(); return; }
		pageOrder.splice(pos,1); anns=anns.filter(a=>!(a.kind!=='watermark'&&a.page===orig));
		if(current>=pageOrder.length)current=pageOrder.length-1;
		renderThumbs(); renderPage(); renderOverlay(); toast('Page removed.');
	}
}
/* drag to reorder */
let dragPos:number|null=null;
function wireDrag(item:HTMLElement,pos:number){
	item.draggable=true;
	item.addEventListener('dragstart',()=>{dragPos=pos;item.classList.add('is-dragover');});
	item.addEventListener('dragend',()=>{item.classList.remove('is-dragover');dragPos=null;});
	item.addEventListener('dragover',(e)=>{e.preventDefault();item.classList.add('is-dragover');});
	item.addEventListener('dragleave',()=>item.classList.remove('is-dragover'));
	item.addEventListener('drop',(e)=>{
		e.preventDefault(); item.classList.remove('is-dragover');
		if(dragPos===null||dragPos===pos)return;
		pushUndo();
		const [m]=pageOrder.splice(dragPos,1); pageOrder.splice(pos,0,m!);
		current=pos; renderThumbs(); renderPage();
	});
}
function updateSidebarFoot(){
	el.sidebarFoot.innerHTML='';
	const info=document.createElement('div'); info.className='ed-pageinfo';
	info.textContent=`${pageOrder.length} page${pageOrder.length===1?'':'s'} · drag to reorder`;
	el.sidebarFoot.appendChild(info);
}
/** make sure every page has cached dimensions (used after merging or adding pages) */
async function cacheMissingMeta(){
	if(!pdfjsDoc)return;
	for(let i=1;i<=pageCount;i++){ if(!pageMeta[i-1]){ const p=await pdfjsDoc.getPage(i); const vp=p.getViewport({scale:1}); pageMeta[i-1]={width:vp.width,height:vp.height,rotation:p.rotate||0}; } }
}

/* ============================================================
   Modes & tools
   ============================================================ */
function setMode(m:Mode){
	mode=m;
	$$('.ed-mode').forEach(b=>b.classList.toggle('is-active',(b as HTMLElement).dataset.mode===m));
	el.toolbar.style.display = m==='edit' ? '' : 'none';
	if(m==='edit'){ el.panel.hidden=true; el.workspace.classList.remove('with-panel'); }
	else { el.panel.hidden=false; el.workspace.classList.add('with-panel'); renderPanel(); }
	renderThumbs();
	if(fitMode) renderPage();
}
function setTool(t:Tool){
	tool=t; selected=null;
	$$('.ed-tool').forEach(b=>b.classList.toggle('is-active',(b as HTMLElement).dataset.tool===t));
	el.viewport.className='ed-viewport tool-'+t;
	if(t!=='crop'){ renderAppliedCrop(); }
	else if(pdfDoc&&mode==='edit'){ drawCropPreview(); }
	// watermark previews live the moment the tool is opened
	if(t==='watermark'&&!watermark&&opt.wmText.trim()){
		watermark={id:uid(),kind:'watermark',text:opt.wmText.trim(),size:opt.wmSize,color:opt.wmColor,opacity:opt.wmOpacity,angle:opt.wmAngle,bold:opt.wmBold};
		dirty=true;
	}
	el.selbar.hidden=true;
	renderOptions();
	renderOverlay();
}

/* ============================================================
   Options bar (per tool)
   ============================================================ */
function renderOptions(){
	const o=el.options; o.innerHTML='';
	const grp=(inner:string)=>{const d=document.createElement('div');d.className='ed-opt-group';d.innerHTML=inner;return d;};
	const seg=(name:string,items:[string,string][],cur:string)=>`<div class="ed-seg" data-seg="${name}">${items.map(([v,l])=>`<button data-v="${v}" class="${v===cur?'is-active':''}" type="button">${l}</button>`).join('')}</div>`;
	const swatches=(key:'textColor'|'drawColor'|'hlColor'|'shapeColor')=>`<span class="ed-swatches" data-sw="${key}">${SWATCHES.map(c=>`<button type="button" class="ed-swatch${(opt[key] as string).toLowerCase()===c?' is-active':''}" data-c="${c}" style="background:${c}" title="${c}" aria-label="Use ${c}"></button>`).join('')}</span>`;
	const range=(key:string,label:string,min:number,max:number,value:number,unit='')=>`<span class="ed-opt"><label>${label} <input type="range" data-k="${key}" min="${min}" max="${max}" value="${value}"> <span class="ed-opt-value" data-out="${key}">${value}${unit}</span></label></span>`;
	const colorField=(key:'textColor'|'drawColor'|'hlColor'|'shapeColor',label:string)=>`<span class="ed-opt"><label>${label} <input type="color" data-k="${key}" value="${opt[key]}"></label></span>${swatches(key)}`;

	if(tool==='addtext'||tool==='edittext'){
		o.appendChild(grp(`<span class="ed-opt"><label>Font <select data-k="fontFamily">${(Object.keys(FONT_LABEL) as FontKey[]).map(f=>`<option value="${f}"${opt.fontFamily===f?' selected':''}>${FONT_LABEL[f]}</option>`).join('')}</select></label></span>
		<span class="ed-opt"><label>Size <input type="number" data-k="textSize" min="6" max="96" value="${opt.textSize}">pt</label></span>`));
		o.appendChild(grp(colorField('textColor','Color')));
		o.appendChild(grp(`<span class="ed-opt">${seg('align',[['left','Left'],['center','Center'],['right','Right']],opt.textAlign)}</span>
		<span class="ed-opt"><label><input type="checkbox" data-k="textBold" ${opt.textBold?'checked':''}> Bold</label></span>
		<span class="ed-opt"><label><input type="checkbox" data-k="textItalic" ${opt.textItalic?'checked':''}> Italic</label></span>`));
		if(tool==='addtext') o.appendChild(grp(`<span class="ed-opt-hint">Click on the page to place text — type, then click anywhere else or press Escape to keep it.</span>`));
		else o.appendChild(grp(`<span class="ed-opt-hint">Click existing text to edit it. New text is drawn over the original.</span>`));
	}
	else if(tool==='draw'){
		o.appendChild(grp(colorField('drawColor','Pen')));
		o.appendChild(grp(range('drawWidth','Width',1,24,opt.drawWidth,'px')+range('penOpacity','Opacity',10,100,opt.penOpacity,'%')));
		o.appendChild(grp(`<span class="ed-opt-hint">Drag to draw. Use the Eraser to remove strokes.</span>`));
	}
	else if(tool==='eraser'){
		o.appendChild(grp(`<span class="ed-opt-hint">Click or drag over anything you added — text, strokes, shapes, highlights, images — to erase it. The original page is never touched.</span>`));
	}
	else if(tool==='highlight'){
		o.appendChild(grp(colorField('hlColor','Colour')));
		o.appendChild(grp(range('hlOpacity','Opacity',10,100,opt.hlOpacity,'%')));
		o.appendChild(grp(`<span class="ed-opt-hint">Drag over text to highlight it.</span>`));
	}
	else if(tool==='shape'){
		o.appendChild(grp(`<span class="ed-opt">${seg('shapeKind',[['rect','Rectangle'],['ellipse','Ellipse'],['line','Line'],['arrow','Arrow']],opt.shapeKind)}</span>`));
		o.appendChild(grp(colorField('shapeColor','Stroke')+range('shapeWidth','Width',1,16,opt.shapeWidth,'px')));
		o.appendChild(grp(`<span class="ed-opt"><label>Fill <input type="color" data-k="shapeFill" value="${opt.shapeFill==='none'?'#ffffff':opt.shapeFill}"> <button class="ed-btn ed-btn-sm" data-act="nofill" type="button">None</button></label></span>
		<span class="ed-opt"><label><input type="checkbox" data-k="shapeDashed" ${opt.shapeDashed?'checked':''}> Dashed</label></span>`));
		o.appendChild(grp(`<span class="ed-opt-hint">Drag to draw a shape.</span>`));
	}
	else if(tool==='redact'){
		o.appendChild(grp(`<span class="ed-opt-hint">Drag over content to black it out permanently on export.</span>`));
	}
	else if(tool==='watermark'){
		o.appendChild(grp(`<span class="ed-opt"><label>Text <input type="text" data-k="wmText" value="${opt.wmText}"></label></span>`));
		o.appendChild(grp(range('wmSize','Size',12,160,opt.wmSize)+range('wmOpacity','Opacity',5,100,opt.wmOpacity,'%')+range('wmAngle','Angle',-90,90,opt.wmAngle,'°')));
		o.appendChild(grp(colorField('wmColor','Colour')));
		o.appendChild(grp(`<button class="ed-btn ed-btn-sm ed-btn-danger" data-act="wm-clear" type="button"${watermark?'':' disabled'}>Remove watermark</button><span class="ed-opt-hint">Updates live on every page as you type.</span>`));
	}
	else if(tool==='crop'){
		const m=opt.cropM;
		o.appendChild(grp(`<span class="ed-opt"><label>Left <input type="number" data-k="cropL" min="0" value="${Math.round(m.l)}"></label></span>
		<span class="ed-opt"><label>Right <input type="number" data-k="cropR" min="0" value="${Math.round(m.r)}"></label></span>
		<span class="ed-opt"><label>Top <input type="number" data-k="cropT" min="0" value="${Math.round(m.t)}"></label></span>
		<span class="ed-opt"><label>Bottom <input type="number" data-k="cropB" min="0" value="${Math.round(m.b)}"></label></span>`));
		o.appendChild(grp(`<button class="ed-btn ed-btn-sm ed-btn-primary" data-act="crop-apply" type="button">Apply crop to this page</button>
		<button class="ed-btn ed-btn-sm" data-act="crop-all" type="button">Apply to all pages</button>
		<button class="ed-btn ed-btn-sm" data-act="crop-reset" type="button">Reset</button>`));
		o.appendChild(grp(`<span class="ed-opt-hint">Drag the box or its corners on the page — the preview updates live.</span>`));
	}
	else if(tool==='image'){
		o.appendChild(grp(`<span class="ed-opt-hint">Choose an image below — it is added to the center of this page. Drag to move, corner handles to resize, Delete to remove.</span>`));
		const b=document.createElement('button'); b.className='ed-btn ed-btn-sm'; b.type='button'; b.dataset.act='pick-image'; b.textContent='Choose image…';
		o.appendChild(grp(b.outerHTML));
	}
	else if(tool==='sign'){
		o.appendChild(grp(`<button class="ed-btn ed-btn-sm" data-act="sig-new" type="button">Create signature</button>
		<span class="ed-opt-hint">${sigDataUrl?'Signature ready — it is placed on the center of this page.':'Draw or type a signature and it is added to the page.'}</span>`));
	}
	else if(tool==='select'){
		o.appendChild(grp(`<span class="ed-opt-hint">Click an item to select it. Drag to move, corner handles to resize, Delete to remove — or use the buttons above the selection.</span>`));
	}
}
/** push the current option values onto the selected annotation so edits preview live */
function applyToSelection(){
	if(!selected)return;
	const a=anns.find(x=>x.id===selected); if(!a)return;
	if(a.kind==='text'){ a.size=opt.textSize; a.color=opt.textColor; a.bold=opt.textBold; a.italic=opt.textItalic; a.align=opt.textAlign; a.font=opt.fontFamily; }
	else if(a.kind==='draw'){ a.color=opt.drawColor; a.width=opt.drawWidth; a.opacity=opt.penOpacity/100; }
	else if(a.kind==='highlight'){ a.color=opt.hlColor; a.opacity=opt.hlOpacity/100; }
	else if(a.kind==='shape'){ a.color=opt.shapeColor; a.fill=opt.shapeFill; a.width=opt.shapeWidth; a.dashed=opt.shapeDashed; a.shape=opt.shapeKind; }
	else return;
	dirty=true;
	renderOverlay();
}
/** the watermark follows the controls as they are moved — no "apply" step needed */
function syncWatermarkLive(){
	const text=(opt.wmText||'').trim();
	if(!text){
		if(watermark){ watermark=null; dirty=true; renderOverlay();
			const b=el.options.querySelector<HTMLButtonElement>('[data-act="wm-clear"]'); if(b)b.disabled=true; }
		return;
	}
	const created=!watermark;
	if(created) watermark={id:uid(),kind:'watermark',text,size:opt.wmSize,color:opt.wmColor,opacity:opt.wmOpacity,angle:opt.wmAngle,bold:opt.wmBold};
	watermark!.text=text; watermark!.size=opt.wmSize; watermark!.color=opt.wmColor; watermark!.opacity=opt.wmOpacity; watermark!.angle=opt.wmAngle;
	dirty=true; renderOverlay();
	if(created){ const b=el.options.querySelector<HTMLButtonElement>('[data-act="wm-clear"]'); if(b)b.disabled=false; }
}
function onOptionClick(e:Event){
	const t=e.target as HTMLElement;
	const btn=t.closest('button') as HTMLButtonElement|null; if(!btn)return;
	const act=btn.dataset.act;
	const sw=btn.closest('.ed-swatches') as HTMLElement|null;
	if(sw){
		const key=sw.dataset.sw as 'textColor'|'drawColor'|'hlColor'|'shapeColor', c=btn.dataset.c!;
		opt[key]=c;
		if(key==='drawColor')opt.drawColor=c; if(key==='hlColor')opt.hlColor=c; if(key==='shapeColor')opt.shapeColor=c; if(key==='textColor')opt.textColor=c;
		renderOptions(); applyToSelection(); return;
	}
	const seg=btn.closest('.ed-seg') as HTMLElement|null;
	if(seg){
		const name=seg.dataset.seg, v=btn.dataset.v!;
		if(name==='align')opt.textAlign=v as any;
		if(name==='shapeKind')opt.shapeKind=v as ShapeKind;
		[...seg.children].forEach(c=>c.classList.toggle('is-active',c===btn));
		applyToSelection();
		return;
	}
	if(act==='nofill'){ opt.shapeFill='none'; renderOptions(); applyToSelection(); }
	else if(act==='wm-clear'){ pushUndo(); watermark=null; renderOverlay(); renderOptions(); toast('Watermark removed.'); }
	else if(act==='pick-image'){ el.imageFile.click(); }
	else if(act==='sig-new'){ openSigModal(); }
	else if(act==='crop-apply'){ applyCrop(false); }
	else if(act==='crop-all'){ applyCrop(true); }
	else if(act==='crop-reset'){ opt.cropM={l:0,r:0,t:0,b:0}; syncCropInputs(); renderOptions(); drawCropPreview(); }
}
function onOptionInput(e:Event){
	const t=e.target as HTMLElement; const k=(t as HTMLInputElement).dataset.k; if(!k)return;
	const input=t as HTMLInputElement;
	const v=input.type==='checkbox'?input.checked:input.value;
	const num=()=>Number(v);
	const out=el.options.querySelector<HTMLElement>(`[data-out="${k}"]`);
	if(out) out.textContent=input.type==='range'?String(v):out.textContent;
	if(k==='textColor')opt.textColor=v as string;
	else if(k==='textSize')opt.textSize=clamp(num(),6,96);
	else if(k==='fontFamily')opt.fontFamily=v as FontKey;
	else if(k==='textBold')opt.textBold=v as boolean;
	else if(k==='textItalic')opt.textItalic=v as boolean;
	else if(k==='drawColor')opt.drawColor=v as string;
	else if(k==='drawWidth'){opt.drawWidth=num(); if(out)out.textContent=opt.drawWidth+'px';}
	else if(k==='penOpacity'){opt.penOpacity=num(); if(out)out.textContent=opt.penOpacity+'%';}
	else if(k==='hlColor')opt.hlColor=v as string;
	else if(k==='hlOpacity'){opt.hlOpacity=num(); if(out)out.textContent=opt.hlOpacity+'%';}
	else if(k==='shapeColor')opt.shapeColor=v as string;
	else if(k==='shapeFill')opt.shapeFill=v as string;
	else if(k==='shapeWidth'){opt.shapeWidth=num(); if(out)out.textContent=opt.shapeWidth+'px';}
	else if(k==='shapeDashed')opt.shapeDashed=input.checked;
	else if(k==='wmText'){opt.wmText=v as string; syncWatermarkLive(); return;}
	else if(k==='wmSize'){opt.wmSize=num(); if(out)out.textContent=String(opt.wmSize);}
	else if(k==='wmOpacity'){opt.wmOpacity=num(); if(out)out.textContent=opt.wmOpacity+'%';}
	else if(k==='wmAngle'){opt.wmAngle=num(); if(out)out.textContent=opt.wmAngle+'°';}
	else if(k==='wmColor'){opt.wmColor=v as string; syncWatermarkLive(); return;}
	else if(k==='cropL'){opt.cropM.l=Math.max(0,num()); drawCropPreview(); return;}
	else if(k==='cropR'){opt.cropM.r=Math.max(0,num()); drawCropPreview(); return;}
	else if(k==='cropT'){opt.cropM.t=Math.max(0,num()); drawCropPreview(); return;}
	else if(k==='cropB'){opt.cropM.b=Math.max(0,num()); drawCropPreview(); return;}
	else return;
	if(k.startsWith('wm')){ syncWatermarkLive(); return; }
	applyToSelection();
}
/** crop rectangle for a page (display coords, origin bottom-left), margins clamped to that page's size */
function cropRectFor(p:number){
	const m=pageMeta[p];
	const l=clamp(opt.cropM.l,0,Math.max(0,m.width-2));
	const t=clamp(opt.cropM.t,0,Math.max(0,m.height-2));
	const r=clamp(opt.cropM.r,0,Math.max(0,m.width-2-l));
	const b=clamp(opt.cropM.b,0,Math.max(0,m.height-2-t));
	return {x:l,y:b,w:Math.max(1,m.width-l-r),h:Math.max(1,m.height-t-b)};
}
function cropRect(){ return cropRectFor(originalOf(current)); }

/* ============================================================
   Overlay rendering
   ============================================================ */
function renderOverlay(){
	el.overlay.innerHTML='';
	const orig=originalOf(current); const s=mapScale(); const meta=pageMeta[orig];
	if(!meta)return;
	// watermark
	if(watermark){
		const w=document.createElement('div');
		const c=toCss(meta.width/2,meta.height/2);
		w.className='ed-ann';
		Object.assign(w.style,{left:'0px',top:'0px',width:meta.width*s+'px',height:meta.height*s+'px',display:'grid',placeItems:'center',pointerEvents:'none'});
		const inner=document.createElement('div');
		inner.textContent=watermark.text;
		inner.style.cssText=`font:bold ${watermark.size*s}px Arial;color:${watermark.color};opacity:${watermark.opacity/100};transform:rotate(${-watermark.angle}deg);white-space:nowrap;font-weight:${watermark.bold?700:400}`;
		w.appendChild(inner); el.overlay.appendChild(w);
	}
	for(const a of annsFor(orig)){
		if(a.kind==='crop')continue;
		const node=buildAnnNode(a,s);
		if(node)el.overlay.appendChild(node);
	}
	renderSelBar();
	renderAppliedCrop();
}
/** keep a visible outline of an applied crop so the change is obvious on screen */
function renderAppliedCrop(){
	if(tool==='crop'||!pdfDoc||mode!=='edit') return;   // the crop tool owns the mask: it draws the live box
	el.cropMask.hidden=true; el.cropMask.innerHTML='';
	const orig=originalOf(current);
	const c=anns.find(a=>a.kind==='crop'&&a.page===orig) as CropAnn|undefined;
	const meta=pageMeta[orig];
	if(!c||!meta) return;
	if(c.x<=0.5&&c.y<=0.5&&Math.abs(c.w-meta.width)<1&&Math.abs(c.h-meta.height)<1) return; // full page = nothing cropped
	const s=mapScale(); const tl=toCss(c.x,c.y+c.h);
	const r=document.createElement('div'); r.className='ed-crop-rect ed-crop-applied';
	Object.assign(r.style,{left:tl.x+'px',top:tl.y+'px',width:c.w*s+'px',height:c.h*s+'px'});
	el.cropMask.appendChild(r);
	el.cropMask.hidden=false;
}
/** floating Delete / Duplicate / Edit buttons above the current selection */
function renderSelBar(){
	const bar=el.selbar;
	const a=selected?anns.find(x=>x.id===selected):null;
	if(!a||a.kind==='crop'){ bar.hidden=true; return; }
	const node=el.overlay.querySelector<HTMLElement>(`[data-id="${a.id}"]`);
	if(!node){ bar.hidden=true; return; }
	let x:number,y:number,w:number,h:number;
	if(a.kind==='draw'){ // strokes are wrapped in a full-page div — use the real bounds
		const pts=a.pts.map(p=>toCss(p.x,p.y));
		x=Math.min(...pts.map(p=>p.x)); y=Math.min(...pts.map(p=>p.y));
		w=Math.max(...pts.map(p=>p.x))-x; h=Math.max(...pts.map(p=>p.y))-y;
	}else{
		x=parseFloat(node.style.left||'0'); y=parseFloat(node.style.top||'0');
		w=node.offsetWidth||80; h=node.offsetHeight||40;
	}
	bar.innerHTML=
		(a.kind==='text'?`<button type="button" data-sel="edit">Edit</button>`:'')+
		`<button type="button" data-sel="dup">Duplicate</button>`+
		`<button type="button" data-sel="del" class="danger">Delete</button>`;
	bar.hidden=false;
	const bw=bar.offsetWidth||160, bh=bar.offsetHeight||30;
	bar.style.left=Math.max(0,Math.min(x+w-bw, el.canvas.offsetWidth-bw))+'px';
	bar.style.top=Math.max(0,y-bh-6)+'px';
}
el.selbar.addEventListener('click',(e)=>{
	const b=(e.target as HTMLElement).closest('button[data-sel]') as HTMLButtonElement|null;
	if(!b)return;
	const a=anns.find(x=>x.id===selected); if(!a)return;
	const act=b.dataset.sel;
	if(act==='del'){
		pushUndo(); anns=anns.filter(x=>x!==a); selected=null; renderOverlay(); toast('Deleted.');
	}else if(act==='dup'){
		pushUndo();
		const copy=JSON.parse(JSON.stringify(a)) as any; copy.id=uid();
		if(copy.kind==='draw'){ copy.pts=copy.pts.map((p:{x:number;y:number})=>({x:p.x+12,y:p.y-12})); }
		else if(typeof copy.x==='number'){ copy.x+=12; copy.y-=12; }
		anns.push(copy as Ann); renderOverlay(); select(copy.id); toast('Duplicated.');
	}else if(act==='edit'){
		const node=el.overlay.querySelector<HTMLElement>(`[data-id="${a.id}"]`);
		if(node&&a.kind==='text')beginInlineEdit(node,a);
	}
});
function buildAnnNode(a:Ann,s:number):HTMLElement|null{
	if(a.kind==='text'){
		const p=toCss(a.x,a.y+a.h);
		const d=document.createElement('div');
		d.className='ed-ann ed-ann-text'; d.dataset.id=a.id;
		Object.assign(d.style,{left:p.x+'px',top:p.y+'px',width:a.w*s+'px',height:a.h*s+'px',fontSize:a.size*s+'px',color:a.color,textAlign:a.align,fontWeight:a.bold?'700':'400',fontStyle:a.italic?'italic':'normal',fontFamily:FONT_CSS[a.font||'helvetica'],lineHeight:'1.2',whiteSpace:'pre-wrap'});
		if(a.cover){ d.style.background=a.cover; }
		d.textContent=a.text;
		wireAnn(d,a); return d;
	}
	if(a.kind==='draw'){
		const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
		svg.setAttribute('class','ed-ann-svg'); svg.dataset.id=a.id;
		svg.style.pointerEvents='none';
		const w=el.canvas.width, h=el.canvas.height;
		svg.setAttribute('width',String(w)); svg.setAttribute('height',String(h));
		svg.style.width=w+'px'; svg.style.height=h+'px';
		const path=document.createElementNS('http://www.w3.org/2000/svg','path');
		const d=a.pts.map((pt,i)=>{const c=toCss(pt.x,pt.y);return `${i?'L':'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`;}).join(' ');
		path.setAttribute('d',d); path.setAttribute('fill','none'); path.setAttribute('stroke',a.color);
		path.setAttribute('stroke-width',String(a.width*s)); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round'); path.setAttribute('pointer-events','stroke');
		path.setAttribute('opacity',String(a.opacity??1));
		svg.appendChild(path);
		// hit area: wrap in a div for selection
		const wrap=document.createElement('div'); wrap.className='ed-ann'; wrap.dataset.id=a.id;
		Object.assign(wrap.style,{left:'0px',top:'0px',width:el.canvas.style.width,height:el.canvas.style.height,pointerEvents:'none'});
		path.style.pointerEvents='stroke'; path.style.cursor='pointer';
		path.addEventListener('pointerdown',(e)=>{ if(!canGrab(a))return; e.stopPropagation(); select(a.id); startDragAnn(e,a); });
		wrap.appendChild(svg);
		if(selected===a.id){ wrap.classList.add('selected'); }
		return wrap;
	}
	if(a.kind==='highlight'||a.kind==='redact'||a.kind==='shape'){
		const p=toCss(a.x,a.y+a.h);
		const d=document.createElement('div'); d.className='ed-ann'; d.dataset.id=a.id;
		Object.assign(d.style,{left:p.x+'px',top:p.y+'px',width:a.w*s+'px',height:a.h*s+'px'});
		if(a.kind==='highlight'){ d.style.background=a.color; d.style.opacity=String(a.opacity??0.42); d.style.mixBlendMode='multiply'; }
		else if(a.kind==='redact'){ d.style.background='#000'; }
		else{
			const bw=Math.max(1,a.width*s)+'px';
			const style=a.dashed?'dashed':'solid';
			if(a.shape==='rect'){ d.style.border=`${bw} ${style} ${a.color}`; if(a.fill&&a.fill!=='none')d.style.background=a.fill; }
			else if(a.shape==='ellipse'){ d.style.border=`${bw} ${style} ${a.color}`; d.style.borderRadius='50%'; if(a.fill&&a.fill!=='none')d.style.background=a.fill; }
			else{
				const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
				svg.setAttribute('class','ed-ann-svg'); svg.style.width='100%'; svg.style.height='100%'; svg.style.overflow='visible';
				const wpx=Math.max(1,a.w*s), hpx=Math.max(1,a.h*s);
				const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
				ln.setAttribute('x1','0'); ln.setAttribute('y1',String(hpx)); ln.setAttribute('x2',String(wpx)); ln.setAttribute('y2','0');
				ln.setAttribute('stroke',a.color); ln.setAttribute('stroke-width',String(a.width*s)); ln.setAttribute('stroke-linecap','round');
				if(a.dashed) ln.setAttribute('stroke-dasharray',`${Math.max(2,a.width*s*2)} ${Math.max(2,a.width*s*2)}`);
				svg.appendChild(ln);
				if(a.shape==='arrow'){
					const ang=Math.atan2(-hpx,wpx), hl=Math.max(7,a.width*s*4);
					for(const off of [0.42,-0.42]){
						const barb=document.createElementNS('http://www.w3.org/2000/svg','line');
						barb.setAttribute('x1',String(wpx)); barb.setAttribute('y1','0');
						barb.setAttribute('x2',String(wpx+Math.cos(ang+Math.PI+off)*hl)); barb.setAttribute('y2',String(Math.sin(ang+Math.PI+off)*hl));
						barb.setAttribute('stroke',a.color); barb.setAttribute('stroke-width',String(a.width*s)); barb.setAttribute('stroke-linecap','round');
						svg.appendChild(barb);
					}
				}
				d.appendChild(svg);
			}
		}
		wireAnn(d,a); return d;
	}
	if(a.kind==='image'){
		const p=toCss(a.x,a.y+a.h);
		const d=document.createElement('div'); d.className='ed-ann ed-ann-image'; d.dataset.id=a.id;
		Object.assign(d.style,{left:p.x+'px',top:p.y+'px',width:a.w*s+'px',height:a.h*s+'px'});
		const img=document.createElement('img'); img.src=URL.createObjectURL(new Blob([a.data],{type:a.mime})); img.draggable=false;
		d.appendChild(img); wireAnn(d,a); return d;
	}
	return null;
}
function select(id:string|null){
	selected=id;
	$$('.ed-ann').forEach(n=>n.classList.remove('selected'));
	if(id){ const n=el.overlay.querySelector(`[data-id="${id}"]`); if(n){n.classList.add('selected'); addHandles(n as HTMLElement,id);} }
	if(tool==='select') renderOptions();
	renderSelBar();
}
function addHandles(node:HTMLElement,id:string){
	node.querySelectorAll('.ed-handle').forEach(h=>h.remove());
	const a=anns.find(x=>x.id===id); if(!a)return;
	if(a.kind==='text'||a.kind==='highlight'||a.kind==='redact'||a.kind==='shape'||a.kind==='image'){
		['tl','tr','bl','br'].forEach(pos=>{
			const h=document.createElement('div'); h.className='ed-handle '+pos; h.dataset.handle=pos;
			node.appendChild(h);
			h.addEventListener('pointerdown',(e)=>{ if(!canGrab(a))return; e.stopPropagation(); startResize(e,a,pos as any);});
		});
	}
}

/* ============================================================
   Pointer interactions on the canvas
   ============================================================ */
function relPos(e:PointerEvent){ const r=el.canvas.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }

/** which tools may move/resize an annotation without switching to Select */
function canGrab(a:Ann){
	if(tool==='select')return true;
	if(tool==='eraser')return false;
	if(tool==='shape'&&a.kind==='shape')return true;
	if(tool==='highlight'&&a.kind==='highlight')return true;
	if(tool==='redact'&&a.kind==='redact')return true;
	if(tool==='draw'&&a.kind==='draw')return true;
	if((tool==='image'||tool==='sign')&&a.kind==='image')return true;
	return false;
}

/* ------------------------------------------------------------
   Touch support
   The canvas wrap sets touch-action:none so a drawing drag is
   never stolen by scrolling — which also means the browser can't
   pan or pinch-zoom for us. So we own the gestures: two fingers
   pinch-zoom and pan around the page, one finger drives the
   active tool exactly like the mouse. Every gesture listens only
   to the pointer that started it, so a stray extra finger can't
   corrupt a stroke or a drag.
   ------------------------------------------------------------ */
let gestureCancel:((()=>void)|null)=null;
/** run a one-finger gesture; a two-finger pinch (or a pointercancel) aborts it */
function gesture(e:PointerEvent,move:(ev:PointerEvent)=>void,up:(ev:PointerEvent)=>void,cancel?:()=>void){
	const id=e.pointerId;
	const finish=(abort:boolean,ev?:PointerEvent)=>{
		window.removeEventListener('pointermove',move);
		window.removeEventListener('pointerup',onUp);
		window.removeEventListener('pointercancel',onUp);
		gestureCancel=null;
		if(abort) cancel?.(); else up(ev!);
	};
	const onUp=(ev:PointerEvent)=>{ if(ev.pointerId!==id)return; finish(ev.type==='pointercancel',ev); };
	gestureCancel=()=>finish(true);
	window.addEventListener('pointermove',move);
	window.addEventListener('pointerup',onUp);
	window.addEventListener('pointercancel',onUp);
}
const pointers=new Map<number,{x:number;y:number}>();
let pinch:{dist:number;zoom:number;mid:{x:number;y:number}}|null=null;
function startPinch(){
	const pts=[...pointers.values()]; if(pts.length<2)return;
	gestureCancel?.();   // whatever the first finger was doing stops now
	const [a,b]=pts;
	pinch={dist:Math.hypot(a.x-b.x,a.y-b.y)||1,zoom:fitMode?computeFit(pageMeta[originalOf(current)]):zoom,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
	fitMode=false;
}
function updatePinch(){
	if(!pinch)return;
	const pts=[...pointers.values()]; const a=pts[0],b=pts[1]; if(!a||!b)return;
	const dist=Math.hypot(a.x-b.x,a.y-b.y);
	const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
	const rect=el.viewport.getBoundingClientRect();
	// a two-finger drag pans
	el.viewport.scrollLeft-=(mid.x-pinch.mid.x);
	el.viewport.scrollTop-=(mid.y-pinch.mid.y);
	pinch.mid=mid;
	// spread the fingers apart to zoom in
	const target=clamp(pinch.zoom*(dist/pinch.dist),0.2,4);
	if(Math.abs(target-zoom)<0.005)return;
	zoom=target;
	// preview the new scale with a cheap CSS transform so the gesture stays at
	// 60fps; a crisp re-render happens the moment the fingers lift
	const k=target/pinch.zoom;
	const wrap=el.canvasWrap as HTMLElement;
	const w=parseFloat(el.canvas.style.width)||0, h=parseFloat(el.canvas.style.height)||0;
	wrap.style.transformOrigin='0 0';
	wrap.style.transform=k===1?'':`scale(${k})`;
	wrap.style.width=k===1?'':`${Math.round(w*k)}px`;
	wrap.style.height=k===1?'':`${Math.round(h*k)}px`;
	el.zoomVal.textContent=Math.round(target*100)+'%';
}
window.addEventListener('pointerdown',(e)=>{
	if(!pdfDoc||mode!=='edit')return;
	const t=e.target as HTMLElement;
	if(!t.closest('.ed-canvas-wrap')&&!t.closest('.ed-ann'))return;
	pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
	if(pointers.size===2){ startPinch(); e.preventDefault(); e.stopPropagation(); }
},true);
window.addEventListener('pointermove',(e)=>{
	if(!pointers.has(e.pointerId))return;
	pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
	if(pinch)updatePinch();
},true);
const releasePointer=(e:PointerEvent)=>{
	if(!pointers.has(e.pointerId))return;
	pointers.delete(e.pointerId);
	if(pinch&&pointers.size<2){
		// fingers lifted: turn the cheap CSS preview into a crisp render at the new zoom
		pinch=null;
		if(pdfDoc&&mode==='edit')void renderPage();
	}
};
window.addEventListener('pointerup',releasePointer,true);
window.addEventListener('pointercancel',releasePointer,true);
/** with the Select tool, a finger drag scrolls the page around */
function startPan(e:PointerEvent){
	const sx=e.clientX, sy=e.clientY, sl=el.viewport.scrollLeft, st=el.viewport.scrollTop;
	const move=(ev:PointerEvent)=>{ el.viewport.scrollLeft=sl-(ev.clientX-sx); el.viewport.scrollTop=st-(ev.clientY-sy); };
	gesture(e,move,()=>{});
}

el.viewport.addEventListener('pointerdown',(e)=>{
	if(!pdfDoc)return;
	if(mode!=='edit')return;
	const target=e.target as HTMLElement;
	// never steal the caret out of an in-progress text editor
	if(target.closest('.ed-ann-textarea')||target.closest('[contenteditable="true"]'))return;
	const inOverlay=target.closest('.ed-ann') as HTMLElement|null;
	const p=relPos(e);
	if(tool==='select'){ if(!inOverlay){ select(null); if(e.pointerType==='touch') startPan(e); } return; }
	// creation tools: stop the browser from selecting page text while drawing.
	// canceling pointerdown also cancels the mousedown default, which is what yanks focus
	// back to the page — the reason a freshly placed text box could never be typed into.
	if(['draw','highlight','redact','shape','crop','eraser','addtext','edittext'].includes(tool)) e.preventDefault();
	if(tool==='addtext'){
		const open=el.overlay.querySelector<HTMLTextAreaElement>('.ed-ann-textarea');
		if(open){ open.blur(); return; }   // a second click commits the open box instead of starting another
		createTextEdit(p); return;
	}
	if(tool==='edittext'){
		if(inOverlay?.dataset.id){ const a=anns.find(x=>x.id===inOverlay.dataset.id); if(a&&a.kind==='text'){ select(a.id); beginInlineEdit(inOverlay,a); return; } }
		handleEdittextClick(p); return;
	}
	// grab an existing annotation of this tool's kind: move it or resize it without switching tools
	if(inOverlay){ const a=anns.find(x=>x.id===inOverlay.dataset.id); if(a&&canGrab(a))return; }
	if(tool==='eraser'){ startErase(e); return; }
	if(tool==='draw'){ startDraw(e); return; }
	if(tool==='highlight'){ startBox(e,'highlight'); return; }
	if(tool==='redact'){ startBox(e,'redact'); return; }
	if(tool==='shape'){ startBox(e,'shape'); return; }
	// images and signatures are added with their buttons only — clicking the page never drops one
	if(tool==='image'){ toast('Use "Choose image…" below to add an image.'); return; }
	if(tool==='sign'){ if(!sigDataUrl) openSigModal(); else toast('Signature ready — use "Create signature" to add another.'); return; }
	if(tool==='crop'){ drawCropPreview(); return; }
});
/* draw freehand */
function startDraw(e:PointerEvent){
	const orig=originalOf(current);
	const pts:{x:number;y:number}[]=[];
	const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','ed-ann-svg');
	svg.style.position='absolute'; svg.style.inset='0'; svg.style.pointerEvents='none'; svg.style.width=el.canvas.style.width; svg.style.height=el.canvas.style.height;
	const path=document.createElementNS('http://www.w3.org/2000/svg','path'); path.setAttribute('fill','none'); path.setAttribute('stroke',opt.drawColor); path.setAttribute('stroke-width',String(opt.drawWidth)); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round'); path.setAttribute('opacity',String(opt.penOpacity/100));
	svg.appendChild(path); el.overlay.appendChild(svg);
	const add=(ev:PointerEvent)=>{ const p=relPos(ev); const pdf=toPdf(p.x,p.y); pts.push(pdf); path.setAttribute('d',pts.map((pt,i)=>{const cc=toCss(pt.x,pt.y);return `${i?'L':'M'}${cc.x.toFixed(1)} ${cc.y.toFixed(1)}`}).join(' ')); };
	const commit=()=>{ if(pts.length>1){ pushUndo(); anns.push({id:uid(),kind:'draw',page:orig,pts,color:opt.drawColor,width:opt.drawWidth,opacity:opt.penOpacity/100}); } renderOverlay(); };
	add(e);   // seed the stroke with the touch point
	gesture(e,add,commit,()=>{ svg.remove(); renderOverlay(); });   // a pinch aborts: the half-drawn stroke goes away
}
/* eraser: click or drag over anything you added to remove it */
function startErase(e:PointerEvent){
	let erased=false;
	const del=(target:EventTarget|null)=>{
		const node=(target as HTMLElement|null)?.closest?.('.ed-ann') as HTMLElement|null;
		if(!node?.dataset.id)return false;
		const a=anns.find(x=>x.id===node.dataset.id); if(!a)return false;
		pushUndo(); anns=anns.filter(x=>x!==a);
		if(selected===a.id){ selected=null; }
		erased=true; renderOverlay(); return true;
	};
	del(e.target);
	const move=(ev:PointerEvent)=>{ del(document.elementFromPoint(ev.clientX,ev.clientY)); };
	gesture(e,move,()=>{ if(erased)toast('Erased.'); });
}
/* box tools */
function startBox(e:PointerEvent,kind:'highlight'|'redact'|'shape'){
	const start=relPos(e);
	const ghost=document.createElement('div'); ghost.style.cssText='position:absolute;border:1.5px dashed var(--blue);pointer-events:none;box-sizing:border-box';
	if(kind==='highlight')ghost.style.background=opt.hlColor+'66';
	el.overlay.appendChild(ghost);
	const move=(ev:PointerEvent)=>{ const p=relPos(ev); const x=Math.min(p.x,start.x),y=Math.min(p.y,start.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y); Object.assign(ghost.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}); };
	const up=(ev:PointerEvent)=>{ ghost.remove();
		const p=relPos(ev); const x=Math.min(p.x,start.x),y=Math.min(p.y,start.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y);
		if(w<4||h<4)return;
		pushUndo();
		const tl=toPdf(x,y), br=toPdf(x+w,y+h);
		const orig=originalOf(current);
		const bx={id:uid(),kind,page:orig,x:Math.min(tl.x,br.x),y:Math.min(tl.y,br.y),w:Math.abs(br.x-tl.x),h:Math.abs(br.y-tl.y),color:kind==='highlight'?opt.hlColor:kind==='redact'?'#000000':opt.shapeColor,width:kind==='shape'?opt.shapeWidth:2,fill:kind==='shape'?opt.shapeFill:'none',dashed:kind==='shape'?opt.shapeDashed:false,opacity:kind==='highlight'?opt.hlOpacity/100:1,shape:(kind==='shape'?opt.shapeKind:'rect') as ShapeKind} as BoxAnn;
		anns.push(bx as Ann); renderOverlay(); select(bx.id);
	};
	gesture(e,move,up,()=>ghost.remove());
}

/* text: add */
function createTextEdit(p:{x:number;y:number}){
	// one text box at a time: re-focus the one already open instead of stacking another
	const existing=el.overlay.querySelector<HTMLTextAreaElement>('.ed-ann-textarea');
	if(existing){ existing.focus(); return; }
	pushUndo();
	const orig=originalOf(current);
	const pdf=toPdf(p.x,p.y);
	const s=mapScale();
	const size=opt.textSize;
	const ta=document.createElement('textarea');
	ta.className='ed-ann-textarea';
	ta.placeholder='Type here, then click anywhere else';
	ta.style.left=p.x+'px'; ta.style.top=Math.max(0,p.y-size*s)+'px'; ta.style.color=opt.textColor;
	ta.style.fontSize=(size*s)+'px'; ta.style.fontWeight=opt.textBold?'700':'400'; ta.style.fontStyle=opt.textItalic?'italic':'normal'; ta.style.textAlign=opt.textAlign;
	ta.style.fontFamily=FONT_CSS[opt.fontFamily];
	ta.style.minWidth=(120*s)+'px'; ta.style.zIndex='11';
	el.overlay.appendChild(ta);
	// focus after the click's default action, so the browser cannot yank focus back to the page
	ta.focus();
	setTimeout(()=>{ if(document.body.contains(ta)) ta.focus(); },0);
	const finish=()=>{
		const text=ta.value.trim(); ta.remove();
		if(!text){ undoStack.pop(); syncUndoButtons(); return; }
		const lines=text.split('\n');
		// measure the real rendered width instead of guessing, so nothing is clipped or wrapped away
		// (measure in page units: the overlay multiplies by the zoom scale)
		const ctx=document.createElement('canvas').getContext('2d');
		if(ctx) ctx.font=`${opt.textBold?'700 ':'400 '}${opt.textItalic?'italic ':''}${size}px ${FONT_CSS[opt.fontFamily]}`;
		const lineWidth=(l:string)=>ctx ? ctx.measureText(l||' ').width : l.length*size*0.6;
		const w=Math.max(20, Math.max(...lines.map(lineWidth))+6);
		const h=lines.length*size*1.25;
		const ann:TextAnn={id:uid(),kind:'text',page:orig,x:pdf.x,y:pdf.y-h,w,h,text,size:opt.textSize,color:opt.textColor,bold:opt.textBold,italic:opt.textItalic,align:opt.textAlign,font:opt.fontFamily,cover:null};
		anns.push(ann); renderOverlay(); select(ann.id);
	};
	ta.addEventListener('blur',finish,{once:true});
	ta.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ta.blur();} e.stopPropagation(); });
}

/* text: edit existing (cover + redraw) */
async function handleEdittextClick(p:{x:number;y:number}){
	if(!pdfjsDoc)return;
	const orig=originalOf(current);
	const pdf=toPdf(p.x,p.y);
	const s=mapScale();
	const page=await pdfjsDoc.getPage(orig+1);
	const tc=await page.getTextContent();
	const meta=pageMeta[orig];
	let best:any=null, bestDist=1e9;
	for(const it of tc.items as any[]){
		if(!it.str||!it.str.trim())continue;
		const tx=(pdfjs as any).Util.transform((page as any).getViewport({scale:1}).transform, it.transform);
		const fontH=Math.hypot(tx[2],tx[3])||it.height||10;
		const x=tx[4], top=meta.height-(tx[5]);
		const w=it.width||it.str.length*fontH*0.5;
		const cx=x+w/2, cy=top-fontH/2;
		const dist=Math.hypot(cx-pdf.x, cy-pdf.y);
		if(dist<bestDist && dist<Math.max(30,fontH)){ bestDist=dist; best={x, y:top-fontH, w, h:fontH, str:it.str}; }
	}
	if(!best){ toast('No text found there. Use "Add Text" instead.',true); return; }
	pushUndo();
	const ann:TextAnn={id:uid(),kind:'text',page:orig,x:best.x,y:best.y,w:best.w,h:best.h,text:best.str,size:Math.round(best.h),color:opt.textColor,bold:opt.textBold,italic:opt.textItalic,align:'left',font:opt.fontFamily,cover:'#ffffff'};
	anns.push(ann); renderOverlay(); select(ann.id);
	// open inline edit
	const node=el.overlay.querySelector(`[data-id="${ann.id}"]`) as HTMLElement|null;
	if(node){ beginInlineEdit(node,ann); }
}
function beginInlineEdit(node:HTMLElement,ann:TextAnn){
	const s=mapScale();
	node.setAttribute('contenteditable','true');
	node.style.background='#ffffffee'; node.style.outline='2px solid var(--blue)';
	node.focus();
	const range=document.createRange(); range.selectNodeContents(node);
	const sel=window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
	const finish=()=>{
		node.removeAttribute('contenteditable');
		const t=node.textContent||'';
		pushUndo(); ann.text=t;
		if(!t.trim()){ anns=anns.filter(a=>a.id!==ann.id); }
		renderOverlay(); select(ann.id);
	};
	node.addEventListener('blur',finish,{once:true});
	node.addEventListener('keydown',(e)=>{ e.stopPropagation(); if(e.key==='Escape')node.blur(); });
}

/* image insert — images are only added with the "Choose image…" button, never by clicking the page */
function placeImageCentered(){
	if(!pendingImage){ el.imageFile.click(); return; }
	const meta=pageMeta[originalOf(current)];
	if(!meta){ toast('Open a PDF first.',true); return; }
	const s=mapScale();
	placeImage({x:meta.width*s/2,y:meta.height*s/2});
}
function placeImage(p:{x:number;y:number}){
	if(!pendingImage) return;
	pushUndo();
	const orig=originalOf(current); const meta=pageMeta[originalOf(current)];
	const s=mapScale();
	let w=pendingImageSize.w, h=pendingImageSize.h;
	// scale down if too big
	const maxW=meta.width*0.7;
	if(w>maxW){ h=h*maxW/w; w=maxW; }
	const maxH=meta.height*0.7;
	if(h>maxH){ w=w*maxH/h; h=maxH; }
	const pdf=toPdf(p.x,p.y);
	const ann:ImageAnn={id:uid(),kind:'image',page:orig,x:pdf.x-w/2,y:pdf.y-h/2,w,h,data:pendingImage,mime:pendingImageMime,rot:0};
	anns.push(ann); pendingImage=null;
	// drop straight into Select so it can be moved or resized right away
	setTool('select'); select(ann.id);
}
/* signature is added from the modal's button — never by clicking the page */

/* drag / resize annotations */
function wireAnn(node:HTMLElement,a:Ann){
	node.addEventListener('pointerdown',(e)=>{
		if(!canGrab(a))return;
		e.stopPropagation(); select(a.id); startDragAnn(e,a);
	});
	if(selected===a.id){ node.classList.add('selected'); addHandles(node,a.id); }
}
function startDragAnn(e:PointerEvent,a:Ann){
	if(!canGrab(a))return;
	pushUndo();
	const start=relPos(e);
	const orig={...a} as any;
	const move=(ev:PointerEvent)=>{
		const p=relPos(ev); const dx=(p.x-start.x)/mapScale(), dy=(p.y-start.y)/mapScale();
		if('x' in a){ (a as any).x=orig.x+dx; (a as any).y=orig.y-dy; }
		renderOverlay();
	};
	gesture(e,move,()=>renderOverlay(),()=>{ Object.assign(a,orig); renderOverlay(); });
}
function startResize(e:PointerEvent,a:Ann,corner:'tl'|'tr'|'bl'|'br'){
	pushUndo();
	const start=relPos(e); const o={...a} as any;
	const move=(ev:PointerEvent)=>{
		const p=relPos(ev); const s=mapScale();
		const dx=(p.x-start.x)/s, dy=(p.y-start.y)/s;
		let x=o.x,y=o.y,w=o.w,h=o.h;
		if(corner==='br'){ w=o.w+dx; y=o.y-dy; h=o.h+dy; }           // left fixed, top fixed → bottom-right corner
		if(corner==='bl'){ x=o.x+dx; w=o.w-dx; y=o.y-dy; h=o.h+dy; }  // right fixed, top fixed → bottom-left corner
		if(corner==='tr'){ w=o.w+dx; h=o.h-dy; }                      // left fixed, bottom fixed → top-right corner
		if(corner==='tl'){ x=o.x+dx; w=o.w-dx; h=o.h-dy; }            // right fixed, bottom fixed → top-left corner
		if(w<6){w=6;} if(h<6){h=6;}
		(a as any).x=x;(a as any).y=y;(a as any).w=w;(a as any).h=h;
		renderOverlay();
	};
	gesture(e,move,()=>renderOverlay(),()=>{ Object.assign(a,o); renderOverlay(); });
}

/* keyboard */
window.addEventListener('keydown',(e)=>{
	const tag=(e.target as HTMLElement)?.tagName;
	if(tag==='INPUT'||tag==='TEXTAREA'||(e.target as HTMLElement)?.isContentEditable)return;
	if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
	if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
	if(e.key==='Delete'||e.key==='Backspace'){ if(selected){ pushUndo(); anns=anns.filter(a=>a.id!==selected); selected=null; renderOverlay(); } return; }
	if(e.key==='Escape'){ select(null); return; }
	// tool shortcuts intentionally disabled: plain letters belong to typing, not tool switching
});

/* ============================================================
   Crop
   ============================================================ */
function drawCropPreview(){
	const c=cropRect(); const s=mapScale();
	el.cropMask.hidden=false; el.cropMask.innerHTML='';
	const tl=toCss(c.x,c.y+c.h);
	const r=document.createElement('div'); r.className='ed-crop-rect';
	Object.assign(r.style,{left:tl.x+'px',top:tl.y+'px',width:c.w*s+'px',height:c.h*s+'px'});
	for(const pos of ['tl','tr','bl','br']){ const h=document.createElement('div'); h.className='ed-handle '+pos; h.dataset.handle=pos; r.append(h); }
	el.cropMask.appendChild(r);
	wireCropRect(r);
}
function syncCropInputs(){
	const m=opt.cropM;
	for(const [k,v] of [['cropL',m.l],['cropR',m.r],['cropT',m.t],['cropB',m.b]] as const){
		const i=el.options.querySelector<HTMLInputElement>(`[data-k="${k}"]`);
		if(i) i.value=String(Math.round(v));
	}
}
/** drag the crop box or its corners; the numeric margins follow live */
function wireCropRect(rect:HTMLElement){
	rect.addEventListener('pointerdown',(e)=>{
		e.preventDefault(); e.stopPropagation();
		const handle=(e.target as HTMLElement).dataset.handle as 'tl'|'tr'|'bl'|'br'|undefined;
		const s=mapScale(); const meta=pageMeta[originalOf(current)];
		if(!meta)return;
		const start=relPos(e); const m0={...opt.cropM};
		const move=(ev:PointerEvent)=>{
			const p=relPos(ev); const dx=(p.x-start.x)/s, dy=-(p.y-start.y)/s;
			const m={...m0};
			if(!handle){
				m.l=clamp(m0.l+dx,0,meta.width-2); m.r=clamp(m0.r-dx,0,meta.width-2);
				m.t=clamp(m0.t-dy,0,meta.height-2); m.b=clamp(m0.b+dy,0,meta.height-2);
			}else{
				if(handle[0]==='t'){ m.t=clamp(m0.t-dy,0,meta.height-2); } else { m.b=clamp(m0.b+dy,0,meta.height-2); }
				if(handle[1]==='l'){ m.l=clamp(m0.l+dx,0,meta.width-2); } else { m.r=clamp(m0.r-dx,0,meta.width-2); }
			}
			opt.cropM=m; syncCropInputs(); drawCropPreview();
		};
		const up=()=>{};
		gesture(e,move,up,()=>{ opt.cropM=m0; syncCropInputs(); drawCropPreview(); });
	});
}
function applyCrop(all:boolean){
	pushUndo();
	const orig=originalOf(current);
	const setCrop=(page:number,rect:{x:number;y:number;w:number;h:number})=>{
		const ex=anns.find(a=>a.kind==='crop'&&a.page===page);
		if(ex)anns=anns.filter(a=>a!==ex);
		anns.push({id:uid(),kind:'crop',page:page,x:rect.x,y:rect.y,w:rect.w,h:(rect as any).h} as CropAnn);
	};
	setCrop(orig,cropRectFor(orig));
	// "all pages" means the same margins on every page — each clamped to its own size
	if(all){ for(const o of pageOrder){ if(o===orig)continue; setCrop(o,cropRectFor(o)); } }
	dirty=true;
	// back to Select so the applied crop outline is visible right away
	setTool('select');
	toast(all?`Crop applied to all ${pageOrder.length} pages.`:'Crop applied to this page. Download to export it.');
}

/* ============================================================
   Export (pdf-lib)
   ============================================================ */
async function download(){
	if(!pdfDoc||!srcBytes){ return; }
	el.btnDownload.disabled=true; el.btnDownload.textContent='Preparing…';
	try{
		const out=await PDFDocument.create();
		// fonts: standard-14 families, embedded once per (family, bold, italic) combination
		const STD:Record<FontKey,[StandardFonts,StandardFonts,StandardFonts,StandardFonts]>={
			helvetica:[StandardFonts.Helvetica,StandardFonts.HelveticaBold,StandardFonts.HelveticaOblique,StandardFonts.HelveticaBoldOblique],
			times:[StandardFonts.TimesRoman,StandardFonts.TimesRomanBold,StandardFonts.TimesRomanItalic,StandardFonts.TimesRomanBoldItalic],
			courier:[StandardFonts.Courier,StandardFonts.CourierBold,StandardFonts.CourierOblique,StandardFonts.CourierBoldOblique],
		};
		const fontCache:Record<string,any>={};
		const getFont=async(f:FontKey,bold:boolean,italic:boolean)=>{
			const key=`${f}:${bold?1:0}:${italic?1:0}`;
			if(!fontCache[key]){ const [r,b,i,bi]=STD[f]||STD.helvetica; fontCache[key]=await out.embedFont(bold?(italic?bi:b):(italic?i:r)); }
			return fontCache[key] as any;
		};
		const fontReg=await getFont('helvetica',false,false);
		const fontBold=await getFont('helvetica',true,false);
		const fontIt=await getFont('helvetica',false,true);
		const fontBI=await getFont('helvetica',true,true);
		// embed source
		const src=await PDFDocument.load(srcBytes,{updateMetadata:false});
		for(let pos=0; pos<pageOrder.length; pos++){
			const orig=pageOrder[pos]!;
			const [p]=await out.copyPages(src,[orig]);
			out.addPage(p);
			const page=out.getPage(out.getPageCount()-1);
			const {width,height}=page.getSize();
			const rot=pageMeta[orig]?.rotation||0;
			// meta.rotation already carries the page's own rotation plus anything applied here
			if(rot) page.setRotation(degrees(rot%360));
			// crop — the box lives in unrotated media space, so map it through the page's own rotation
			const crop=anns.find(a=>a.kind==='crop'&&a.page===orig) as CropAnn|undefined;
			if(crop){
				const spage=await pdfjsDoc.getPage(orig+1);
				const vp=spage.getViewport({scale:1});
				// the stored rect is in display space (origin bottom-left)
				const tl=vp.convertToPdfPoint(crop.x, vp.height-(crop.y+crop.h));
				const br=vp.convertToPdfPoint(crop.x+crop.w, vp.height-crop.y);
				page.setCropBox(Math.min(tl[0],br[0]),Math.min(tl[1],br[1]),Math.abs(br[0]-tl[0]),Math.abs(br[1]-tl[1]));
			}
			// watermark
			if(watermark){
				const f=watermark.bold?fontBold:fontReg;
				const size=watermark.size;
				const tw=f.widthOfTextAtSize(watermark.text,size);
				page.drawText(watermark.text,{x:(width-tw)/2,y:height/2-size/3,size,font:f,color:hex(watermark.color),opacity:watermark.opacity/100,rotate:degrees(-watermark.angle)});
			}
			// annotations
			for(const a of annsFor(orig)){
				if(a.kind==='crop')continue;
				if(a.kind==='highlight'){ page.drawRectangle({x:a.x,y:a.y,width:a.w,height:a.h,color:hex(a.color),opacity:a.opacity??0.4}); }
				else if(a.kind==='redact'){ page.drawRectangle({x:a.x,y:a.y,width:a.w,height:a.h,color:rgb(0,0,0)}); }
				else if(a.kind==='shape'){
					const dash=a.dashed?[Math.max(2,a.width*2),Math.max(2,a.width*2)]:undefined;
					const fill=a.fill&&a.fill!=='none'?hex(a.fill):undefined;
					if(a.shape==='rect'){ page.drawRectangle({x:a.x,y:a.y,width:a.w,height:a.h,borderColor:hex(a.color),borderWidth:a.width,color:fill,borderDashArray:dash}); }
					else if(a.shape==='ellipse'){ page.drawEllipse({x:a.x+a.w/2,y:a.y+a.h/2,xScale:a.w/2,yScale:a.h/2,borderColor:hex(a.color),borderWidth:a.width,color:fill,borderDashArray:dash}); }
					else{
						const start={x:a.x,y:a.y}, end={x:a.x+a.w,y:a.y+a.h};
						page.drawLine({start,end,thickness:a.width,color:hex(a.color),dashArray:dash});
						if(a.shape==='arrow'){ // simple two-stroke head
							const ang=Math.atan2(a.h,a.w), hl=Math.max(6,a.width*4);
							for(const off of [Math.PI-0.42,Math.PI+0.42]){
								page.drawLine({start:end,end:{x:end.x+Math.cos(ang+off)*hl,y:end.y+Math.sin(ang+off)*hl},thickness:a.width,color:hex(a.color)});
							}
						}
					}
				}
				else if(a.kind==='draw'){
					for(let i=1;i<a.pts.length;i++){ page.drawLine({start:a.pts[i-1]!,end:a.pts[i]!,thickness:a.width,color:hex(a.color),opacity:a.opacity??1}); }
				}
				else if(a.kind==='image'){
					try{ const img=a.mime==='image/png'?await out.embedPng(a.data):await out.embedJpg(a.data); page.drawImage(img,{x:a.x,y:a.y,width:a.w,height:a.h}); }catch{ /* unsupported image */ }
				}
				else if(a.kind==='text'){
					if(a.cover){ page.drawRectangle({x:a.x-1,y:a.y-1,width:a.w+2,height:a.h+2,color:rgb(1,1,1)}); }
					const f=await getFont(a.font||'helvetica',a.bold,a.italic);
					const lines=a.text.split('\n');
					const lh=a.size*1.2;
					let anchorX=a.x;
					for(let i=0;i<lines.length;i++){
						const line=lines[i]!; const lw=f.widthOfTextAtSize(line,a.size);
						let x=anchorX; if(a.align==='center')x=a.x+(a.w-lw)/2; else if(a.align==='right')x=a.x+a.w-lw;
						const y=a.y+a.h-(i+1)*lh+a.size*0.2;
						page.drawText(line,{x,y,size:a.size,font:f,color:hex(a.color)});
					}
				}
			}
		}
		const bytes=await out.save();
		downloadBlob(bytes,fileName.replace(/\.pdf$/i,'')+'-edited.pdf');
		dirty=false; toast('Downloaded — nothing was uploaded.');
	}catch(e:any){ console.error(e); toast('Export failed: '+(e?.message||'unknown'),true); }
	finally{ el.btnDownload.disabled=false; el.btnDownload.textContent='Download'; }
}
function downloadBlob(data:Uint8Array,name:string){
	const url=URL.createObjectURL(new Blob([data],{type:'application/pdf'}));
	const a=document.createElement('a'); a.href=url; a.download=name; a.click();
	setTimeout(()=>URL.revokeObjectURL(url),1500);
}

/* ============================================================
   Signature modal
   ============================================================ */
let sigMode:'draw'|'type'='draw';
function openSigModal(){
	el.sigModal.hidden=false;
	if(!sigMode) setSigTab('draw');
}
function setSigTab(t:'draw'|'type'){
	sigMode=t;
	$$('.ed-sig-tab').forEach(b=>b.classList.toggle('is-active',(b as HTMLElement).dataset.sigtab===t));
	($('#ed-sigdraw') as HTMLElement).hidden = t!=='draw';
	($('#ed-sigtype') as HTMLElement).hidden = t!=='type';
}
function initSigPad(){
	const c=el.sigCanvas; const ctx=c.getContext('2d')!;
	ctx.strokeStyle='#111'; ctx.lineWidth=2.4; ctx.lineCap='round'; ctx.lineJoin='round';
	let drawing=false;
	const pos=(e:PointerEvent)=>{ const r=c.getBoundingClientRect(); return {x:(e.clientX-r.left)*(c.width/r.width), y:(e.clientY-r.top)*(c.height/r.height)}; };
	c.addEventListener('pointerdown',(e)=>{drawing=true;ctx.beginPath();const p=pos(e);ctx.moveTo(p.x,p.y);c.setPointerCapture(e.pointerId);});
	c.addEventListener('pointermove',(e)=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();});
	c.addEventListener('pointerup',()=>drawing=false);
	c.addEventListener('pointerleave',()=>drawing=false);
	$('#ed-sigclear')?.addEventListener('click',()=>ctx.clearRect(0,0,c.width,c.height));
}

/* ============================================================
   Wiring
   ============================================================ */
function goTo(pos:number){
	current=clamp(pos,0,pageOrder.length-1);
	updatePageIndicator();
	$$('.ed-thumb').forEach((n,i)=>n.classList.toggle('is-active',i===current));
	renderPage(); renderOverlay();
	const node=el.thumbs.children[current] as HTMLElement|null; node?.scrollIntoView({block:'nearest'});
	if(mode!=='edit') renderPanel();
}
function updatePageIndicator(){
	el.pageInput.value=String(current+1); el.pageCount.textContent=String(pageOrder.length);
	el.pageInput.max=String(pageOrder.length);
	el.prev.disabled=current===0; el.next.disabled=current===pageOrder.length-1;
}
function setZoom(z:number){
	fitMode=false; zoom=clamp(z,0.2,4); renderPage();
}
function renderPanel(){
	const p=el.panel;
	if(mode==='organize'){
		p.innerHTML=`<h3>Organize pages</h3>
		<p class="ed-note">Drag thumbnails on the left to reorder. Hover a page to rotate, duplicate or delete it.</p>
		<div class="ed-bulk">
			<button class="ed-btn" data-p="rotateall" type="button">Rotate all pages 90°</button>
			<button class="ed-btn" data-p="reverse" type="button">Reverse page order</button>
			<button class="ed-btn" data-p="merge" type="button">Merge another PDF…</button>
		</div>
		<p class="ed-note">Your changes apply when you press Download.</p>`;
	}else if(mode==='pages'){
		p.innerHTML=`<h3>Pages</h3>
		<div class="ed-row"><button class="ed-btn" data-p="addblank" type="button">Add blank page</button></div>
		<div class="ed-row"><button class="ed-btn" data-p="merge" type="button">Merge PDFs…</button></div>
		<div class="ed-row"><button class="ed-btn" data-p="split" type="button">Split & download pages</button></div>
		<div class="ed-row"><button class="ed-btn" data-p="extract" type="button">Download this page only</button></div>
		<p class="ed-note">Pages are processed locally and download straight to your device.</p>`;
	}else{ p.innerHTML=''; return; }
	p.onclick=(e)=>{
		const b=(e.target as HTMLElement).closest('button[data-p]') as HTMLButtonElement|null; if(!b)return;
		panelAction(b.dataset.p!);
	};
}
async function panelAction(a:string){
	if(a==='rotateall'){ pushUndo(); for(const o of pageOrder){pageMeta[o].rotation=(pageMeta[o].rotation+90)%360;} renderThumbs(); renderPage(); toast('Rotated all pages.'); }
	else if(a==='reverse'){ pushUndo(); pageOrder.reverse(); current=0; renderThumbs(); renderPage(); toast('Order reversed.'); }
	else if(a==='merge'){ el.mergeFile.click(); }
	else if(a==='addblank'){ toast('Adding a blank page…'); await addBlankPage(); }
	else if(a==='split'){ splitAndDownload(); }
	else if(a==='extract'){ extractCurrent(); }
}
async function addBlankPage(){
	if(!pdfDoc)return;
	pushUndo();
	try{
		const doc=await PDFDocument.load(srcBytes!,{updateMetadata:false});
		const last=doc.getPage(Math.max(0,doc.getPageCount()-1));
		const {width,height}=last.getSize();
		doc.addPage([width,height]);
		await reloadDoc(await doc.save());
		await cacheMissingMeta();
		current=pageOrder.length-1;
		el.docMeta.textContent=`${pageCount} pages`;
		await renderThumbs(); await renderPage(); updatePageIndicator();
		toast('Blank page added.');
	}catch(e:any){ console.error(e); toast('Could not add a blank page.',true); undoStack.pop(); syncUndoButtons(); }
}
async function splitAndDownload(){
	if(!pdfDoc)return;
	toast('Preparing individual pages…');
	const src=await PDFDocument.load(srcBytes!,{updateMetadata:false});
	for(let i=0;i<pageOrder.length;i++){
		const out=await PDFDocument.create();
		const [p]=await out.copyPages(src,[pageOrder[i]!]); out.addPage(p);
		const bytes=await out.save();
		downloadBlob(bytes,`${fileName.replace(/\.pdf$/i,'')}-page-${i+1}.pdf`);
		await new Promise(r=>setTimeout(r,220));
	}
	toast('Downloaded each page as its own PDF.');
}
async function extractCurrent(){
	if(!pdfDoc)return;
	const out=await PDFDocument.create();
	const src=await PDFDocument.load(srcBytes!,{updateMetadata:false});
	const [p]=await out.copyPages(src,[pageOrder[current]!]); out.addPage(p);
	const bytes=await out.save();
	downloadBlob(bytes,`${fileName.replace(/\.pdf$/i,'')}-page-${current+1}.pdf`);
	toast('Downloaded this page.');
}

/* events */
el.btnOpen.addEventListener('click',()=>el.file.click());
el.btnOpenEmpty.addEventListener('click',()=>el.file.click());
el.file.addEventListener('change',()=>{ const f=el.file.files?.[0]; if(f)openFile(f); el.file.value=''; });
el.imageFile.addEventListener('change',async()=>{ const f=el.imageFile.files?.[0]; el.imageFile.value=''; if(!f)return; await queueImage(f); placeImageCentered(); });
/* dark mode: follow the site theme, with an animated toggle in the editor top bar */
const themeBtn=$('#ed-theme') as HTMLButtonElement|null;
const themeRoot=document.documentElement;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let themeIconTimer=0, themeFadeTimer=0;
function applyTheme(t:'light'|'dark'){
	themeRoot.dataset.theme=t;
	document.body.dataset.theme=t;   // editor.css reads the theme from the body
	if(themeBtn){
		const next=t==='dark'?'light':'dark';
		themeBtn.title=`Switch to ${next} mode`;
		themeBtn.setAttribute('aria-label',`Switch to ${next} mode`);
	}
	try{ localStorage.setItem('theme',t); }catch{ /* private mode */ }
}
if(themeBtn){
	const popIcon=()=>{ themeBtn.classList.remove('is-toggling'); void themeBtn.offsetWidth; themeBtn.classList.add('is-toggling'); window.clearTimeout(themeIconTimer); themeIconTimer=window.setTimeout(()=>themeBtn.classList.remove('is-toggling'),600); };
	// crossfade fallback for browsers without the View Transitions API
	const fadeColors=()=>{ themeRoot.classList.remove('theme-animating'); void themeRoot.offsetWidth; themeRoot.classList.add('theme-animating'); window.clearTimeout(themeFadeTimer); themeFadeTimer=window.setTimeout(()=>themeRoot.classList.remove('theme-animating'),550); };
	// the inline head script already picked the starting theme
	applyTheme(themeRoot.dataset.theme==='dark'?'dark':'light');
	themeBtn.addEventListener('click',()=>{
		const next=themeRoot.dataset.theme==='dark'?'light':'dark';
		// checked at click time: if the API is unavailable (or throws) we fall back to a fade
		if(!reduceMotion.matches&&typeof document.startViewTransition==='function'){
			// expand the new theme outwards from the toggle button
			const rect=themeBtn.getBoundingClientRect();
			const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
			themeRoot.style.setProperty('--theme-reveal-x',`${x}px`);
			themeRoot.style.setProperty('--theme-reveal-y',`${y}px`);
			themeRoot.style.setProperty('--theme-reveal-r',`${Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))}px`);
			try{
				const vt=document.startViewTransition(()=>{ applyTheme(next); popIcon(); });
				// if the transition itself fails, make sure the theme still changes
				vt?.finished?.catch(()=>{ applyTheme(next); popIcon(); });
				return;
			}catch{ /* fall through to the fade */ }
		}
		applyTheme(next);
		if(!reduceMotion.matches){ fadeColors(); popIcon(); }
	});
}
/* load an image into the "pending image" slot, ready to be placed on the page */
async function queueImage(file:File){
	const buf=new Uint8Array(await file.arrayBuffer());
	pendingImage=buf; pendingImageMime=file.type||'image/png';
	await new Promise<void>(r=>{ const img=new Image(); img.onload=()=>{pendingImageSize={w:img.width,h:img.height};r();}; img.onerror=()=>r(); img.src=URL.createObjectURL(new Blob([buf],{type:pendingImageMime})); });
}
/* drag & drop: drop a PDF anywhere to open (or merge) it, drop an image to insert it */
const dropOverlay=$('#ed-dropoverlay') as HTMLElement|null;
let dragDepth=0;
const hasFiles=(e:DragEvent)=>!!e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter',(e)=>{ if(!hasFiles(e))return; e.preventDefault(); dragDepth++; if(dropOverlay)dropOverlay.hidden=false; });
window.addEventListener('dragover',(e)=>{ if(!hasFiles(e))return; e.preventDefault(); });
window.addEventListener('dragleave',()=>{ dragDepth=Math.max(0,dragDepth-1); if(!dragDepth&&dropOverlay)dropOverlay.hidden=true; });
window.addEventListener('drop',async(e)=>{
	if(!hasFiles(e)||!e.dataTransfer?.files.length)return;
	e.preventDefault(); dragDepth=0; if(dropOverlay)dropOverlay.hidden=true;
	const files=[...e.dataTransfer.files];
	const pdfs=files.filter(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));
	const imgs=files.filter(f=>/^image\//i.test(f.type));
	if(pdfs.length){ if(pdfDoc)await mergePdfs(pdfs); else await openFile(pdfs[0]!); return; }
	if(imgs.length&&pdfDoc){ await queueImage(imgs[0]!); placeImageCentered(); return; }
	toast('Drop a PDF file here to open it.',true);
});
el.mergeFile.addEventListener('change',async()=>{ const files=[...(el.mergeFile.files||[])]; el.mergeFile.value=''; await mergePdfs(files); });
el.btnDownload.addEventListener('click',download);
el.btnUndo.addEventListener('click',undo);
el.btnRedo.addEventListener('click',redo);
el.prev.addEventListener('click',()=>goTo(current-1));
el.next.addEventListener('click',()=>goTo(current+1));
el.pageInput.addEventListener('change',()=>goTo(Number(el.pageInput.value)-1));
el.zoomIn.addEventListener('click',()=>setZoom((fitMode?1:zoom)+0.2));
el.zoomOut.addEventListener('click',()=>setZoom((fitMode?1:zoom)-0.2));
el.zoomFit.addEventListener('click',()=>{fitMode=true;renderPage();});
$$('.ed-mode').forEach(b=>(b as HTMLElement).addEventListener('click',()=>setMode((b as HTMLElement).dataset.mode as Mode)));
$$('.ed-tool').forEach(b=>(b as HTMLElement).addEventListener('click',()=>setTool((b as HTMLElement).dataset.tool as Tool)));
$$('.ed-sig-tab').forEach(b=>(b as HTMLElement).addEventListener('click',()=>setSigTab((b as HTMLElement).dataset.sigtab as any)));
$('#ed-sigcancel')?.addEventListener('click',()=>{el.sigModal.hidden=true;});
$('#ed-sigadd')?.addEventListener('click',()=>{
	if(sigMode==='draw'){ sigDataUrl=el.sigCanvas.toDataURL('image/png'); }
	else{ const text=($('#ed-sigtext') as HTMLInputElement).value||'Your Name'; const c=document.createElement('canvas'); c.width=460;c.height=160; const ctx=c.getContext('2d')!; ctx.fillStyle='#111'; ctx.font='54px "Brush Script MT", cursive'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,230,80); sigDataUrl=c.toDataURL('image/png'); }
	el.sigModal.hidden=true;
	(async()=>{ if(!sigDataUrl)return; const buf=await (await fetch(sigDataUrl)).arrayBuffer(); pendingImage=new Uint8Array(buf); pendingImageMime='image/png'; pendingImageSize={w:220,h:76}; placeImageCentered(); })();
});
$('#ed-sigtext')?.addEventListener('input',(e)=>{ ($('#ed-sigpreview') as HTMLElement).textContent=(e.target as HTMLInputElement).value||'Your Name'; });
window.addEventListener('resize',()=>{ if(fitMode&&pdfDoc)renderPage(); });
window.addEventListener('beforeunload',(e)=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } });

async function mergePdfs(files:File[]){
	if(!files.length)return;
	const pdfs=files.filter(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));
	if(!pdfDoc){ const f=pdfs[0]; if(f)openFile(f); return; }
	pushUndo();
	try{
		const base=await PDFDocument.load(srcBytes!,{updateMetadata:false});
		let added=0;
		for(const f of pdfs){
			const doc=await PDFDocument.load(new Uint8Array(await f.arrayBuffer()),{updateMetadata:false});
			const copied=await base.copyPages(doc,doc.getPageIndices());
			for(const p of copied){ base.addPage(p); added++; }
		}
		if(!added){ toast('No PDF pages to merge.',true); undoStack.pop(); syncUndoButtons(); return; }
		await reloadDoc(await base.save());
		await cacheMissingMeta();
		current=Math.min(current,pageOrder.length-1);
		el.docMeta.textContent=`${pageCount} page${pageCount===1?'':'s'}`;
		await renderThumbs(); await renderPage(); updatePageIndicator();
		toast(`Merged ${added} page${added===1?'':'s'} into your document.`);
	}catch(e:any){ console.error(e); toast('Merge failed.',true); undoStack.pop(); syncUndoButtons(); }
}

initSigPad();
el.options.addEventListener('click',onOptionClick);
el.options.addEventListener('input',onOptionInput);
el.options.addEventListener('change',onOptionInput);
setTool('select');
setSigTab('draw');
