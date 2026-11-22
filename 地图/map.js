
(() => {
'use strict';
const data=window.GTA6_MARKERS,svg=document.getElementById('map-svg'),image=document.getElementById('map-image'),viewport=document.getElementById('map-viewport'),pins=document.getElementById('map-pins'),regions=document.getElementById('map-regions'),list=document.getElementById('marker-list');
const pinElements=new Map(),listButtons=new Map(),ns='http://www.w3.org/2000/svg';
const leaders=document.getElementById('map-leaders'),items=new Map(),panels=new Map();
const progressKey='gta6-map-progress-v1',statusElements=new Map();
let progress=readProgress(),activeFilter='all',completedButton,starredButton;
let initialId;try{initialId=decodeURIComponent(location.hash.slice(1));}catch{initialId='';}
let selected=null,expandedId=null,box,drag=null;
function text(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
function link(label,href,primary=false,external=false){const e=text('a',label,'action'+(primary?' primary':''));e.href=href;if(external){e.target='_blank';e.rel='noopener noreferrer';}return e;}
function readProgress(){
 try{
  const saved=JSON.parse(window.localStorage.getItem(progressKey)||'{}'),clean={};
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return clean;
  Object.keys(saved).forEach(id=>{if(/^[a-z0-9-]+$/.test(id)&&saved[id]&&typeof saved[id]==='object')clean[id]={completed:saved[id].completed===true,starred:saved[id].starred===true};});return clean;
 }catch{return {};}
}
function state(m){return progress[m.id]||{completed:false,starred:false};}
function matches(m){const s=state(m);return activeFilter==='all'||(activeFilter==='incomplete'&&!s.completed)||(activeFilter==='completed'&&s.completed)||(activeFilter==='starred'&&s.starred);}
function updateProgress(m,key){
 progress[m.id]={...state(m),[key]:!state(m)[key]};
 const feedback=document.getElementById('save-status');feedback.hidden=false;
 try{window.localStorage.setItem(progressKey,JSON.stringify(progress));feedback.textContent='进度已保存在此浏览器';feedback.classList.remove('save-error');}
 catch{feedback.textContent='浏览器未能保存；当前更改仅在本次打开期间有效。';feedback.classList.add('save-error');}
 refreshProgress();drawRegions();positionPins();
}
function refreshProgress(){
 const completed=data.markers.filter(m=>state(m).completed).length,starred=data.markers.filter(m=>state(m).starred).length;
 const labels={all:'全部 '+data.markers.length,incomplete:'未完成 '+(data.markers.length-completed),starred:'★ 想去 '+starred,completed:'已完成 '+completed};
 Object.entries(labels).forEach(([filter,label])=>{const b=document.getElementById('filter-'+filter);b.textContent=label;b.setAttribute('aria-pressed',String(filter===activeFilter));});
 document.getElementById('marker-count').textContent='已完成 '+completed+' / '+data.markers.length+' 个地点';
 data.markers.forEach(m=>{
  const s=state(m),row=listButtons.get(m.id),pin=pinElements.get(m.id),badges=statusElements.get(m.id);items.get(m.id).hidden=!matches(m);
  [row,pin].forEach(e=>{e.classList.toggle('is-completed',s.completed);e.classList.toggle('is-starred',s.starred);});
  badges.completed.textContent=s.completed?'✓':'○';badges.completed.setAttribute('aria-label',s.completed?'已完成':'未完成');
  badges.starred.textContent=s.starred?'★':'';badges.pin.textContent=(s.completed?'✓':'')+(s.starred?'★':'');badges.pin.hidden=!s.completed&&!s.starred;
  const label='地点'+m.number+'：'+m.title+'，'+(s.completed?'已完成':'未完成')+(s.starred?'，星标想去':'');row.setAttribute('aria-label',label);pin.setAttribute('aria-label',label);
 });
 document.getElementById('filter-empty').hidden=data.markers.some(matches);
 if(selected&&!matches(selected))collapseDetails();
 if(completedButton&&starredButton&&selected){const s=state(selected);completedButton.textContent=s.completed?'✓ 已完成':'○ 未完成';completedButton.setAttribute('aria-pressed',String(s.completed));starredButton.textContent=s.starred?'★ 已星标':'☆ 星标想去';starredButton.setAttribute('aria-pressed',String(s.starred));}
}
function setFilter(filter){activeFilter=filter;if(selected&&!matches(selected))collapseDetails();refreshProgress();drawRegions();positionPins();}
function icons(m){
 const span=document.createElement('span');span.className='category-icons';span.setAttribute('aria-hidden','true');
 (m.categories||[]).forEach(category=>{
  if(category==='weapon'){
   const icon=document.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','category-icon weapon-icon');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.8');icon.setAttribute('stroke-linejoin','round');
   const body=document.createElementNS(ns,'path');body.setAttribute('d','M2 5h15v2h5v5H11l-2 8H4l2-8H2Z');icon.append(body);
   const detail=document.createElementNS(ns,'path');detail.setAttribute('d','M11 12v4h3l2-4M5 8h12');icon.append(detail);span.append(icon);
  }else if(category==='cash')span.append(text('span','$','category-cash'));
  else if(category==='vehicle')span.append(text('span','🚗','category-car'));
  else if(category==='aircraft')span.append(text('span','✈️','category-plane'));
 });return span;
}
function currentMap(){return data.map;}
function anchor(m){return m.position;}
function positionPins(){
 const matrix=svg.getScreenCTM();if(!matrix)return;const bounds=viewport.getBoundingClientRect(),placed=[];leaders.replaceChildren();
 data.markers.forEach(m=>{
  const e=pinElements.get(m.id);if(!matches(m)||!m.position){e.hidden=true;return;}
  const a=anchor(m),p=new DOMPoint(a.x,a.y).matrixTransform(matrix);e.hidden=p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom;if(e.hidden)return;
  const x=p.x-bounds.left,y=p.y-bounds.top,w=e.offsetWidth||76,h=e.offsetHeight||38;let foot={x,y};
  {
   const offsets=[[0,0],[-80,-20],[80,-20],[0,65],[-80,55],[80,55],[0,-80]];
   for(let ring=2;ring<=5;ring++)for(let i=0;i<12;i++){const angle=i*Math.PI/6;offsets.push([Math.cos(angle)*ring*72,Math.sin(angle)*ring*52]);}
   for(const [dx,dy] of offsets){const candidate={x:Math.max(w/2+6,Math.min(bounds.right-bounds.left-w/2-6,x+dx)),y:Math.max(h+15,Math.min(bounds.bottom-bounds.top-8,y+dy))};const r={l:candidate.x-w/2-4,r:candidate.x+w/2+4,t:candidate.y-h-14,b:candidate.y};foot=candidate;if(!placed.some(v=>r.l<v.r&&r.r>v.l&&r.t<v.b&&r.b>v.t)){placed.push(r);break;}}
   if(Math.abs(foot.x-x)+Math.abs(foot.y-y)>3){const line=document.createElementNS(ns,'line');Object.entries({x1:x,y1:y,x2:foot.x,y2:foot.y,stroke:'#f3ce72','stroke-width':1.5}).forEach(([k,v])=>line.setAttribute(k,v));leaders.append(line);}
  }
  e.style.left=foot.x+'px';e.style.top=foot.y+'px';e.classList.toggle('active',m.id===expandedId);
 });
}
const tileLayer=document.getElementById('map-tiles'),tileCache=new Map();
const localTiles=new Set(window.GTA6_LOCAL_TILES||[]),tileGroups=new Map();
for(let z=4;z<=6;z++){const g=document.createElementNS(ns,'g');tileLayer.append(g);tileGroups.set(z,g);}
let tileLevel=3,visibleTileKeys=new Set();
function renderTiles(){
 const config=data.map.tiles,matrix=svg.getScreenCTM();if(!config||!matrix||!box)return;
 const scale=Math.hypot(matrix.a,matrix.b)*(window.devicePixelRatio||1);
 const z=Math.max(3,Math.min(config.maxZoom,Math.ceil(Math.log2(scale))+1));
 // The SVG can show extra map area beside the viewBox when the viewport is wide.
 const bounds=viewport.getBoundingClientRect(),inverse=matrix.inverse();
 const start=new DOMPoint(bounds.left,bounds.top).matrixTransform(inverse),end=new DOMPoint(bounds.right,bounds.bottom).matrixTransform(inverse);
 const visible={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};
 const wanted=new Set();tileLevel=3;
 // Keep loaded parent tiles behind finer tiles while they load or if a file fails.
 for(let level=4;level<=z;level++){
  const size=config.tileSize/2**(level-1),b=config.nativeBounds,nativeFactor=2**(config.maxZoom-level);
  const x0=Math.max(Math.floor((visible.x+config.origin)/size),Math.floor(b[0]/nativeFactor)),x1=Math.min(Math.floor((visible.x+visible.w+config.origin)/size),Math.floor(b[2]/nativeFactor));
  const y0=Math.max(Math.floor((visible.y+config.origin)/size),Math.floor(b[1]/nativeFactor)),y1=Math.min(Math.floor((visible.y+visible.h+config.origin)/size),Math.floor(b[3]/nativeFactor));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const key=level+','+y+','+x;if(!localTiles.has(key))continue;wanted.add(key);tileLevel=Math.max(tileLevel,level);let entry=tileCache.get(key);
   if(!entry){
    const img=document.createElementNS(ns,'image');entry={img,loaded:false,failed:false,z:level};tileCache.set(key,entry);
    Object.entries({x:x*size-config.origin,y:y*size-config.origin,width:size+.01,height:size+.01,preserveAspectRatio:'none'}).forEach(([k,v])=>img.setAttribute(k,v));
    img.addEventListener('load',()=>{entry.loaded=true;entry.failed=false;tileStatus();});img.addEventListener('error',()=>{entry.failed=true;img.setAttribute('visibility','hidden');tileStatus();});
    img.setAttribute('href',config.url.replaceAll('{z}',level).replaceAll('{y}',y).replaceAll('{x}',x));tileGroups.get(level).append(img);
   }
   entry.visible=true;entry.img.setAttribute('visibility',entry.failed?'hidden':'visible');
  }
 }
 visibleTileKeys=wanted;
 tileCache.forEach((entry,key)=>{if(!wanted.has(key)){entry.visible=false;entry.img.setAttribute('visibility','hidden');}});
 if(tileCache.size>650)for(const [key,entry] of tileCache){if(!entry.visible){entry.img.remove();tileCache.delete(key);}if(tileCache.size<=450)break;}
 tileStatus();
}
function tileStatus(){
 const entries=[...visibleTileKeys].map(key=>tileCache.get(key)).filter(Boolean),pending=entries.filter(e=>!e.loaded&&!e.failed).length,failed=entries.filter(e=>e.failed).length;
 document.getElementById('tile-status').textContent=pending?'正在加载本地高清图块':failed?'部分本地图块未读取，已保留较清晰的下一级底图':tileLevel>3?'本地高清 · '+tileLevel+'/6 级 · 当前攻略地点周边细节':'本地全境底图 · 5120 × 6144 · 放大攻略地点可查看更细图块';
}
function renderView(){svg.setAttribute('viewBox',[box.x,box.y,box.w,box.h].join(' '));renderTiles();positionPins();}
function fit(){const m=currentMap();box={...(m.initialView||{x:0,y:0,w:m.width,h:m.height})};renderView();}
function drawRegions(){
 regions.replaceChildren();data.markers.filter(m=>m.position&&matches(m)).forEach(m=>{
  const color=state(m).completed?'#52dc8e':'#f3ce72',p=m.position,c=document.createElementNS(ns,'circle');
  Object.entries({cx:p.x,cy:p.y,r:p.radius,fill:color,'fill-opacity':'.06',stroke:color,'stroke-width':1.5,'stroke-dasharray':'5 5','vector-effect':'non-scaling-stroke'}).forEach(([k,v])=>c.setAttribute(k,v));regions.append(c);
 });
}
function collapseDetails(){
 if(expandedId){panels.get(expandedId).hidden=true;panels.get(expandedId).replaceChildren();listButtons.get(expandedId).setAttribute('aria-expanded','false');}
 expandedId=null;selected=null;completedButton=null;starredButton=null;
 listButtons.forEach(b=>b.setAttribute('aria-current','false'));positionPins();
}
function detailMap(m){
 const d=m.detailMap,figure=document.createElement('figure'),a=document.createElement('a'),map=document.createElementNS(ns,'svg');
 figure.className='detail-map';a.href=d.image;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label','打开'+d.caption+'原图');
 map.setAttribute('viewBox','0 0 '+d.width+' '+d.height);map.setAttribute('role','img');map.setAttribute('aria-label',d.caption+(d.point?'，十字为定位参照':''));
 const img=document.createElementNS(ns,'image');Object.entries({href:d.image,width:d.width,height:d.height}).forEach(([k,v])=>img.setAttribute(k,v));map.append(img);
 if(d.point){const point=d.point,r=Math.max(12,d.width/42),circle=document.createElementNS(ns,'circle');Object.entries({cx:point.x,cy:point.y,r,fill:'none',stroke:'#ffdf66','stroke-width':4}).forEach(([k,v])=>circle.setAttribute(k,v));map.append(circle);
 [[-1,0],[1,0],[0,-1],[0,1]].forEach(([x,y])=>{const line=document.createElementNS(ns,'line');Object.entries({x1:point.x+x*r*1.2,y1:point.y+y*r*1.2,x2:point.x+x*r*1.9,y2:point.y+y*r*1.9,stroke:'#ffdf66','stroke-width':4}).forEach(([k,v])=>line.setAttribute(k,v));map.append(line);});}
 a.append(map);figure.append(a,text('figcaption',d.caption+' · 点击看原图'));return figure;
}
function select(m,toggle=false){
 if(toggle&&expandedId===m.id){collapseDetails();return;}
 collapseDetails();selected=m;expandedId=m.id;const details=panels.get(m.id);details.hidden=false;
 listButtons.get(m.id).setAttribute('aria-expanded','true');listButtons.get(m.id).setAttribute('aria-current','true');details.replaceChildren();


 details.append(text('p','地点 '+m.number,'eyebrow'),text('h2',m.title),text('p',m.location,'location'));
 const progressControls=document.createElement('div');progressControls.className='progress-controls';progressControls.setAttribute('role','group');progressControls.setAttribute('aria-label','地点完成情况与星标');
 completedButton=text('button','','completed-toggle');completedButton.type='button';completedButton.id='toggle-completed';completedButton.onclick=()=>updateProgress(m,'completed');
 starredButton=text('button','','starred-toggle');starredButton.type='button';starredButton.id='toggle-starred';starredButton.onclick=()=>updateProgress(m,'starred');progressControls.append(completedButton,starredButton);details.append(progressControls);
 const actions=document.createElement('div');actions.className='actions';actions.append(link(m.source.type==='normal'?'打开原图文':'打开原视频',m.source.url,true,true));details.append(actions,text('h3','可以获得'));
 const ul=document.createElement('ul');ul.className='rewards';m.rewards.forEach(r=>ul.append(text('li',r)));details.append(ul,text('p',m.rewardNote,'reward-note'));
 if(m.requirements)details.append(text('p',m.requirements,'requirements'));
 details.append(text('h3','攻略定位图'),detailMap(m),text('p',m.detailMap.note,'accuracy'));
 if(m.position?.note)details.append(text('p','全境参考：'+m.position.note,'accuracy'));
 (m.alternateMaps||[]).forEach(map=>{details.append(text('h3','补充定位图'),detailMap({detailMap:map}),text('p',map.note,'accuracy'));});
 details.append(text('h3','领取步骤'));
 const steps=document.createElement('ol');steps.className='steps';
 (m.walkthrough?.steps||[]).forEach(step=>{const li=document.createElement('li');if(step.time)li.append(text('span',step.time,'step-time'));li.append(text('p',step.text));steps.append(li);});details.append(steps);
 (m.walkthrough?.notes||[]).forEach(note=>details.append(text('p',note,'guide-note')));
 (m.additionalGuides||[]).forEach(guide=>{
  const section=document.createElement('section');section.className='additional-guide';section.append(text('h3',guide.title),text('p',guide.summary,'guide-note'));
  const steps=document.createElement('ol');steps.className='steps';guide.steps.forEach(step=>steps.append(text('li',step)));section.append(steps);guide.notes.forEach(note=>section.append(text('p',note,'guide-note')));
  section.append(link(guide.source.type==='normal'?'打开补充图文':'打开补充攻略',guide.source.url,false,true),text('p','来源：'+guide.source.author,'source-line'));details.append(section);
 });
 details.append(text('p','来源：'+m.source.author+(m.source.type==='normal'?' · 图文'+(m.source.imageCount?' · '+m.source.imageCount+'张图':''):' · 视频约'+m.source.durationSeconds+'秒'),'source-line'));
 refreshProgress();drawRegions();positionPins();
}
data.markers.forEach(m=>{
 const pin=text('button','','map-pin');pin.type='button';pin.title=m.number+' · '+m.shortTitle+'（全境参考）';const pinStatus=text('span','','pin-progress');pinStatus.setAttribute('aria-hidden','true');pin.append(text('span',String(m.number),'pin-number'),icons(m),pinStatus);pin.onclick=()=>{select(m);listButtons.get(m.id).scrollIntoView({block:'nearest'});};pins.append(pin);pinElements.set(m.id,pin);
 const row=text('button','','place-button');row.type='button';const status=document.createElement('span');status.className='place-progress';const star=text('span','','place-star'),completed=text('span','','place-completed');star.setAttribute('aria-hidden','true');status.append(star,completed);row.append(text('span',String(m.number),'place-number'),icons(m),text('span',m.shortTitle||m.title,'place-name'),status);row.id='place-toggle-'+m.id;row.setAttribute('aria-expanded','false');row.setAttribute('aria-controls','place-detail-'+m.id);row.onclick=()=>select(m,true);
 const item=document.createElement('div');item.className='place-item';const panel=document.createElement('article');panel.className='details';panel.id='place-detail-'+m.id;panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-labelledby',row.id);item.append(row,panel);list.append(item);items.set(m.id,item);panels.set(m.id,panel);listButtons.set(m.id,row);statusElements.set(m.id,{completed,starred:star,pin:pinStatus});
});
['all','incomplete','starred','completed'].forEach(filter=>{document.getElementById('filter-'+filter).onclick=()=>setFilter(filter);});
window.addEventListener('storage',event=>{if(event.key===progressKey||event.key===null){progress=readProgress();refreshProgress();drawRegions();positionPins();}});
function svgPoint(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
function zoom(factor,c){const m=currentMap(),matrix=svg.getScreenCTM(),pixelScale=matrix?Math.hypot(matrix.a,matrix.b)*(window.devicePixelRatio||1):1,nativeScale=2**((m.tiles?.maxZoom||6)-1),minWidth=box.w*pixelScale/nativeScale,w=Math.min(m.width*1.4,Math.max(minWidth,box.w*factor)),scale=w/box.w;box={x:c.x-(c.x-box.x)*scale,y:c.y-(c.y-box.y)*scale,w:w,h:box.h*scale};renderView();}
document.getElementById('zoom-in').onclick=()=>zoom(.75,{x:box.x+box.w/2,y:box.y+box.h/2});
document.getElementById('zoom-out').onclick=()=>zoom(1.333333,{x:box.x+box.w/2,y:box.y+box.h/2});
document.getElementById('fit-map').onclick=fit;
svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15,svgPoint(e));},{passive:false});
svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=svgPoint(e);svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');});
svg.addEventListener('pointermove',e=>{if(!drag)return;const p=svgPoint(e);box.x+=drag.x-p.x;box.y+=drag.y-p.y;renderView();});
const stop=()=>{drag=null;svg.classList.remove('dragging');};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);
new ResizeObserver(()=>{renderTiles();positionPins();}).observe(viewport);
refreshProgress();drawRegions();fit();const initial=data.markers.find(m=>m.id===initialId);if(initial)select(initial);
window.addEventListener('hashchange',()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const m=data.markers.find(m=>m.id===id);if(m){activeFilter='all';select(m);listButtons.get(m.id).scrollIntoView({block:'nearest'});}});
requestAnimationFrame(fit);
})();
