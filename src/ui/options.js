const elements = {
  profiles: document.querySelector("#profiles"),
  blockedDomains: document.querySelector("#blocked-domains"),
  events: document.querySelector("#events"),
  health: document.querySelector("#health"),
  message: document.querySelector("#message"),
  retry: document.querySelector("#retry"),
  addProfile: document.querySelector("#add-profile"),
  profileDomain: document.querySelector("#profile-domain"),
  profileLabel: document.querySelector("#profile-label"),
  profileMode: document.querySelector("#profile-mode"),
  addBlock: document.querySelector("#add-block"),
  blockDomain: document.querySelector("#block-domain"),
  clearEvents: document.querySelector("#clear-events")
};

let snapshot = { config: { profiles: [], blockedDomains: [] }, events: [], runtime: {} };

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text != null) element.textContent = String(options.text);
  if (options.type) element.type = options.type;
  return element;
}

function showMessage(message = "", success = false) {
  elements.message.textContent = message;
  elements.message.className = success ? "success" : "error";
}

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || "Threatwatch request failed.");
  return response;
}

async function reload() {
  try {
    snapshot = await send("state.get");
    render();
  } catch (error) {
    showMessage(error.message);
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
  elements.health.textContent = status;
  elements.health.className = `status ${status}`;
  elements.retry.classList.toggle("hidden", status === "healthy");

  if (status === "degraded" && snapshot.runtime?.lastErrorCode) {
    showMessage(`Protection sync is degraded: ${snapshot.runtime.lastErrorCode}`);
  }
}

function renderProfiles() {
  elements.profiles.replaceChildren();

  if (!snapshot.config.profiles.length) {
    const empty = createElement("div", { className: "card muted", text: "No protected sites." });
    elements.profiles.appendChild(empty);
    return;
  }

  for (const profile of snapshot.config.profiles) {
    elements.profiles.appendChild(renderProfile(profile));
  }
}

function renderProfile(profile) {
  const card = createElement("article", { className: "card profile-card" });
  const header = createElement("div", { className: "row between" });
  const identity = createElement("div");
  identity.append(
    createElement("strong", { text: profile.label || profile.domain }),
    createElement("div", { className: "muted small", text: profile.domain })
  );

  const removeButton = createElement("button", { className: "danger", text: "Remove", type: "button" });
  removeButton.addEventListener("click", () => removeProfile(profile.id));
  header.append(identity, removeButton);

  const controls = createElement("div", { className: "profile-controls" });
  const modeLabel = createElement("label", { text: "Mode" });
  const modeSelect = createElement("select");
  for (const mode of ["normal", "strict", "learn"]) {
    const option = createElement("option", { text: mode[0].toUpperCase() + mode.slice(1) });
    option.value = mode;
    option.selected = profile.mode === mode;
    modeSelect.appendChild(option);
  }
  modeSelect.addEventListener("change", () => updateProfile(profile.id, { mode: modeSelect.value }));
  modeLabel.appendChild(modeSelect);

  const enabledLabel = createElement("label", { className: "checkbox-row" });
  const enabledCheckbox = createElement("input");
  enabledCheckbox.type = "checkbox";
  enabledCheckbox.checked = profile.enabled;
  enabledCheckbox.addEventListener("change", () => updateProfile(profile.id, { enabled: enabledCheckbox.checked }));
  enabledLabel.append(enabledCheckbox, document.createTextNode("Enabled"));
  controls.append(modeLabel, enabledLabel);

  const defenseRow = createElement("div", { className: "row" });
  defenseRow.append(
    renderDefenseToggle(profile, "blockSuspiciousDownloads", "Block risky downloads"),
    renderDefenseToggle(profile, "blockSuspiciousClipboard", "Block command clipboard writes"),
    renderDefenseToggle(profile, "removeClickOverlays", "Neutralize click overlays")
  );

  const allowSection = createElement("div", { className: "stack" });
  allowSection.appendChild(createElement("div", { className: "small muted", text: "Allowed top-level destination domains" }));
  const tags = createElement("div", { className: "tags" });

  for (const domain of profile.allowedTopLevelDomains || []) {
    const tag = createElement("span", { className: "tag" });
    tag.appendChild(document.createTextNode(domain));
    if (domain !== profile.domain) {
      const remove = createElement("button", { className: "small-button ghost", text: "×", type: "button" });
      remove.title = `Remove ${domain}`;
      remove.addEventListener("click", () => removeAllowedDomain(profile.id, domain));
      tag.appendChild(remove);
    }
    tags.appendChild(tag);
  }

  const allowForm = createElement("form", { className: "inline-form" });
  const allowLabel = createElement("label", { text: "Add destination domain" });
  const allowInput = createElement("input");
  allowInput.placeholder = "player.example";
  allowInput.autocomplete = "off";
  allowLabel.appendChild(allowInput);
  const allowButton = createElement("button", { className: "primary", text: "Allow", type: "submit" });
  allowForm.append(allowLabel, allowButton);
  allowForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const domain = allowInput.value.trim();
    if (!domain) return;
    await addAllowedDomain(profile.id, domain);
  });

  allowSection.append(tags, allowForm);
  card.append(header, controls, defenseRow, allowSection);
  return card;
}

function renderDefenseToggle(profile, key, labelText) {
  const label = createElement("label", { className: "checkbox-row small" });
  const checkbox = createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = profile[key] !== false;
  checkbox.addEventListener("change", () => updateProfile(profile.id, { [key]: checkbox.checked }));
  label.append(checkbox, document.createTextNode(labelText));
  return label;
}

function renderBlockedDomains() {
  elements.blockedDomains.replaceChildren();
  if (!snapshot.config.blockedDomains.length) {
    elements.blockedDomains.appendChild(createElement("span", { className: "muted small", text: "No global domains blocked." }));
    return;
  }

  for (const domain of snapshot.config.blockedDomains) {
    const tag = createElement("span", { className: "tag" });
    tag.appendChild(document.createTextNode(domain));
    const remove = createElement("button", { className: "small-button ghost", text: "×", type: "button" });
    remove.title = `Unblock ${domain}`;
    remove.addEventListener("click", () => removeBlockedDomain(domain));
    tag.appendChild(remove);
    elements.blockedDomains.appendChild(tag);
  }
}

function renderEvents() {
  elements.events.replaceChildren();
  for (const event of snapshot.events.slice(0, 150)) {
    const row = document.createElement("tr");
    const values = [
      new Date(event.timestamp).toLocaleString(),
      event.action,
      event.type + (event.decisionCandidate ? " · learn" : ""),
      event.targetUrl || "",
      event.sourceLayer || ""
    ];

    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    elements.events.appendChild(row);
  }
}

async function updateProfile(profileId, patch) {
  try {
    showMessage("");
    await send("profile.update", { profileId, patch });
    await reload();
  } catch (error) {
    showMessage(error.message);
    await reload();
  }
}

async function removeProfile(profileId) {
  try {
    showMessage("");
    await send("profile.delete", { profileId });
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
}

async function addAllowedDomain(profileId, domain) {
  try {
    showMessage("");
    await send("allowlist.add", { profileId, domain });
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
}

async function removeAllowedDomain(profileId, domain) {
  try {
    showMessage("");
    await send("allowlist.remove", { profileId, domain });
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
}

async function removeBlockedDomain(domain) {
  try {
    showMessage("");
    await send("blocklist.remove", { domain });
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
}

elements.addProfile.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    showMessage("");
    await send("profile.create", {
      profile: {
        domain: elements.profileDomain.value.trim(),
        label: elements.profileLabel.value.trim(),
        mode: elements.profileMode.value
      }
    });
    elements.addProfile.reset();
    elements.profileMode.value = "strict";
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
});

elements.addBlock.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    showMessage("");
    await send("blocklist.add", { domain: elements.blockDomain.value.trim() });
    elements.addBlock.reset();
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
});

elements.clearEvents.addEventListener("click", async () => {
  try {
    showMessage("");
    await send("events.clear");
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
});

elements.retry.addEventListener("click", async () => {
  try {
    showMessage("");
    await send("protection.retry");
    showMessage("Protection synchronized.", true);
    await reload();
  } catch (error) {
    showMessage(error.message);
  }
});

reload();
