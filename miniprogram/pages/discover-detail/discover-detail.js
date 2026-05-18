const articles = require("../../data/knowledge.js");

Page({
  data: { article: null },
  onLoad(options) {
    const id = options.id ? decodeURIComponent(options.id) : "";
    const list = Array.isArray(articles) ? articles : [];
    const article = list.find((a) => a.id === id) || null;
    this.setData({ article });
    if (article && article.title) {
      wx.setNavigationBarTitle({ title: article.title.slice(0, 12) });
    }
  },
});
