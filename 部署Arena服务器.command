#!/bin/bash
# 把 Arena 在线服务器部署为 Cloudflare Worker "parhelion-arena"（只碰这一个 Worker）。需要本机已登录 wrangler。
cd "$(dirname "$0")/arena-game" || exit 1
npm run worker:deploy 2>&1 | tee "$(dirname "$0")/.arena-worker-deploy.log"
echo; echo "完成。部署日志已存到 Parhelion/.arena-worker-deploy.log，回到 Claude 说一声即可。按回车关闭。"; read -r _
