const { request } = require("../../utils/api.js");

function groupSymptoms(list) {
  const m = new Map();
  for (const s of list) {
    const g = s.group || "其它";
    if (!m.has(g)) m.set(g, []);
    m.get(g).push({ ...s, checked: false });
  }
  return [...m.entries()].map(([group, items]) => ({ group, items }));
}

function applySelected(symptomGroups, selectedIds) {
  const set = new Set(selectedIds);
  return symptomGroups.map((g) => ({
    group: g.group,
    items: g.items.map((it) => ({
      ...it,
      checked: set.has(it.id),
    })),
  }));
}

Page({
  data: {
    symptomGroups: [],
    plantLabels: ["不关联植物"],
    plantIds: [""],
    plantPickerIndex: 0,
    selectedIds: [],
    submitDisabled: true,
    result: null,
  },
  async onLoad() {
    await Promise.all([this.loadCatalog(), this.loadPlants()]);
  },
  async loadCatalog() {
    try {
      const data = await request({ path: "/diagnose/catalog", method: "GET" });
      const list = (data && data.symptoms) || [];
      const symptomGroups = groupSymptoms(list);
      this.setData({ symptomGroups });
    } catch (e) {
      wx.showToast({ title: "加载症状失败", icon: "none" });
    }
  },
  async loadPlants() {
    try {
      const raw = await request({ path: "/plants", method: "GET" });
      const plants = Array.isArray(raw) ? raw : [];
      const plantLabels = ["不关联植物"].concat(
        plants.map((p) => p.nickname || p.speciesLabel || "植物")
      );
      const plantIds = [""].concat(plants.map((p) => p.id));
      this.setData({ plantLabels, plantIds });
    } catch (_) {
      /* optional */
    }
  },
  onPlantPickerChange(e) {
    this.setData({ plantPickerIndex: Number(e.detail.value) });
  },
  onSymptomChange(e) {
    const selectedIds = e.detail.value || [];
    const symptomGroups = applySelected(this.data.symptomGroups, selectedIds);
    this.setData({
      selectedIds,
      symptomGroups,
      submitDisabled: selectedIds.length === 0,
    });
  },
  async onSubmit() {
    const { selectedIds, plantIds, plantPickerIndex } = this.data;
    if (!selectedIds.length) {
      wx.showToast({ title: "请至少选一项症状", icon: "none" });
      return;
    }
    const plantId = plantIds[plantPickerIndex] || undefined;
    const body = { symptomIds: selectedIds };
    if (plantId) body.plantId = plantId;
    wx.showLoading({ title: "分析中", mask: true });
    try {
      const result = await request({
        path: "/diagnose",
        method: "POST",
        data: body,
      });
      this.setData({ result });
    } catch (e) {
      wx.showToast({ title: "请求失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
