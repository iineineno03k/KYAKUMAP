---
marp: true
theme: kyakumap
size: 16:9
paginate: false
html: true
title: KYAKUMAP — AI HACK 2026
description: 顧客情報を、つなげて読む。営業準備AI KYAKUMAPの4分発表資料
---

<!-- _class: title -->

<div class="brand">KYAKUMAP</div>

# 顧客情報を、<br><span>つなげて読む。</span>

営業準備AI「KYAKUMAP」

<!--
私たちは、社内に散らばった顧客情報をつなぎ、次の訪問準備へ変える営業準備AI、KYAKUMAPを開発しました。

[Sources]
- KYAKUMAP Zenn記事ドラフト（docs/zenn-draft.md）
-->

---

<!-- _class: evidence -->

## 商談の速さを分けるのは、**準備**でした

<div class="periods">
  <div><small>できる担当者</small><strong>1〜2<em>か月</em></strong></div>
  <div class="divider">／</div>
  <div><small>進まない担当者</small><strong>半年〜1<em>年</em></strong></div>
</div>

<div class="causal">
  <b>重要な情報を持ち帰る</b><i>→</i><b>仮説を立てる</b><i>→</i><b>複数の提案を準備する</b>
</div>

<p class="source">2026年8月、営業・人事経験者へのインタビューに基づく</p>

<!--
営業経験者へのインタビューでは、商談をまとめるまでに、1〜2か月と半年から1年の差がありました。
差を生むのは準備です。顧客から重要な情報を持ち帰り、仮説と複数の提案を用意できるか。
しかし実際には、その情報は日報や会議記録、別担当者の記憶に散らばっています。

[Sources]
- 営業・人事経験者へのユーザーインタビュー（2026年8月実施）
- 公開用の表現境界: docs/demo-video.md
-->

---

<!-- _class: handoff -->

## 散らばった情報が、<br>次の訪問準備へ変わる。

<p>デモ動画をご覧ください。</p>

<!--
KYAKUMAPは、AIに正しい提案を考えさせるものではありません。
チームがすでに持つ情報から、次に確認すべきことを見つけます。
それでは、デモ動画をご覧ください。
-->

---

<!-- _class: demo -->

<video controls playsinline preload="metadata" poster="images/kyakumap-demo-thumbnail.png">
  <source src="videos/kyakumap-demo.mp4" type="video/mp4">
</video>

<!--
動画を再生する。
-->

---

## 答えを作るのではなく、**根拠へつなぐ。**

<div class="responsibilities">
  <div>
    <small>KNOWLEDGE</small>
    <strong>知識はDB</strong>
    <p>事実・人物・関係<br>原文根拠を保持</p>
  </div>
  <i>→</i>
  <div>
    <small>EXPRESSION</small>
    <strong>表現はLLM</strong>
    <p>必要な根拠を選び<br>回答を読みやすくする</p>
  </div>
  <i>→</i>
  <div>
    <small>VALIDATION</small>
    <strong>リンクはサーバー</strong>
    <p>根拠ID・人物IDを<br>許可リストで照合</p>
  </div>
</div>

<div class="safety-line">有効な根拠がなければ、コード側で「分からない」へ降格</div>

<!--
自然文の日報から人物、事実、関係を抽出するためにAIが必要です。
一方で、営業準備では、もっともらしい嘘は許されません。
そこで、知識はDB、表現はLLM、リンクはサーバーで検証する構成にしました。
根拠を確認できなければ、AIが回答してもコード側で「分からない」へ降格します。

[Sources]
- KYAKUMAP Zenn記事ドラフト「自然さと事実性を両立する設計」
- app/src/lib/customer-ai.ts
-->

---

## 業務データを扱うための、**二重の境界**

<div class="boundaries">
  <section>
    <small>APPLICATION</small>
    <h3>必要な情報だけを渡す</h3>
    <ul>
      <li>質問対象の顧客周辺に限定</li>
      <li>根拠ID・人物IDを検証</li>
      <li>APIキーはサーバーだけで保持</li>
    </ul>
  </section>
  <section>
    <small>ORCAROUTER</small>
    <h3>モデルの前で守る</h3>
    <ul>
      <li>質問に応じてモデルを選択</li>
      <li>個人情報・APIキーをマスク</li>
      <li>機密情報は呼び出し前にブロック</li>
    </ul>
  </section>
</div>

<p class="bottom-claim">品質・コスト・安全性を、運用として制御する。</p>

<!--
本番運用では、アプリとAIゲートウェイに二重の境界を置きました。
アプリ側で入力範囲と出力IDを制限し、OrcaRouter側で個人情報やシークレットをマスク、またはモデルへ届く前にブロックします。
またAuto Routerによって、質問の難しさに応じてモデルを使い分けます。

[Sources]
- KYAKUMAP Zenn記事ドラフト「OrcaRouterで、LLMコストとセキュリティを運用に組み込む」
- OrcaRouter Guardrails検証記録（docs/zenn-draft.md）
-->

---

<!-- _class: closing -->

## 一人が持ち帰った情報を、<br><span>次の人の準備へ。</span>

<div class="target">複数の担当者が、同じ顧客に関わる法人営業チームへ</div>

<p>既存の日報や顧客管理を置き換えず、<br>散らばった記録を、次の訪問で使える判断材料に変える。</p>

<div class="closing-footer"><b>KYAKUMAP</b>　顧客情報を、つなげて読む。</div>

<!--
KYAKUMAPは、既存の日報や顧客管理を置き換えません。
散らばった記録を、次の訪問で使える判断材料へ変えます。
AIが顧客を想像するのではなく、チームが持つ顧客理解へたどり着けるようにする。
顧客情報を、つなげて読む。KYAKUMAPです。

[Sources]
- KYAKUMAP Zenn記事ドラフト「おわりに」
-->
