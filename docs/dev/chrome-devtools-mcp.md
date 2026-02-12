# chrome-devtools-mcp（Chrome DevTools MCP Server）

本仓库采用“工具本地安装”的方式放在 `tools/chrome-devtools-mcp/`，避免全局安装污染环境。

## 安装

```bash
cd tools/chrome-devtools-mcp
npm install
```

## 运行 / 查看参数

```bash
cd tools/chrome-devtools-mcp
npm run mcp -- --help
```

## 常用场景

### 1) 让它自己启动一个新的 Chrome（默认）

```bash
cd tools/chrome-devtools-mcp
npm run mcp
```

常用参数：

- `--headless`：无 UI 模式
- `--channel stable|beta|dev|canary`：选择 Chrome 渠道
- `--userDataDir <path>`：指定 Chrome profile 目录
- `--isolated`：使用临时 profile（退出后自动清理）

### 2) 连接到你已经打开的 Chrome（保留登录态更常用）

先用“远程调试”方式启动/配置 Chrome（仓库 README 中有详细说明），然后用下面其中一种方式连接：

```bash
cd tools/chrome-devtools-mcp
npm run mcp -- --browserUrl http://127.0.0.1:9222
```

或：

```bash
cd tools/chrome-devtools-mcp
npm run mcp -- --wsEndpoint ws://127.0.0.1:9222/devtools/browser/<id>
```

## 隐私 / 统计

默认会收集使用统计数据。关闭方式（二选一）：

```bash
cd tools/chrome-devtools-mcp
npm run mcp -- --no-usage-statistics
```

或设置环境变量：

```bash
export CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS=1
```

## 调试日志

```bash
cd tools/chrome-devtools-mcp
DEBUG='*' npm run mcp -- --logFile /tmp/chrome-devtools-mcp.log
```

