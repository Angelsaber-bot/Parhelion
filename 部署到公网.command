#!/bin/bash
# 把已构建好的网站（site/dist/public）发布到 https://parhelion-game.pages.dev
# 只部署 Cloudflare Pages 项目 parhelion-game，不碰其它项目。需要本机已登录 wrangler。
cd "$(dirname "$0")/site" || exit 1
if [ ! -f dist/public/index.html ]; then echo "还没有构建：先在 site 目录运行 npm run build"; read -r _; exit 1; fi
npx --yes wrangler@4.153.0 pages deploy dist/public --project-name parhelion-game --branch main --commit-dirty=true
echo; echo "完成后打开 https://parhelion-game.pages.dev 查看。按回车关闭。"; read -r _
