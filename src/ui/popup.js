const elements = {
  health: document.querySelector("#health"),
  domain: document.querySelector("#domain"),
  message: document.querySelector("#message"),
  unprotected: document.querySelector("#unprotected"),
  protected: document.querySelector("#protected"),
  newMode: document.querySelector("#new-mode"),
  protect: document.querySelector("#protect"),
  unprotectedAvatar: document.querySelector("#unprotected-avatar"),
  protectedAvatar: document.querySelector("#protected-avatar"),
  profileState: document.querySelector("#profile-state"),
  profileLabel: document.querySelector("#profile-label"),
  enabled: document.querySelector("#enabled"),
  mode: document.querySelector("#mode"),
  eventCount: document.querySelector("#event-count"),
  events: document.querySelector("#events"),
  options: document.querySelector("#options"),
  retry: document.querySelector("#retry")
};

let activeTab;
let status;

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || "Threatwatch request failed.");
  return response;
}

function setMessage(message = "") {
  elements.message.textContent = message;
  elements.message.className = "message error";
}

function initials(value = "") {
  const cleaned = String(value)
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
  const pieces = cleaned.split(/\s+/).filter(Boolean);

  if (pieces.length > 1) {
    return `${pieces[0][0] || ""}${pieces[1][0] || ""}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || "TW";
}

async function load() {
  try {
    setMessage("");
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url || !/^https?:/i.test(activeTab.url)) {
      throw new Error("Threatwatch can protect HTTP and HTTPS pages.");
    }

    const parsed = new URL(activeTab.url);
    elements.domain.textContent = parsed.hostname;
    elements.unprotectedAvatar.textContent = initials(parsed.hostname);
    status = await send("url.status", { url: activeTab.url });
    render();
  } catch (error) {
    setMessage(error.message);
  }
}

function render() {
  const health = status.runtime?.protectionStatus || "unknown";
  elements.health.textContent = health;
  elements.health.className = `status ${health}`;
  elements.retry.classList.toggle("hidden", health === "healthy");

  const profile = status.profile;
  elements.unprotected.classList.toggle("hidden", Boolean(profile));
  elements.protected.classList.toggle("hidden", !profile);

  if (profile) {
    const label = profile.label || profile.domain;
    elements.profileLabel.textContent = label;
    elements.protectedAvatar.textContent = initials(label);
    elements.enabled.checked = profile.enabled;
    elements.mode.value = profile.mode;
    elements.eventCount.textContent = String(status.eventCount || 0);
    elements.profileState.textContent = profile.enabled ? "Under watch" : "Watch paused";
    elements.profileState.className = `popup-state-label${profile.enabled ? "" : " off-watch"}`;
  }

  elements.events.replaceChildren();
  if (!status.recentEvents?.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const screen = document.createElement("span");
    screen.className = "empty-screen";
    screen.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = "No catches on this channel";
    const note = document.createElement("span");
    note.textContent = "Threatwatch will show recent interventions here.";
    empty.append(screen, title, note);
    elements.events.appendChild(empty);
    return;
  }

  for (const threatEvent of status.recentEvents) {
    const item = document.createElement("div");
    item.className = "event";

    const title = document.createElement("strong");
    title.textContent = `${threatEvent.action}: ${threatEvent.type}`;

    const target = document.createElement("div");
    target.className = "muted small";
    target.textContent = threatEvent.targetUrl ||
      new Date(threatEvent.timestamp).toLocaleString();

    item.append(title, target);
    elements.events.appendChild(item);
  }
}

elements.protect.addEventListener("click", async () => {
  try {
    setMessage("");
    const hostname = new URL(activeTab.url).hostname;
    await send("profile.create", {
      profile: {
        domain: hostname,
        label: hostname,
        mode: elements.newMode.value
      }
    });
    await load();
  } catch (error) {
    setMessage(error.message);
  }
});

elements.enabled.addEventListener("change", async () => {
  try {
    await send("profile.update", {
      profileId: status.profile.id,
      patch: { enabled: elements.enabled.checked }
    });
    await load();
  } catch (error) {
    setMessage(error.message);
  }
});

elements.mode.addEventListener("change", async () => {
  try {
    await send("profile.update", {
      profileId: status.profile.id,
      patch: { mode: elements.mode.value }
    });
    await load();
  } catch (error) {
    setMessage(error.message);
  }
});

elements.options.addEventListener("click", () => chrome.runtime.openOptionsPage());

elements.retry.addEventListener("click", async () => {
  try {
    await send("protection.retry");
    await load();
  } catch (error) {
    setMessage(error.message);
  }
});

load();
