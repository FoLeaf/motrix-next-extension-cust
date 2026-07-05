import { DEFAULT_PORT, buildTaskActionBody, normalizeSettings, sortTasksByCreatedDesc } from "./shared.js";

const refreshMs = 1200;
let settings = { port: DEFAULT_PORT, token: "" };
let refreshTimer = null;

const els = {
  connectionText: document.getElementById("connectionText"),
  totalSpeed: document.getElementById("totalSpeed"),
  totalProgress: document.getElementById("totalProgress"),
  totalTasks: document.getElementById("totalTasks"),
  settingsPanel: document.getElementById("settingsPanel"),
  portInput: document.getElementById("portInput"),
  tokenInput: document.getElementById("tokenInput"),
  interceptInput: document.getElementById("interceptInput"),
  saveSettings: document.getElementById("saveSettings"),
  openMain: document.getElementById("openMain"),
  taskList: document.getElementById("taskList"),
  taskTemplate: document.getElementById("taskTemplate")
};

async function init() {
  settings = normalizeSettings(await chrome.storage.local.get(["port", "token", "interceptDownloads"]));
  els.portInput.value = String(settings.port);
  els.tokenInput.value = settings.token;
  els.interceptInput.checked = settings.interceptDownloads;
  bindEvents();
  void chrome.runtime.sendMessage({ type: "wake" });
  await refresh();
}

function bindEvents() {
  els.saveSettings.addEventListener("click", saveSettings);
  els.openMain.addEventListener("click", () => postWindowShow());
  els.taskList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const task = button.closest(".task");
    void postTaskAction(task.dataset.gid, button.dataset.action);
  });
}

async function saveSettings() {
  settings = normalizeSettings({
    port: els.portInput.value,
    token: els.tokenInput.value,
    interceptDownloads: els.interceptInput.checked
  });
  await chrome.storage.local.set(settings);
  await chrome.runtime.sendMessage({ type: "settingsUpdated" });
  await refresh();
}

async function refresh() {
  clearTimeout(refreshTimer);
  if (!settings.token) {
    renderDisconnected("未配置密钥");
    return;
  }

  try {
    const snapshot = await fetchSnapshot();
    renderSnapshot(snapshot);
    const activeCount = Number(snapshot.totals.numActive || 0) + Number(snapshot.totals.numWaiting || 0);
    if (activeCount > 0) {
      refreshTimer = setTimeout(refresh, refreshMs);
    }
  } catch {
    renderDisconnected("未连接");
  }
}

async function fetchSnapshot() {
  const response = await fetch(`${apiBase()}/tasks`, {
    headers: authHeaders(),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`tasks-${response.status}`);
  return response.json();
}

async function postTaskAction(gid, action) {
  if (!gid || !action) return;
  const response = await fetch(`${apiBase()}/task-action`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: buildTaskActionBody(gid, action)
  });
  if (response.ok) await refresh();
}

async function postWindowShow() {
  if (!settings.token) return;
  await fetch(`${apiBase()}/window/show`, {
    method: "POST",
    headers: authHeaders()
  }).catch(() => {});
}

function renderSnapshot(snapshot) {
  const totals = snapshot.totals || {};
  const activeCount = Number(totals.numActive || 0) + Number(totals.numWaiting || 0);
  els.connectionText.textContent = activeCount > 0 ? "下载中" : "已连接";
  els.connectionText.className = "";
  els.totalSpeed.textContent = formatSpeed(Number(totals.downloadSpeed || 0));
  els.totalProgress.textContent = totals.hasUnknownSize ? "活动中" : formatPercent(totals.progress);
  els.totalTasks.textContent = String(activeCount);

  const tasks = sortTasksByCreatedDesc(Array.isArray(snapshot.tasks) ? snapshot.tasks : []);
  els.taskList.textContent = "";
  if (tasks.length === 0) {
    renderEmpty("暂无任务");
    return;
  }
  for (const task of tasks) {
    els.taskList.appendChild(renderTask(task));
  }
}

function renderDisconnected(message) {
  els.connectionText.textContent = `${message} :${settings.port}`;
  els.connectionText.className = "offline";
  els.totalSpeed.textContent = "0 B/s";
  els.totalProgress.textContent = "--";
  els.totalTasks.textContent = "0";
  els.taskList.textContent = "";
  renderEmpty("等待 Motrix");
}

function renderEmpty(text) {
  const node = document.createElement("div");
  node.className = "empty";
  node.textContent = text;
  els.taskList.appendChild(node);
}

function renderTask(task) {
  const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.gid = task.gid;
  node.querySelector(".task-name").textContent = task.name || task.gid;

  const status = node.querySelector(".task-status");
  status.textContent = statusLabel(task.status);
  status.classList.toggle("active", ["active", "waiting"].includes(task.status));
  status.classList.toggle("error", task.status === "error");

  const track = node.querySelector(".progress-track");
  const fill = node.querySelector(".progress-fill");
  if (task.progress == null) {
    track.classList.add("unknown");
  } else {
    fill.style.width = `${Math.min(100, Math.max(0, Number(task.progress)))}%`;
  }

  node.querySelector(".task-speed").textContent = formatSpeed(Number(task.downloadSpeed || 0));
  node.querySelector(".task-size").textContent = `${formatBytes(Number(task.completedLength || 0))} / ${formatBytes(Number(task.totalLength || 0))}`;
  node.querySelector(".task-eta").textContent = formatEta(task.etaSeconds);
  node.querySelector(".task-path").textContent = task.targetPath || task.dir || "";

  const toggle = node.querySelector(".task-toggle");
  const resume = task.status === "paused";
  toggle.textContent = resume ? ">" : "II";
  toggle.dataset.action = resume ? "resume" : "pause";
  node.querySelector(".task-cancel").dataset.action = "cancel";
  node.querySelector(".task-open").dataset.action = "open";
  const folderButton = node.querySelector(".task-folder");
  folderButton.dataset.action = "showInFolder";
  folderButton.textContent = "目录";

  return node;
}

function apiBase() {
  return `http://127.0.0.1:${settings.port}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${settings.token}` };
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(0)}%` : "--";
}

function formatSpeed(value) {
  return `${formatBytes(value)}/s`;
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function formatEta(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function statusLabel(status) {
  return {
    active: "下载",
    waiting: "等待",
    paused: "暂停",
    complete: "完成",
    error: "失败",
    removed: "移除"
  }[status] || status || "--";
}

void init();
