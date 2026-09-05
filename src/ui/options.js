const byId = (id) => document.getElementById(id);

const ui = {
  profiles: byId("profiles"),
  blockedDomains: byId("blocked-domains"),
  events: byId("events"),
  health: byId("health"),
  message: byId("message"),
  retry: byId("retry"),
  addProfile: byId("add-profile"),
  profileDomain: byId("profile-domain"),
  profileLabel: byId("profile-label"),
  profileMode: byId("profile-mode"),
  addBlock: byId("add-block"),
  blockDomain: byId("block-domain"),
  clearEvents: byId("clear-events")
};

let snapshot = {
  config: { profiles: [], blockedDomains: [] },
  events: [],
  runtime: {}
};

function element(tagName, options = {}) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  return node;
}

function showMessage(message = "", success = false) {
  ui.message.textContent = message;
  ui.message.className = success ? "success" : "error";
}

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || "Threatwatch request failed.");
  return response;
}

async function refresh() {
  try {
    snapshot = await send("state.get");
    render();
  } catch (error) {
    showMessage(error.message);
  }
}

async function runMutation(type, payload = {}, successMessage = "") {
  try {
    showMessage("");
    await send(type, payload);
    if (successMessage) showMessage(successMessage, true);
    await refresh();
  } catch (error) {
    showMessage(error.message);
    await refresh();
  }
}

function render() {
  renderHealth();
  renderProfiles();
  renderBlockedDomains();
  renderEvents();
}

function renderHealth() {
  const status = snapshot.runtime?.protectionStatus || "unknown";
  ui.health.textContent = status;
  ui.health.className = `status ${status}`;
  ui.retry.classList.toggle("hidden", status === "healthy");

  if (status === "degraded" && snapshot.runtime?.lastErrorCode) {
    showMessage(`Protection sync is degraded: ${snapshot.runtime.lastErrorCode}`);
  }
}

function profileToggle(profile, key, labelText) {
  const label = element("label", { className: "checkbox-row small" });
  const checkbox = element("input");
  checkbox.type = "checkbox";
  checkbox.checked = profile[key] !== false;
  checkbox.addEventListener("change", () => {
    runMutation("profile.update", {
      profileId: profile.id,
      patch: { [key]: checkbox.checked }
    });
  });
  label.append(checkbox, document.createTextNode(labelText));
  return label;
}

function renderProfile(profile) {
  const card = element("article", { className: "card profile-card" });
  const header = element("div", { className: "row between" });
  const identity = element("div");
  identity.append(
    element("strong", { text: profile.label || profile.domain }),
    element("div", { className: "muted small", text: profile.domain })
  );

  const removeButton = element("button", { className: "danger", text: "Remove", type: "button" });
  removeButton.addEventListener("click", () => {
    runMutation("profile.delete", { profileId: profile.id });
  });
  header.append(identity, removeButton);

  const controls = element("div", { className: "profile-controls" });
  const modeLabel = element("label", { text: "Mode" });
  const modeSelect = element("select");
  for (const mode of ["normal", "strict", "learn"]) {
    const option = element("option", { text: mode[0].toUpperCase() + mode.slice(1) });
    option.value = mode;
    option.selected = profile.mode === mode;
    modeSelect.appendChild(option);
  }
  modeSelect.addEventListener("change", () => {
    runMutation("profile.update", {
      profileId: profile.id,
      patch: { mode: modeSelect.value }
    });
  });
  modeLabel.appendChild(modeSelect);

  const enabledLabel = element("label", { className: "checkbox-row" });
  const enabledCheckbox = element("input");
  enabledCheckbox.type = "checkbox";
  enabledCheckbox.checked = profile.enabled;
  enabledCheckbox.addEventListener("change", () => {
    runMutation("profile.update", {
      profileId: profile.id,
      patch: { enabled: enabledCheckbox.checked }
    });
  });
  enabledLabel.append(enabledCheckbox, document.createTextNode("Enabled"));
  controls.append(modeLabel, enabledLabel);

  const defenses = element("div", { className: "row" });
  defenses.append(
    profileToggle(profile, "blockSuspiciousDownloads", "Block download attempts"),
    profileToggle(profile, "blockSuspiciousClipboard", "Block command clipboard writes"),
    profileToggle(profile, "removeClickOverlays", "Neutralize click overlays")
  );

  const allowSection = element("div", { className: "stack" });
  allowSection.appendChild(element("div", {
    className: "small muted",
    text: "Allowed top-level destination domains"
  }));

  const tags = element("div", { className: "tags" });
  for (const domain of profile.allowedTopLevelDomains || []) {
    const tag = element("span", { className: "tag" });
    tag.appendChild(document.createTextNode(domain));

    if (domain !== profile.domain) {
      const remove = element("button", { className: "small-button ghost", text: "×", type: "button" });
      remove.title = `Remove ${domain}`;
      remove.addEventListener("click", () => {
        runMutation("allowlist.remove", { profileId: profile.id, domain });
      });
      tag.appendChild(remove);
    }
    tags.appendChild(tag);
  }

  const allowForm = element("form", { className: "inline-form" });
  const allowLabel = element("label", { text: "Add destination domain" });
  const allowInput = element("input");
  allowInput.placeholder = "player.example";
  allowInput.autocomplete = "off";
  allowLabel.appendChild(allowInput);
  const allowButton = element("button", { className: "primary", text: "Allow", type: "submit" });
  allowForm.append(allowLabel, allowButton);
  allowForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const domain = allowInput.value.trim();
    if (!domain) return;
    await runMutation("allowlist.add", { profileId: profile.id, domain });
  });

  allowSection.append(tags, allowForm);
  card.append(header, controls, defenses, allowSection);
  return card;
}

function renderProfiles() {
  ui.profiles.replaceChildren();
  if (!snapshot.config.profiles.length) {
    ui.profiles.appendChild(element("div", { className: "card muted", text: "No protected sites." }));
    return;
  }

  for (const profile of snapshot.config.profiles) {
    ui.profiles.appendChild(renderProfile(profile));
  }
}

function renderBlockedDomains() {
  ui.blockedDomains.replaceChildren();
  if (!snapshot.config.blockedDomains.length) {
    ui.blockedDomains.appendChild(element("span", {
      className: "muted small",
      text: "No global domains blocked."
    }));
    return;
  }

  for (const domain of snapshot.config.blockedDomains) {
    const tag = element("span", { className: "tag" });
    tag.appendChild(document.createTextNode(domain));
    const remove = element("button", { className: "small-button ghost", text: "×", type: "button" });
    remove.title = `Unblock ${domain}`;
    remove.addEventListener("click", () => runMutation("blocklist.remove", { domain }));
    tag.appendChild(remove);
    ui.blockedDomains.appendChild(tag);
  }
}

function renderEvents() {
  ui.events.replaceChildren();
  for (const threatEvent of snapshot.events.slice(0, 150)) {
    const row = document.createElement("tr");
    const values = [
      new Date(threatEvent.timestamp).toLocaleString(),
      threatEvent.action,
      threatEvent.type + (threatEvent.decisionCandidate ? " · learn" : ""),
      threatEvent.targetUrl || "",
      threatEvent.sourceLayer || ""
    ];

    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    ui.events.appendChild(row);
  }
}

ui.addProfile.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runMutation("profile.create", {
    profile: {
      domain: ui.profileDomain.value.trim(),
      label: ui.profileLabel.value.trim(),
      mode: ui.profileMode.value
    }
  });
  ui.addProfile.reset();
  ui.profileMode.value = "strict";
});

ui.addBlock.addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = ui.blockDomain.value.trim();
  if (!domain) return;
  await runMutation("blocklist.add", { domain });
  ui.addBlock.reset();
});

ui.clearEvents.addEventListener("click", () => runMutation("events.clear"));
ui.retry.addEventListener("click", () => {
  runMutation("protection.retry", {}, "Protection synchronized.");
});

refresh();
