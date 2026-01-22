# ops

此目录用于存放**部署/运维**相关脚本，不参与前后端应用运行。

## 脚本说明

- `ops/local/compare-versions.sh`：对比本机 / 远端仓库（如 gitee）/ 服务器的代码版本（commit/tag）。
- `ops/server/deploy-script-with-version-select.sh`：用于在服务器上初始化并生成 `/opt/deploy/jh-craftsys/` 的部署脚本与配置模板（会写入示例配置）。
- `ops/server/minimal-version-upgrade.sh`：用于最小化升级服务器部署脚本（更新 `/opt/deploy/jh-craftsys/bin` 下的部分脚本能力）。
- `ops/local/start-all.sh`：本地一键启动前后端（当前脚本偏历史用途，可能与现有工程的 pnpm/npm 与健康检查路径不完全一致）。

## 安全提示

- 不要在仓库内保存真实密码/密钥；脚本若包含示例凭据，部署前请改为通过环境变量或独立的 secrets 文件注入。
