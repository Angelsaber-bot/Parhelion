# 自动部署（GitHub main → 公网 + 本地 Mac）

每次推送到 `main`，GitHub Actions（`.github/workflows/deploy.yml`）会：

1. 安装依赖，跑 Arena 测试和网站测试（World 测试会跑并显示结果，但不挡部署）。
2. 构建网站 `site/dist/public`，并确认里面用的是正式 Arena 服务器地址。
3. 先部署 Arena Worker `parhelion-arena`，再用冒烟测试连一次正式服务器。
4. 冒烟测试通过后才部署 Cloudflare Pages 项目 `parhelion-game`。

只碰这两个 Cloudflare 项目，旧游戏的项目不动。只改 `*.md`、`docs/`、`.command` 的推送不会触发部署；
在 GitHub 的 Actions 页面点 “Run workflow” 可以手动再部署一次。

## 一次性设置（max）

1. Cloudflare 控制台 → 右上角头像 → My Profile → API Tokens → Create Token →
   选模板 **Edit Cloudflare Workers** → Use template。
   - 确认权限里有 `Account · Workers Scripts · Edit` 和 `Account · Cloudflare Pages · Edit`（没有就点 “+ Add more” 加上）。
     Durable Objects 由 Workers Scripts 权限覆盖。
   - Account Resources 选你自己的账号；Zone Resources 选 All zones（没有域名也没关系）。
   - Continue → Create Token，复制 token（只显示一次）。
2. Account ID：Cloudflare 控制台首页 → Workers & Pages，右侧栏 “Account ID”，复制。
3. GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret，加两个：
   - `CLOUDFLARE_API_TOKEN` = 第 1 步的 token
   - `CLOUDFLARE_ACCOUNT_ID` = 第 2 步的 Account ID
4. Actions 页面 → Deploy → Run workflow，跑一次确认变绿。

没设置密钥时流程只测试和构建，不部署（会显示一条黄色警告）。

## 本地 Mac 自动同步

在 `Desktop/Parhelion` 里双击 **安装自动同步.command** 一次。之后每 2 分钟（以及开机登录时）静音执行
`site/scripts/mac/sync.sh`：

- `git fetch` + `git merge --ff-only origin/main`，然后重建本地一键网站（`启动 Parhelion.command` 用的 `site/dist`）。
- 有未提交的本地修改、不在 main 分支、或本地有未推送的提交时直接跳过，不覆盖任何东西。
- `_local/` 等未跟踪文件永远不动。
- 日志：`~/Library/Logs/Parhelion-sync.log`。卸载：再双击一次安装文件，输入 `u` 回车。
- 第一次运行如果 macOS 问 “bash 想访问桌面文件夹”，点 “允许”。

`部署Arena服务器.command` 和 `部署到公网.command` 保留为手动备用，正常情况下不再需要。
