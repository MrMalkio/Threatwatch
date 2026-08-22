(() => {
  const CH="__THREATWATCH_PAGE_GUARD__";
  const eventTypes=new Set(["popup-blocked","protocol-blocked","clipboard-blocked"]);
  const risky=[".exe",".msi",".msix",".bat",".cmd",".ps1",".vbs",".js",".scr",".hta",".reg",".lnk",".jar",".apk",".dmg",".pkg"];
  const clickfix=[/press\s+(?:the\s+)?windows(?:\s+key)?\s*\+\s*r/i,/press\s+win\s*\+\s*r/i,/open\s+(?:the\s+)?run\s+(?:dialog|box|window)/i,/paste\s+(?:the\s+)?(?:command|verification|text).{0,80}(?:run|enter)/i,/(?:verify|verification).{0,100}(?:clipboard|paste|windows\s*\+\s*r|win\s*\+\s*r)/i];
  let cfg=null, warned=false, scanQueued=false;
  chrome.runtime.sendMessage({type:"bridge-init"}).then(r=>{if(r?.ok&&r.active&&r.profile){cfg=r.profile;activate();}}).catch(()=>{});
  window.addEventListener("message",e=>{if(!cfg||e.source!==window)return;const d=e.data;if(!d||d.channel!==CH||!eventTypes.has(d.type))return;report({type:d.type,severity:d.type==="clipboard-blocked"?"high":"medium",action:"blocked",sourceUrl:d.payload?.sourceUrl||location.href,targetUrl:d.payload?.targetUrl||"",detail:d.payload?.detail||"Blocked hostile behavior."});});
  function activate(){document.addEventListener("click",onClick,true);startObserver();queueScan();}
  function onClick(e){const a=findAnchor(e);if(!a)return;const href=a.href||a.getAttribute("href")||"";if(!href)return;
    let u;try{u=new URL(href,location.href);}catch{return;}
    if(!["http:","https:","mailto:","tel:","about:"].includes(u.protocol)){stop(e);report({type:"protocol-blocked",severity:"high",action:"blocked",sourceUrl:location.href,targetUrl:u.href,detail:"Blocked a non-web protocol launch."});return;}
    if(cfg.blockSuspiciousDownloads&&risky.some(x=>u.pathname.toLowerCase().endsWith(x))){stop(e);report({type:"dangerous-download",severity:"high",action:"blocked",sourceUrl:location.href,targetUrl:u.href,detail:"Blocked a high-risk executable or script download link."});return;}
    if(!["strict","learn"].includes(cfg.mode)||!/^https?:$/.test(u.protocol)||isAllowed(u.hostname))return;
    const target=(a.getAttribute("target")||"").toLowerCase();const canEscape=window===window.top||["_top","_parent","_blank"].includes(target);if(!canEscape)return;
    stop(e);report({type:"external-navigation",severity:"medium",action:"blocked",sourceUrl:location.href,targetUrl:u.href,detail:"Blocked an unexpected external navigation from a protected page."});
  }
  function findAnchor(e){const path=typeof e.composedPath==="function"?e.composedPath():[];for(const n of path)if(n?.tagName==="A")return n;let n=e.target;while(n&&n!==document){if(n.tagName==="A")return n;n=n.parentNode;}return null;}
  function stop(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}
  function isAllowed(h){return [cfg.domain,...(cfg.allowedTopLevelDomains||[])].some(d=>h===d||h.endsWith(`.${d}`));}
  function startObserver(){const begin=()=>{if(!document.documentElement)return setTimeout(begin,25);const o=new MutationObserver(()=>queueScan());o.observe(document.documentElement,{childList:true,subtree:true,attributes:true});};begin();}
  function queueScan(){if(scanQueued||warned)return;scanQueued=true;setTimeout(()=>{scanQueued=false;scanPage();},900);}
  function scanPage(){if(!document.body)return;const text=(document.body.innerText||"").replace(/\s+/g," ").slice(0,20000);if(!warned&&clickfix.some(p=>p.test(text))){warned=true;warning();report({type:"clickfix-warning",severity:"high",action:"warned",sourceUrl:location.href,detail:"Page text resembles a fake verification or ClickFix instruction flow."});}
    if(cfg.removeClickOverlays!==false)scanOverlays();}
  function scanOverlays(){const els=document.body?.querySelectorAll("*")||[];for(let i=0;i<Math.min(els.length,4000);i++){const el=els[i];if(el.dataset?.threatwatchNeutralized)return;let s,r;try{s=getComputedStyle(el);r=el.getBoundingClientRect();}catch{continue;}if(!["fixed","absolute"].includes(s.position)||s.pointerEvents==="none")continue;if(r.width/window.innerWidth<.72||r.height/window.innerHeight<.55)continue;const z=parseInt(s.zIndex,10),op=parseFloat(s.opacity||"1"),tiny=(el.textContent||"").trim().length<12,transparent=s.backgroundColor==="transparent"||/rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(s.backgroundColor);if(!Number.isFinite(z)||z<500||!(op<=.08||(transparent&&tiny)))continue;el.dataset.threatwatchNeutralized="true";el.style.setProperty("pointer-events","none","important");report({type:"click-overlay",severity:"medium",action:"neutralized",sourceUrl:location.href,detail:"Neutralized a transparent click-capture overlay."});}}
  function warning(){const host=document.createElement("div");host.dataset.threatwatchUi="true";host.style.cssText="all:initial;position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647";const sh=host.attachShadow({mode:"closed"});sh.innerHTML='<div style="width:min(720px,calc(100vw - 32px));box-sizing:border-box;border:1px solid #f04438;border-radius:12px;background:#101828;color:#fff;padding:14px;font:600 14px/1.45 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35)"><b style="color:#fda29b">Threatwatch warning:</b> this page resembles a ClickFix verification flow. Do not paste commands into Run, Terminal, PowerShell, or Command Prompt.</div>';(document.documentElement||document.body).appendChild(host);}
  function report(event){chrome.runtime.sendMessage({type:"event",event}).catch(()=>{});}
})();
