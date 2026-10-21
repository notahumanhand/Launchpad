const grid = document.getElementById("application-grid");
const wakeButton = document.getElementById("wake-all");
const overallStatus = document.getElementById("overall-status");
const lastChecked = document.getElementById("last-checked");

const symbols = { caseflow: "CF", commonthread: "CT", verifhir: "VF" };
const statusLabels = {
  idle: "Not checked",
  waking: "Starting",
  checking: "Checking",
  online: "Available",
  unavailable: "Needs attention"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function renderApplications(applications) {
  grid.innerHTML = applications.map((app, index) => {
    const status = app.status || {};
    const state = status.state || "idle";
    const online = state === "online";
    const unavailable = state === "unavailable";
    return `
      <article class="project-card" style="--accent:${escapeHtml(app.accent || "#2458a6")}">
        <div class="card-top">
          <span class="project-index">PROJECT 0${index + 1}</span>
          <span class="status ${escapeHtml(state)}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(statusLabels[state] || state)}</span>
        </div>
        <div class="project-monogram" aria-hidden="true">${escapeHtml(symbols[app.id] || app.name.slice(0, 2).toUpperCase())}</div>
        <h3 class="project-name">${escapeHtml(app.name)}</h3>
        <p class="project-tagline">${escapeHtml(app.tagline)}</p>
        <p class="project-description">${escapeHtml(app.description)}</p>
        <div class="stack-block">
          <p class="stack-label">TECHNOLOGY</p>
          <p class="stack">${escapeHtml(app.stack)}</p>
        </div>
        <p class="card-status-message" aria-live="polite">${escapeHtml(status.message || "Waiting for the first check.")}${status.elapsed_ms ? ` · ${(status.elapsed_ms / 1000).toFixed(1)}s` : ""}</p>
        <div class="card-actions">
          <a class="open-link" href="${escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer">${online ? "View live project ↗" : "Open project ↗"}</a>
          ${unavailable ? `<button class="retry-link" type="button" data-retry="${escapeHtml(app.id)}">Retry status check</button>` : ""}
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
    overallStatus.textContent = "All three project sites are responding.";
  } else if (inProgress || pending) {
    overallStatus.textContent = `${online} of ${applications.length} project sites responding · checks in progress`;
  } else {
    overallStatus.textContent = `${online} of ${applications.length} project sites responding · unavailable sites can be retried`;
  }
  wakeButton.disabled = Boolean(inProgress);
  wakeButton.innerHTML = inProgress
    ? '<span class="button-icon" aria-hidden="true">↻</span> Checking projects…'
    : '<span class="button-icon" aria-hidden="true">↻</span> Check all projects';
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Status request failed");
    const data = await response.json();
    renderApplications(data.applications);
    summarize(data.applications, data.wake_in_progress);
    lastChecked.textContent = `Last status update: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch {
    overallStatus.textContent = "Status could not be retrieved. Please try again.";
  }
}

async function wakeAll() {
  wakeButton.disabled = true;
  try {
    await fetch("/api/wake", { method: "POST" });
    await refreshStatus();
  } catch {
    overallStatus.textContent = "Could not start project checks. Please retry.";
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

// Check the three services on arrival without blocking the page render.
(async function init() {
  await refreshStatus();
  await wakeAll();
  window.setInterval(refreshStatus, 2500);
})();
