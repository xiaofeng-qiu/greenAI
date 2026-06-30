export const G = "#1e7a4a";
export const GRAY = "#71727a";

export const CATEGORIES = ["全部", "浇水技巧", "光照管理", "施肥指南", "病虫害"];

export const ARTICLES = [
  { id: 1, title: "蝴蝶兰的正确浇水方法", category: "浇水技巧", readTime: "3分钟", difficulty: "初级", emoji: "🌺", tag: "推荐" },
  { id: 2, title: "室内植物光照需求全攻略", category: "光照管理", readTime: "5分钟", difficulty: "初级", emoji: "☀️", tag: "热门" },
  { id: 3, title: "有机肥 vs 化肥：哪个更适合？", category: "施肥指南", readTime: "4分钟", difficulty: "中级", emoji: "🌱", tag: null },
  { id: 4, title: "常见叶片问题诊断指南", category: "病虫害", readTime: "6分钟", difficulty: "中级", emoji: "🍃", tag: "实用" },
  { id: 5, title: "多肉植物夏季养护要点", category: "光照管理", readTime: "4分钟", difficulty: "初级", emoji: "🌵", tag: null },
  { id: 6, title: "绿萝水培 vs 土培对比", category: "浇水技巧", readTime: "5分钟", difficulty: "初级", emoji: "🌿", tag: null },
];

export const TOOL_CONFIG = {
  plantId: {
    label: "植物识别",
    color: G,
    bg: "#e2f5ec",
    hint: "拍摄植物叶片或整株照片，AI 将识别植物种类及养护建议",
    result: {
      name: "识别完成",
      confidence: 0,
      tags: ["AI 识别"],
      adviceLabel: "建议",
      advice: ["请在识别结果中确认植物种类后再执行养护。"],
    },
  },
  soilId: {
    label: "土壤识别",
    color: "#c47000",
    bg: "#fff3e0",
    hint: "拍摄土壤表面，AI 分析土壤干湿与肥力状态",
    result: {
      name: "评估完成",
      confidence: 0,
      tags: ["土壤分析"],
      adviceLabel: "建议",
      advice: ["结合土壤评估结果，调整浇水和施肥节奏。"],
    },
  },
  pestDiag: {
    label: "病虫诊断",
    color: "#c0392b",
    bg: "#fef0f0",
    hint: "拍摄病变部位，AI 识别病虫类型并给出防治建议",
    result: {
      name: "诊断完成",
      confidence: 0,
      tags: ["病虫害诊断"],
      adviceLabel: "建议",
      advice: ["出现持续恶化时请尽快线下复检。"],
    },
  },
};

export const LOCATIONS = ["阳台", "客厅", "书房", "卧室", "厨房", "餐厅", "户外"];
