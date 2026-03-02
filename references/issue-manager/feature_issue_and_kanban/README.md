# 新功能：提 Issue + 项目看板（独立开发区）

本目录存放「AI 驱动 Issue 创建」与「项目看板」的**文档与代码**，在测试通过前**不直接修改主项目**，稳定后再合并。

## 功能范围

1. **提 Issue 模块**：自然语言描述 + 账号 → 选模版、填标题/正文/标签 → 调用 GitHub API 直接创建。
2. **项目看板**：按项目标签（如 `project/问数深化`）从 `issues_snapshot` 同步到 `project_issues`，每日生成看板（进度/逾期/阻塞 + 可选 AI 总结）。

## 目录结构

```
feature_issue_and_kanban/
├── README.md
├── issue_creator/              # Module 1：Issue 创建
│   ├── __init__.py
│   ├── knowledge_extractor.py  # 知识库提炼（产品/标签/常见类型）
│   ├── ai_issue_generator.py  # AI 生成草稿
│   └── github_issue_creator.py # 调用 GitHub API 创建
├── project_manager/            # Module 2/3：项目同步与看板
│   ├── __init__.py
│   ├── project_sync.py         # 同步带项目标签的 Issue 到 project_issues
│   └── dashboard_generator.py  # 每日看板 Markdown + AI 总结
└── scripts/
    ├── create_new_tables.sql   # 新增表 DDL（project_issues, issue_knowledge_base, conversation_sessions）
    ├── run_create_tables.py    # 执行建表
    ├── create_issue_interactive.py  # 单轮/交互创建 Issue
    ├── update_knowledge_base.py     # 更新知识库
    ├── sync_project_issues.py       # 同步项目 Issue
    └── generate_daily_dashboard.py # 生成每日看板
```

## 依赖与运行方式

- **依赖**：与主项目一致（config、database_storage、llm_parser、github_collector 的配置与依赖）。无额外 pip 依赖。
- **运行**：所有脚本需在**项目根目录**（`GitHub_Issue_智能管理系统/`）下执行，例如：
  ```bash
  cd /path/to/GitHub_Issue_智能管理系统
  python feature_issue_and_kanban/scripts/run_create_tables.py
  python feature_issue_and_kanban/scripts/create_issue_interactive.py --input "描述" --repo matrixorigin/matrixflow --preview
  python feature_issue_and_kanban/scripts/update_knowledge_base.py --repo matrixorigin/matrixflow
  python feature_issue_and_kanban/scripts/sync_project_issues.py --repo matrixorigin/matrixflow --project-tag "project/问数深化"
  python feature_issue_and_kanban/scripts/generate_daily_dashboard.py --project-tag "project/问数深化" --output ./dashboard.md
  ```

## 使用说明

### 1. 建表（首次）

```bash
python feature_issue_and_kanban/scripts/run_create_tables.py
```

### 2. 知识库提炼（可选，用于提升生成质量）

```bash
python feature_issue_and_kanban/scripts/update_knowledge_base.py --repo matrixorigin/matrixflow
```

### 3. 创建 Issue

- 单轮 + 预览：`--input "描述" --repo owner/name --preview`
- 单轮并创建：`--input "描述" --repo owner/name`
- 交互模式：`--interactive --repo owner/name`

### 4. 项目看板

- 先同步：`sync_project_issues.py --repo owner/name --project-tag "project/xxx"`
- 再生成看板：`generate_daily_dashboard.py --project-tag "project/xxx" [--output path] [--no-ai]`

## 状态与合并

- **当前**：代码已实现并落在此目录，依赖主项目 config/DB/LLM/GitHub。
- **合并条件**：在本目录内联调、测试通过后，再将脚本与模块迁入主项目（如 `scripts/`、`modules/issue_creator`、`modules/project_manager`）。
