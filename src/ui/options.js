const byId = (id) => document.getElementById(id);

const ui = {
  profiles: byId("profiles"),
  blockedDomains: byId("blocked-domains"),
  blockedCount: byId("blocked-count"),
  events: byId("events"),
  eventsEmpty: byId("events-empty"),
  health: byId("health"),
  message: byId("message"),
  retry: byId("retry"),
  addProfile: byId("add-profile"),
  profileDomain: byId("profile-domain"),
  profileLabel: byId("profile-label"),
  profileMode: byId("profile-mode"),
  addBlock: byId("add-block"),
  blockDomain: byId("block-domain"),
  clearEvents: byId("clear-events"),
  profileSearch: byId("profile-search"),
  profileSort: byId("profile-sort"),
  profileFilters: byId("profile-filters"),
  profileVisibleCount: byId("profile-visible-count"),
  profileTotalCount: byId("profile-total-count"),
  profileFilterNote: byId("profile-filter-note"),
  expandVisible: byId("expand-visible"),
  collapseAll: byId("collapse-all"),
  profileTotal: byId("profile-total"),
  profileActive: byId("profile-active"),
  profileShielded: byId("profile-shielded"),
  eventTotal: byId("event-total")
};

const VIEW_STORAGE_KEY = "threatwatch.options.watchlist-view.v1";
const MODE_ORDER = Object.freeze({ strict: 0, learn: 1, normal: 2 });
const MODE_COPY = Object.freeze({
  strict: "Blocks unexpected exits, downloads, protocol launches, and other hostile actions.",
  learn: "Uses Strict containment and marks navigation decisions for later review.",
  normal: "Logs unexpected web exits without running Strict-only page defenses."
});

let snapshot = {
  config: { profiles: [], blockedDomains: [] },
  events: [],
  runtime: {}
};

const viewState = loadViewState();

function loadViewState() {
  const fallback = {
    query: "",
    filter: "all",
    sort: "activity",
    expanded: new Set()
  };

  try {
    const stored = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || "{}");
    return {
      query: "",
      filter: ["all", "strict", "learn", "normal", "paused"].includes(stored.filter)
        ? stored.filter
        : fallback.filter,
      sort: ["activity", "name", "events", "mode"].includes(stored.sort)
        ? stored.sort
        : fallback.sort,
      expanded: new Set(Array.isArray(stored.expanded) ? stored.expanded : [])
    };
  } catch {
    return fallback;
  }
}

function saveViewState() {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      filter: viewState.filter,
      sort: viewState.sort,
      expanded: [...viewState.expanded]
    }));
  } catch {
    // View preferences are optional and must not block the settings page.
  }
}

function element(tagName, options = {}) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  if (options.title) node.title = options.title;
  return node;
}

function showMessage(message = "", success = false) {
  ui.message.textContent = message;
  ui.message.className = success ? "message success" : "message error";
}

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || "Threatwatch request failed.");
  return response;
}

async function refresh() {
  try {
    snapshot = await send("state.get");
    pruneExpandedProfiles();
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

function pruneExpandedProfiles() {
  const validIds = new Set(snapshot.config.profiles.map((profile) => profile.id));
  for (const profileId of viewState.expanded) {
    if (!validIds.has(profileId)) viewState.expanded.delete(profileId);
  }
  saveViewState();
}

function profileMetrics() {
  const metrics = new Map();

  for (const threatEvent of snapshot.events) {
    if (!threatEvent.profileId) continue;
    const current = metrics.get(threatEvent.profileId) || {
      count: 0,
      latest: 0,
      high: 0
    };

    current.count += 1;
    current.latest = Math.max(current.latest, Number(threatEvent.timestamp) || 0);
    if (threatEvent.severity === "high") current.high += 1;
    metrics.set(threatEvent.profileId, current);
  }

  return metrics;
}

function render() {
  renderHealth();
  renderStats();
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

function renderStats() {
  const profiles = snapshot.config.profiles;
  ui.profileTotal.textContent = String(profiles.length);
  ui.profileActive.textContent = String(profiles.filter((profile) => profile.enabled).length);
  ui.profileShielded.textContent = String(
    profiles.filter((profile) => profile.enabled && ["strict", "learn"].includes(profile.mode)).length
  );
  ui.eventTotal.textContent = String(snapshot.events.length);
  ui.blockedCount.textContent = String(snapshot.config.blockedDomains.length);
}

function filteredProfiles(metrics) {
  const query = viewState.query.trim().toLowerCase();
  const filtered = snapshot.config.profiles.filter((profile) => {
    const matchesQuery = !query || [profile.label, profile.domain]
      .some((value) => String(value || "").toLowerCase().includes(query));

    if (!matchesQuery) return false;
    if (viewState.filter === "paused") return !profile.enabled;
    if (["strict", "learn", "normal"].includes(viewState.filter)) {
      return profile.mode === viewState.filter;
    }
    return true;
  });

  const metricFor = (profile) => metrics.get(profile.id) || { count: 0, latest: 0, high: 0 };

  return filtered.sort((left, right) => {
    if (viewState.sort === "events") {
      return metricFor(right).count - metricFor(left).count ||
        left.domain.localeCompare(right.domain);
    }

    if (viewState.sort === "mode") {
      return (MODE_ORDER[left.mode] ?? 9) - (MODE_ORDER[right.mode] ?? 9) ||
        left.domain.localeCompare(right.domain);
    }

    if (viewState.sort === "name") {
      return (left.label || left.domain).localeCompare(right.label || right.domain);
    }

    return metricFor(right).latest - metricFor(left).latest ||
      metricFor(right).count - metricFor(left).count ||
      left.domain.localeCompare(right.domain);
  });
}

function profileToggle(profile, key, labelText) {
  const label = element("label", { className: "defense-toggle" });
  const checkbox = element("input");
  const visual = element("span", { className: "switch-track" });
  const copy = element("span", { className: "defense-copy", text: labelText });

  checkbox.type = "checkbox";
  checkbox.checked = profile[key] !== false;
  checkbox.addEventListener("change", () => {
    runMutation("profile.update", {
      profileId: profile.id,
      patch: { [key]: checkbox.checked }
    });
  });

  label.append(checkbox, visual, copy);
  return label;
}

function siteInitials(profile) {
  const value = String(profile.label || profile.domain || "TW")
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  const pieces = value.split(/\s+/).filter(Boolean);
  if (pieces.length > 1) {
    return `${pieces[0][0] || ""}${pieces[1][0] || ""}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase() || "TW";
}

function modeBadge(mode) {
  return element("span", {
    className: `mode-badge ${mode}`,
    text: mode
  });
}

function eventBadge(metric) {
  const label = metric.count === 1 ? "1 catch" : `${metric.count} catches`;
  const badge = element("span", {
    className: `catch-badge${metric.high ? " has-high" : ""}`,
    text: label
  });
  badge.title = metric.high
    ? `${metric.high} high-severity ${metric.high === 1 ? "event" : "events"}`
    : "No high-severity events";
  return badge;
}

function renderProfile(profile, metric) {
  const isExpanded = viewState.expanded.has(profile.id);
  const card = element("article", {
    className: `watchlist-item mode-${profile.mode}${profile.enabled ? "" : " is-paused"}${isExpanded ? " is-open" : ""}`
  });

  const summaryRow = element("div", { className: "watchlist-row" });
  const openButton = element("button", {
    className: "profile-open",
    type: "button",
    title: isExpanded ? "Close site controls" : "Open site controls"
  });
  const detailsId = `profile-details-${profile.id}`;
  openButton.setAttribute("aria-expanded", String(isExpanded));
  openButton.setAttribute("aria-controls", detailsId);

  const avatar = element("span", {
    className: "site-avatar",
    text: siteInitials(profile)
  });
  avatar.setAttribute("aria-hidden", "true");

  const identity = element("span", { className: "site-identity" });
  identity.append(
    element("strong", { className: "site-name", text: profile.label || profile.domain }),
    element("span", { className: "site-domain", text: profile.domain })
  );

  const summarySignals = element("span", { className: "profile-signals" });
  summarySignals.append(modeBadge(profile.mode), eventBadge(metric));

  const chevron = element("span", { className: "chevron", text: "›" });
  chevron.setAttribute("aria-hidden", "true");

  openButton.append(avatar, identity, summarySignals, chevron);
  openButton.addEventListener("click", () => {
    if (viewState.expanded.has(profile.id)) {
      viewState.expanded.delete(profile.id);
    } else {
      viewState.expanded.add(profile.id);
    }
    saveViewState();
    renderProfiles();
  });

  const enabledLabel = element("label", {
    className: "profile-power",
    title: profile.enabled ? "Pause protection for this site" : "Resume protection for this site"
  });
  const enabledText = element("span", {
    className: "sr-only",
    text: `Protection enabled for ${profile.domain}`
  });
  const enabledCheckbox = element("input");
  enabledCheckbox.type = "checkbox";
  enabledCheckbox.checked = profile.enabled;
  enabledCheckbox.setAttribute("aria-label", `Protection enabled for ${profile.domain}`);
  const enabledTrack = element("span", { className: "switch-track" });
  enabledCheckbox.addEventListener("change", () => {
    runMutation("profile.update", {
      profileId: profile.id,
      patch: { enabled: enabledCheckbox.checked }
    });
  });
  enabledLabel.append(enabledCheckbox, enabledTrack, enabledText);

  summaryRow.append(openButton, enabledLabel);

  const details = element("div", {
    className: `profile-details${isExpanded ? "" : " hidden"}`
  });
  details.id = detailsId;

  const detailGrid = element("div", { className: "profile-detail-grid" });

  const modeSection = element("section", { className: "detail-block" });
  modeSection.append(
    element("span", { className: "detail-kicker", text: "Watch mode" })
  );
  const modeSelect = element("select", { className: "mode-select" });
  modeSelect.setAttribute("aria-label", `Watch mode for ${profile.domain}`);
  for (const mode of ["strict", "learn", "normal"]) {
    const option = element("option", {
      text: mode[0].toUpperCase() + mode.slice(1)
    });
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
  modeSection.append(
    modeSelect,
    element("p", {
      className: "muted small mode-description",
      text: MODE_COPY[profile.mode] || MODE_COPY.strict
    })
  );

  const defenseSection = element("section", { className: "detail-block" });
  defenseSection.append(
    element("span", { className: "detail-kicker", text: "Active defenses" }),
    profileToggle(profile, "blockSuspiciousDownloads", "Block download attempts"),
    profileToggle(profile, "blockSuspiciousClipboard", "Block command clipboard writes"),
    profileToggle(profile, "removeClickOverlays", "Neutralize click overlays")
  );

  detailGrid.append(modeSection, defenseSection);

  const allowSection = element("section", { className: "allow-section" });
  const allowHeader = element("div", { className: "row between" });
  allowHeader.append(
    element("div", {
      className: "detail-kicker",
      text: "Allowed top-level destinations"
    }),
    element("span", {
      className: "counter-badge",
      text: String((profile.allowedTopLevelDomains || []).length)
    })
  );

  const tags = element("div", { className: "tags" });
  for (const domain of profile.allowedTopLevelDomains || []) {
    const tag = element("span", {
      className: `tag${domain === profile.domain ? " primary-domain" : ""}`
    });
    tag.appendChild(document.createTextNode(domain));

    if (domain !== profile.domain) {
      const remove = element("button", {
        className: "tag-remove",
        text: "×",
        type: "button",
        title: `Remove ${domain}`
      });
      remove.setAttribute("aria-label", `Remove allowed destination ${domain}`);
      remove.addEventListener("click", () => {
        runMutation("allowlist.remove", { profileId: profile.id, domain });
      });
      tag.appendChild(remove);
    }
    tags.appendChild(tag);
  }

  const allowForm = element("form", { className: "inline-form allow-form" });
  const allowLabel = element("label", { className: "grow-field" });
  allowLabel.append(
    element("span", { className: "sr-only", text: "Add destination domain" })
  );
  const allowInput = element("input");
  allowInput.placeholder = "player.example";
  allowInput.autocomplete = "off";
  allowLabel.appendChild(allowInput);
  const allowButton = element("button", {
    className: "button secondary",
    text: "Allow destination",
    type: "submit"
  });
  allowForm.append(allowLabel, allowButton);
  allowForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const domain = allowInput.value.trim();
    if (!domain) return;
    await runMutation("allowlist.add", { profileId: profile.id, domain });
  });

  allowSection.append(allowHeader, tags, allowForm);

  const footer = element("div", { className: "profile-footer" });
  const lastActivity = metric.latest
    ? `Last catch ${new Date(metric.latest).toLocaleString()}`
    : "No local catches for this site";
  footer.appendChild(element("span", {
    className: "muted small",
    text: lastActivity
  }));

  const removeButton = element("button", {
    className: "button danger subtle-danger",
    text: "Remove from watchlist",
    type: "button"
  });
  removeButton.addEventListener("click", () => {
    const confirmed = confirm(`Remove ${profile.label || profile.domain} from your watchlist?`);
    if (confirmed) runMutation("profile.delete", { profileId: profile.id });
  });
  footer.appendChild(removeButton);

  details.append(detailGrid, allowSection, footer);
  card.append(summaryRow, details);
  return card;
}

function renderProfiles() {
  const metrics = profileMetrics();
  const visibleProfiles = filteredProfiles(metrics);

  ui.profiles.replaceChildren();
  ui.profileVisibleCount.textContent = String(visibleProfiles.length);
  ui.profileTotalCount.textContent = String(snapshot.config.profiles.length);

  const filterName = viewState.filter === "all"
    ? "the full watchlist"
    : viewState.filter === "paused"
      ? "paused profiles"
      : `${viewState.filter} profiles`;
  ui.profileFilterNote.textContent = viewState.query
    ? `Searching ${filterName}`
    : `Showing ${filterName}`;

  for (const button of ui.profileFilters.querySelectorAll("[data-profile-filter]")) {
    const active = button.dataset.profileFilter === viewState.filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  ui.profileSort.value = viewState.sort;

  if (!visibleProfiles.length) {
    const empty = element("div", { className: "empty-state profile-empty" });
    const screen = element("span", { className: "empty-screen" });
    screen.setAttribute("aria-hidden", "true");
    empty.append(
      screen,
      element("strong", {
        text: snapshot.config.profiles.length ? "No sites match this view" : "Your watchlist is empty"
      }),
      element("span", {
        text: snapshot.config.profiles.length
          ? "Change the search or filter."
          : "Add a streaming site from the panel on the right."
      })
    );
    ui.profiles.appendChild(empty);
    return;
  }

  for (const profile of visibleProfiles) {
    ui.profiles.appendChild(
      renderProfile(profile, metrics.get(profile.id) || { count: 0, latest: 0, high: 0 })
    );
  }
}

function renderBlockedDomains() {
  ui.blockedDomains.replaceChildren();
  ui.blockedCount.textContent = String(snapshot.config.blockedDomains.length);

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
    const remove = element("button", {
      className: "tag-remove",
      text: "×",
      type: "button",
      title: `Unblock ${domain}`
    });
    remove.setAttribute("aria-label", `Unblock ${domain}`);
    remove.addEventListener("click", () => runMutation("blocklist.remove", { domain }));
    tag.appendChild(remove);
    ui.blockedDomains.appendChild(tag);
  }
}

function renderEvents() {
  ui.events.replaceChildren();
  const hasEvents = snapshot.events.length > 0;
  ui.eventsEmpty.classList.toggle("hidden", hasEvents);

  for (const threatEvent of snapshot.events.slice(0, 150)) {
    const row = document.createElement("tr");
    const action = element("span", {
      className: `event-action action-${threatEvent.action}`,
      text: threatEvent.action
    });
    const type = element("span", {
      className: "event-type",
      text: threatEvent.type + (threatEvent.decisionCandidate ? " · learn" : "")
    });

    const cells = [
      new Date(threatEvent.timestamp).toLocaleString(),
      action,
      type,
      threatEvent.targetUrl || "",
      threatEvent.sourceLayer || ""
    ];

    for (const value of cells) {
      const cell = document.createElement("td");
      if (value instanceof Node) {
        cell.appendChild(value);
      } else {
        cell.textContent = value;
      }
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
  }, "Site added to the watchlist.");
  ui.addProfile.reset();
  ui.profileMode.value = "strict";
});

ui.addBlock.addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = ui.blockDomain.value.trim();
  if (!domain) return;
  await runMutation("blocklist.add", { domain }, "Domain added to the global block list.");
  ui.addBlock.reset();
});

ui.profileSearch.addEventListener("input", () => {
  viewState.query = ui.profileSearch.value;
  renderProfiles();
});

ui.profileSort.addEventListener("change", () => {
  viewState.sort = ui.profileSort.value;
  saveViewState();
  renderProfiles();
});

ui.profileFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-filter]");
  if (!button) return;
  viewState.filter = button.dataset.profileFilter;
  saveViewState();
  renderProfiles();
});

ui.expandVisible.addEventListener("click", () => {
  const metrics = profileMetrics();
  for (const profile of filteredProfiles(metrics)) {
    viewState.expanded.add(profile.id);
  }
  saveViewState();
  renderProfiles();
});

ui.collapseAll.addEventListener("click", () => {
  viewState.expanded.clear();
  saveViewState();
  renderProfiles();
});

ui.clearEvents.addEventListener("click", () => {
  if (snapshot.events.length && confirm("Clear all local Threatwatch events?")) {
    runMutation("events.clear");
  }
});

ui.retry.addEventListener("click", () => {
  runMutation("protection.retry", {}, "Protection synchronized.");
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;

  if (event.key === "/" && !isTyping) {
    event.preventDefault();
    ui.profileSearch.focus();
  }
});

refresh();
