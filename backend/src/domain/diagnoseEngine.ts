/** Rule-based symptom triage for MVP (not a substitute for lab or expert diagnosis). */

export const DIAGNOSE_SYMPTOM_IDS = [
  "leaf_yellow_uniform",
  "leaf_yellow_new_only",
  "leaf_brown_tips",
  "leaf_spots_brown",
  "leaf_white_powder",
  "leaf_holes_chewing",
  "leaf_curl_deform",
  "wilting_soft_stem",
  "wilting_dry_soil",
  "soil_sour_smell",
  "growth_slow_pale",
  "leaf_fine_web",
] as const;

export type DiagnoseSymptomId = (typeof DIAGNOSE_SYMPTOM_IDS)[number];

export type SymptomCatalogItem = {
  id: DiagnoseSymptomId;
  group: string;
  label: string;
};

export type DiagnoseCause = {
  id: string;
  title: string;
  summary: string;
  actions: string[];
};

const CATALOG: SymptomCatalogItem[] = [
  {
    id: "leaf_yellow_uniform",
    group: "叶片",
    label: "老叶均匀发黄、自下而上",
  },
  {
    id: "leaf_yellow_new_only",
    group: "叶片",
    label: "新叶发黄、叶脉仍绿",
  },
  {
    id: "leaf_brown_tips",
    group: "叶片",
    label: "叶尖或叶缘焦枯、褐色",
  },
  {
    id: "leaf_spots_brown",
    group: "叶片",
    label: "褐色/水渍状斑点、扩大",
  },
  {
    id: "leaf_white_powder",
    group: "叶片",
    label: "叶面白粉状霉层",
  },
  {
    id: "leaf_holes_chewing",
    group: "叶片",
    label: "虫咬孔洞、缺刻",
  },
  {
    id: "leaf_curl_deform",
    group: "叶片",
    label: "卷曲、畸形、皱缩",
  },
  {
    id: "wilting_soft_stem",
    group: "整体",
    label: "萎蔫且茎基部发软、发黑",
  },
  {
    id: "wilting_dry_soil",
    group: "整体",
    label: "萎蔫且盆土明显偏干",
  },
  {
    id: "soil_sour_smell",
    group: "盆土",
    label: "盆土异味、长期潮湿不透气感",
  },
  {
    id: "growth_slow_pale",
    group: "整体",
    label: "长势慢、叶色整体偏淡",
  },
  {
    id: "leaf_fine_web",
    group: "虫害迹象",
    label: "叶背细丝网、针尖小黄点",
  },
];

type Rule = {
  id: string;
  title: string;
  summary: string;
  actions: string[];
  /** Higher runs first when multiple rules match. */
  priority: number;
  match: (s: ReadonlySet<DiagnoseSymptomId>) => boolean;
};

const RULES: Rule[] = [
  {
    id: "root_rot_overwater",
    title: "可能：闷根 / 浇水过多",
    summary:
      "茎软、盆土异味或长期潮湿，常与排水差、浇水过勤有关；根系缺氧后易腐烂。",
    actions: [
      "立刻减少浇水，检查盆底是否积水；必要时脱盆查看根系，剪掉褐色软烂根。",
      "改用疏松透气的介质，盆器要有排水孔。",
      "待土面下 2–3 cm 干透再浇，冬季更需控水。",
    ],
    priority: 100,
    match: (s) => s.has("wilting_soft_stem") || s.has("soil_sour_smell"),
  },
  {
    id: "underwater",
    title: "可能：缺水",
    summary: "盆土很干仍萎蔫，多为蒸腾大于补水；暖气环境更易发生。",
    actions: [
      "浇透水至盆底有水流出，之后按土干再浇。",
      "避免长期干透再猛浇，可分两次间隔几分钟浇透。",
    ],
    priority: 90,
    match: (s) => s.has("wilting_dry_soil"),
  },
  {
    id: "powdery_mildew",
    title: "可能：白粉病（真菌）",
    summary: "叶面白色粉状物多为白粉病，通风差、叶面长期潮湿易诱发。",
    actions: [
      "摘除重病叶并单独放置，加强通风与叶面干燥。",
      "按说明使用登记在案的内吸/保护性杀菌剂（如苯醚甲环唑等），注意安全间隔。",
    ],
    priority: 85,
    match: (s) => s.has("leaf_white_powder"),
  },
  {
    id: "spider_mite",
    title: "可能：红蜘蛛等螨类",
    summary: "叶背细网、针尖黄点常见于螨害；干燥、闷热环境高发。",
    actions: [
      "用清水或肥皂水冲洗叶背，或湿布擦拭；严重时可按说明用杀螨剂。",
      "提高环境湿度（喷雾周围空气而非长期闷叶）、与其它植物隔离。",
    ],
    priority: 82,
    match: (s) => s.has("leaf_fine_web"),
  },
  {
    id: "chewing_pest",
    title: "可能：咀嚼式害虫（蚜虫/毛虫等）",
    summary: "孔洞、缺刻多为啃食；需辨认虫体或粪便痕迹。",
    actions: [
      "手工清除可见虫体；可尝试印楝油或登记杀虫剂，注意浓度与安全。",
      "检查新购入植物是否带虫，避免交叉感染。",
    ],
    priority: 78,
    match: (s) => s.has("leaf_holes_chewing"),
  },
  {
    id: "leaf_spot_fungal",
    title: "可能：叶斑类病害",
    summary: "水渍状或褐色扩展斑点多与真菌/细菌有关，叶面长期带水会加重。",
    actions: [
      "摘除病叶，改善通风；浇水尽量浇在土面，避免傍晚叶面长期潮湿。",
      "可按说明使用广谱杀菌剂，连续防治需遵守标签间隔。",
    ],
    priority: 75,
    match: (s) => s.has("leaf_spots_brown"),
  },
  {
    id: "iron_chlorosis",
    title: "可能：缺铁 / 碱性土黄化（喜酸植物常见）",
    summary: "新叶发黄而老叶相对正常、叶脉常仍绿，多见于杜鹃、栀子等喜酸植物。",
    actions: [
      "使用喜酸植物专用土或硫酸亚铁类（按说明），避免长期用硬水浇花。",
      "确认品种是否喜酸，再调整施肥与介质 pH。",
    ],
    priority: 70,
    match: (s) => s.has("leaf_yellow_new_only"),
  },
  {
    id: "nitrogen_low",
    title: "可能：缺氮或自然老叶黄化",
    summary: "自下而上老叶均匀发黄，可能缺氮，也可能是正常老叶更替。",
    actions: [
      "生长季可少量追施均衡氮肥或复合肥，薄肥勤施。",
      "若仅底层 1–2 片老叶黄、新叶正常，可摘黄叶观察即可。",
    ],
    priority: 65,
    match: (s) => s.has("leaf_yellow_uniform"),
  },
  {
    id: "dry_air_salt",
    title: "可能：空气过干、肥害或盐分累积",
    summary: "叶缘焦枯常与暖气干燥、施肥过浓或盐分在盆边累积有关。",
    actions: [
      "暖气房可托盘加湿或植物旁放水盘（勿长期泡根）。",
      "减少化肥浓度与频率；偶尔浇透水淋溶盐分（排水良好前提下）。",
    ],
    priority: 60,
    match: (s) => s.has("leaf_brown_tips"),
  },
  {
    id: "virus_or_pest_distort",
    title: "可能：病毒病或刺吸害虫致畸",
    summary: "卷曲畸形需排除蚜虫、粉虱等刺吸口器害虫，再考虑病毒可能。",
    actions: [
      "仔细检查叶背与顶芽是否有蚜虫、粉虱；先治虫。",
      "若虫少仍严重畸形且扩散，考虑隔离并咨询本地植保或园艺师。",
    ],
    priority: 55,
    match: (s) => s.has("leaf_curl_deform"),
  },
  {
    id: "general_weak",
    title: "可能：整体养分或光照不足",
    summary: "长势慢、叶色淡常与光弱、长期未换盆或缺肥有关。",
    actions: [
      "逐步增加明亮散射光（避免突然暴晒）。",
      "生长季薄肥勤施，1–2 年视根系情况考虑换盆。",
    ],
    priority: 40,
    match: (s) => s.has("growth_slow_pale"),
  },
];

/** 规则诊断与 LLM 诊断共用免责说明（产品文案）。 */
export const DIAGNOSE_DISCLAIMER =
  "本结果为基于常见园艺症状的规则性提示，不能替代实地检疫、实验室检测或专业人员诊断；若植株快速恶化，建议拍照咨询本地园艺店或植保部门。";

/** 追加在 LLM 视觉诊断结果中的补充免责（与 {@link DIAGNOSE_DISCLAIMER} 连用）。 */
export const DIAGNOSE_LLM_EXTRA_DISCLAIMER =
  "以下为视觉大模型生成的参考意见，可能存在不完整或误判；涉及用药、浓度与安全时，请以产品标签与当地法规为准，必要时咨询线下植保或园艺师。";

export function listSymptomCatalog(): SymptomCatalogItem[] {
  return CATALOG.slice();
}

export type DiagnoseEnvHint = {
  indoor?: boolean | null;
  heating?: boolean | null;
};

export type DiagnoseResult = {
  causes: DiagnoseCause[];
  contextTips: string[];
  disclaimer: string;
};

function ruleToCause(r: Rule): DiagnoseCause {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    actions: r.actions,
  };
}

export function diagnoseFromSymptoms(
  symptomIds: readonly DiagnoseSymptomId[],
  env?: DiagnoseEnvHint | null
): DiagnoseResult {
  const set = new Set(symptomIds);
  const matched: Rule[] = [];
  for (const rule of RULES) {
    if (rule.match(set)) matched.push(rule);
  }
  matched.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const causes: DiagnoseCause[] = [];
  for (const r of matched) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    causes.push(ruleToCause(r));
    if (causes.length >= 3) break;
  }

  const contextTips: string[] = [];
  if (env?.heating) {
    contextTips.push("当前标记为「有供暖」：空气易偏干，叶缘焦枯与萎蔫需结合盆土干湿判断，避免误判为单纯缺水。");
  }
  if (env?.indoor === false) {
    contextTips.push("户外摆放请注意暴雨后排水与叶面长期带水，易诱发叶斑与闷根。");
  }
  if (causes.length === 0) {
    causes.push({
      id: "no_rule_match",
      title: "暂未匹配到常见规则",
      summary:
        "请补充更多症状描述或更换勾选；若问题持续恶化，建议咨询本地园艺师并携带清晰照片（叶背、茎基部、盆土剖面）。",
      actions: [
        "记录症状出现时间与浇水施肥变化，便于排查。",
        "与其它植物隔离观察，避免交叉感染。",
      ],
    });
  }

  return { causes, contextTips, disclaimer: DIAGNOSE_DISCLAIMER };
}
