# 首页语言层（不替换现有首页）

`reference-home.html` 是当前线上首页的结构快照，仅供文字覆盖测试，不是完整网站构建入口。
本次没有取得其现用 `/site/style.css` 与完整图片资源：只读请求返回 HTTP 403。
不要用此目录或历史首页覆盖当前网站，否则会丢失视觉资源。

共享语言保存键：`parhelion-language-v1`，值 `zh` / `en`。首页、Arena、World 在同一域名下共用选择。

## 在现有网站的审核副本中应用

1. 使用已有依赖构建语言层（不会安装软件）：`node site/build-localization.mjs`。
2. 复制当前完整静态站点到审核目录。不要直接指向生产发布目录。
3. 预检：`node site/apply-localization.mjs /绝对路径/审核目录 --dry-run`。
4. 应用：`node site/apply-localization.mjs /绝对路径/审核目录`。

脚本仅新增 `site/home-language.js`、`site/language.css` 和首页两个引用标签；会保留原首页备份 `index.html.before-language`。
现有图片、主样式、链接与 Arena/World 内容不被覆盖。重复运行幂等；发现不同的已有语言文件则停止，要求人工核对。

此脚本不部署、不上传、不提交 Git、不自动构建游戏。上线仍需用户单独授权，并与本次游戏构建统一验收。
