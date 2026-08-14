export function conversationQuestions(label: string) {
  const questions: Record<string, string[]> = {
    最終承認者と推薦ルートを確認する: [
      "設備導入を最終的に決めるのは、どなたですか？",
      "導入を進めるには、誰の推薦が必要ですか？",
    ],
    過去の設備導入で困ったことを聞く: ["以前、設備を導入したときに困ったことはありましたか？"],
    現場が新設備に感じている不安を聞く: [
      "現場の皆さんは、新しい設備にどんな不安を感じていますか？",
    ],
    製造側の更新責任者を確認する: ["製造側で設備更新を担当しているのは、どなたですか？"],
  };
  return questions[label] ?? [label];
}
