#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交互式 / 单轮 AI 创建 Issue。
用法（在项目根目录执行）:
  python3 feature_issue_and_kanban/scripts/create_issue_interactive.py --input "描述" --repo matrixorigin/matrixflow --preview --output-html feature_issue_and_kanban/preview.html
"""
import sys
import traceback
from pathlib import Path

# 项目根目录（脚本在 feature_issue_and_kanban/scripts/ 下）
ROOT = Path(__file__).resolve().parents[2]
ERROR_FILE = ROOT / "feature_issue_and_kanban" / "last_error.txt"
PREVIEW_DIR = ROOT / "feature_issue_and_kanban"

def _write_preview_html(content: str, output_path: Path) -> None:
    out = output_path if output_path.is_absolute() else ROOT / output_path
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")

# 在任何可能失败的 import 之前，先根据命令行写出预览占位页
if "--output-html" in sys.argv:
    try:
        i = sys.argv.index("--output-html")
        if i + 1 < len(sys.argv):
            _write_preview_html(
                """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>Issue 预览</title></head><body><p>正在生成草稿…请查看终端。若长时间无更新，请打开同目录下 last_error.txt 查看报错。</p></body></html>""",
                Path(sys.argv[i + 1]),
            )
    except Exception:
        pass

import json
import argparse
import html
from typing import Optional

# 若下面 import 项目模块失败，会把报错写入 last_error.txt 并更新预览页

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def _ensure_preview_path(output_html: Optional[Path]) -> Optional[Path]:
    if not output_html:
        return None
    out = Path(output_html)
    if not out.is_absolute():
        out = ROOT / out
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    placeholder = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>Issue 预览 - 生成中</title></head><body><p>正在生成草稿，请稍候…若长时间无更新，请查看终端报错。</p></body></html>"""
    out.write_text(placeholder, encoding="utf-8")
    return out

try:
    from config.config import GITHUB_TOKEN, GITHUB_API_BASE_URL
    from modules.database_storage.mo_client import MOStorage
    from modules.llm_parser.llm_parser import LLMParser
    sys.path.insert(0, str(ROOT / "feature_issue_and_kanban"))
    from issue_creator.ai_issue_generator import AIIssueGenerator
    from issue_creator.github_issue_creator import create_issue_on_github
except Exception as e:
    err_msg = traceback.format_exc()
    try:
        ERROR_FILE.parent.mkdir(parents=True, exist_ok=True)
        ERROR_FILE.write_text(err_msg, encoding="utf-8")
    except Exception:
        pass
    if "--output-html" in sys.argv and sys.argv.index("--output-html") + 1 < len(sys.argv):
        try:
            out = Path(sys.argv[sys.argv.index("--output-html") + 1])
            if not out.is_absolute():
                out = ROOT / out
            out = out.resolve()
            err_html = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>Issue 预览 - 报错</title><style>pre {{ white-space: pre-wrap; background: #f6f8fa; padding: 12px; }}</style></head><body><h2>脚本在加载或运行时报错</h2><p>请根据下方报错排查（如：数据库连接、AI 配置、网络）。</p><pre>{html.escape(err_msg)}</pre></body></html>"""
            out.write_text(err_html, encoding="utf-8")
        except Exception:
            pass
    raise


def _body_to_html(md: str) -> str:
    """简单把 Markdown 转成 HTML 显示（换行保留）"""
    if not md:
        return ""
    s = html.escape(md)
    return "<p>" + s.replace("\n\n", "</p><p>").replace("\n", "<br>\n") + "</p>"


def write_preview_html(draft: dict, repo_owner: str, repo_name: str, output_path: Path) -> str:
    """把草稿写成本地 HTML 预览页，返回绝对路径。"""
    title = draft.get("title") or "Issue 草稿"
    body = draft.get("body") or ""
    labels = draft.get("labels") or []
    assignees = draft.get("assignees") or []
    body_html = _body_to_html(body)
    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Issue 预览 · {html.escape(title[:50])}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; }}
    h1 {{ font-size: 1.25rem; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }}
    .meta {{ color: #57606a; font-size: 14px; margin: 12px 0; }}
    .meta span {{ margin-right: 12px; }}
    .body {{ line-height: 1.6; white-space: pre-wrap; }}
    .body p {{ margin: 8px 0; }}
    .body h1, .body h2, .body h3 {{ margin: 16px 0 8px; }}
    .tag {{ display: inline-block; background: #ddf4ff; color: #0969da; padding: 2px 8px; border-radius: 12px; margin: 2px 4px 2px 0; font-size: 12px; }}
    .assignee {{ color: #656d76; }}
  </style>
</head>
<body>
  <h1>{html.escape(title)}</h1>
  <div class="meta">
    <span>仓库: {html.escape(repo_owner + "/" + repo_name)}</span>
    <span>标签: {", ".join(html.escape(l) for l in labels) or "—"}</span>
    <span class="assignee">负责人: {", ".join(html.escape(a) for a in assignees) or "—"}</span>
  </div>
  <div class="body">
    {body_html}
  </div>
  <p style="margin-top: 24px; color: #57606a; font-size: 12px;">此为本地预览，确认后请使用本脚本不加 --preview 执行以在 GitHub 创建 Issue。</p>
</body>
</html>
"""
    out = Path(output_path)
    if not out.is_absolute():
        out = ROOT / out
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html_content, encoding="utf-8")
    return str(out)


def run_single(repo_owner: str, repo_name: str, user_input: str, preview_only: bool, output_html: Optional[Path] = None) -> dict:
    print("正在初始化（数据库、AI）...", flush=True)
    try:
        storage = MOStorage()
        llm = LLMParser()
        gen = AIIssueGenerator(storage, llm, GITHUB_TOKEN, GITHUB_API_BASE_URL)
        print("正在生成草稿（调用 AI）...", flush=True)
        draft = gen.generate_issue_draft(user_input, repo_owner, repo_name)
    except Exception as e:
        print(f"生成草稿时出错: {e}", flush=True)
        draft = {
            "title": (user_input[:80] + "…") if len(user_input) > 80 else user_input,
            "body": user_input,
            "labels": [],
            "assignees": [],
        }
    print("\n--- 草稿预览 ---", flush=True)
    print("标题:", draft.get("title"), flush=True)
    print("正文:", (draft.get("body") or "")[:500], "..." if len(draft.get("body") or "") > 500 else "", flush=True)
    print("标签:", draft.get("labels"), flush=True)
    print("负责人:", draft.get("assignees"), flush=True)
    if output_html:
        path = write_preview_html(draft, repo_owner, repo_name, output_html)
        print("本地网页已生成:", path, flush=True)
    if preview_only:
        return {"draft": draft, "created": False}
    print("\n正在创建 Issue...")
    created = create_issue_on_github(
        owner=repo_owner,
        repo=repo_name,
        title=draft.get("title", "新Issue"),
        body=draft.get("body", ""),
        token=GITHUB_TOKEN,
        labels=draft.get("labels"),
        assignees=draft.get("assignees"),
        base_url=GITHUB_API_BASE_URL,
    )
    print("✓ 已创建:", created.get("html_url"), "编号 #" + str(created.get("number", "")))
    return {"draft": draft, "created": created}


def run_interactive(repo_owner: str, repo_name: str) -> None:
    storage = MOStorage()
    llm = LLMParser()
    gen = AIIssueGenerator(storage, llm, GITHUB_TOKEN, GITHUB_API_BASE_URL)
    print(f"交互模式 · 仓库 {repo_owner}/{repo_name} · 输入描述后生成草稿，输入 'q' 退出")
    while True:
        user_input = input("\n描述> ").strip()
        if user_input.lower() == "q":
            break
        if not user_input:
            continue
        draft = gen.generate_issue_draft(user_input, repo_owner, repo_name)
        print("标题:", draft.get("title"))
        print("正文摘要:", (draft.get("body") or "")[:300])
        print("标签:", draft.get("labels"))
        confirm = input("确认创建? (y/n)> ").strip().lower()
        if confirm == "y":
            created = create_issue_on_github(
                owner=repo_owner,
                repo=repo_name,
                title=draft.get("title", "新Issue"),
                body=draft.get("body", ""),
                token=GITHUB_TOKEN,
                labels=draft.get("labels"),
                assignees=draft.get("assignees"),
                base_url=GITHUB_API_BASE_URL,
            )
            print("✓ 已创建:", created.get("html_url"))


def _load_body_template(issue_type: str) -> str:
    """按类型加载正文模板（与 generate_preview_only 一致）。"""
    tpl_dir = ROOT / "feature_issue_and_kanban" / "templates"
    mapping = {"Doc Request": "Doc_Request.md", "Customer Project": "Customer_Project.md", "MO Feature": "MO_Feature.md", "MO Bug": "MO_Bug.md", "MOI Feature": "MOI_Feature.md", "MOI Bug": "MOI_Bug.md", "MOI SubTask": "MOI_SubTask.md", "Test Request": "Test_Request.md", "EE Feature": "EE_Feature.md", "User Bug": "User_Bug.md"}
    fname = mapping.get((issue_type or "").strip())
    if fname and (tpl_dir / fname).exists():
        return (tpl_dir / fname).read_text(encoding="utf-8").strip()
    return ""


def run_direct(repo_owner: str, repo_name: str, title: str, body: str, labels: list, assignees: list, preview_only: bool, output_html: Optional[Path] = None) -> dict:
    """直接使用标题/正文，不调用 AI/DB。用于聊天流程中「确认后提交」或「仅生成预览」。"""
    draft = {"title": title, "body": body, "labels": labels, "assignees": assignees}
    print("标题:", title, flush=True)
    print("正文:", (body or "")[:300] + ("..." if len(body or "") > 300 else ""), flush=True)
    if output_html:
        path = write_preview_html(draft, repo_owner, repo_name, output_html)
        print("本地网页已生成:", path, flush=True)
    if preview_only:
        return {"draft": draft, "created": False}
    from issue_creator.github_issue_creator import create_issue_on_github
    from config.config import GITHUB_TOKEN, GITHUB_API_BASE_URL
    created = create_issue_on_github(owner=repo_owner, repo=repo_name, title=title, body=body or "", token=GITHUB_TOKEN, labels=labels or None, assignees=assignees or None, base_url=GITHUB_API_BASE_URL)
    print("✓ 已创建:", created.get("html_url"), "编号 #" + str(created.get("number", "")))
    return {"draft": draft, "created": created}


def main():
    print("Issue 创建脚本已启动", flush=True)
    parser = argparse.ArgumentParser(description="AI 驱动 Issue 创建")
    parser.add_argument("--input", help="Issue 描述（单轮模式，会调 AI）")
    parser.add_argument("--title", help="直接指定标题（与 --body 或 --type 同时使用时跳过 AI）")
    parser.add_argument("--body", help="直接指定正文；不填且指定 --type 时使用该类型正文模板")
    parser.add_argument("--type", "--issue-type", dest="issue_type", default="", help="Issue 类型，如 Doc Request；未传 --body 时用该类型模板作为正文")
    parser.add_argument("--labels", default="", help="逗号分隔标签，如 kind/docs,area/问数")
    parser.add_argument("--assignees", default="", help="逗号分隔负责人，如 wupeng")
    parser.add_argument("--repo", required=True, help="仓库 owner/name，如 matrixorigin/matrixflow")
    parser.add_argument("--interactive", action="store_true", help="交互模式")
    parser.add_argument("--preview", action="store_true", help="仅预览不创建")
    parser.add_argument("--output-html", help="生成本地预览网页路径")
    args = parser.parse_args()
    parts = args.repo.split("/")
    if len(parts) != 2:
        print("--repo 格式应为 owner/name")
        sys.exit(1)
    repo_owner, repo_name = parts[0], parts[1]
    out_html = Path(args.output_html) if args.output_html else None
    if out_html:
        _ensure_preview_path(out_html)

    if args.title is not None:
        if str(ROOT / "feature_issue_and_kanban") not in sys.path:
            sys.path.insert(0, str(ROOT / "feature_issue_and_kanban"))
        labels = [x.strip() for x in (args.labels or "").split(",") if x.strip()]
        assignees = [x.strip() for x in (args.assignees or "").split(",") if x.strip()]
        body = (args.body or "").strip()
        if not body and (args.issue_type or "").strip():
            body = _load_body_template((args.issue_type or "").strip())
        run_direct(repo_owner, repo_name, args.title, body, labels, assignees, args.preview, out_html)
        return
    if args.interactive:
        run_interactive(repo_owner, repo_name)
        return
    if not args.input:
        print("单轮模式需提供 --input；或同时提供 --title 与 --body 跳过 AI")
        sys.exit(1)
    try:
        run_single(repo_owner, repo_name, args.input, args.preview, out_html)
    except Exception as e:
        print(f"错误: {e}", flush=True)
        raise

