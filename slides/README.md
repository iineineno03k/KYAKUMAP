# KYAKUMAP 4分発表資料

Marp形式の発表資料です。GitHub PagesではHTMLとして公開します。

## ローカル確認

```bash
npx --yes @marp-team/marp-cli@4.2.3 \
  slides/pitch.md \
  --theme slides/theme.css \
  --html \
  --server
```

## ビルド

```bash
mkdir -p dist/images dist/videos
npx --yes @marp-team/marp-cli@4.2.3 \
  slides/pitch.md \
  --theme slides/theme.css \
  --html \
  --output dist/index.html
cp public/images/kyakumap-demo-thumbnail.png dist/images/
cp public/videos/kyakumap-demo.mp4 dist/videos/
```

`main`へpushすると、`.github/workflows/pages.yml`がGitHub Pagesへ自動デプロイします。
