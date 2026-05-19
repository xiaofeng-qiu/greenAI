const { request } = require("../../utils/api.js");
const { refreshTodayTabBadge } = require("../../utils/tabBadge.js");

const CACHE_KEY = "discover_articles_cache";

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
  data: { articles: [], searchQuery: "" },
  onShow() {
    refreshTodayTabBadge();
  },
  onLoad() {
    this._articles = [];
    this._searchExtras = [];
    this._searchTimer = null;
    this.loadArticles();
  },

  // ── 缓存优先，仅后端为数据源 ──
  async loadArticles() {
    // 1. 显示缓存
    const cached = wx.getStorageSync(CACHE_KEY);
    if (Array.isArray(cached) && cached.length > 0) {
      this._articles = decorateArticles(cached);
      this.applyFilter((this.data.searchQuery || "").trim().toLowerCase());
    }

    // 2. 后台刷新
    try {
      const remote = await request({
        path: "/knowledge/articles",
        method: "GET",
      });
      if (Array.isArray(remote) && remote.length > 0) {
        wx.setStorageSync(CACHE_KEY, remote);
        this._articles = decorateArticles(remote);
        this.applyFilter((this.data.searchQuery || "").trim().toLowerCase());
      }
    } catch (_) {
      /* 离线时保留缓存 */
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
    if (!q) {
      this._searchExtras = [];
      this.setData({ articles: this._articles });
      return;
    }
    const filtered = this._articles.filter((a) => {
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
    wx.navigateTo({
      url: `/pages/discover-detail/discover-detail?id=${encodeURIComponent(id)}`,
    });
  },
});
