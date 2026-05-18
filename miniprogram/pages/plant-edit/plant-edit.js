const { request } = require("../../utils/api.js");

const WATER_RANGE = ["low", "medium", "high"];
const WATER_LABELS = ["低", "中", "高"];
const LIGHT_RANGE = ["low", "medium", "high"];
const LIGHT_LABELS = ["弱", "中", "强"];

Page({
  data: {
    nickname: "",
    speciesLabel: "",
    waterIndex: 1,
    waterLabels: WATER_LABELS,
    indoor: true,
    heating: false,
    lightIndex: 1,
    lightLabels: LIGHT_LABELS,
  },
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },
  onSpeciesInput(e) {
    this.setData({ speciesLabel: e.detail.value });
  },
  onWaterChange(e) {
    this.setData({ waterIndex: Number(e.detail.value) });
  },
  onIndoorChange(e) {
    this.setData({ indoor: e.detail.value });
  },
  onHeatingChange(e) {
    this.setData({ heating: e.detail.value });
  },
  onLightChange(e) {
    this.setData({ lightIndex: Number(e.detail.value) });
  },
  async onSubmit() {
    const { nickname, speciesLabel, waterIndex, indoor, heating, lightIndex } = this.data;
    if (!nickname.trim() || !speciesLabel.trim()) {
      wx.showToast({ title: "请填写昵称和品种", icon: "none" });
      return;
    }
    const waterPreference = WATER_RANGE[waterIndex];
    const lightLevel = LIGHT_RANGE[lightIndex];
    try {
      await request({
        path: "/plants",
        method: "POST",
        data: {
          nickname: nickname.trim(),
          speciesLabel: speciesLabel.trim(),
          waterPreference,
          indoor,
          heating,
          lightLevel,
        },
      });
      wx.showToast({ title: "已保存" });
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },
});
