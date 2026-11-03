import {bilingual,onLanguageChange} from '../../shared-client/i18n.ts';

export type GraphicsQuality='high'|'low';
export const GRAPHICS_KEY='parhelion-arena-graphics-v1';
type StoragePort={getItem(key:string):string|null;setItem(key:string,value:string):void};
export function initialGraphics(params:URLSearchParams,storage?:StoragePort):GraphicsQuality{
 if(params.has('low'))return 'low';
 try{return storage?.getItem(GRAPHICS_KEY)==='low'?'low':'high';}catch{return 'high';}
}
/** Stable drawing resolution. Performance mode reduces effects; neither mode
 * silently drops below one drawing pixel per CSS pixel during combat. */
export function graphicsPixelRatio(quality:GraphicsQuality,dpr:number,width:number,height:number){
 const ratio=Number.isFinite(dpr)&&dpr>0?dpr:1;
 const area=Math.max(1,(Number.isFinite(width)?width:1)*(Number.isFinite(height)?height:1));
 const budget=Math.max(1,Math.sqrt(6_000_000/area));
 return Math.max(1,Math.min(ratio,quality==='high'?2:1,budget));
}
export function mountGraphicsControl(dialog:HTMLElement,quality:GraphicsQuality,apply:(quality:GraphicsQuality)=>void,storage?:StoragePort){
 const label=document.createElement('label');label.className='arena-graphics';label.setAttribute('data-i18n-ignore','');
 const text=document.createElement('span'),select=document.createElement('select');select.id='arena-graphics';select.name='graphics';
 for(const value of ['high','low']){const option=document.createElement('option');option.value=value;select.append(option);}
 label.append(text,select);dialog.querySelector('.settings-sliders')!.after(label);select.value=quality;
 const render=()=>{text.textContent=bilingual('画质','Graphics');select.setAttribute('aria-label',bilingual('画质','Graphics'));select.options[0].textContent=bilingual('清晰','Sharp');select.options[1].textContent=bilingual('流畅','Smooth');};render();onLanguageChange(render);
 select.onchange=()=>{const value=select.value==='low'?'low':'high';apply(value);try{storage?.setItem(GRAPHICS_KEY,value);}catch{/* Applied for this session. */}const url=new URL(location.href);url.searchParams.delete('low');if(value==='low')url.searchParams.set('low','');history.replaceState(null,'',url);};
}
