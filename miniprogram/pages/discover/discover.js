const rawArticles = require("../../data/knowledge.js");
const { refreshTodayTabBadge } = require("../../utils/tabBadge.js");

Page({
  data: { allArticles: [], articles: [], searchQuery: "" },
  onShow() {
    refreshTodayTabBadge();
  },
  onLoad() {
    const list = Array.isArray(rawArticles) ? rawArticles : [];
    const all = list.map((a) => {
      const title = String(a.title || "").trim();
      return {
        ...a,
        coverTone: typeof a.coverTone === "number" ? a.coverTone : 0,
        thumbGlyph: title ? title.charAt(0) : "植",
      };
    });
    this.setData({ allArticles: all, articles: all });
  },
  onSearchInput(e) {
    const q = (e.detail.value || "").trim().toLowerCase();
    this.setData({ searchQuery: e.detail.value || "" });
    this.applyFilter(q);
  },
  applyFilter(q) {
    const all = this.data.allArticles || [];
    if (!q) {
      this.setData({ articles: all });
      return;
    }
    const filtered = all.filter((a) => {
      const hay = `${a.title || ""} ${a.summary || ""} ${a.body || ""}`.toLowerCase();
      return hay.includes(q);
    });
    this.setData({ articles: filtered });
  },
  onOpen(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/discover-detail/discover-detail?id=${encodeURIComponent(id)}` });
  },
});
