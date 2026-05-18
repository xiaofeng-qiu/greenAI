const { request } = require("../../utils/api.js");

const ZONES = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

Page({
  data: {
    labels: [...ZONES],
    tzIndex: 0,
  },
  async onShow() {
    try {
      const me = await request({ path: "/users/me", method: "GET" });
      const tz = me.timezone || "Asia/Shanghai";
      let labels = [...ZONES];
      let idx = labels.indexOf(tz);
      if (idx < 0) {
        labels = [tz, ...labels];
        idx = 0;
      }
      this.setData({ labels, tzIndex: idx });
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },
  onTzChange(e) {
    this.setData({ tzIndex: Number(e.detail.value) });
  },
  async onSave() {
    const tz = this.data.labels[this.data.tzIndex];
    try {
      await request({
        path: "/users/me",
        method: "PATCH",
        data: { timezone: tz },
      });
      wx.showToast({ title: "已保存" });
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },
});
