# 服务端 update.sh 134033e 失败修复说明

## 现象

执行 `sudo /opt/deploy/jh-craftsys/bin/update.sh 134033e` 后：

1. **未切到 134033e**：输出显示 `HEAD is now at 0e33fed`（最新版），而不是 134033e。
2. **后端路径错误**：`npm error path /opt/jh-craftsys/source/backend/package.json` —— 仓库已是 monorepo，后端在 `packages/backend`，不是 `backend`。

## 原因

- **02_checkout_or_update.sh**：服务端脚本可能是旧版，未正确按 commit 参数切换，或参数未传入，导致仍切到 `origin/main`（0e33fed）。
- **04_install_backend_deps.sh**：服务端脚本仍是“单仓”时代的路径（`$SRC_DIR/backend`），当前仓库为 monorepo，正确路径为 `$SRC_DIR/packages/backend`。

## 一、一次性修复（在服务器上执行）

在服务器上按顺序执行即可完成“更新到 134033e”并绕过旧脚本问题。

### 1. 切到 134033e

```bash
cd /opt/jh-craftsys/source
git fetch origin
git checkout 134033e
git rev-parse --short HEAD   # 应输出 134033e
```

### 2. 修正 04 的后端路径（若仍是 backend）

```bash
# 查看当前 04 里是否还是 backend
grep -n 'SRC_DIR.*backend' /opt/deploy/jh-craftsys/bin/04_install_backend_deps.sh
```

若看到的是 `cd "$SRC_DIR/backend"`，改为 `packages/backend`：

```bash
sudo sed -i 's|SRC_DIR/backend|SRC_DIR/packages/backend|g' /opt/deploy/jh-craftsys/bin/04_install_backend_deps.sh
```

### 3. 只跑升级链（不再拉取/切版本）

```bash
# 代理若需要先开
sudo -u changyun /opt/deploy/jh-craftsys/bin/00_proxy_on.sh

# 后端依赖 + 前端构建 + 重启
sudo -u changyun /opt/deploy/jh-craftsys/bin/04_install_backend_deps.sh
sudo -u changyun /opt/deploy/jh-craftsys/bin/05_install_frontend_deps_build.sh
sudo -u changyun /opt/deploy/jh-craftsys/bin/07_restart_backend_systemd.sh
sudo -u changyun /opt/deploy/jh-craftsys/bin/08_deploy_switch_and_smoke.sh
sudo -u changyun /opt/deploy/jh-craftsys/bin/10_proxy_off.sh
```

（若你平时用 `sudo update.sh` 且脚本里会切用户，这里用 `sudo -u changyun` 保持一致；用户名为你实际跑部署的用户。）

### 4. 验证

```bash
cd /opt/jh-craftsys/source
git log -1 --oneline   # 应为 134033e
sudo systemctl status jiuhuan-backend
```

---

## 二、长期修复：更新服务端部署脚本（推荐）

让服务端的 `02`、`04` 等与仓库当前版本一致（支持 commit 参数 + monorepo 路径）。

1. **在本地**（或能访问本仓库的机器）当前分支已包含最新部署脚本时，将 `ops/server/deploy-script-with-version-select.sh` 拷到服务器。
2. **在服务器上**执行一次该脚本（会覆盖 `/opt/deploy/jh-craftsys/bin/` 下的 02、04、update.sh 等）：

   ```bash
   # 假设脚本已拷到 /tmp/deploy-script-with-version-select.sh
   bash /tmp/deploy-script-with-version-select.sh
   ```

3. 再执行指定版本升级：

   ```bash
   sudo /opt/deploy/jh-craftsys/bin/update.sh 134033e
   ```

这样以后用 `update.sh <commit|tag|branch>` 都会按参数切换，且 04 会使用 `packages/backend`。

---

## 小结

| 问题 | 处理 |
|------|------|
| HEAD 在 0e33fed 而不是 134033e | 在 source 目录手动 `git checkout 134033e`，或更新 02 脚本后重跑 `update.sh 134033e` |
| `backend/package.json` 不存在 | 把 04 里的 `$SRC_DIR/backend` 改为 `$SRC_DIR/packages/backend`，或重新生成部署脚本 |

按“一”做可立刻完成 134033e 的部署；按“二”做可避免以后同类问题。
