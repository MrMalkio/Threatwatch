(() => {
  if (window.__threatwatchClipboardGuardInstalled) return;
  Object.defineProperty(window,"__threatwatchClipboardGuardInstalled",{value:true});
  const CH="__THREATWATCH_PAGE_GUARD__";
  const patterns=[/\bpowershell(?:\.exe)?\b/i,/\bpwsh(?:\.exe)?\b/i,/\bcmd(?:\.exe)?\s*\/c\b/i,/\bmshta(?:\.exe)?\b/i,/\brundll32(?:\.exe)?\b/i,/\bregsvr32(?:\.exe)?\b/i,/\bcertutil(?:\.exe)?\b/i,/\bwscript(?:\.exe)?\b/i,/\bcscript(?:\.exe)?\b/i,/\binvoke-expression\b/i,/\biex\s*\(/i,/\bfrombase64string\b/i];
  const suspicious=text=>typeof text==="string"&&patterns.some(p=>p.test(text.slice(0,5000)));
  const report=detail=>{try{window.postMessage({channel:CH,type:"clipboard-blocked",payload:{sourceUrl:location.href,detail}},"*");}catch{}};
  try {
    const cb=navigator.clipboard;
    if(cb&&typeof cb.writeText==="function"){
      const native=cb.writeText.bind(cb);
      const guarded=text=>suspicious(text)?(report("Blocked a clipboard write containing a suspicious command payload."),Promise.reject(new DOMException("Blocked by Threatwatch","NotAllowedError"))):native(text);
      try{Object.defineProperty(cb,"writeText",{value:guarded,configurable:false,writable:false});}catch{try{cb.writeText=guarded;}catch{}}
    }
  } catch {}
})();
