const articles = require("../../data/knowledge.js");

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
    const list = Array.isArray(articles) ? articles : [];
    const article = list.find((x) => x.id === id) || null;
    const coverTone = article && typeof article.coverTone === "number" ? article.coverTone : 0;
    const articleSections = article ? sectionsFromArticle(article, coverTone) : [];
    this.setData({ article, articleSections, coverTone });
    if (article && article.title) {
      wx.setNavigationBarTitle({ title: article.title.slice(0, 12) });
    }
  },
});
