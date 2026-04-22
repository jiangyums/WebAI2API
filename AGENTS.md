# AGENTS.md - WebAI2API 开发指南

> 本文件供 AI 编码代理（如 OpenCode、Cursor、Copilot 等）使用，提供项目构建、测试、代码风格等规范。

---

## 1. 项目简介

**WebAI2API** 是一个基于 Playwright (Camoufox) 的网页版 AI 服务转通用 API 工具。通过模拟人类操作与 LMArena、Gemini 等网站交互，提供兼容 OpenAI 格式的接口服务，支持多窗口并发与多账号管理。

- **Node.js**: v20.0.0+ (ABI 115+)
- **模块系统**: ESM (ES Modules)
- **包管理器**: pnpm

---

## 2. 命令

### 启动命令

```bash
# 启动服务（有头模式，显示浏览器窗口）
pnpm start

# 启动服务（无头模式，后台运行）
pnpm start -- -headless

# 登录模式（会临时强行禁用无头模式和自动化）
pnpm start -- -login

# 初始化浏览器依赖
pnpm init

# 生成 API 密钥
pnpm genkey
```

> **注意**：默认使用有头模式（非无头模式），以降低被网站风控检测的风险。每次启动时会自动检查是否有未关闭的之前实例，如有则先关闭它。

### 无头模式

通过 `-headless` 参数启用无头模式（后台运行，不显示浏览器窗口）：

```bash
pnpm start -- -headless
```

> **建议**：为降低风控，**强烈建议长期保持非无头模式运行**（或使用虚拟显示器 Xvfb）。

### 测试命令

```bash
# 运行所有测试
pnpm test

# 监听模式（开发用）
pnpm test:watch

# 运行单个测试文件
pnpm vitest run src/__tests__/logger.test.js
```

### 代码检查与格式化

```bash
# 检查代码格式（不修改文件）
pnpm lint

# 格式化代码（自动修改）
pnpm format
```

---

## 3. 代码风格

### 3.1 导入规范

使用 `package.json` 中定义的路径别名：

```javascript
// 模块导入
import { loadConfig } from "#config";
import { logger } from "#utils/logger";
import { getBackend } from "#backend/index";
import { createQueueManager } from "#server/queue";

// 相对路径导入（当别名不适用时）
import fs from "fs";
import path from "path";
```

### 3.2 文件结构

```
src/
├── backend/          # 后端适配器
│   ├── adapter/    # 各网站适配器（如 lmarena.js, gemini.js）
│   ├── engine/    # 浏览器引擎（launcher.js, utils.js）
│   └── pool/      # 浏览器实例池管理
├── config/         # 配置加载
├── server/        # HTTP 服务器
│   ├── api/       # API 端点
│   ├── errors.js  # 错误码定义
│   └── queue.js   # 任务队列
└── utils/         # 工具函数
    ├── logger.js  # 日志模块
    └── history.js # 历史记录
```

### 3.3 命名规范

| 类型      | 命名规则         | 示例                            |
| --------- | ---------------- | ------------------------------- |
| 文件      | kebab-case       | `lmarena.js`, `pool-manager.js` |
| 函数/变量 | camelCase        | `loadConfig`, `poolManager`     |
| 类        | PascalCase       | `PoolManager`, `QueueManager`   |
| 常量      | UPPER_SNAKE_CASE | `ERROR_CODES`, `MAX_RETRIES`    |
| 布尔函数  | is/has/can 前缀  | `isInitialized`, `hasError`     |

### 3.4 JSDoc 规范

所有导出函数必须包含 JSDoc 注释：

```javascript
/**
 * 获取后端接口
 * @returns {object} 后端统一接口
 */
export function getBackend() {
    // ...
}

/**
 * 执行生图任务
 * @param {object} context - 浏览器上下文 { page, client }
 * @param {string} prompt - 提示词
 * @param {string[]} imgPaths - 图片路径数组
 * @param {string} [modelId] - 指定的模型 ID (可选)
 * @param {object} [meta={}] - 日志元数据
 * @returns {Promise<{image?: string, text?: string, error?: string}>} 生成结果
 */
async function generate(context, prompt, imgPaths, modelId, meta = {}) {
    // ...
}
```

文件头部使用：

```javascript
/**
 * @fileoverview LMArena 图片生成适配器
 */
```

### 3.5 错误处理

使用统一的错误码常量（定义于 `src/server/errors.js`）：

```javascript
import { ERROR_CODES, getErrorDetails, getErrorMessage } from "#server/errors";

function handleError(code) {
    const details = getErrorDetails(code);
    return { error: getErrorMessage(code), ...details };
}
```

错误码类型：

- `UNAUTHORIZED` - 未授权
- `BROWSER_NOT_INITIALIZED` - 浏览器未初始化
- `SERVER_BUSY` - 服务器繁忙
- `INVALID_MODEL` - 模型无效
- `RECAPTCHA` - 触发人机验证

### 3.6 适配器模式

每个 AI 网站适配器使用 manifest 模式：

```javascript
export const manifest = {
    id: "adapter-name",
    displayName: "适配器名称",
    description: "适配器描述",

    configSchema: [{ key: "optionKey", label: "选项名称", type: "boolean", default: false }],

    getTargetUrl(config, workerConfig) {
        return TARGET_URL;
    },

    models: [
        { id: "model-id", imagePolicy: "optional" },
        { id: "model-id-2", codeName: "display-name", imagePolicy: "required" }
    ],

    navigationHandlers: [],

    generate
};
```

### 3.7 日志规范

使用统一的 logger 模块：

```javascript
import { logger } from "#utils/logger";

logger.debug("模块", "消息", meta);
logger.info("模块", "消息", meta);
logger.warn("模块", "消息", meta);
logger.error("模块", "消息", meta);
```

参数顺序：`(模块名, 消息, 元数据)`
元数据包含常用字段：`id`, `adapter`, `model`

---

## 4. 测试规范

### 4.1 框架

使用 **Vitest** 作为测试框架。

### 4.2 测试文件位置

```
__tests__/                    # 或 tests/
├── logger.test.js
├── config.test.js
└── adapter/
    └── lmarena.test.js
```

### 4.3 测试文件命名

- `*.test.js` - 单元测试
- `*.spec.js` - 集成测试
- `__fixtures__/` - 测试数据

### 4.4 测试示例

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "#utils/logger";

describe("logger", () => {
    it("should log message with correct format", () => {
        const log = logger.info("测试", "消息", { id: "test-1" });
        // 验证日志格式
    });

    it("should filter by log level", () => {
        logger.setLevel("error");
        // debug 日志不应输出
    });
});
```

### 4.5 运行测试

```bash
# 运行所有测试
pnpm test

# 运行单个文件
pnpm vitest run src/__tests__/logger.test.js

# 监听模式
pnpm vitest

# 仅运行覆盖率
pnpm vitest run --coverage
```

---

## 5. 代码格式化

### 5.1 工具

使用 **Prettier** 进行代码格式化。

### 5.2 配置 (.prettierrc)

```json
{
    "semi": true,
    "singleQuote": false,
    "tabWidth": 4,
    "trailingComma": "none",
    "printWidth": 100,
    "bracketSpacing": true
}
```

### 5.3 命令

```bash
# 检查格式（不修改）
pnpm lint

# 格式化代码
pnpm format
```

---

## 6. 架构说明

### 6.1 后端适配器

```
src/backend/
├── index.js         # 统一入口，返回 getBackend()
├── adapter/       # 各网站适配器实现
│   ├── lmarena.js
│   ├── gemini.js
│   └── chatgpt.js
├── engine/        # 浏览器引擎
└── pool/         # 实例池管理
```

### 6.2 Server API

```
src/server/
├── server.js      # HTTP 服务器入口
├── index.js      # 模块导出
├── errors.js     # 错误码定义
├── queue.js     # 任务队列
└── api/        # API 端点
    └── openai/  # OpenAI 兼容接口
```

### 6.3 关键模块

| 模块           | 职责                     |
| -------------- | ------------------------ |
| `PoolManager`  | 管理多个浏览器实例       |
| `QueueManager` | 任务队列、并发控制、心跳 |
| `Adapter`      | 各网站的具体交互逻辑     |
| `Config`       | 配置加载与校验           |

---

## 7. 常见操作

### 7.1 添加新适配器

1. 在 `src/backend/adapter/` 创建新文件
2. 实现 `generate()` 函数和 `manifest` 对象
3. 在 `config.yaml` 添加对应 Worker 配置

### 7.2 添加新 API 端点

在 `src/server/api/` 目���下创建新路由处理文件。

### 7.3 调试

```bash
# 启用调试日志
LOG_LEVEL=debug pnpm start

# 查看日志
tail -f data/logs/system.log
```

---

_本文件最后更新: 2026-04-22_
