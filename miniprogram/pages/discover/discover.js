const rawArticles = require("../../data/knowledge.js");
const { request } = require("../../utils/api.js");
const { refreshTodayTabBadge } = require("../../utils/tabBadge.js");

function decorateArticles(list) {
  return list.map((a) => {
    const title = String(a.title || "").trim();
    return {
      ...a,
      coverTone: typeof a.coverTone === "number" ? a.coverTone : 0,
      thumbGlyph: title ? title.charAt(0) : "植",
    };
  });
}

Page({
  data: { allArticles: [], articles: [], searchQuery: "" },
  onShow() {
    refreshTodayTabBadge();
  },
  onLoad() {
    this._searchExtras = [];
    this._searchTimer = null;
    const list = Array.isArray(rawArticles) ? rawArticles : [];
    const all = decorateArticles(list);
    this.setData({ allArticles: all, articles: all });
    this.tryMergeRemoteArticles();
  },
  async tryMergeRemoteArticles() {
    try {
      const remote = await request({ path: "/knowledge/articles", method: "GET" });
      if (!Array.isArray(remote) || remote.length === 0) return;
      const merged = new Map();
      for (const a of this.data.allArticles || []) {
        if (a && a.id != null) merged.set(String(a.id), a);
      }
      for (const a of remote) {
        if (a && a.id != null) merged.set(String(a.id), a);
      }
      const combined = decorateArticles([...merged.values()]);
      combined.sort((x, y) => String(x.title || "").localeCompare(String(y.title || ""), "zh"));
      this.setData({ allArticles: combined, articles: combined });
      const q = (this.data.searchQuery || "").trim().toLowerCase();
      this.applyFilter(q);
    } catch (_) {
      /* 未登录或接口不可用时保留本地数据 */
    }
  },
  onSearchInput(e) {
    const raw = e.detail.value || "";
    const q = raw.trim().toLowerCase();
    this.setData({ searchQuery: raw });
    this.applyFilter(q);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this.trySearchKnowledgeRemote(raw.trim());
    }, 400);
  },
  async trySearchKnowledgeRemote(rawQ) {
    const q = (this.data.searchQuery || "").trim().toLowerCase();
    if (!rawQ || rawQ.length < 2) {
      this._searchExtras = [];
      const qNow = (this.data.searchQuery || "").trim().toLowerCase();
      this.applyFilter(qNow);
      return;
    }
    try {
      const res = await request({
        path: `/knowledge/search?q=${encodeURIComponent(rawQ)}&limit=15`,
        method: "GET",
      });
      const hits = (res && res.buckets && res.buckets.articles) || [];
      this._searchExtras = hits.map((h) => ({
        id: h.slug,
        title: h.title || h.slug,
        summary: h.snippet || "",
        body: "",
        coverTone: 0,
        thumbGlyph: (h.title && String(h.title).charAt(0)) || "搜",
      }));
    } catch (_) {
      this._searchExtras = [];
    }
    const qNow = (this.data.searchQuery || "").trim().toLowerCase();
    this.applyFilter(qNow);
  },
  applyFilter(q) {
    const all = this.data.allArticles || [];
    if (!q) {
      this._searchExtras = [];
      this.setData({ articles: all });
      return;
    }
    const filtered = all.filter((a) => {
      const hay = `${a.title || ""} ${a.summary || ""} ${a.body || ""}`.toLowerCase();
      return hay.includes(q);
    });
    const extras = this._searchExtras || [];
    const byId = new Map();
    for (const a of filtered) {
      if (a && a.id != null) byId.set(String(a.id), a);
    }
    for (const a of extras) {
      if (a && a.id != null && !byId.has(String(a.id))) byId.set(String(a.id), a);
    }
    this.setData({ articles: decorateArticles([...byId.values()]) });
  },
  onOpen(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/discover-detail/discover-detail?id=${encodeURIComponent(id)}` });
  },
});
