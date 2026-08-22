(() => {
  if (window.__threatwatchPageGuardInstalled) return;
  Object.defineProperty(window, "__threatwatchPageGuardInstalled", { value:true });
  const CH = "__THREATWATCH_PAGE_GUARD__";
  const report = (type,payload={}) => { try { window.postMessage({channel:CH,type,payload:{...payload,sourceUrl:location.href}},"*"); } catch {} };
  const parse = v => { try { return new URL(String(v || ""), location.href); } catch { return null; } };
  const dangerous = v => { const u=parse(v); return !!u && !["http:","https:","mailto:","tel:","about:"].includes(u.protocol); };
  const nativeOpen = window.open;
  function guardedOpen(url,...args) {
    const raw = url == null ? "" : String(url);
    if (!raw || raw === "about:blank") { report("popup-blocked",{targetUrl:raw || "about:blank",detail:"Blocked a blank popup/popunder target."}); return null; }
    if (dangerous(raw)) { report("protocol-blocked",{targetUrl:raw,detail:"Blocked a non-web protocol launch."}); return null; }
    return nativeOpen.call(window,url,...args);
  }
  try { Object.defineProperty(window,"open",{value:guardedOpen,configurable:false,writable:false}); } catch { try { window.open=guardedOpen; } catch {} }
})();
