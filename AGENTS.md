# Parhelion 项目约定

- 每次开发改动默认同步三端。更新本机可玩的构建，提交并推送到 GitHub `main`，发布到现有公网项目 `parhelion-game`。Arena 联机规则变化时，先更新 `parhelion-arena` 并验证联机，再发布网页。核对三端版本后再报告完成。
- 按改动范围选择测试。Arena 小修运行相关 Arena 测试、构建和必要的联机验证，可用现有 Cloudflare 手动发布流程快速同步。影响 World 或共享功能的改动做对应回归。
