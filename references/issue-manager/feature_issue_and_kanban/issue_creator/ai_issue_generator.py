#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Issue 生成器：根据用户自然语言描述生成 Issue 草稿（标题、正文、标签、负责人等），并可调用 GitHub API 创建。
"""
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Any


class AIIssueGenerator:
    def __init__(self, storage, llm, github_token: str, base_url: str = "https://api.github.com"):
        self.storage = storage
        self.llm = llm
        self.github_token = github_token
        self.base_url = base_url
        self.knowledge_base = None  # 可加载为 dict 或 str

    def load_knowledge_base(self, repo_owner: str, repo_name: str) -> None:
        """从数据库或 data/knowledge_base/*.md 加载知识库摘要，供生成时参考。"""
        root = Path(__file__).resolve().parents[2]
        for base in [root, Path.cwd()]:
            p = base / "data" / "knowledge_base" / f"{repo_owner}_{repo_name}_knowledge_latest.md"
            if p.exists():
                self.knowledge_base = p.read_text(encoding="utf-8")[:8000]
                return
        sql = """
        SELECT knowledge_type, category, title, description FROM issue_knowledge_base
        WHERE is_active = 1 ORDER BY id DESC LIMIT 200
        """
        try:
            rows = self.storage.execute(sql, {})
            if rows:
                self.knowledge_base = json.dumps(
                    [{"type": r.get("knowledge_type"), "category": r.get("category"), "title": r.get("title")} for r in rows],
                    ensure_ascii=False,
                )
        except Exception:
            self.knowledge_base = None

    def generate_issue_draft(
        self,
        user_input: str,
        repo_owner: str,
        repo_name: str,
        explicit_requirements: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        根据用户描述生成 Issue 草稿。
        返回: { "title", "body", "labels", "assignees", "related_issues", "template_type" }
        """
        self.load_knowledge_base(repo_owner, repo_name)
        kb = (self.knowledge_base or "")[:6000]
        prompt = f"""
用户描述：
{user_input}

{f'额外要求：{json.dumps(explicit_requirements, ensure_ascii=False)}' if explicit_requirements else ''}

参考知识库（可选）：
{kb}

请根据描述生成一条 GitHub Issue 草稿，严格按以下 JSON 输出（不要 markdown 代码块）：
{{
  "title": "简短标题，建议带 [产品/类型] 前缀",
  "body": "正文 Markdown，包含：问题描述、复现步骤或需求说明、相关模块",
  "labels": ["kind/bug 或 kind/feature 等", "area/xxx"],
  "assignees": ["GitHub 登录名，从描述中识别的账号"],
  "related_issues": ["#123 或仅数字 123"],
  "template_type": "bug_report 或 feature_request 等"
}}
只返回一行 JSON，不要其他文字。
"""
        resp = self.llm._call_ai("你只输出合法的一行 JSON，不要 markdown 与解释。", prompt)
        draft = self._parse_draft_response(resp, user_input)
        draft.setdefault("repo_owner", repo_owner)
        draft.setdefault("repo_name", repo_name)
        return draft

    def _parse_draft_response(self, response: Optional[str], fallback_title: str) -> Dict[str, Any]:
        if not response:
            return {
                "title": fallback_title[:200] or "新Issue",
                "body": "",
                "labels": [],
                "assignees": [],
                "related_issues": [],
                "template_type": "unknown",
            }
        text = response.strip()
        m = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        return {
            "title": text[:200] or fallback_title[:200],
            "body": text,
            "labels": [],
            "assignees": [],
            "related_issues": [],
            "template_type": "unknown",
        }

    def create_issue_on_github(self, draft: Dict[str, Any]) -> Dict[str, Any]:
        """根据草稿调用 GitHub API 创建 Issue。"""
        from .github_issue_creator import create_issue_on_github as do_create
        owner = draft.get("repo_owner") or draft.get("owner")
        repo = draft.get("repo_name") or draft.get("repo")
        if not owner or not repo:
            raise ValueError("草稿中缺少 repo_owner/repo_name 或 owner/repo")
        return do_create(
            owner=owner,
            repo=repo,
            title=draft.get("title", "新Issue"),
            body=draft.get("body", ""),
            token=self.github_token,
            labels=draft.get("labels") or None,
            assignees=draft.get("assignees") or None,
            base_url=self.base_url,
        )
