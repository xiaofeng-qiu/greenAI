const localArticles = require("../../data/knowledge.js");
const { request } = require("../../utils/api.js");

function sectionsFromArticle(a, coverTone) {
  if (a.sections && Array.isArray(a.sections) && a.sections.length) {
    return a.sections.map((s, i) => {
      const base = { ...s, _key: `s${i}` };
      if (s.type === "figure") {
        return {
          ...base,
          figureTone: typeof s.tone === "number" ? s.tone : coverTone,
        };
      }
      return base;
    });
  }
  const body = String(a.body || "");
  const lines = body.split(/\n+/).filter(Boolean);
  return lines.map((text, i) => ({ type: "p", text, _key: `p${i}` }));
}

Page({
  data: { article: null, articleSections: [], coverTone: 0 },
  onLoad(options) {
    const id = options.id ? decodeURIComponent(options.id) : "";
    const list = Array.isArray(localArticles) ? localArticles : [];
    let article = list.find((x) => x.id === id) || null;
    const applyArticle = (a) => {
      if (!a) {
        this.setData({ article: null, articleSections: [], coverTone: 0 });
        return;
      }
      const coverTone = typeof a.coverTone === "number" ? a.coverTone : 0;
      const articleSections = sectionsFromArticle(a, coverTone);
      this.setData({ article: a, articleSections, coverTone });
      if (a.title) {
        wx.setNavigationBarTitle({ title: String(a.title).slice(0, 12) });
      }
    };
    if (article) {
      applyArticle(article);
      return;
    }
    if (!id) {
      applyArticle(null);
      return;
    }
    request({
      path: `/knowledge/articles/${encodeURIComponent(id)}`,
      method: "GET",
    })
      .then((remote) => {
        if (remote && remote.id) {
          applyArticle(remote);
        } else {
          applyArticle(null);
        }
      })
      .catch(() => {
        applyArticle(null);
      });
  },
});
