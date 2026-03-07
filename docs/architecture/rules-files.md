# Rules File Structure

基于 Claude Code Skills 模式，定义 Agent 的规则文件系统。

## 文件结构

```
repo/
├── .ai/                           # AI 配置目录
│   ├── AGENTS.md                  # 根级 Agent 指令 (必须)
│   ├── rules/                     # 模块化规则
│   │   ├── 00-context.md          # 项目上下文 (00- 前缀保证加载顺序)
│   │   ├── 01-coding-style.md     # 代码风格
│   │   ├── 02-testing.md          # 测试规范
│   │   ├── 03-architecture.md     # 架构模式
│   │   └── 04-mcp-tools.md        # MCP 工具使用指南
│   └── plans/                     # 生成的执行计划
│       └── plan-{issue-number}.md
│
└── .cursorrules                   # Cursor IDE 规则 (与 AGENTS.md 同步)
```

## AGENTS.md 格式

使用 YAML frontmatter + Markdown 内容：

```markdown
---
name: matrixone-agent
description: |
  Agent for MatrixOne database kernel development.

  适用场景:
  - 实现 SQL 执行器功能
  - 修复存储引擎 bug
  - 添加新的 SQL 语法支持

  示例:
  <example>
  Context: 用户需要实现窗口函数支持
  user: "实现 ROW_NUMBER() OVER (PARTITION BY ...)"
  assistant: "我将分析现有执行器代码，设计窗口函数实现方案"
  </example>

model: sonnet                    # 使用模型: inherit/sonnet/opus/haiku
color: blue                      # 标识颜色
tools:                           # 允许的工具
  - Read
  - Write
  - Grep
  - Bash
  - mcp__filesystem
  - mcp__terminal
---

# MatrixOne Agent 上下文

## 项目概述

MatrixOne 是一个超融合数据库，支持 OLTP、OLAP 和流处理。

## 代码组织结构

```

pkg/
├── sql/              # SQL 层
│   ├── parser/       # 语法解析
│   ├── plan/         # 查询计划
│   ├── executor/     # 执行器
│   └── types/        # 类型系统
├── vm/               # 虚拟机层
├── catalog/          # 元数据管理
└── storage/          # 存储引擎

```

## 编码规范

### Go 代码
- 使用标准错误处理: `if err != nil { return err }`
- 函数复杂度: 圈复杂度 < 15
- 测试覆盖: 新代码必须包含单元测试

### 测试要求
- 表驱动测试
- 使用 testify/assert
- 集成测试在 `test/` 目录

## MCP 工具使用

### filesystem
- 工作目录: `/workspace`
- 只读写项目文件，不访问系统目录

### terminal
- 允许: `go test`, `go build`, `git`
- 禁止: `rm -rf /`, `curl | bash`

## 执行流程

1. **分析**: 阅读相关代码，理解现有实现
2. **设计**: 在 `.ai/plans/` 中创建设计文档
3. **实现**: 编写代码，遵循编码规范
4. **测试**: 运行本地测试
5. **提交**: 创建 PR，链接到 issue

## 迭代限制

- Lint 错误: 最多 3 次自动修复
- 类型错误: 最多 3 次自动修复
- 测试失败: 1 次尝试，失败则转人工
