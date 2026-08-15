# 引き継ぎ — KYAKUMAP

最終更新: 2026-08-14

## 現在地

KYAKUMAPは、社内に散らばる記録を顧客・関係者・判断材料へ対応づけ、本人らしい一人称で質問に答える根拠付き顧客情報マッピングAI。現在の公開可能な製品方針は`PRODUCT-RESET.md`。private側の詳細な企画SSoTは`../docs/proposal-v6.md`、技術設計は`../docs/design-v5.md`。

ブランド上の重要な境界として、人を「攻略対象」「キャラクター」と呼ばない。鍵・アンロック・発見演出は残すが、開く対象は人物ではなく、根拠が対応づいた情報領域である。画面上の数値は「顧客理解度」ではなく、会社が定義した情報項目の「情報充足度」として表示する。

通常入口は`/customers`。顧客詳細では音声・テキストで質問できる。既知情報は人物らしく回答し、情報不足時は関係グラフ上の情報保持者候補を提示する。顧客候補は詳細画面へリンクする。

顧客一覧は写真を大きく保ったまま、カード内の情報を「訪問日時・人物・次に確認する1件（または新しい手がかり）」へ絞った。名前・会社・役職の簡易検索がある。顧客詳細では、所属・役職・年齢・経歴・担当範囲はAIへ尋ねず「基本プロフィール」で即読できる。深掘りたいことだけを顧客AIへ尋ねる設計に分けた。根拠表示の資料名は`source_documents.source_url`がある場合にNotion等の原本へリンクする。

顧客詳細の第一画面は「関係者マップ」と「情報充足度」を並べる。関係グラフは中心人物から2段先まで表示し、社内の接点を含む未知の関係へ気づかせる。デスクトップではノードのドラッグとキャンバス移動ができ、拡大・縮小は右上のボタンを使う。通常のホイールとモバイルの1本指操作はページスクロールを優先する。情報充足度は全体バーと5領域のコンパクト表示に絞り、各領域の既知・未知の詳細はモーダルで開く。モーダルの「未確認項目から質問を作る」は、未確認項目を質問文としてチャット入力欄へ渡す（送信はしない）。大きな人物紹介カードは廃止し、冒頭の折りたたみ式「営業前メモ」へ集約した。

関係グラフの人物ノードは、`customer_profiles.image_url`がある場合は円形の顔写真アイコンを使う。写真がない社内メンバーなどは頭文字へフォールバックする。選択状態は写真を黄色く塗らず黄色いリングで示し、社内メンバーはミント色、2段先は破線のリングという既存の意味を維持する。

情報充足度には最優先の`next_moves`を「次に確認したいこと」として1件だけ表示し、質問の下書きを作れる。関係者マップでも選択した人物との接点について質問の下書きを作れる。どちらもAPIへ自動送信せず、チャット入力欄へ移動して営業本人の確認を待つ。

従来の最下部のチャット欄は廃止し、画面右下の「記録AIに聞く」または各質問導線から音声中心の会話モードを開く。会話モードは人物写真と大きなマイクを中心にし、テキスト入力は折りたたみ式の補助手段、過去ログは「会話メモ」として扱う。LLMの回答テキストは先に表示せず、TTSの再生開始と同時に表示する。LLM回答後から音声準備中までは「社内記録を確認しています」と明示し、実在本人が考えているようには見せない。表示上も「人物設定に合う合成音声」「〇〇さんの記録AI」と明示する。

`next_moves.label`は内部の営業タスク名として維持し、詳細画面ではそのまま表示しない。`page.tsx`の`conversationQuestions`で「設備導入を最終的に決めるのは、どなたですか？」のように、そのまま声に出せる一問一答の疑問文へ変換する。複数の確認事項を含むタスクは複数の質問へ分割する。関係ノード・情報領域から作る質問も「記録を教えて」ではなく、顧客本人へ直接尋ねる文体にそろえる。

`ready`のパネルがある場合だけ、具体的な発見内容を「新しい手がかり」として営業前メモの直下に表示する。「マップで見る」で該当人物を選択・強調する。一度見た手がかりは顧客・パネル単位でlocalStorageへ記録し、同じ通知を再読み込みのたびに出さない。

## データとAI

1. `source_documents`: Notion等から取得した原本SSoT
2. `knowledge_entities / claims / relations / evidence_links`: 根拠付き知識グラフ
3. `customer_profiles / customer_panels / next_moves`: 営業準備UIへの投影
4. `POST /api/customers/:customerId/chat`: 顧客近傍を取得し、OrcaRouter Auto Router＋Tool Callingで人物らしい回答を構造化生成
5. `POST /api/speech`: 回答を人物設定の声で読み上げる

Notionの取り込みは手動CLIで一気通貫に実行できる。

```bash
npm run sync:notion -- --limit 1
```

更新された原文を`source_documents`へ保存し、OrcaRouterで人物・事実・関係を抽出した後、根拠引用の原文一致を検証して`knowledge_* / evidence_links`へ保存する。既定はAPI課金を抑えるため1件。原文保存後の失敗を再処理するときは`--force`を付ける。

各情報領域は`panel_item_definitions`の5小項目へ分かれ、顧客別状態は`customer_panel_items`に持つ。領域別と全体の情報充足度は小項目の重み付き充足率。佐藤カードは15/25で全体60%、内訳は基本情報100%、課題80%、キーパーソン40%、意思決定40%、懸念40%。

事実をLLMへ作らせない。LLMが返したevidenceId/entityIdはDB由来の許可リストで検証し、リンクURLはサーバーが生成する。根拠なしknown回答はunknownへ降格する。

記録AIの既定モデルは`orcarouter/auto`。Auto RouterはAnthropicを含む複数プロバイダへ解決され得るため、`generateObject`の`response_format`ではなく、プロバイダ横断で変換されるTool Callingを必須指定して構造化回答を受け取る。知識抽出は引き続き`anthropic/claude-haiku-4.5`固定。

OrcaRouter側では`KYAKUMAP Security Guardrail`を現在のAPIキーへ明示的に紐付け済み。入力の連絡先等をマスクし、決済・本人確認情報と代表的なシークレットをブロックする。マッチ原文ログはOFF。設定内容と実測結果はREADME「実測した OrcaRouter の挙動」を参照。

## 重要ファイル

- `src/server/customer-ai/context.ts`: 顧客近傍・根拠・情報保持者候補の取得
- `src/app/api/customers/[customerId]/chat/route.ts`: OrcaRouterと出力検証
- `src/server/ingestion/sync-notion.ts`: Notion原文同期から知識抽出・保存までのオーケストレーション
- `src/server/knowledge/persist-extraction.ts`: AI抽出結果の冪等保存と古い抽出結果の置換
- `scripts/sync-notion-knowledge.mts`: 手動同期CLI
- `src/app/(workspace)/customers/[customerId]/_components/customer-ai-chat.tsx`: 音声・テキストUI
- `src/lib/prompts.ts`, `../docs/prompts.md`: プロンプトSSoT
- `src/lib/browser-speech.ts`, `src/app/api/speech/route.ts`: 音声入出力

## 確認

```bash
cd app
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:verify
npm run check
```

API課金を伴う確認は`npm run logs`を先に読み、`TESTING.md`の固定質問を既知・未知各1回までにする。ログは`.logs/turns.jsonl`へ残る。
