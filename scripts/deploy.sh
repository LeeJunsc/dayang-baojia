#!/usr/bin/env bash
# 构建并发布到 GitHub Pages(gh-pages 分支)
set -euo pipefail
cd "$(dirname "$0")/.."

npm test
npm run build

cd dist
touch .nojekyll
git init -b gh-pages >/dev/null
git config user.name "LeeJunsc"
git config user.email "92505358+LeeJunsc@users.noreply.github.com"
git add -A
git commit -m "deploy $(date +%F_%H%M)" -q
git -c credential.helper='!gh auth git-credential' push --force \
  https://github.com/LeeJunsc/dayang-baojia.git gh-pages
rm -rf .git

echo "✅ 已发布:https://leejunsc.github.io/dayang-baojia/(生效约需1分钟)"
