const TOKEN_KEY = "greenai_admin_token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

async function api(path, opts = {}) {
  const token = getToken();
  if (!token) {
    setStatus("请先填写并保存 API Token", true);
    throw new Error("no_token");
  }
  const res = await fetch(path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    setStatus(`请求失败 ${res.status}`, true);
    throw new Error(String(res.status));
  }
  setStatus(`${path} · ${res.status}`);
  return body;
}

function renderJson(targetId, data) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = `<pre class="json">${escapeHtml(
    JSON.stringify(data, null, 2)
  )}</pre>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderUserTable(data) {
  const el = document.getElementById("usersOut");
  if (!el || !data?.items) return;
  const rows = data.items
    .map(
      (u) => `<tr>
      <td><code>${escapeHtml(u.id)}</code></td>
      <td><code>${escapeHtml(u.openid)}</code></td>
      <td>${escapeHtml(u.timezone)}</td>
      <td>${u.plantCount}</td>
      <td>${u.deviceCount}</td>
      <td>${escapeHtml(u.createdAt)}</td>
    </tr>`
    )
    .join("");
  el.innerHTML = `<p>共 ${data.total} 条 · 第 ${data.page} 页</p>
  <table><thead><tr>
    <th>用户 ID</th><th>openid</th><th>时区</th><th>植物</th><th>设备</th><th>注册</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

document.getElementById("saveToken")?.addEventListener("click", () => {
  const v = document.getElementById("token")?.value?.trim() || "";
  sessionStorage.setItem(TOKEN_KEY, v);
  setStatus(v ? "Token 已保存到 sessionStorage" : "已清空 Token");
});

document.getElementById("token")?.addEventListener("change", (e) => {
  const v = /** @type {HTMLInputElement} */ (e.target).value.trim();
  sessionStorage.setItem(TOKEN_KEY, v);
});

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-tab");
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      panels.forEach((p) =>
        p.classList.toggle("active", p.id === `panel-${name}`)
      );
    });
  });
}

document.getElementById("loadUsers")?.addEventListener("click", async () => {
  const q = document.getElementById("userQ")?.value?.trim();
  const qs = new URLSearchParams({ page: "1", pageSize: "30" });
  if (q) qs.set("q", q);
  try {
    const data = await api(`/api/users?${qs}`);
    renderUserTable(data);
  } catch {
    /* status set */
  }
});

document.getElementById("loadPlants")?.addEventListener("click", async () => {
  try {
    const data = await api("/api/hardware/plants?page=1&pageSize=50");
    renderJson("plantsOut", data);
  } catch {
    /* */
  }
});

document
  .getElementById("loadPlantDetail")
  ?.addEventListener("click", async () => {
    const id = document.getElementById("plantDetailId")?.value?.trim();
    if (!id) {
      setStatus("填写植物 ID", true);
      return;
    }
    try {
      const data = await api(`/api/hardware/plants/${encodeURIComponent(id)}`);
      renderJson("plantsOut", data);
    } catch {
      /* */
    }
  });

document
  .getElementById("loadDeviceLogs")
  ?.addEventListener("click", async () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    const deviceId = document.getElementById("logDeviceId")?.value?.trim();
    const userId = document.getElementById("logUserId")?.value?.trim();
    const level = document.getElementById("logLevel")?.value?.trim();
    if (deviceId) qs.set("deviceId", deviceId);
    if (userId) qs.set("userId", userId);
    if (level) qs.set("level", level);
    try {
      const data = await api(`/api/logs/device-ingest?${qs}`);
      renderJson("deviceLogsOut", data);
    } catch {
      /* */
    }
  });

document
  .getElementById("loadSystemLogs")
  ?.addEventListener("click", async () => {
    try {
      const data = await api("/api/logs/system?fileLines=120");
      renderJson("systemLogsOut", data);
    } catch {
      /* */
    }
  });

window.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("token");
  if (input && input instanceof HTMLInputElement) {
    input.value = getToken();
  }
  initTabs();
  setStatus("填写 Token 后各页点「刷新」");
});
