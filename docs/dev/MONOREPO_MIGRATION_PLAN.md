# Monorepo 迁移方案（详细版）

> 本文为迁移规划与落地记录：本次先完成「前端迁移到 `packages/frontend`」，后端暂时仍在 `backend/`（继续使用 npm，不做 pnpm 化），后续再评估迁入 `packages/backend`。
>
> 统一约定：前端构建产物只认 `packages/frontend/dist/`。

## 📋 目录

1. [当前结构分析](#当前结构分析)
2. [目标结构设计](#目标结构设计)
3. [迁移影响分析](#迁移影响分析)
4. [详细迁移步骤](#详细迁移步骤)
5. [需要修改的文件清单](#需要修改的文件清单)
6. [风险评估与应对](#风险评估与应对)
7. [回滚方案](#回滚方案)
8. [测试验证清单](#测试验证清单)

---

## 当前结构分析

### 当前目录结构

```
jiuhuan/
├── src/                    # 前端源代码（根目录）
├── backend/                # 后端代码（子目录）
├── package.json            # 前端依赖配置
├── vite.config.ts          # 前端构建配置
├── tsconfig.json           # TypeScript 配置（前端）
├── components.d.ts         # 组件类型定义（自动生成）
├── uno.config.ts           # UnoCSS 配置
├── eslint.config.mjs       # ESLint 配置
├── mock/                   # Mock 数据
├── public/                 # 静态资源
├── tools/                  # 工具脚本
├── docs/                   # 文档
├── ops/                    # 部署脚本
└── ...                     # 其他配置文件
```

### 当前配置特点

1. **前端配置在根目录**
   - `package.json`、`vite.config.ts`、`tsconfig.json` 等都在根目录
   - 路径别名 `@/*` 指向 `src/*`
   - 构建输出到 `dist/` 或 `dist-*`

2. **后端独立在 `backend/` 目录**
   - 有自己的 `package.json` 和依赖
   - 使用 npm（前端使用 pnpm）
   - 运行在 3001 端口

3. **工具脚本跨目录引用**
   - `tools/pdf/debug-mould-transfer.ts` 引用 `../../src/utils/pdf/mouldTransferParser`

4. **部署脚本硬编码路径**
   - 多个 shell 脚本中硬编码了 `backend/` 和 `src/` 路径

---

## 目标结构设计

### 目标目录结构

```
jiuhuan/
├── packages/
│   ├── frontend/           # 前端包
│   │   ├── src/            # 前端源代码
│   │   ├── public/         # 静态资源
│   │   ├── mock/           # Mock 数据
│   │   ├── package.json    # 前端依赖
│   │   ├── vite.config.ts  # 前端构建配置
│   │   ├── tsconfig.json   # TypeScript 配置
│   │   ├── components.d.ts # 组件类型定义
│   │   ├── uno.config.ts   # UnoCSS 配置
│   │   └── index.html      # HTML 入口
│   │
│   └── backend/            # 后端包
│       ├── routes/          # 路由
│       ├── migrations/      # 数据库迁移
│       ├── templates/      # 模板文件
│       ├── scripts/        # 脚本
│       ├── ops/            # 运维配置
│       ├── docs/           # 后端文档
│       ├── package.json    # 后端依赖
│       └── server.js        # 服务器入口
│
├── tools/                  # 工具脚本（保持不变）
├── docs/                   # 项目文档（保持不变）
├── ops/                    # 部署脚本（需要更新路径）
├── package.json            # Workspace 根配置
├── pnpm-workspace.yaml     # Workspace 配置
├── .gitignore
└── ...                     # 其他根级配置
```

### 设计原则

1. **清晰的职责分离**
   - 前端和后端各自独立，有明确的边界
   - 共享资源（如工具脚本）放在根目录

2. **保持向后兼容**
   - 尽量保持现有功能不变
   - 最小化对业务代码的影响

3. **符合 Monorepo 最佳实践**
   - 使用 pnpm workspace
   - 统一的依赖管理
   - 清晰的包结构

---

## 迁移影响分析

### 影响范围统计

| 类型 | 文件数量 | 修改难度 | 风险等级 |
|------|---------|---------|---------|
| **配置文件** | 8-10 个 | 中等 | 🟡 中 |
| **工具脚本** | 1 个 | 简单 | 🟢 低 |
| **部署脚本** | 10-15 个 | 中等 | 🟡 中 |
| **前端代码** | 0 个 | 无 | 🟢 低（使用别名） |
| **后端代码** | 0 个 | 无 | 🟢 低 |
| **文档** | 5-10 个 | 简单 | 🟢 低 |

### 关键影响点

1. **路径引用变更**
   - 所有配置文件的路径需要更新
   - 工具脚本的导入路径需要调整
   - 部署脚本的路径引用需要更新

2. **构建流程变更**
   - 前端构建命令需要从 `packages/frontend` 目录执行
   - 或者通过 workspace 根目录执行（推荐）

3. **开发体验**
   - IDE 配置可能需要调整
   - 路径自动补全可能需要重新配置

---

## 详细迁移步骤

### 阶段 1：准备工作（风险评估）

#### 1.1 创建备份分支
```bash
git checkout -b backup/before-monorepo-migration
git push origin backup/before-monorepo-migration
```

#### 1.2 确保当前代码可运行
```bash
# 测试前端
pnpm install
pnpm run dev

# 测试后端
cd backend
npm install
npm start
```

#### 1.3 记录当前状态
- 记录所有可运行的命令
- 记录当前构建输出目录
- 记录环境变量配置

---

### 阶段 2：创建新目录结构

#### 2.1 创建 packages 目录
```bash
mkdir -p packages/frontend
```

#### 2.2 移动前端文件
```bash
# 移动前端源代码
mv src packages/frontend/
mv public packages/frontend/
mv mock packages/frontend/
mv index.html packages/frontend/

# 移动前端配置文件
mv vite.config.ts packages/frontend/
mv tsconfig.json packages/frontend/
mv uno.config.ts packages/frontend/
mv components.d.ts packages/frontend/
mv eslint.config.mjs packages/frontend/
```

#### 2.3 移动后端文件
```bash
# 本次先不迁移后端（仍在 backend/，继续使用 npm）
# 后续如需迁移，可再执行：
# mv backend packages/
```

#### 2.4 保留根目录文件
以下文件保留在根目录：
- `package.json`（将改为 workspace 配置）
- `.gitignore`
- `AGENTS.md`
- `README.md`
- `docs/`（项目文档）
- `tools/`（工具脚本）
- `ops/`（部署脚本）
- `sql/`（SQL 脚本）
- `.env.*`（环境变量文件）
- `.husky/`（Git hooks）
- `.github/`（GitHub Actions）
- 其他根级配置文件

---

### 阶段 3：更新配置文件

#### 3.1 创建 pnpm-workspace.yaml
```yaml
packages:
  - 'packages/frontend'
```

#### 3.2 更新根目录 package.json
```json
{
  "name": "jiuhuan-monorepo",
  "version": "2.9.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.3",
  "scripts": {
    "dev": "pnpm --filter frontend dev",
    "build:pro": "pnpm --filter frontend build:pro",
    "build:dev": "pnpm --filter frontend build:dev",
    "build:test": "pnpm --filter frontend build:test",
    "build:gitee": "pnpm --filter frontend build:gitee",
    "backend:dev": "pnpm --filter backend dev",
    "backend:start": "pnpm --filter backend start",
    "lint:eslint": "pnpm --filter frontend lint:eslint",
    "lint:format": "pnpm --filter frontend lint:format",
    "lint:style": "pnpm --filter frontend lint:style",
    "ts:check": "pnpm --filter frontend ts:check"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.1.0"
  }
}
```

#### 3.3 更新 packages/frontend/package.json
- 保持原有依赖不变
- 更新脚本路径（如果需要）
- 添加 `name: "frontend"`

#### 3.4 更新 packages/frontend/vite.config.ts
```typescript
// 修改路径解析
function pathResolve(dir: string) {
  return resolve(root, '.', dir)  // root 已经是 packages/frontend
}

// 更新所有路径引用
// src/ -> src/ (相对路径不变，因为文件已移动)
// mock -> mock/ (相对路径不变)
```

关键修改点：
- `pathResolve('src/...')` → 保持不变（因为文件已移动）
- `mock` → 保持不变
- `outDir` → 可能需要调整为 `../../dist` 或保持 `dist`

#### 3.5 更新 packages/frontend/tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]  // 保持不变，因为 src 已移动
    }
  },
  "include": ["src", "types/**/*.d.ts", "mock/**/*.ts"]
}
```

#### 3.6 更新 packages/frontend/components.d.ts
```typescript
// 所有路径从 ./src/ 改为 ./src/（保持不变，因为文件已移动）
// 但需要确认生成工具能正确识别新路径
```

#### 3.7 更新 packages/frontend/uno.config.ts
```typescript
// 修改导入路径
import { ICON_PREFIX } from './src/constants'  // 保持不变
```

#### 3.8 更新 packages/frontend/eslint.config.mjs
```javascript
files: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue'],  // 保持不变
```

---

### 阶段 4：更新工具脚本

#### 4.1 更新 tools/pdf/debug-mould-transfer.ts
```typescript
// 修改前：
import { parseMouldTransferFromText } from '../../src/utils/pdf/mouldTransferParser'

// 修改后：
import { parseMouldTransferFromText } from '../../packages/frontend/src/utils/pdf/mouldTransferParser'
```

#### 4.2 更新 scripts/icon.ts
```typescript
// 修改前：
import { ICON_PREFIX } from '../src/constants'
const outputDir = path.resolve(process.cwd(), 'src/components/IconPicker/src/data')

// 修改后：
import { ICON_PREFIX } from '../packages/frontend/src/constants'
const outputDir = path.resolve(process.cwd(), 'packages/frontend/src/components/IconPicker/src/data')
```

---

### 阶段 5：更新部署脚本

#### 5.1 更新 ops/local/start-all.sh
```bash
# 修改前：
cd backend
cd ..

# 修改后：
cd backend
cd ..
```

#### 5.2 更新 ops/server/deploy-script-with-version-select.sh
需要查找并替换所有路径引用：
- `src/` → `packages/frontend/src/`
- `dist*` → `packages/frontend/dist/`

#### 5.3 更新其他部署脚本
检查以下文件并更新路径：
- `ops/server/minimal-version-upgrade.sh`
- `backend/ops/systemd/*.sh`
- `backend/ops/FIX_AND_SETUP.sh`
- `backend/ops/CREATE_FILES_ON_SERVER.sh`

---

### 阶段 6：更新 Docker 和开发环境配置

#### 6.1 更新 Dockerfile.dev
```dockerfile
# 修改前：
WORKDIR /app
COPY package.json .
RUN pnpm install
COPY . .
CMD [ "pnpm", "run", "dev" ]

# 修改后：
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install
COPY . .
WORKDIR /app/packages/frontend
CMD [ "pnpm", "run", "dev" ]
```

#### 6.2 更新 docker-compose.dev.yaml
```yaml
# 确认卷挂载路径是否需要调整
volumes:
  - /app/node_modules
  - .:/app
```

#### 6.3 更新 .devcontainer/devcontainer.json
```json
{
  "updateContentCommand": "pnpm install && cd backend && npm install"
}
```

### 阶段 7：更新 CI/CD 配置

#### 7.1 更新 .github/workflows/auto-merge.yml
```yaml
# 修改构建和发布路径
- name: Build Github
  run: |
    pnpm install --no-frozen-lockfile
    cd packages/frontend
    pnpm run build:pro

- name: Deploy Github
  uses: peaceiris/actions-gh-pages@v3
  with:
    publish_dir: ./packages/frontend/dist
```

#### 7.2 检查其他 CI/CD 配置
确认 `.github/workflows/release.yml` 是否需要修改。

### 阶段 8：更新文档

#### 8.1 更新 AGENTS.md
```markdown
## 目录职责（约定）

- `packages/frontend/src/`：前端业务代码
- `backend/`：后端 API（Node/Express）
- ...
```

#### 8.2 更新 README.md
更新所有路径引用和说明。

#### 8.3 更新其他文档
检查 `docs/` 目录下的所有文档，更新路径引用。

---

### 阶段 9：安装依赖和测试

#### 9.1 清理旧依赖
```bash
rm -rf node_modules
rm -rf packages/*/node_modules
rm pnpm-lock.yaml
```

#### 9.2 安装新依赖
```bash
pnpm install
```

#### 9.3 测试前端
```bash
pnpm dev
# 或
cd packages/frontend && pnpm dev
```

#### 9.4 测试后端
```bash
cd backend && npm start
# 或
pnpm backend:start
```

#### 9.5 测试构建
```bash
pnpm build:dev
pnpm build:pro
```

#### 9.6 测试 Docker
```bash
docker-compose -f docker-compose.dev.yaml up
```

---

## 需要修改的文件清单

### 配置文件（必须修改）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `pnpm-workspace.yaml` | 新建文件 | 🔴 高 |
| `package.json`（根目录） | 改为 workspace 配置 | 🔴 高 |
| `packages/frontend/package.json` | 添加 name 字段 | 🔴 高 |
| `packages/frontend/vite.config.ts` | 更新路径引用 | 🔴 高 |
| `packages/frontend/tsconfig.json` | 确认路径配置 | 🟡 中 |
| `packages/frontend/components.d.ts` | 确认路径（自动生成） | 🟡 中 |
| `packages/frontend/uno.config.ts` | 确认导入路径 | 🟡 中 |
| `packages/frontend/eslint.config.mjs` | 确认文件路径 | 🟡 中 |

### 工具脚本（必须修改）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `tools/pdf/debug-mould-transfer.ts` | 更新导入路径 | 🔴 高 |
| `scripts/icon.ts` | 更新路径引用 | 🔴 高 |

### 部署脚本（必须修改）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `ops/local/start-all.sh` | 更新 cd 路径 | 🔴 高 |
| `ops/server/deploy-script-with-version-select.sh` | 更新所有路径引用 | 🔴 高 |
| `ops/server/minimal-version-upgrade.sh` | 更新路径引用 | 🔴 高 |
| `backend/ops/systemd/setup-systemd.sh` | 更新路径引用 | 🔴 高 |
| `backend/ops/systemd/start.sh` | 更新路径引用 | 🔴 高 |
| `backend/ops/FIX_AND_SETUP.sh` | 更新路径引用 | 🔴 高 |
| `backend/ops/CREATE_FILES_ON_SERVER.sh` | 更新路径引用 | 🔴 高 |

### Docker 和开发环境配置（需要修改）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `Dockerfile.dev` | 更新工作目录和路径 | 🔴 高 |
| `docker-compose.dev.yaml` | 更新卷挂载路径 | 🔴 高 |
| `.devcontainer/devcontainer.json` | 更新 postCreateCommand 路径 | 🔴 高 |

### CI/CD 配置（需要修改）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `.github/workflows/auto-merge.yml` | 更新构建路径和发布目录 | 🔴 高 |
| `.github/workflows/release.yml` | 确认是否需要修改 | 🟡 中 |

### 其他配置文件（需要检查）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `postcss.config.cjs` | 检查路径引用 | 🟡 中 |
| `prettier.config.cjs` | 检查路径引用 | 🟡 中 |
| `stylelint.config.cjs` | 检查路径引用 | 🟡 中 |
| `commitlint.config.cjs` | 检查路径引用 | 🟡 中 |
| `plopfile.cjs` | 检查路径引用 | 🟡 中 |
| `.husky/*` | 检查脚本路径 | 🟡 中 |

### 文档（建议修改）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `AGENTS.md` | 更新目录说明 | 🟡 中 |
| `README.md` | 更新路径说明 | 🟡 中 |
| `docs/**/*.md` | 更新路径引用 | 🟢 低 |

---

## 风险评估与应对

### 风险 1：路径引用错误

**风险描述**：配置文件中的路径引用可能遗漏或错误。

**影响**：构建失败、开发环境无法启动。

**应对措施**：
1. 使用 `grep` 全面搜索所有路径引用
2. 创建测试脚本验证所有路径
3. 分阶段迁移，每阶段都进行测试

**回滚方案**：使用备份分支恢复。

---

### 风险 2：构建输出路径变更

**风险描述**：构建输出目录可能改变，影响部署。

**影响**：部署脚本可能找不到构建产物。

**应对措施**：
1. 明确构建输出目录（建议统一为 `packages/frontend/dist-*`）
2. 更新所有部署脚本中的路径引用
3. 在部署脚本中添加路径检查

**回滚方案**：临时调整部署脚本或手动指定路径。

---

### 风险 3：IDE 配置失效

**风险描述**：IDE 的路径别名、自动补全可能失效。

**影响**：开发体验下降。

**应对措施**：
1. 更新 IDE 工作区配置
2. 重新索引项目
3. 检查 TypeScript 路径映射

**回滚方案**：重新配置 IDE 或使用旧版本。

---

### 风险 4：依赖安装问题

**风险描述**：workspace 依赖安装可能有问题。

**影响**：无法安装依赖或依赖冲突。

**应对措施**：
1. 清理所有 node_modules 和 lock 文件
2. 使用 `pnpm install` 重新安装
3. 检查 workspace 配置是否正确

**回滚方案**：恢复旧的 package.json 和依赖。

---

### 风险 5：Git 历史混乱

**风险描述**：大量文件移动可能导致 Git 历史难以追踪。

**影响**：代码审查和问题追踪困难。

**应对措施**：
1. 使用 `git mv` 而不是 `mv` 来移动文件（保留历史）
2. 分阶段提交，每个阶段都有清晰的提交信息
3. 创建迁移说明文档

**回滚方案**：使用 `git revert` 或 `git reset`。

---

## 回滚方案

### 快速回滚

如果迁移过程中出现严重问题，可以快速回滚：

```bash
# 1. 切换到备份分支
git checkout backup/before-monorepo-migration

# 2. 创建新分支继续开发
git checkout -b main-restored

# 3. 或者直接恢复文件
git checkout backup/before-monorepo-migration -- .
```

### 部分回滚

如果只是部分功能有问题，可以部分回滚：

```bash
# 恢复特定文件
git checkout backup/before-monorepo-migration -- <file-path>

# 恢复特定目录
git checkout backup/before-monorepo-migration -- <dir-path>
```

---

## 测试验证清单

### 开发环境测试

- [ ] 前端开发服务器能正常启动（`pnpm dev`）
- [ ] 后端服务器能正常启动（`npm start` 或 `pnpm backend:start`）
- [ ] 前端能正常访问后端 API
- [ ] 热更新功能正常
- [ ] TypeScript 类型检查通过（`pnpm ts:check`）

### 构建测试

- [ ] 前端开发构建成功（`pnpm build:dev`）
- [ ] 前端生产构建成功（`pnpm build:pro`）
- [ ] 前端测试构建成功（`pnpm build:test`）
- [ ] 前端 Gitee 构建成功（`pnpm build:gitee`）
- [ ] 构建产物在正确位置

### 代码质量测试

- [ ] ESLint 检查通过（`pnpm lint:eslint`）
- [ ] Prettier 格式化正常（`pnpm lint:format`）
- [ ] Stylelint 检查通过（`pnpm lint:style`）

### 功能测试

- [ ] 前端页面能正常访问
- [ ] 后端 API 能正常响应
- [ ] 文件上传功能正常
- [ ] 数据库连接正常
- [ ] 权限系统正常

### 工具脚本测试

- [ ] `tools/pdf/debug-mould-transfer.ts` 能正常运行
- [ ] `scripts/icon.ts` 能正常运行
- [ ] 其他工具脚本能正常运行

### 部署测试

- [ ] 本地部署脚本能正常运行（`ops/local/start-all.sh`）
- [ ] 服务器部署脚本路径正确
- [ ] systemd 服务配置路径正确

### Docker 测试

- [ ] Docker 镜像能正常构建（`docker build -f Dockerfile.dev .`）
- [ ] Docker Compose 能正常启动（`docker-compose -f docker-compose.dev.yaml up`）
- [ ] DevContainer 配置正确（如果使用）

### CI/CD 测试

- [ ] GitHub Actions 工作流能正常运行
- [ ] 构建和发布流程正常

---

## 迁移时间估算

| 阶段 | 预计时间 | 说明 |
|------|---------|------|
| 准备工作 | 30 分钟 | 创建备份、测试当前状态 |
| 创建目录结构 | 15 分钟 | 创建目录、移动文件 |
| 更新配置文件 | 1-2 小时 | 修改所有配置文件 |
| 更新工具脚本 | 30 分钟 | 修改工具脚本路径 |
| 更新部署脚本 | 1-2 小时 | 修改所有部署脚本 |
| 更新 Docker 配置 | 30 分钟 | 更新 Docker 相关配置 |
| 更新 CI/CD 配置 | 30 分钟 | 更新 GitHub Actions |
| 更新文档 | 30 分钟 | 更新文档中的路径 |
| 测试验证 | 1-2 小时 | 全面测试 |
| **总计** | **6-8 小时** | 包含测试和修复时间 |

---

## 后续优化建议

1. **统一包管理器**
   - 考虑将后端也迁移到 pnpm（可选）

2. **优化构建流程**
   - 使用 Turborepo 或 Nx 加速构建（可选）

3. **完善 CI/CD**
   - 更新 GitHub Actions 配置以支持新结构

4. **文档完善**
   - 更新所有开发文档
   - 添加 Monorepo 使用指南

---

## 总结

本迁移方案提供了从当前结构到标准 Monorepo 结构的完整迁移路径。方案经过详细分析，考虑了所有可能的影响点和风险。

**关键成功因素**：
1. ✅ 详细的文件清单和修改说明
2. ✅ 分阶段迁移，每阶段都有测试
3. ✅ 完整的回滚方案
4. ✅ 全面的测试验证清单

**建议执行顺序**：
1. 先创建备份分支
2. 在开发分支上小规模测试
3. 确认无误后再合并到主分支
4. 更新部署流程

---

**文档版本**：v1.0  
**创建日期**：2026-01-28  
**最后更新**：2026-01-28
