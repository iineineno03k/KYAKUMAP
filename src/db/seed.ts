import "./load-env";
import { createDb } from "./index";
import {
  customerPanelItems,
  customerPanels,
  customerProfiles,
  entityAliases,
  evidenceLinks,
  knowledgeClaims,
  knowledgeEntities,
  knowledgeRelations,
  nextMoves,
  panelDefinitions,
  panelEvidence,
  panelItemDefinitions,
  sourceDocuments,
} from "./schema";

const now = new Date("2026-08-13T09:00:00+09:00");
const salesProfiles: Record<string, Record<string, string>> = {
  "person-sato": {
    age: "52歳",
    summary: "現場の腹落ちを最優先する、叩き上げの工場長",
    career: "製造現場24年。班長、製造課長を経て3年前に工場長へ昇格",
    responsibility: "3ライン・約80名の生産、安全、品質、設備投資の一次判断",
    currentFocus: "欠員時の停止削減と、商品切り替え作業の標準化",
    decisionStyle: "現場班長の意見を聞き、自分の目で稼働を確認してから判断",
    communication: "結論から短く。数字だけでなく、現場でどう変わるかを見せる",
    personalHook: "休日は海釣り。釣った魚を家族に振る舞う",
    winningAngle: "小さく試せる実機デモと、現場班長が納得できる運用イメージ",
    avoid: "本社メリットだけの説明、現場確認なしの即決依頼",
  },
  "person-mori": {
    age: "48歳",
    summary: "品質と働きやすさを両立させたい、調整型の製造部長",
    career: "品質管理出身。製造企画を経て製造部長、繁忙期の応援設計も担当",
    responsibility: "製造計画、要員配置、工程改善。品質保証との合意形成役",
    currentFocus: "品種切り替え時の清掃・検査時間と、繁忙期の残業削減",
    decisionStyle: "関係部署を早めに巻き込み、運用負荷を確認してから起案",
    communication: "丁寧な対話を好む。現場メンバーの反応まで聞くと話が深まる",
    personalHook: "新商品の試食会を自ら企画。地域の食品DX研究会にも参加",
    winningAngle: "品質保証を含む導入手順と、繁忙期でも回る教育計画",
    avoid: "省人化だけを強調すること、品質確認を後回しにすること",
  },
  "person-kuroda": {
    age: "45歳",
    summary: "止めない・自分で直せるを重視する、技術肌の保全責任者",
    career: "設備メーカーのサービス技術を経て現職。保全歴18年",
    responsibility: "冷凍ライン6系統の予防保全、復旧、部品在庫、保全会社選定",
    currentFocus: "老朽設備の突発停止と、交換部品の長納期対策",
    decisionStyle: "故障モードと復旧手順を細かく確認。曖昧な説明では進めない",
    communication: "図面・仕様・実測値があると早い。技術担当同席を歓迎",
    personalHook: "休日は古いバイクの整備。工具の話になると饒舌",
    winningAngle: "部品供給年数、遠隔支援、現場で交換できる範囲を明示",
    avoid: "『壊れません』という断言、保守費用を隠した初期価格訴求",
  },
  "person-yamamoto": {
    age: "54歳",
    summary: "信頼できる紹介と現場確認から入る、慎重派の工場長",
    career: "惣菜工場の生産管理畑。佐藤工場長とは前職で5年間同じ職場",
    responsibility: "生産・品質・人員の統括。設備投資案を本社へ推薦",
    currentFocus: "導入した省人化設備の定着率向上と、教育の属人化解消",
    decisionStyle: "信頼する実務家の評価を重視し、導入現場を見て判断",
    communication: "紹介の経緯を最初に明確に。失敗例も隠さない説明を好む",
    personalHook: "佐藤工場長と今も年に数回食事。高校野球観戦が好き",
    winningAngle: "佐藤工場長経由の紹介と、定着まで伴走した他社事例",
    avoid: "面識を誇張すること、導入後の教育を現場任せにする提案",
  },
  "person-fujimoto": {
    age: "50歳",
    summary: "価格ではなく比較根拠で社内を動かす、ロジカルな購買部長",
    career: "経理・原価管理を経て購買へ。全社購買の標準化を主導",
    responsibility: "3工場の設備購買、見積比較、取引条件、稟議資料の品質管理",
    currentFocus: "工場ごとに異なる要求仕様を揃え、比較可能にすること",
    decisionStyle: "総保有コストと選定理由を表にして、反対意見を先につぶす",
    communication: "前提・比較軸・結論の順。数字の出典があると信頼が上がる",
    personalHook: "食品DX研究会で森部長と同じ分科会。文具店巡りが趣味",
    winningAngle: "5年総額、選定基準、リスクを1枚で比較できる資料",
    avoid: "口頭だけの値引き提案、後出し費用、根拠のない業界No.1",
  },
  "person-ishikawa": {
    age: "61歳",
    summary: "小規模経営の現実を知る、投資回収に厳しいオーナー社長",
    career: "家業を継いで28年。店舗を2店から8店へ拡大し工房を集約",
    responsibility: "最終決裁、資金繰り、商品方針。現場責任者の推薦を尊重",
    currentFocus: "少人数でも止まらない製造と、廃棄ロスの削減",
    decisionStyle: "回収期間を確認したうえで、現場責任者の納得を最終条件にする",
    communication: "専門用語を避け、月額効果と店への影響を端的に伝える",
    personalHook: "商工会の設備委員会で佐藤工場長と面識。早朝の散歩が日課",
    winningAngle: "繁忙日の損失回避額と、段階導入できる小さなプラン",
    avoid: "大手向け機能の羅列、補助金ありきの過大投資",
  },
  "person-nagase": {
    age: "47歳",
    summary: "改善意欲は高いが、稼働を止める変更には慎重な工場長",
    career: "生産管理と設備導入を経験。前職案件で黒田さんと協働",
    responsibility: "製麺ラインの生産、原価、衛生、人員配置と改善投資の起案",
    currentFocus: "季節商品の切り替え時に発生する残業と段取りロス",
    decisionStyle: "段階導入でリスクを限定し、各工程の責任者と合意して進める",
    communication: "現場の時系列に沿った説明が有効。導入初週の動きを知りたがる",
    personalHook: "地域のランニング大会に参加。新しい麺料理の食べ歩きが好き",
    winningAngle: "週末施工、並行稼働、初週サポートを含む移行計画",
    avoid: "一括切り替え前提、稼働停止時間を曖昧にすること",
  },
  "person-hayashi": {
    age: "39歳",
    summary: "データと保全性で選ぶ、社内横断型の生産技術課長",
    career: "制御設計出身。包装ライン刷新を2拠点で担当した若手リーダー",
    responsibility: "技術評価、PoC設計、設備仕様。購買・工場長への推薦材料作成",
    currentFocus: "包装ライン停止原因の横断分析と、予知保全の仕組み化",
    decisionStyle: "小規模検証でデータを取り、再現性が見えたら全体展開",
    communication: "仮説と検証条件を明確に。技術的な反論を歓迎する",
    personalHook: "山本工場長と改善コンテストの審査員仲間。ガジェット好き",
    winningAngle: "2週間のPoC、評価指標、API・保守仕様を最初から提示",
    avoid: "完成品の押し売り、ブラックボックスなAI説明",
  },
};
const entities = [
  {
    id: "person-sato",
    type: "customer_person",
    canonicalName: "佐藤 健一",
    description: "みなと食品 工場長",
    propertiesJson: {
      firstPerson: "俺",
      speechStyle: "現場責任者らしく、率直で落ち着いた口調。語尾は『だよ』『だな』を自然に使う",
      voice: "onyx",
      speechDelivery: "measured",
      salesProfile: salesProfiles["person-sato"],
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "person-mori",
    type: "customer_person",
    canonicalName: "森 あかり",
    description: "こもれび菓子 製造部長",
    propertiesJson: {
      firstPerson: "私",
      speechStyle: "丁寧で親しみのある口調。です・ます調で穏やかに話す",
      voice: "marin",
      speechDelivery: "practical",
      salesProfile: salesProfiles["person-mori"],
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "person-kuroda",
    type: "customer_person",
    canonicalName: "黒田 誠",
    description: "北浜フローズン 保全責任者",
    propertiesJson: { salesProfile: salesProfiles["person-kuroda"] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "person-yamamoto",
    type: "customer_person",
    canonicalName: "山本 隆",
    description: "北港デリカ 工場長",
    propertiesJson: { salesProfile: salesProfiles["person-yamamoto"] },
    createdAt: now,
    updatedAt: now,
  },
  ...[
    ["person-fujimoto", "藤本 美咲", "青葉デリカ 購買部長"],
    ["person-ishikawa", "石川 浩二", "麦の丘ベーカリー 代表取締役"],
    ["person-nagase", "長瀬 香織", "千代川製麺 工場長"],
    ["person-hayashi", "林 直樹", "東都パック 生産技術課長"],
  ].map(([id, canonicalName, description]) => ({
    id,
    type: "customer_person",
    canonicalName,
    description,
    propertiesJson: { salesProfile: salesProfiles[id] },
    createdAt: now,
    updatedAt: now,
  })),
  {
    id: "member-yamada",
    type: "internal_member",
    canonicalName: "山田",
    description: "営業2年目",
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "member-tanaka",
    type: "internal_member",
    canonicalName: "田中",
    description: "営業7年目",
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "company-minato",
    type: "company",
    canonicalName: "みなと食品",
    description: null,
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "company-komorebi",
    type: "company",
    canonicalName: "こもれび菓子",
    description: null,
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "company-kitahama",
    type: "company",
    canonicalName: "北浜フローズン",
    description: null,
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "company-kitako",
    type: "company",
    canonicalName: "北港デリカ",
    description: null,
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  },
  ...[
    ["company-aoba", "青葉デリカ"],
    ["company-mugino丘", "麦の丘ベーカリー"],
    ["company-chiyokawa", "千代川製麺"],
    ["company-toto", "東都パック"],
  ].map(([id, canonicalName]) => ({
    id,
    type: "company",
    canonicalName,
    description: null,
    propertiesJson: {},
    createdAt: now,
    updatedAt: now,
  })),
];
const profiles = [
  {
    entityId: "person-sato",
    companyEntityId: "company-minato",
    ownerEntityId: "member-yamada",
    roleLabel: "工場長",
    imageUrl: "/images/customer-ai/factory-manager.webp",
    catchphrase: "現場を見ずに、数字だけで決めたくない。",
    accent: "coral",
    nextContactAt: new Date("2026-08-20T10:00:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-mori",
    companyEntityId: "company-komorebi",
    ownerEntityId: "member-yamada",
    roleLabel: "製造部長",
    imageUrl: "/images/customer-ai/floor-leader.webp",
    catchphrase: "現場が続けられる仕組みなら、前向きに考えたい。",
    accent: "mint",
    nextContactAt: new Date("2026-08-22T14:00:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-kuroda",
    companyEntityId: "company-kitahama",
    ownerEntityId: "member-tanaka",
    roleLabel: "保全責任者",
    imageUrl: "/images/customer-ai/maintenance-lead.webp",
    catchphrase: "止まったときに、自分たちで戻せるかが大事です。",
    accent: "blue",
    nextContactAt: new Date("2026-08-26T13:00:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-yamamoto",
    companyEntityId: "company-kitako",
    ownerEntityId: "member-tanaka",
    roleLabel: "工場長",
    imageUrl: "/images/customer-ai/yamamoto.webp",
    catchphrase: "紹介なら、現場を一緒に見てもいい。",
    accent: "mint",
    nextContactAt: new Date("2026-08-27T10:00:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-fujimoto",
    companyEntityId: "company-aoba",
    ownerEntityId: "member-yamada",
    roleLabel: "購買部長",
    imageUrl: "/images/customer-ai/fujimoto.webp",
    catchphrase: "安さより、現場が納得できる根拠がほしい。",
    accent: "coral",
    nextContactAt: new Date("2026-08-28T15:00:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-ishikawa",
    companyEntityId: "company-mugino丘",
    ownerEntityId: "member-tanaka",
    roleLabel: "代表取締役",
    imageUrl: "/images/customer-ai/ishikawa.webp",
    catchphrase: "うちの規模で本当に回るのか、そこだけです。",
    accent: "blue",
    nextContactAt: new Date("2026-09-01T11:00:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-nagase",
    companyEntityId: "company-chiyokawa",
    ownerEntityId: "member-yamada",
    roleLabel: "工場長",
    imageUrl: "/images/customer-ai/nagase.webp",
    catchphrase: "止めずに変えられるなら、挑戦したい。",
    accent: "mint",
    nextContactAt: new Date("2026-09-03T13:30:00+09:00"),
    updatedAt: now,
  },
  {
    entityId: "person-hayashi",
    companyEntityId: "company-toto",
    ownerEntityId: "member-tanaka",
    roleLabel: "生産技術課長",
    imageUrl: "/images/customer-ai/hayashi.webp",
    catchphrase: "保全まで含めて、筋のいい提案が好きです。",
    accent: "coral",
    nextContactAt: new Date("2026-09-05T16:00:00+09:00"),
    updatedAt: now,
  },
];
const documents = [
  {
    id: "doc-yamada-0805",
    sourceType: "notion",
    externalId: "demo-notion-0805",
    sourceUrl: "https://www.notion.so/demo-notion-0805",
    title: "みなと食品 初回訪問",
    authorLabel: "山田",
    occurredAt: new Date("2026-08-05T16:00:00+09:00"),
    rawText:
      "佐藤工場長は現場の納得を重視。欠員時にラインが止まり、商品切り替えを現場班長に頼っている。休日は海釣りに出かけるのが趣味で、釣った魚を家族に振る舞うという。",
    contentHash: "demo-0805",
    externalUpdatedAt: now,
    ingestedAt: now,
  },
  {
    id: "doc-tanaka-0712",
    sourceType: "notion",
    externalId: "demo-notion-0712",
    sourceUrl: null,
    title: "北港デリカ 訪問記録",
    authorLabel: "田中",
    occurredAt: new Date("2026-07-12T17:30:00+09:00"),
    rawText: "山本工場長との会話で、みなと食品の佐藤工場長とは前職時代の同僚だと分かった。",
    contentHash: "demo-0712",
    externalUpdatedAt: now,
    ingestedAt: now,
  },
  {
    id: "doc-mori-0728",
    sourceType: "slack",
    externalId: "demo-slack-0728",
    sourceUrl: null,
    title: "こもれび菓子 商談共有",
    authorLabel: "高橋",
    occurredAt: new Date("2026-07-28T15:00:00+09:00"),
    rawText: "森製造部長は繁忙期にも無理なく回る工程を優先。品質管理の吉田さんが設備選定に関与。",
    contentHash: "demo-0728",
    externalUpdatedAt: now,
    ingestedAt: now,
  },
  {
    id: "doc-cross-source-0810",
    sourceType: "slack",
    externalId: "demo-slack-0810",
    sourceUrl: null,
    title: "営業チーム 横断つながりメモ",
    authorLabel: "営業AI",
    occurredAt: new Date("2026-08-10T12:00:00+09:00"),
    rawText:
      "森部長と藤本部長は食品DX研究会の同じ分科会。佐藤工場長と石川社長は商工会の設備委員会で面識あり。黒田さんと長瀬工場長は前職の設備案件で協働。山本工場長と林課長は改善コンテストの審査員仲間。藤本部長と林課長は包装ライン更新で協業。",
    contentHash: "demo-0810",
    externalUpdatedAt: now,
    ingestedAt: now,
  },
  {
    id: "doc-customer-smalltalk-0811",
    sourceType: "notion",
    externalId: "demo-notion-smalltalk-0811",
    sourceUrl: null,
    title: "顧客との雑談・背景メモ",
    authorLabel: "営業チーム",
    occurredAt: new Date("2026-08-11T18:00:00+09:00"),
    rawText:
      "森部長は新商品の試食会を自ら企画する。黒田さんは休日に古いバイクを整備する。山本工場長は高校野球観戦が好き。藤本部長は文具店巡りが趣味。石川社長は早朝の散歩が日課。長瀬工場長は地域のランニング大会に参加し、麺料理の食べ歩きも好き。林課長は新しいガジェットを試すのが好き。",
    contentHash: "demo-smalltalk-0811",
    externalUpdatedAt: now,
    ingestedAt: now,
  },
];
const aliases = [
  { id: "alias-sato", entityId: "person-sato", alias: "佐藤工場長", sourceType: "notion" },
  { id: "alias-yamamoto", entityId: "person-yamamoto", alias: "山本工場長", sourceType: "notion" },
];
const claims = [
  {
    id: "claim-sato-hobby",
    subjectEntityId: "person-sato",
    predicate: "HAS_HOBBY",
    valueText: "休日の海釣り。釣った魚を家族に振る舞う",
    confidence: 0.98,
    status: "supported",
    observedAt: new Date("2026-08-05T16:00:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  },
  ...[
    ["mori", "person-mori", "新商品の試食会を自ら企画する"],
    ["kuroda", "person-kuroda", "休日に古いバイクを整備する"],
    ["yamamoto", "person-yamamoto", "高校野球観戦が好き"],
    ["fujimoto", "person-fujimoto", "文具店巡りが趣味"],
    ["ishikawa", "person-ishikawa", "早朝の散歩が日課"],
    ["nagase", "person-nagase", "地域のランニング大会への参加と麺料理の食べ歩き"],
    ["hayashi", "person-hayashi", "新しいガジェットを試すのが好き"],
  ].map(([key, subjectEntityId, valueText]) => ({
    id: `claim-${key}-hobby`,
    subjectEntityId,
    predicate: "HAS_HOBBY",
    valueText,
    confidence: 0.96,
    status: "supported",
    observedAt: new Date("2026-08-11T18:00:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  })),
  {
    id: "claim-sato-value",
    subjectEntityId: "person-sato",
    predicate: "VALUES",
    valueText: "生産の安定と現場の納得",
    confidence: 0.98,
    status: "supported",
    observedAt: new Date("2026-08-05T16:00:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  },
  {
    id: "claim-sato-challenge",
    subjectEntityId: "person-sato",
    predicate: "HAS_CHALLENGE",
    valueText: "欠員時のライン停止と商品切り替えの属人化",
    confidence: 0.97,
    status: "supported",
    observedAt: new Date("2026-08-05T16:00:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  },
  {
    id: "claim-mori-value",
    subjectEntityId: "person-mori",
    predicate: "VALUES",
    valueText: "繁忙期にも無理なく回る工程",
    confidence: 0.96,
    status: "supported",
    observedAt: new Date("2026-07-28T15:00:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  },
];
const relations = [
  {
    id: "relation-sato-yamamoto",
    fromEntityId: "person-sato",
    toEntityId: "person-yamamoto",
    relationType: "KNOWS",
    label: "前職時代の同僚",
    confidence: 0.94,
    status: "candidate",
    observedAt: new Date("2026-07-12T17:30:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  },
  {
    id: "relation-tanaka-yamamoto",
    fromEntityId: "member-tanaka",
    toEntityId: "person-yamamoto",
    relationType: "HAS_CONTACT",
    label: "訪問担当として接点あり",
    confidence: 1,
    status: "supported",
    observedAt: new Date("2026-07-12T17:30:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  },
  ...[
    ["relation-mori-fujimoto", "person-mori", "person-fujimoto", "地域の食品DX研究会で同じ分科会"],
    ["relation-sato-ishikawa", "person-sato", "person-ishikawa", "商工会の設備委員会で面識あり"],
    [
      "relation-kuroda-nagase",
      "person-kuroda",
      "person-nagase",
      "前職の設備メーカーで同じ導入案件を担当",
    ],
    [
      "relation-yamamoto-hayashi",
      "person-yamamoto",
      "person-hayashi",
      "工場改善コンテストの審査員仲間",
    ],
    [
      "relation-fujimoto-hayashi",
      "person-fujimoto",
      "person-hayashi",
      "包装ライン更新で過去に協業",
    ],
  ].map(([id, fromEntityId, toEntityId, label]) => ({
    id,
    fromEntityId,
    toEntityId,
    relationType: "KNOWS",
    label,
    confidence: 0.91,
    status: "candidate",
    observedAt: new Date("2026-08-10T12:00:00+09:00"),
    extractionVersion: "sales-graph-v1",
    createdAt: now,
  })),
];
const definitions = [
  {
    id: "definition-profile",
    key: "profile",
    title: "基本情報",
    icon: "user",
    description: "役割と大切にしていること",
    sortOrder: 1,
  },
  {
    id: "definition-challenge",
    key: "challenge",
    title: "いまの課題",
    icon: "spark",
    description: "現在困っていること",
    sortOrder: 2,
  },
  {
    id: "definition-relationships",
    key: "relationships",
    title: "キーパーソン",
    icon: "people",
    description: "意思決定に関係する人物",
    sortOrder: 3,
  },
  {
    id: "definition-decision",
    key: "decision",
    title: "意思決定ルート",
    icon: "route",
    description: "誰がどう決めるか",
    sortOrder: 4,
  },
  {
    id: "definition-concern",
    key: "concern",
    title: "本音・懸念",
    icon: "heart",
    description: "提案に対する不安や譲れない条件",
    sortOrder: 5,
  },
];
const itemBlueprints: Record<string, Array<[string, string, string]>> = {
  profile: [
    ["responsibility", "役割・責任範囲", "何を任され、どこまで判断できるか"],
    ["career", "経歴", "現在の判断軸につながる経験"],
    ["style", "判断スタイル", "比較・検討・決断の癖"],
    ["communication", "会話スタイル", "伝わりやすい話し方"],
    ["personal", "人となり", "趣味や雑談などの背景情報"],
  ],
  challenge: [
    ["symptom", "起きている事象", "現場で何が起きているか"],
    ["impact", "事業への影響", "時間・品質・売上への影響"],
    ["frequency", "頻度・規模", "どの程度起きるか"],
    ["cause", "原因仮説", "本人が何を原因と見ているか"],
    ["target", "目指す状態", "どうなれば解決か"],
  ],
  relationships: [
    ["champion", "推進者", "社内で前向きに動く人"],
    ["evaluator", "技術評価者", "仕様や実現性を見る人"],
    ["approver", "承認者", "最終的に許可する人"],
    ["influencer", "影響者", "判断へ強く影響する人"],
    ["outside", "社外の接点", "紹介や信頼につながる関係"],
  ],
  decision: [
    ["initiator", "起案者", "誰が案件を立ち上げるか"],
    ["criteria", "評価基準", "何を満たせば進むか"],
    ["budget", "予算責任者", "予算を握る人・部署"],
    ["final", "最終決裁者", "最後に決める人"],
    ["timing", "決裁時期", "いつ、何に合わせて決めるか"],
  ],
  concern: [
    ["operation", "運用リスク", "現場運用への不安"],
    ["cost", "費用懸念", "価格・回収への不安"],
    ["adoption", "定着懸念", "教育・利用定着への不安"],
    ["history", "過去の失敗", "以前の導入で困ったこと"],
    ["must", "譲れない条件", "絶対に外せない条件"],
  ],
};
const itemDefinitions = definitions.flatMap((panel) =>
  itemBlueprints[panel.key].map(([key, label, description], index) => ({
    id: `item-definition-${panel.key}-${key}`,
    panelDefinitionId: panel.id,
    key,
    label,
    description,
    weight: 1,
    sortOrder: index + 1,
  })),
);
const panelState: Record<string, Array<[string, string | null, string | null]>> = {
  "person-sato": [
    ["unlocked", "食品工場の運営責任者。生産の安定と現場の納得を重視する。", null],
    ["unlocked", "欠員時のライン停止と、商品切り替えを一部の熟練者に頼っている。", null],
    ["ready", "田中さんの記録から、元同僚の山本工場長とのつながりを発見。", null],
    ["locked", null, "設備投資を推薦する人と、最終承認者を確認する"],
    ["locked", null, "過去の設備導入で困ったことを聞く"],
  ],
  "person-mori": [
    ["unlocked", "製造部長。繁忙期にも回る工程づくりを優先する。", null],
    ["unlocked", "品種切り替え時の清掃と検査に時間がかかっている。", null],
    ["unlocked", "品質管理の吉田さんが設備選定に強い影響を持つ。", null],
    ["unlocked", "森部長が起案し、品質保証と工場長の合意後、本社が承認する。", null],
    ["locked", null, "現場が新設備に感じている不安を確認する"],
  ],
  "person-kuroda": [
    ["unlocked", "設備保全責任者。復旧性と部品供給を重視する。", null],
    ["unlocked", "老朽設備の突発停止と、交換部品の長納期が課題。", null],
    ["locked", null, "更新計画に関与する製造側の責任者を確認する"],
    ["locked", null, "来期予算の起案者と承認条件を確認する"],
    ["locked", null, "保全契約で絶対に譲れない条件を聞く"],
  ],
  "person-yamamoto": [
    ["unlocked", "北港デリカの工場長。紹介者への信頼を重視する。", null],
    ["unlocked", "省人化設備の定着率に課題を感じている。", null],
    ["ready", "田中さんの訪問記録から、佐藤工場長との前職つながりを発見。", null],
    ["locked", null, "設備更新の最終承認者を確認する"],
    ["locked", null, "紹介で重視する条件を聞く"],
  ],
  "person-fujimoto": [
    ["unlocked", "購買部長。価格だけでなく現場の納得材料を求める。", null],
    ["unlocked", "複数工場で仕様がばらつき、比較しづらい。", null],
    ["ready", "Slackの研究会メモから、森製造部長との接点を発見。", null],
    ["locked", null, "比較表を誰と作るか確認する"],
    ["locked", null, "稟議で否決された過去案件を聞く"],
  ],
  "person-ishikawa": [
    ["unlocked", "地域密着型ベーカリーの経営者。投資回収を重視する。", null],
    ["unlocked", "少人数運営で、設備停止が売上に直結する。", null],
    ["ready", "商工会議事録から、佐藤工場長との面識を発見。", null],
    ["unlocked", "本人が最終決裁。現場責任者の推薦が条件。", null],
    ["locked", null, "許容できる停止時間を聞く"],
  ],
  "person-nagase": [
    ["unlocked", "工場長。稼働を止めない段階導入を重視する。", null],
    ["unlocked", "季節商品の切り替え時に残業が増える。", null],
    ["ready", "保全日報から、黒田さんとの前職案件を発見。", null],
    ["locked", null, "段階導入の予算枠を確認する"],
    ["locked", null, "現場が最も怖い変更点を聞く"],
  ],
  "person-hayashi": [
    ["unlocked", "生産技術課長。保全性まで含む設計を好む。", null],
    ["unlocked", "包装ラインの停止原因を横断分析できていない。", null],
    ["ready", "改善コンテスト記録から、山本工場長との接点を発見。", null],
    ["unlocked", "技術評価後、購買部長と工場長が共同推薦する。", null],
    ["locked", null, "社内評価で最も重い指標を聞く"],
  ],
};
const panels = profiles.flatMap((profile) =>
  definitions.map((definition, i) => {
    const state = panelState[profile.entityId][i];
    return {
      id: `panel-${profile.entityId.replace("person-", "")}-${definition.key}`,
      customerEntityId: profile.entityId,
      definitionId: definition.id,
      status: state[0],
      summary: state[1],
      unlockHint: state[2],
      unlockedAt: state[0] === "unlocked" ? now : null,
      updatedAt: now,
    };
  }),
);
const knownItemCounts: Record<string, Record<string, number>> = {
  "person-sato": { profile: 5, challenge: 4, relationships: 2, decision: 2, concern: 2 },
  "person-mori": { profile: 5, challenge: 4, relationships: 3, decision: 4, concern: 2 },
  "person-kuroda": { profile: 4, challenge: 4, relationships: 2, decision: 2, concern: 2 },
  "person-yamamoto": { profile: 4, challenge: 3, relationships: 2, decision: 2, concern: 1 },
  "person-fujimoto": { profile: 4, challenge: 3, relationships: 2, decision: 3, concern: 2 },
  "person-ishikawa": { profile: 5, challenge: 4, relationships: 2, decision: 4, concern: 2 },
  "person-nagase": { profile: 4, challenge: 3, relationships: 2, decision: 2, concern: 2 },
  "person-hayashi": { profile: 4, challenge: 4, relationships: 3, decision: 4, concern: 2 },
};
const relationshipDetails: Record<string, string[]> = {
  "person-sato": ["現場班長が導入後の定着を左右する", "山本工場長とは前職時代の同僚"],
  "person-mori": [
    "森部長が社内の推進役",
    "品質管理の吉田さんが設備選定に関与",
    "工場長の合意が必要",
  ],
  "person-kuroda": ["黒田さんが技術評価を主導", "長瀬工場長と前職案件で協働"],
  "person-yamamoto": ["山本工場長が本社への推薦役", "佐藤工場長とは前職時代の同僚"],
  "person-fujimoto": ["藤本部長が比較資料を作成", "森部長と食品DX研究会で同じ分科会"],
  "person-ishikawa": ["現場責任者の推薦を重視", "佐藤工場長と商工会で面識あり"],
  "person-nagase": ["長瀬工場長が改善投資を起案", "黒田さんと前職案件で協働"],
  "person-hayashi": [
    "林課長が技術評価を主導",
    "購買部長と工場長が共同推薦",
    "山本工場長と審査員仲間",
  ],
};
function itemValues(customerId: string, panelKey: string) {
  const profile = salesProfiles[customerId];
  if (panelKey === "profile")
    return [
      profile.responsibility,
      profile.career,
      profile.decisionStyle,
      profile.communication,
      profile.personalHook,
    ];
  if (panelKey === "challenge")
    return [
      profile.currentFocus,
      `担当領域への影響：${profile.responsibility}`,
      "繁忙期や切り替え時に顕在化",
      "属人化と標準化不足が主因の候補",
      profile.winningAngle,
    ];
  if (panelKey === "relationships") return relationshipDetails[customerId];
  if (panelKey === "decision")
    return [
      profile.decisionStyle,
      profile.winningAngle,
      "予算責任者の確認が必要",
      "最終決裁者の確認が必要",
      "次回接触に向け時期を確認",
    ];
  return [
    profile.avoid,
    "費用条件は追加確認",
    profile.communication,
    "過去事例は追加確認",
    profile.winningAngle,
  ];
}
const panelItems = profiles.flatMap((profile) =>
  definitions.flatMap((panelDefinition) => {
    const panelId = `panel-${profile.entityId.replace("person-", "")}-${panelDefinition.key}`;
    const panel = panels.find((item) => item.id === panelId);
    const knownCount = knownItemCounts[profile.entityId][panelDefinition.key];
    const values = itemValues(profile.entityId, panelDefinition.key);
    return itemDefinitions
      .filter((item) => item.panelDefinitionId === panelDefinition.id)
      .map((item, index) => {
        const isKnown = index < knownCount;
        const isReady = !isKnown && index === knownCount && panel?.status === "ready";
        return {
          id: `panel-item-${profile.entityId.replace("person-", "")}-${panelDefinition.key}-${item.key}`,
          customerPanelId: panelId,
          itemDefinitionId: item.id,
          status: isKnown ? "known" : isReady ? "ready" : "missing",
          valueText: isKnown || isReady ? (values[index] ?? "関連する記録あり") : null,
          unlockHint: isKnown || isReady ? null : item.description,
          updatedAt: now,
        };
      });
  }),
);
const evidence = [
  {
    id: "evidence-claim-sato-hobby",
    claimId: "claim-sato-hobby",
    relationId: null,
    sourceDocumentId: "doc-yamada-0805",
    quote: "休日は海釣りに出かけるのが趣味で、釣った魚を家族に振る舞う",
    createdAt: now,
  },
  ...[
    ["mori", "新商品の試食会を自ら企画する"],
    ["kuroda", "休日に古いバイクを整備する"],
    ["yamamoto", "高校野球観戦が好き"],
    ["fujimoto", "文具店巡りが趣味"],
    ["ishikawa", "早朝の散歩が日課"],
    ["nagase", "地域のランニング大会に参加し、麺料理の食べ歩きも好き"],
    ["hayashi", "新しいガジェットを試すのが好き"],
  ].map(([key, quote]) => ({
    id: `evidence-claim-${key}-hobby`,
    claimId: `claim-${key}-hobby`,
    relationId: null,
    sourceDocumentId: "doc-customer-smalltalk-0811",
    quote,
    createdAt: now,
  })),
  {
    id: "evidence-claim-value",
    claimId: "claim-sato-value",
    relationId: null,
    sourceDocumentId: "doc-yamada-0805",
    quote: "現場の納得を重視",
    createdAt: now,
  },
  {
    id: "evidence-claim-challenge",
    claimId: "claim-sato-challenge",
    relationId: null,
    sourceDocumentId: "doc-yamada-0805",
    quote: "欠員時にラインが止まり、商品切り替えを現場班長に頼っている",
    createdAt: now,
  },
  {
    id: "evidence-relation-sato-yamamoto",
    claimId: null,
    relationId: "relation-sato-yamamoto",
    sourceDocumentId: "doc-tanaka-0712",
    quote: "みなと食品の佐藤工場長とは前職時代の同僚",
    createdAt: now,
  },
  {
    id: "evidence-claim-mori",
    claimId: "claim-mori-value",
    relationId: null,
    sourceDocumentId: "doc-mori-0728",
    quote: "繁忙期にも無理なく回る工程を優先",
    createdAt: now,
  },
  ...[
    ["relation-mori-fujimoto", "森部長と藤本部長は食品DX研究会の同じ分科会"],
    ["relation-sato-ishikawa", "佐藤工場長と石川社長は商工会の設備委員会で面識あり"],
    ["relation-kuroda-nagase", "黒田さんと長瀬工場長は前職の設備案件で協働"],
    ["relation-yamamoto-hayashi", "山本工場長と林課長は改善コンテストの審査員仲間"],
    ["relation-fujimoto-hayashi", "藤本部長と林課長は包装ライン更新で協業"],
  ].map(([relationId, quote]) => ({
    id: `evidence-${relationId}`,
    claimId: null,
    relationId,
    sourceDocumentId: "doc-cross-source-0810",
    quote,
    createdAt: now,
  })),
];
const panelEvidenceRows = [
  {
    id: "panel-evidence-sato-profile",
    customerPanelId: "panel-sato-profile",
    claimId: "claim-sato-value",
    relationId: null,
  },
  {
    id: "panel-evidence-sato-challenge",
    customerPanelId: "panel-sato-challenge",
    claimId: "claim-sato-challenge",
    relationId: null,
  },
  {
    id: "panel-evidence-sato-rel",
    customerPanelId: "panel-sato-relationships",
    claimId: null,
    relationId: "relation-sato-yamamoto",
  },
  {
    id: "panel-evidence-mori-profile",
    customerPanelId: "panel-mori-profile",
    claimId: "claim-mori-value",
    relationId: null,
  },
];
const moves = [
  {
    id: "move-sato-1",
    customerEntityId: "person-sato",
    customerPanelId: "panel-sato-decision",
    label: "最終承認者と推薦ルートを確認する",
    reason: "意思決定ルートが未開放",
    status: "open",
    sortOrder: 1,
  },
  {
    id: "move-sato-2",
    customerEntityId: "person-sato",
    customerPanelId: "panel-sato-concern",
    label: "過去の設備導入で困ったことを聞く",
    reason: "本音・懸念が未開放",
    status: "open",
    sortOrder: 2,
  },
  {
    id: "move-mori-1",
    customerEntityId: "person-mori",
    customerPanelId: "panel-mori-concern",
    label: "現場が新設備に感じている不安を聞く",
    reason: "最後の情報パネルを開放するため",
    status: "open",
    sortOrder: 1,
  },
  {
    id: "move-kuroda-1",
    customerEntityId: "person-kuroda",
    customerPanelId: "panel-kuroda-relationships",
    label: "製造側の更新責任者を確認する",
    reason: "キーパーソンが未確認",
    status: "open",
    sortOrder: 1,
  },
];
async function main() {
  const db = createDb();
  try {
    await db.transaction(async (tx) => {
      await tx.delete(nextMoves);
      await tx.delete(panelEvidence);
      await tx.delete(customerPanelItems);
      await tx.delete(customerPanels);
      await tx.delete(panelItemDefinitions);
      await tx.delete(panelDefinitions);
      await tx.delete(customerProfiles);
      await tx.delete(evidenceLinks);
      await tx.delete(knowledgeRelations);
      await tx.delete(knowledgeClaims);
      await tx.delete(entityAliases);
      await tx.delete(sourceDocuments);
      await tx.delete(knowledgeEntities);
      await tx.insert(knowledgeEntities).values(entities);
      await tx.insert(customerProfiles).values(profiles);
      await tx.insert(sourceDocuments).values(documents);
      await tx.insert(entityAliases).values(aliases);
      await tx.insert(knowledgeClaims).values(claims);
      await tx.insert(knowledgeRelations).values(relations);
      await tx.insert(evidenceLinks).values(evidence);
      await tx.insert(panelDefinitions).values(definitions);
      await tx.insert(customerPanels).values(panels);
      await tx.insert(panelItemDefinitions).values(itemDefinitions);
      await tx.insert(customerPanelItems).values(panelItems);
      await tx.insert(panelEvidence).values(panelEvidenceRows);
      await tx.insert(nextMoves).values(moves);
    });
    process.stdout.write("顧客情報マップseedを投入しました。\n");
  } finally {
    await db.$client.end();
  }
}
main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
