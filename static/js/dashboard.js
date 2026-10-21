const grid = document.getElementById("application-grid");
const wakeButton = document.getElementById("wake-all");
const overallStatus = document.getElementById("overall-status");
const lastChecked = document.getElementById("last-checked");

const symbols = { caseflow: "CF", commonthread: "CT", verifhir: "VF" };
const statusLabels = {
  idle: "Not checked",
  waking: "Waking up",
  checking: "Checking",
  online: "Online",
  unavailable: "Unavailable"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function renderApplications(applications) {
  grid.innerHTML = applications.map((app) => {
    const status = app.status || {};
    const state = status.state || "idle";
    const online = state === "online";
    const unavailable = state === "unavailable";
    return `
      <article class="app-card" style="--accent:${escapeHtml(app.accent || "#2458a6")}">
        <div class="card-top">
          <div class="app-symbol" aria-hidden="true">${escapeHtml(symbols[app.id] || app.name.slice(0, 2).toUpperCase())}</div>
          <span class="status ${escapeHtml(state)}" aria-label="Status: ${escapeHtml(statusLabels[state] || state)}">
            <span class="status-dot" aria-hidden="true"></span>${escapeHtml(statusLabels[state] || state)}
          </span>
        </div>
        <h3 class="app-name">${escapeHtml(app.name)}</h3>
        <p class="app-tagline">${escapeHtml(app.tagline)}</p>
        <p class="app-description">${escapeHtml(app.description)}</p>
        <p class="stack-label">TECHNOLOGY STACK</p>
        <p class="stack">${escapeHtml(app.stack)}</p>
        <p class="card-status-message" aria-live="polite">${escapeHtml(status.message || "Waiting for first check.")}${status.elapsed_ms ? ` · ${(status.elapsed_ms / 1000).toFixed(1)}s` : ""}</p>
        <div class="card-actions">
          <a class="open-link" href="${escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer" ${online ? "" : 'aria-disabled="true"'}>${online ? "Open application ↗" : "Open site anyway ↗"}</a>
          ${unavailable ? `<button class="retry-link" type="button" data-retry="${escapeHtml(app.id)}">Retry check</button>` : ""}
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => retryApplication(button.dataset.retry));
  });
}

function summarize(applications, inProgress) {
  const states = applications.map((app) => app.status?.state || "idle");
  const online = states.filter((state) => state === "online").length;
  const pending = states.some((state) => ["waking", "checking", "idle"].includes(state));
  if (online === applications.length) {
    overallStatus.textContent = "All applications are online";
  } else if (inProgress || pending) {
    overallStatus.textContent = `${online} of ${applications.length} online · starting services`;
  } else {
    overallStatus.textContent = `${online} of ${applications.length} online · check unavailable services`;
  }
  wakeButton.disabled = Boolean(inProgress);
  wakeButton.innerHTML = inProgress
    ? '<span class="button-icon" aria-hidden="true">↻</span> Checking applications…'
    : '<span class="button-icon" aria-hidden="true">↻</span> Wake all applications';
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Status request failed");
    const data = await response.json();
    renderApplications(data.applications);
    summarize(data.applications, data.wake_in_progress);
    lastChecked.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch {
    overallStatus.textContent = "Could not retrieve status. Retry in a moment.";
  }
}

async function wakeAll() {
  wakeButton.disabled = true;
  try {
    await fetch("/api/wake", { method: "POST" });
    await refreshStatus();
  } catch {
    overallStatus.textContent = "Could not start checks. Please retry.";
    wakeButton.disabled = false;
  }
}

async function retryApplication(appId) {
  try {
    await fetch(`/api/retry/${encodeURIComponent(appId)}`, { method: "POST" });
    await refreshStatus();
  } catch {
    overallStatus.textContent = "Retry failed. Please try again.";
  }
}

wakeButton.addEventListener("click", wakeAll);

// Start all three services as soon as the launchpad is visited, then poll for
// independent status changes. The launchpad itself remains responsive.
(async function init() {
  await refreshStatus();
  await wakeAll();
  window.setInterval(refreshStatus, 2500);
})();
