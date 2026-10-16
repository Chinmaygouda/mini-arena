import * as THREE from 'three';
import type { WeaponId } from '@mini-arena/shared';
import type { WeaponClipName } from '../animation/types';
import type { WeaponViewmodel } from '../viewmodel';

export interface HandLabAmmo { weaponId: WeaponId; mag: number; reserve: number; magSize: number; reserveMax: number; }
export interface HandLabCallbacks {
  selectAssaultRifle: () => void;
  getAmmo: () => HandLabAmmo;
  setAmmo: (mag: number, reserve: number) => void;
  requestReload: (empty: boolean) => void;
  setInspectionCamera: (camera: THREE.PerspectiveCamera | null) => void;
  startMouseSweep: () => void;
}
type Side='right'|'left';
type Channel='x'|'y'|'z'|'rx'|'ry'|'rz';
const CLIPS:ReadonlyArray<{name:WeaponClipName;label:string}>=[
 {name:'idle',label:'Hip / idle'},{name:'walk',label:'Walk'},{name:'sprint',label:'Sprint'},
 {name:'ads',label:'ADS'},{name:'fire',label:'Fire / recoil'},{name:'draw',label:'Equip / draw'},
 {name:'holster',label:'Holster'},{name:'inspect',label:'Inspect'}
];

/** Development-only editor attached to the actual Three.js production viewmodel. */
export class HandLabOverlay {
 private root:HTMLDivElement|null=null;private mounted=false;private raf=0;private fpsStart=0;private fpsFrames=0;private fps=0;private metricTime=0;private lastClip='';
 private inspectCamera=new THREE.PerspectiveCamera(58,window.innerWidth/Math.max(1,window.innerHeight),.01,100);
 private markers=new THREE.Group();private socketGeom=new THREE.SphereGeometry(.006,10,8);private elbowGeom=new THREE.SphereGeometry(.007,10,8);
 private matR=new THREE.MeshBasicMaterial({color:0x22c55e,depthTest:false,depthWrite:false});private matL=new THREE.MeshBasicMaterial({color:0x38bdf8,depthTest:false,depthWrite:false});private matE=new THREE.MeshBasicMaterial({color:0xf59e0b,depthTest:false,depthWrite:false});
 private markR=new THREE.Mesh(this.socketGeom,this.matR);private markL=new THREE.Mesh(this.socketGeom,this.matL);private elbowR=new THREE.Mesh(this.elbowGeom,this.matE);private elbowL=new THREE.Mesh(this.elbowGeom,this.matE);
 private axesR=new THREE.AxesHelper(.065);private axesL=new THREE.AxesHelper(.065);
 private resize=():void=>{this.inspectCamera.aspect=window.innerWidth/Math.max(1,window.innerHeight);this.inspectCamera.updateProjectionMatrix();};
 constructor(private vm:WeaponViewmodel,private camera:THREE.PerspectiveCamera,private scene:THREE.Scene,private cb:HandLabCallbacks){
  this.inspectCamera.name='HandLab_Inspection_Camera';this.inspectCamera.position.set(.62,-.08,-.56);this.inspectCamera.userData.target=new THREE.Vector3(.05,-.16,-.58);
  this.markers.name='HandLab_Elbow_Markers';this.markers.add(this.elbowR,this.elbowL);
  for(const o of [this.markR,this.markL,this.elbowR,this.elbowL,this.axesR,this.axesL])o.visible=false;
  this.vm.animator.socketR.add(this.markR,this.axesR);this.vm.animator.socketL.add(this.markL,this.axesL);this.camera.add(this.inspectCamera);
 }
 private stopProp=(e:Event):void=>{e.stopPropagation();};
 public mount():void{
  if(this.mounted)return;this.mounted=true;this.vm.animator.setHandLabMode(true);this.scene.add(this.markers);
  this.root=document.createElement('div');this.root.id='mini-arena-hand-lab';this.root.innerHTML=this.markup();document.body.appendChild(this.root);
  this.root.addEventListener('click',this.click);this.root.addEventListener('input',this.input);this.root.addEventListener('change',this.change);this.root.addEventListener('pointerdown',this.stopProp);this.root.addEventListener('mousedown',this.stopProp);window.addEventListener('resize',this.resize);this.refreshClip();this.refreshAmmo();this.raf=window.requestAnimationFrame(this.tick);
 }
 public destroy():void{
  if(!this.mounted)return;this.mounted=false;window.cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.resize);
  this.root?.removeEventListener('click',this.click);this.root?.removeEventListener('input',this.input);this.root?.removeEventListener('change',this.change);this.root?.removeEventListener('pointerdown',this.stopProp);this.root?.removeEventListener('mousedown',this.stopProp);this.root?.remove();this.root=null;
  this.cb.setInspectionCamera(null);this.camera.remove(this.inspectCamera);this.vm.animator.socketR.remove(this.markR,this.axesR);this.vm.animator.socketL.remove(this.markL,this.axesL);this.scene.remove(this.markers);
  this.axesR.dispose();this.axesL.dispose();this.socketGeom.dispose();this.elbowGeom.dispose();this.matR.dispose();this.matL.dispose();this.matE.dispose();this.vm.animator.setHandLabMode(false);
 }
 private markup():string{
  const clips=CLIPS.map(c=>'<button class="hl-btn" data-clip="'+c.name+'">'+c.label+'</button>').join('');
  const sliders=(side:Side,title:string):string=>{
   const rows:[Channel,string,number,number,string][]=[['x','ΔX',-80,80,'mm'],['y','ΔY',-80,80,'mm'],['z','ΔZ',-80,80,'mm'],['rx','Pitch',-45,45,'°'],['ry','Yaw',-45,45,'°'],['rz','Roll',-45,45,'°']];
   return '<div class="hl-sub"><b>'+title+'</b>'+rows.map(r=>'<label class="hl-slider"><span>'+r[1]+' <small>'+r[4]+'</small></span><input type="range" min="'+r[2]+'" max="'+r[3]+'" value="0" step="1" data-side="'+side+'" data-channel="'+r[0]+'"><output data-out="'+side+'-'+r[0]+'">0</output></label>').join('')+'</div>';
  };
  return '<style>'+
  '#mini-arena-hand-lab{position:fixed;z-index:1200;top:12px;left:96px;width:min(360px,calc(100vw - 108px));max-height:calc(100vh - 24px);overflow:auto;padding:12px;color:#e2e8f0;background:rgba(7,12,22,.96);border:1px solid #38bdf8;border-radius:10px;box-shadow:0 14px 40px #0008;font:12px/1.4 ui-monospace,Consolas,monospace;user-select:text}'+
  '#mini-arena-hand-lab *{box-sizing:border-box}#mini-arena-hand-lab h2{margin:0;color:#38bdf8;font:700 14px system-ui}#mini-arena-hand-lab p{margin:5px 0 9px;color:#94a3b8;font-size:10px}'+
  '#mini-arena-hand-lab .hl-section{border-top:1px solid #263449;margin-top:9px;padding-top:7px}#mini-arena-hand-lab .hl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}#mini-arena-hand-lab .hl-row{display:flex;gap:4px;flex-wrap:wrap;margin:5px 0}'+
  '#mini-arena-hand-lab .hl-btn{padding:6px;border:1px solid #334155;border-radius:5px;background:#111c2e;color:#e2e8f0;cursor:pointer;font:inherit}#mini-arena-hand-lab .hl-btn:hover{border-color:#38bdf8}#mini-arena-hand-lab .hl-status{padding:6px;background:#0b2332;border-radius:5px;color:#a5f3fc}'+
  '#mini-arena-hand-lab .hl-metrics{display:grid;grid-template-columns:1fr 1fr;gap:4px}#mini-arena-hand-lab .hl-metric{padding:5px;background:#0c1423;border:1px solid #1f2d42;border-radius:4px}#mini-arena-hand-lab .hl-metric small{display:block;color:#94a3b8;font-size:9px}#mini-arena-hand-lab .hl-slider{display:grid;grid-template-columns:65px 1fr 28px;gap:4px;align-items:center;margin:4px 0}#mini-arena-hand-lab input[type=range]{width:100%;accent-color:#38bdf8}#mini-arena-hand-lab input[type=number]{width:56px;background:#0c1423;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:3px}#mini-arena-hand-lab .hl-sub{border-top:1px solid #1f2d42;padding-top:5px;margin-top:5px}#mini-arena-hand-lab .hl-sub b{color:#7dd3fc}#mini-arena-hand-lab .hl-check{display:flex;gap:5px;align-items:center;margin:3px 0}.hl-event{position:absolute;top:0;width:2px;height:7px;background:#fbbf24}'+
  '</style><h2>Assault Rifle Hand Lab</h2><p>Dev-only · production viewmodel · weapon-local tuning</p>'+
  '<div class="hl-row"><button class="hl-btn" data-action="rifle">Equip Rifle (1)</button><button class="hl-btn" data-action="reset">Reset</button><button class="hl-btn" data-action="export">Export JSON</button></div>'+
  '<div class="hl-status" data-role="status">Waiting for model assets…</div>'+
  '<section class="hl-section"><b>Diagnostics</b><div class="hl-metrics"><div class="hl-metric"><small>Weapon / clip</small><b data-m="clip">—</b></div><div class="hl-metric"><small>Clip time / tick</small><b data-m="time">—</b></div><div class="hl-metric"><small>Right wrist target error</small><b data-m="errR">—</b></div><div class="hl-metric"><small>Left wrist target error</small><b data-m="errL">—</b></div><div class="hl-metric"><small>Right reach / elbow</small><b data-m="reachR">—</b></div><div class="hl-metric"><small>Left reach / elbow</small><b data-m="reachL">—</b></div><div class="hl-metric"><small>FPS estimate</small><b data-m="fps">—</b></div><div class="hl-metric"><small>Finite values</small><b data-m="finite">—</b></div></div></section>'+
  '<section class="hl-section"><b>Animation clips</b><div class="hl-grid">'+clips+'</div><div class="hl-row"><button class="hl-btn" data-action="tactical">Tactical reload</button><button class="hl-btn" data-action="empty">Empty reload</button><button class="hl-btn" data-action="pause">Pause</button><button class="hl-btn" data-action="step">Step tick</button></div>'+
  '<label class="hl-slider"><span>Speed</span><input type="range" min=".1" max="2" value="1" step=".1" data-control="speed"><output data-role="speed">1.0×</output></label>'+
  '<div style="position:relative;padding-top:8px"><div data-role="events"></div><input data-control="scrub" type="range" min="0" max=".999" step=".001" value="0" style="width:100%"></div><small data-role="event-label" style="color:#64748b"></small><label class="hl-check"><input data-control="loop" type="checkbox"> Loop non-reload clips</label></section>'+
  '<section class="hl-section"><b>Shared ammo setup</b><div class="hl-row"><label>Mag <input data-control="mag" type="number" min="0" max="30" value="30"></label><label>Reserve <input data-control="reserve" type="number" min="0" max="90" value="90"></label><button class="hl-btn" data-action="ammo">Apply</button></div></section>'+
  '<section class="hl-section"><b>Inspection</b><div class="hl-grid"><button class="hl-btn" data-preset="fps">FPS</button><button class="hl-btn" data-preset="side">Side</button><button class="hl-btn" data-preset="top">Top</button><button class="hl-btn" data-preset="front">Front</button><button class="hl-btn" data-preset="rear">Rear</button><button class="hl-btn" data-action="sweep">5s mouse sweep</button></div><label class="hl-check"><input data-control="sockets" type="checkbox"> Socket markers / axes</label><label class="hl-check"><input data-control="elbows" type="checkbox"> Elbow markers</label></section>'+
  '<section class="hl-section"><b>Live tuning · positions mm / rotation degrees</b>'+sliders('right','Right grip')+sliders('left','Left handguard')+'</section><div class="hl-row"><button class="hl-btn" data-action="close">Close</button></div>';
 }
 private click=(event:MouseEvent):void=>{
  if(!(event.target instanceof HTMLElement))return;const item=event.target.closest<HTMLElement>('[data-action],[data-clip],[data-preset]');if(!item||!this.root?.contains(item))return;
  const a=item.dataset.action,clip=item.dataset.clip as WeaponClipName|undefined,preset=item.dataset.preset;
  if(a==='close'){this.destroy();return;}
  if(a==='rifle'){this.cb.selectAssaultRifle();this.vm.animator.setHandLabMode(true);this.vm.playClip('idle',true);this.status('Assault Rifle selected. Tuning targets the production viewmodel.');return;}
  if(a==='reset'){this.vm.animator.handLabPositionOffsetR.set(0,0,0);this.vm.animator.handLabPositionOffsetL.set(0,0,0);this.vm.animator.handLabRotationOffsetR.set(0,0,0);this.vm.animator.handLabRotationOffsetL.set(0,0,0);this.root.querySelectorAll<HTMLInputElement>('[data-side]').forEach(x=>x.value='0');this.root.querySelectorAll<HTMLOutputElement>('[data-out]').forEach(x=>x.value='0');this.vm.playClip('idle',true);return;}
  if(a==='export'){this.exportJSON();return;}if(a==='tactical'||a==='empty'){this.cb.requestReload(a==='empty');this.status('Reload requested through shared state.');return;}
  if(a==='ammo'){this.cb.setAmmo(this.number('[data-control=mag]',0),this.number('[data-control=reserve]',0));this.status('Development ammo values applied.');return;}
  if(a==='pause'){const p=this.vm.animator.getHandLabPlayback();this.vm.animator.setHandLabPlayback(!p.paused,p.speed,p.loop);item.textContent=p.paused?'Pause':'Resume';return;}
  if(a==='step'){this.vm.animator.stepHandLabTick();return;}if(a==='sweep'){this.cb.startMouseSweep();this.status('Started deterministic 5-second yaw/pitch sweep.');return;}
  if(clip){if(this.vm.currentVisualDef.weaponId!=='assault_rifle'){this.status('Select Assault Rifle first.');return;}if(!this.vm.currentVisualDef.clips[clip]){this.status('Clip not present in this visual definition.');return;}this.vm.animator.setHandLabMode(true);this.vm.playClip(clip,true);this.refreshClip();return;}
  if(preset)this.setPreset(preset);
 };
 private input=(event:Event):void=>{
  if(!(event.target instanceof HTMLInputElement)||!this.root)return;const el=event.target,side=el.dataset.side as Side|undefined,channel=el.dataset.channel as Channel|undefined;
  if(side&&channel){const rot=channel.startsWith('r'),i=channel==='x'||channel==='rx'?0:channel==='y'||channel==='ry'?1:2;const v=rot?THREE.MathUtils.degToRad(Number(el.value)):Number(el.value)/1000;
   const target=side==='right'?(rot?this.vm.animator.handLabRotationOffsetR:this.vm.animator.handLabPositionOffsetR):(rot?this.vm.animator.handLabRotationOffsetL:this.vm.animator.handLabPositionOffsetL);target.setComponent(i,v);
   const out=this.root.querySelector<HTMLOutputElement>('[data-out="'+side+'-'+channel+'"]');if(out)out.value=el.value;}
  if(el.dataset.control==='speed'){const p=this.vm.animator.getHandLabPlayback(),s=Math.max(.1,Math.min(2,Number(el.value)||1));this.vm.animator.setHandLabPlayback(p.paused,s,p.loop);const o=this.root.querySelector<HTMLOutputElement>('[data-role=speed]');if(o)o.value=s.toFixed(1)+'×';}
  if(el.dataset.control==='scrub'){this.vm.animator.scrubHandLabTo(this.vm.animator.getClipName() as WeaponClipName,Number(el.value));this.refreshClip();}
 };
 private change=(event:Event):void=>{if(!(event.target instanceof HTMLInputElement))return;const e=event.target;
  if(e.dataset.control==='loop'){const p=this.vm.animator.getHandLabPlayback();this.vm.animator.setHandLabPlayback(p.paused,p.speed,e.checked);}
  if(e.dataset.control==='sockets')this.markR.visible=this.markL.visible=this.axesR.visible=this.axesL.visible=e.checked;
  if(e.dataset.control==='elbows')this.elbowR.visible=this.elbowL.visible=e.checked;
 };
 private setPreset(which:string):void{if(which==='fps'){this.cb.setInspectionCamera(null);return;}this.cb.setInspectionCamera(this.inspectCamera);
  const poses:Record<string,{p:[number,number,number];t:[number,number,number]}>={
   side:{p:[.62,-.08,-.56],t:[.05,-.16,-.58]},top:{p:[.05,.65,-.58],t:[.05,-.16,-.58]},
   front:{p:[.05,-.16,-1.25],t:[.05,-.16,-.58]},rear:{p:[.05,-.1,.2],t:[.05,-.16,-.58]}};
  const p=poses[which]??poses.side!;this.inspectCamera.position.set(...p.p);this.inspectCamera.userData.target=new THREE.Vector3(...p.t);
 }
 private exportJSON():void{const def=this.vm.currentVisualDef;if(def.weaponId!=='assault_rifle'){this.status('Select Assault Rifle to export.');return;}const k=def.clips.idle.keyframes[0]!;
  const add=(p:THREE.Vector3,d:THREE.Vector3)=>[p.x+d.x,p.y+d.y,p.z+d.z],rot=(p:THREE.Euler,d:THREE.Vector3)=>[p.x+d.x,p.y+d.y,p.z+d.z];
  const data={schemaVersion:1,weaponId:'assault_rifle',coordinateSpace:'weapon-local',units:'metres',note:'Review the exported tuning before promoting values into source.',
   gripR:{position:add(k.rightHand.pos,this.vm.animator.handLabPositionOffsetR),rotationRadians:rot(k.rightHand.rot,this.vm.animator.handLabRotationOffsetR)},
   gripL:{position:add(k.leftHand.pos,this.vm.animator.handLabPositionOffsetL),rotationRadians:rot(k.leftHand.rot,this.vm.animator.handLabRotationOffsetL)},fingerGrips:def.fingerGrips};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='assault_rifle.handdef.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),0);this.status('Exported JSON; review before changing source.');
 }
 private number(s:string,f:number):number{const v=this.root?.querySelector<HTMLInputElement>(s)?.value,n=v===undefined?f:Number(v);return Number.isFinite(n)?n:f;}
 private status(s:string):void{const e=this.root?.querySelector<HTMLElement>('[data-role=status]');if(e)e.textContent=s;}
 private refreshAmmo():void{const a=this.cb.getAmmo(),m=this.root?.querySelector<HTMLInputElement>('[data-control=mag]'),r=this.root?.querySelector<HTMLInputElement>('[data-control=reserve]');if(m){m.max=String(a.magSize);m.value=String(a.mag);}if(r){r.max=String(a.reserveMax);r.value=String(a.reserve);}}
 private refreshClip():void{if(!this.root)return;const name=this.vm.animator.getClipName() as WeaponClipName,c=this.vm.currentVisualDef.clips[name],p=this.vm.animator.getHandLabProgress(),s=this.root.querySelector<HTMLInputElement>('[data-control=scrub]');if(s)s.value=String(Math.min(.999,p));
  const events=c?.events??[],marks=this.root.querySelector<HTMLElement>('[data-role=events]'),label=this.root.querySelector<HTMLElement>('[data-role=event-label]');
  if(marks)marks.innerHTML=events.map(e=>'<i class="hl-event" style="left:'+Math.max(0,Math.min(100,e.timeFraction*100))+'%" title="'+e.type+'"></i>').join('');
  if(label)label.textContent=events.map(e=>e.type+' @ '+Math.round(e.timeFraction*(c?.duration??0)*60)+' ticks').join(' · ')||'No cosmetic events';this.lastClip=name;
 }
 private updateDiagnostics():void{if(!this.root)return;const a=this.vm.animator,d=this.vm.currentVisualDef,n=a.getClipName();if(n!==this.lastClip)this.refreshClip();a.setHandLabMode(d.weaponId==='assault_rifle');
  const c=this.root.querySelector<HTMLElement>('[data-m=clip]'),t=this.root.querySelector<HTMLElement>('[data-m=time]');if(c)c.textContent=d.weaponId+' / '+n;if(t){const s=a.getHandLabProgress()*a.getCurrentClipDuration();t.textContent=s.toFixed(2)+'s / '+Math.round(s*60)+' ticks';}
  const fps=this.root.querySelector<HTMLElement>('[data-m=fps]');if(fps)fps.textContent=String(this.fps);const rig=this.vm.armsRig.skinnedArms;if(!rig){this.metric('errR','loading GLB…');this.metric('errL','loading GLB…');this.metric('reachR','—');this.metric('reachL','—');this.metric('finite','proxy / loading');return;}const sEl=this.root.querySelector<HTMLElement>('[data-role=status]');if(sEl&&sEl.textContent==='Waiting for model assets…')this.status('Production AK-47 & Skinned Arms Rig active. Ready for tuning.');
  this.scene.updateMatrixWorld(true);const pr=new THREE.Vector3(),pl=new THREE.Vector3(),qr=new THREE.Quaternion(),ql=new THREE.Quaternion();a.socketR.getWorldPosition(pr);a.socketL.getWorldPosition(pl);a.socketR.getWorldQuaternion(qr);a.socketL.getWorldQuaternion(ql);
  const tr=pr.clone().sub(this.vm.armsRig.palmOffsetLocalR.clone().applyQuaternion(qr)),tl=pl.clone().sub(this.vm.armsRig.palmOffsetLocalL.clone().applyQuaternion(ql));
  const wr=new THREE.Vector3(),wl=new THREE.Vector3(),sr=new THREE.Vector3(),sl=new THREE.Vector3(),er=new THREE.Vector3(),el=new THREE.Vector3();rig.handR.getWorldPosition(wr);rig.handL.getWorldPosition(wl);rig.upperArmR.getWorldPosition(sr);rig.upperArmL.getWorldPosition(sl);rig.forearmR.getWorldPosition(er);rig.forearmL.getWorldPosition(el);this.elbowR.position.copy(er);this.elbowL.position.copy(el);
  this.metric('errR',(wr.distanceTo(tr)*1000).toFixed(2)+' mm');this.metric('errL',(wl.distanceTo(tl)*1000).toFixed(2)+' mm');this.metric('reachR',this.reach(sr,tr,er));this.metric('reachL',this.reach(sl,tl,el));
  this.metric('finite',[pr.x,pr.y,pr.z,pl.x,pl.y,pl.z,wr.x,wr.y,wr.z,wl.x,wl.y,wl.z].every(Number.isFinite)?'PASS':'FAIL NaN/Inf');
 }
 private reach(s:THREE.Vector3,w:THREE.Vector3,e:THREE.Vector3):string{const d=s.distanceTo(w),a=s.clone().sub(e),b=w.clone().sub(e),den=a.length()*b.length(),ang=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(den>1e-7?a.dot(b)/den:1,-1,1)));return (d/.559512*100).toFixed(1)+'% / '+ang.toFixed(1)+'°';}
 private metric(k:string,v:string):void{const n=this.root?.querySelector<HTMLElement>('[data-m='+k+']');if(n)n.textContent=v;}
 private tick=(now:number):void=>{if(!this.mounted)return;this.fpsFrames++;if(!this.fpsStart)this.fpsStart=now;if(now-this.fpsStart>=1000){this.fps=Math.round(this.fpsFrames*1000/(now-this.fpsStart));this.fpsFrames=0;this.fpsStart=now;}if(now-this.metricTime>=100){this.updateDiagnostics();this.metricTime=now;}this.raf=window.requestAnimationFrame(this.tick);};
}
