# 工具脚本目录说明

此目录用于存放一次性或辅助脚本（不参与应用运行与构建）。

如需新增脚本，建议遵循：

- 命名体现用途（例如 `check_*`、`analyze_*`、`rename_*`）
- 在脚本顶部写明用途、输入、输出、运行方式

## BMO 开发一键脚本

- `bmo-dev-up.sh`
  - 作用：拉起后端开发服务（启用 `dev-user` 自动登录，默认直连 `http://jiuhuan.net:18081`）
  - 用法：`./tools/bmo-dev-up.sh`
  - 强制重启后端：`FORCE_RESTART=1 ./tools/bmo-dev-up.sh`
- `bmo-dev-status.sh`
  - 作用：查看后端监听与关键接口状态
  - 用法：`./tools/bmo-dev-status.sh`
- `bmo-dev-down.sh`
  - 作用：停止由脚本托管的后端进程（基于 pid 文件）
  - 用法：`./tools/bmo-dev-down.sh`
