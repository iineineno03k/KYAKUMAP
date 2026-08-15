# KYAKUMAP — 顧客情報マッピングAI

顧客情報を、つなげて読む。社内に散らばる記録を、顧客・関係者・判断材料へ対応づける営業準備AI。通常入口は `/customers`。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

## データフロー

```text
Notion等 → source_documents → AI抽出 → knowledge graph → customer panels
```

Notionは画面機能ではなくバックエンドコネクタ。原文は`source_documents`へそのまま保存し、AIが作るclaim/relationは必ず原文根拠へ接続する。

## コマンド

- `npm run check`: Biome、tsc、Next build
- `npm run db:migrate`: migration適用
- `npm run db:seed`: 完全合成データへリセット
- `npm run db:verify`: 原本・関係・情報領域を検証
- `npm run sync:notion -- --limit 1`: Notionの更新記録を1件取得し、OrcaRouterで抽出して知識テーブルへ保存
- `npm run logs`: AI処理ログを読む
- `npm run probe -- billing`: OrcaRouterの課金累計を確認（単位はセント）

### Notionから手動同期する

```bash
npm run sync:notion -- --limit 1
```

提出済みのNotion営業記録から、原文の新規・更新分だけを`source_documents`へ保存し、OrcaRouterで人物・事実・関係と原文根拠を抽出する。検証済みの結果は`knowledge_entities / knowledge_claims / knowledge_relations / evidence_links`へ保存する。API課金を意図せず増やさないよう、既定の処理上限は1件。

原文保存後にAI処理が失敗した場合は、原因を直してから`--force`を付けて再実行する。未処理候補が残っている場合は、通常のコマンドを繰り返す。

## 環境変数

`ORCAROUTER_API_KEY`、`ORCAROUTER_KNOWLEDGE_MODEL`、`ORCAROUTER_CUSTOMER_CHAT_MODEL`、`DATABASE_URL`。Notion同期には`NOTION_API_TOKEN`と`NOTION_DATA_SOURCE_ID`を追加する。記録AIの既定値は`orcarouter/auto`、知識抽出の既定値は`anthropic/claude-haiku-4.5`。

## 実測した OrcaRouter の挙動

`npm run probe` で確認した事実です。推測ではありません。音声・旧顧客AIに関する項目は廃止前の履歴です。

- `GET /v1/models` は**認証なしで引けます**（184モデル）。原価の推定にはこれを使っています
- ストリーミングで `stream_options: {include_usage: true}` を付けると、最後のチャンクに `usage` が来ます
- **`x-orca-resolved-model` / `x-orca-router` は、`orcarouter/*` のルーター名を指定したときだけ返ります。** `openai/gpt-4o-mini` のように具体的なモデル名を書いた場合は返りません（解決すべきものが無いため）
- `POST /v1/audio/speech` は `Content-Type: audio/mpeg` で音声データを返します
- `openai/gpt-4o-mini-tts` に同じ89字・同じ話し方指示を与え、`cedar` / `onyx` / `marin` の3音声を生成すると3.2〜4.2秒。3件合計の実費は2.0142セント（2026-08-12実測）。音質比較は `/voice-lab` で行い、商談ループでは顧客AI設定で選んだ声を使用する
- 商談用の`/api/speech`は固定文17字・`cedar`で2,190ms、54,528 bytes、`audio/mpeg`（2026-08-12実測）
- `input_audio` は本番の商談ループでは使わない。音声入力はブラウザ標準認識、顧客AIの読み上げだけを `/audio/speech` に分離する
- `/v1/dashboard/billing/usage` は `{"object":"list","total_usage":...}` を返します。**単位はセント**で、**ワークスペース単位の累計**です。APIキー別・リクエスト別ではありません
- `orcarouter/sales-customer-adaptive`の過去14件では平均2.70秒。ただし廃止済みpromptの結果であり、現行品質の根拠には使わない（2026-08-13実測）
- 現行の根拠付き記録AIで`orcarouter/auto`を使う場合、`response_format`による構造化出力では2件とも`Invalid JSON response`になった。Anthropicを含むプロバイダ横断の構造化回答は、OrcaRouter公式仕様に合わせてTool Callingへ変更した（2026-08-15）
- Tool Callingへ変更後の固定2問は両方成功した。既知質問は`openai/gpt-5-nano-2025-08-07`へ解決され7.4秒・0.060225セント、未知質問は`google/gemini-2.5-pro`へ解決され12.5秒・2.1985セント。2件合計2.258725セント（公開単価とusageから算出、課金累計差2.2588セントと一致。2026-08-15）
- `KYAKUMAP Security Guardrail`を使用中のAPIキーへ明示的に紐付けた。入力のメール・電話・IPはマスクし、クレジットカード・SSN・マイナンバー・OpenAI APIキー・AWSアクセスキー・JWTはブロックする。OrcaRouterキーはカスタムRE2でマスクし、マッチ原文ログはOFF。架空メールは`[EMAIL]`、架空OrcaRouterキーは`[ORCAROUTER_API_KEY]`へ置換され、架空SSNはモデル呼び出し前にHTTP 400 `guardrail_blocked`となりusageなしだった（2026-08-15）

---

## 既知の制約

- 知識グラフは現時点ではPostgreSQL上のノード/エッジ表現。Neo4jは未導入
- Notion以外のSlack、CRM、Teams、メールコネクタはインターフェースのみ設計済み
- エンティティ同一性が曖昧な場合は自動統合しない
- 情報充足度は人物理解の推測値ではなく、固定情報項目の根拠付き充足率
- 認証、権限継承、実顧客データ取り込みは未実装。画面とseedは完全合成データ
- 375px幅とノートPC幅で主要導線に横スクロールがないことを確認済み
