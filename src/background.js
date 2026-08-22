const KEY = "threatwatchState";
const MODES = new Set(["normal", "strict", "learn"]);
const DEFAULT_PROFILES = [
  profile("cineby.tech", "Cineby"),
  profile("vumoo.to", "Vumoo")
];

function profile(domain, label = domain) {
  return {
    id: domain.replace(/[^a-z0-9]+/g, "-"), label, domain, enabled: true, mode: "strict",
    allowedTopLevelDomains: [domain], blockNotifications: true, blockPopups: true,
    blockAutomaticDownloads: true, blockSuspiciousClipboard: true,
    blockSuspiciousDownloads: true, removeClickOverlays: true
  };
}

function normalizeDomain(input = "") {
  try {
    const raw = String(input).trim().toLowerCase();
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch { return ""; }
}

function host(url = "") { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } }
function matchesDomain(h, d) { return h === d || h.endsWith(`.${d}`); }
function cleanUrl(url = "") {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? `${u.origin}${u.pathname}`.slice(0, 500) : `${u.protocol}${u.pathname}`.slice(0,500); }
  catch { return String(url).slice(0,500); }
}
function findProfile(state, url) {
  const h = host(url);
  return state.profiles.find(p => p.enabled && matchesDomain(h, p.domain)) || null;
}
function allowed(url, p) {
  const h = host(url);
  return [p.domain, ...(p.allowedTopLevelDomains || [])].some(d => matchesDomain(h, d));
}

async function getState() {
  const got = await chrome.storage.local.get(KEY);
  const s = got[KEY];
  if (s) return normalizeState(s);
  const initial = normalizeState({ profiles: DEFAULT_PROFILES, blockedDomains: [], events: [] });
  await chrome.storage.local.set({ [KEY]: initial });
  return initial;
}
function normalizeState(input = {}) {
  const profiles = Array.isArray(input.profiles) ? input.profiles : DEFAULT_PROFILES;
  return {
    profiles: profiles.map(p => {
      const d = normalizeDomain(p.domain);
      return d ? { ...profile(d, p.label || d), ...p, domain: d, id: p.id || d.replace(/[^a-z0-9]+/g,"-"), mode: MODES.has(p.mode) ? p.mode : "strict", allowedTopLevelDomains: [...new Set([d, ...((p.allowedTopLevelDomains || []).map(normalizeDomain).filter(Boolean))])] } : null;
    }).filter(Boolean),
    blockedDomains: [...new Set((input.blockedDomains || []).map(normalizeDomain).filter(Boolean))],
    events: Array.isArray(input.events) ? input.events.slice(0, 750) : []
  };
}
async function saveState(s) { const n = normalizeState(s); await chrome.storage.local.set({ [KEY]: n }); return n; }

async function syncProtection(state) {
  await syncRules(state);
  await syncSettings(state);
  await syncMainScripts(state);
}

async function syncRules(state) {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const rules = [];
  let id = 1000;
  for (const p of state.profiles) {
    if (!p.enabled || !["strict","learn"].includes(p.mode)) continue;
    const excludes = [...new Set([p.domain, ...(p.allowedTopLevelDomains || [])])];
    rules.push({ id: id++, priority: 10, action: { type: "block" }, condition: { initiatorDomains: [p.domain], excludedRequestDomains: excludes, resourceTypes: ["main_frame"] } });
    rules.push({ id: id++, priority: 9, action: { type: "block" }, condition: { topDomains: [p.domain], excludedRequestDomains: excludes, resourceTypes: ["main_frame"] } });
  }
  for (const d of state.blockedDomains) {
    rules.push({ id: id++, priority: 20, action: { type: "block" }, condition: { requestDomains: [d], resourceTypes: ["main_frame","sub_frame","script","xmlhttprequest","media","object","other"] } });
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id), addRules: rules });
}

async function syncSettings(state) {
  await Promise.all([
    chrome.contentSettings.notifications.clear({scope:"regular"}),
    chrome.contentSettings.popups.clear({scope:"regular"}),
    chrome.contentSettings.automaticDownloads.clear({scope:"regular"})
  ]);
  const jobs = [];
  for (const p of state.profiles.filter(x => x.enabled)) {
    for (const scheme of ["http","https"]) {
      const primaryPattern = `${scheme}://[*.]${p.domain}/*`;
      if (p.blockNotifications) jobs.push(chrome.contentSettings.notifications.set({primaryPattern, setting:"block"}));
      if (p.blockPopups) jobs.push(chrome.contentSettings.popups.set({primaryPattern, setting:"block"}));
      if (p.blockAutomaticDownloads) jobs.push(chrome.contentSettings.automaticDownloads.set({primaryPattern, setting:"block"}));
    }
  }
  await Promise.all(jobs);
}

async function syncMainScripts(state) {
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const ids = existing.filter(s => s.id.startsWith("tw-")).map(s => s.id);
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  const scripts = [];
  for (const p of state.profiles) {
    if (!p.enabled || !["strict","learn"].includes(p.mode)) continue;
    const matches = [`http://${p.domain}/*`,`https://${p.domain}/*`,`http://*.${p.domain}/*`,`https://*.${p.domain}/*`];
    scripts.push({ id:`tw-${p.id}-base`, matches, js:["src/page-guard.js"], runAt:"document_start", allFrames:true, matchOriginAsFallback:true, world:"MAIN", persistAcrossSessions:true });
    if (p.blockSuspiciousClipboard) scripts.push({ id:`tw-${p.id}-clip`, matches, js:["src/clipboard-guard.js"], runAt:"document_start", allFrames:true, matchOriginAsFallback:true, world:"MAIN", persistAcrossSessions:true });
  }
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
}

let eventQueue = Promise.resolve();
function logEvent(raw) {
  eventQueue = eventQueue.catch(()=>{}).then(async () => {
    const s = await getState();
    s.events.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), type: String(raw.type || "unknown").slice(0,64), severity: raw.severity || "medium", action: raw.action || "observed", profileId: raw.profileId || "", sourceUrl: cleanUrl(raw.sourceUrl || ""), targetUrl: cleanUrl(raw.targetUrl || ""), detail: String(raw.detail || "").slice(0,500) });
    s.events = s.events.slice(0,750);
    await saveState(s);
  });
  return eventQueue;
}

chrome.runtime.onInstalled.addListener(async () => syncProtection(await getState()));
chrome.runtime.onStartup.addListener(async () => syncProtection(await getState()));

chrome.webNavigation.onCreatedNavigationTarget.addListener(async d => {
  let source; try { source = await chrome.tabs.get(d.sourceTabId); } catch { return; }
  const s = await getState(); const p = findProfile(s, source.url);
  if (!p || !["strict","learn"].includes(p.mode) || allowed(d.url,p)) return;
  try { await chrome.tabs.remove(d.tabId); } catch {}
  await logEvent({ type:"spawned-navigation", severity:"high", action:"closed", profileId:p.id, sourceUrl:source.url, targetUrl:d.url, detail:"Closed a new tab/window spawned from a protected site." });
});

chrome.downloads.onCreated.addListener(async item => {
  if (!item.referrer) return;
  const s = await getState(); const p = findProfile(s,item.referrer);
  if (!p || !p.blockSuspiciousDownloads) return;
  const candidate = (item.filename || item.finalUrl || item.url || "").toLowerCase().split(/[?#]/)[0];
  const risky = [".exe",".msi",".msix",".bat",".cmd",".ps1",".vbs",".js",".scr",".hta",".reg",".lnk",".jar",".apk",".dmg",".pkg"].some(x => candidate.endsWith(x));
  if (!risky) return;
  try { await chrome.downloads.cancel(item.id); } catch { return; }
  await logEvent({ type:"dangerous-download", severity:"high", action:"cancelled", profileId:p.id, sourceUrl:item.referrer, targetUrl:item.finalUrl || item.url, detail:"Cancelled a high-risk executable or script download." });
});

chrome.runtime.onMessage.addListener((m,sender,send) => {
  (async () => {
    const state = await getState();
    if (m.type === "bridge-init") {
      const p = findProfile(state, sender.tab?.url || sender.url || "");
      return { active: !!p, profile:p };
    }
    if (m.type === "event") {
      const p = findProfile(state, sender.tab?.url || m.event?.sourceUrl || "");
      if (p) await logEvent({ ...m.event, profileId:p.id });
      return {};
    }
    if (m.type === "get-state") return { state };
    if (m.type === "get-url-status") { const p = findProfile(state,m.url); const events = p ? state.events.filter(e=>e.profileId===p.id) : []; return { profile:p, eventCount:events.length, recentEvents:events.slice(0,8) }; }
    if (m.type === "save-state") { const saved = await saveState(m.state || {}); await syncProtection(saved); return { state:saved }; }
    if (m.type === "upsert-profile") {
      const d = normalizeDomain(m.profile?.domain); if (!d) throw new Error("Valid domain required");
      const np = { ...profile(d,m.profile?.label || d), ...(m.profile || {}), domain:d, id:m.profile?.id || d.replace(/[^a-z0-9]+/g,"-") };
      const i = state.profiles.findIndex(p=>p.id===np.id || p.domain===d); if (i>=0) state.profiles[i]=np; else state.profiles.push(np);
      const saved = await saveState(state); await syncProtection(saved); return { state:saved, profile:np };
    }
    if (m.type === "clear-events") { state.events=[]; return { state:await saveState(state) }; }
    return {};
  })().then(r=>send({ok:true,...r})).catch(e=>send({ok:false,error:e.message}));
  return true;
});

getState().then(syncProtection).catch(()=>{});
