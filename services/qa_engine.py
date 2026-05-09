"""
Qwen3.5-2B RAG 问答引擎。

模型加载：
  - 优先从 `ai_service.core.config` 中的 `qwen_model_local_dir`（默认 `E:/QianWen3.5-2B`）加载。
  - 备选自动从 ModelScope 下载到缓存（首次运行时触发）。

推理策略：
  - 非思考模式（Qwen3.5-2B 默认）：greedy 解码，batch 生成
  - ChromaDB 检索 + 低置信度兜底回答
  - 支持 SSE 流式输出（预生成完整文本后逐 chunk 推送）
"""

from __future__ import annotations

import asyncio
import os
import threading
from datetime import datetime
from typing import AsyncGenerator, Iterator


_DOC_NAME_PATTERNS = [
    "教室管理办法",
    "学籍管理实施细则",
    "学士学位授予实施细则",
    "本科生转专业管理办法",
    "本科学生毕业预警与帮扶实施办法",
    "本科学生学籍管理实施细则",
    "考试组织及实施办法",
    "学生考试（考核）违纪作弊处理细则",
    "选修课管理办法",
    "课程替代规定",
    "教学工作规范",
    "教学组织管理规定",
    "实践性教学环节实施细则",
    "教学事故认定及处理办法",
]

_CATEGORY_KEYWORDS = {
    "学籍与学位管理": ["学籍", "学位", "毕业", "转专业", "转学", "辅修", "预警", "帮扶"],
    "课程与培养管理": ["教室", "课程", "选修", "替代", "实习", "实验", "多媒体", "教学组织", "教学工作规范"],
    "教学质量与考核": ["考试", "成绩", "绩点", "违纪", "作弊", "考核", "质量", "教学事故"],
    "教案_教材_课程建设": ["教案", "教材", "课程建设", "在线开放课程", "微专业", "双语", "教改", "档案"],
    "奖学金政策": ["奖学金", "奖助", "资助", "奖励", "评优"],
}

_QUERY_ROUTE_ORDER = [
    ("学籍与学位管理", ["学位", "毕业", "学籍", "转专业", "转学", "辅修", "预警", "帮扶"]),
    ("课程与培养管理", ["教室", "课程", "选修", "替代", "实习", "实验", "多媒体", "教学组织", "教学工作规范"]),
    ("教学质量与考核", ["考试", "成绩", "绩点", "违纪", "作弊", "考核", "质量", "教学事故"]),
    ("教案_教材_课程建设", ["教案", "教材", "课程建设", "在线开放课程", "微专业", "双语", "教改", "档案"]),
    ("奖学金政策", ["奖学金", "奖助", "资助", "奖励", "评优"]),
]


_QUERY_EXPANSIONS = {
    "教室": ["借用", "外借", "开放", "多媒体", "教学楼"],
    "学籍": ["转专业", "转学", "辅修", "毕业", "预警"],
    "学位": ["授予", "条件", "毕业"],
    "考试": ["考核", "违纪", "作弊", "成绩", "组织"],
    "成绩": ["绩点", "转换", "等级", "分数"],
    "课程": ["选修", "替代", "实践", "教学", "大类分流"],
    "教材": ["教案", "在线课程", "微专业"],
}

import torch
from modelscope import AutoModelForCausalLM, AutoTokenizer

from ai_service.core.config import get_settings
from ai_service.services.emotion_analyzer import EmotionAnalyzer
from ai_service.services.session_manager import SessionManager
from ai_service.services.vector_store import query_collection

settings = get_settings()
ROLE_LABEL_MAP = {"student": "学生", "teacher": "教师", "admin": "教务人员"}
FALLBACK = settings.fallback_contacts

# 全局 GPU 锁：防止多请求同时访问 GPU 导致排队阻塞
_gpu_lock = threading.Lock()


# ─────────────────────────────────────────────────────────────
# 路径解析：优先本地目录，其次 ModelScope 自动下载
# ─────────────────────────────────────────────────────────────
def _resolve_model_path() -> str:
    local = getattr(settings, "qwen_model_local_dir", None)
    if local and os.path.isdir(local):
        if os.path.isfile(os.path.join(local, "model.safetensors.index.json")) or \
           any(f.startswith("model.safetensors") for f in os.listdir(local)):
            return local
    return settings.model_name


# ─────────────────────────────────────────────────────────────
# System prompt（中文智慧校园助手）
# ─────────────────────────────────────────────────────────────
def _system_prompt(role_label: str) -> str:
    return (
        "你叫智校行 Smart1，是智慧校园助手。"
        f"你的服务对象是 {role_label}。"
        "请根据参考资料回答问题。如果资料不足，请诚实说明并给出建议联系部门。"
        "回答要简洁有序，可分点列出。不要编造政策信息。"
    )


def _build_prompt(
    question: str,
    role_label: str,
    docs: list[str],
    history: list[tuple[str, str]],
) -> list[dict]:
    context = "\n---\n".join(docs) if docs else "（无相关检索结果）"
    messages = [
        {"role": "system", "content": _system_prompt(role_label)},
    ]
    for q, a in history[-3:]:
        messages.append({"role": "user", "content": q})
        messages.append({"role": "assistant", "content": a})
    messages.append({"role": "user", "content": (
        f"【参考资料】\n{context}\n\n"
        f"【用户问题】\n{question}"
    )})
    return messages


# ─────────────────────────────────────────────────────────────
# Batch 生成（使用 model.generate，比逐 token 循环快）
# ─────────────────────────────────────────────────────────────
def _batch_generate(
    model, tokenizer, messages: list[dict], max_new_tokens: int = 300
) -> Iterator[str]:
    """
    使用 apply_chat_template + model.generate() 进行 batch 推理。
    HuggingFace generate() 内部使用 KV cache，一次性生成，速度远快于逐 token 循环。
    """
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt")
    if settings.device == "cuda":
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
            repetition_penalty=settings.repetition_penalty,
        )

    generated_text = tokenizer.decode(
        outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )
    yield generated_text


# ─────────────────────────────────────────────────────────────
# 主引擎类
# ─────────────────────────────────────────────────────────────
class CampusQAEngine:
    def __init__(self, collection, embeddings_model) -> None:
        self.collection = collection
        self.embeddings_model = embeddings_model
        self.session_manager = SessionManager(max_history=5)
        self.emotion_analyzer = EmotionAnalyzer()

        model_path = _resolve_model_path()
        print(f"[qa_engine] 加载 Qwen3.5-2B from: {model_path}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path,
            trust_remote_code=True,
            local_files_only=os.path.isdir(model_path),
        )

        model_kwargs: dict = {
            "trust_remote_code": True,
            "dtype": torch.float16 if settings.device == "cuda" else torch.float32,
        }

        self.model = AutoModelForCausalLM.from_pretrained(model_path, **model_kwargs)

        if settings.device == "cuda":
            self.model = self.model.to("cuda")

        print("[qa_engine] 模型加载完成")

    def _expand_query(self, question: str) -> str:
        q = question
        extras = []
        for key, words in _QUERY_EXPANSIONS.items():
            if key in q:
                extras.extend(words)
        if extras:
            q = q + " " + " ".join(extras)
        return q

    def _infer_category(self, question: str) -> str | None:
        q = question
        for cat, kws in _QUERY_ROUTE_ORDER:
            if any(kw in q for kw in kws):
                return cat
        return None

    def _retrieve(self, question: str, category_filter: str | None = None):
        search_question = self._expand_query(question)
        inferred_category = category_filter or self._infer_category(question)
        results = query_collection(
            self.collection, self.embeddings_model,
            search_question, top_k=settings.top_k * 2, category_filter=inferred_category,
        )
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        # If a category was inferred, hard-filter the returned chunks again to avoid
        # semantically similar but wrong categories (e.g. 学位 -> 奖学金).
        if inferred_category and docs and metas:
            filtered = [
                (doc, meta, dist)
                for doc, meta, dist in zip(docs, metas, distances)
                if inferred_category in str(meta.get("category", ""))
            ]
            if filtered:
                docs, metas, distances = map(list, zip(*filtered))

        best_sim = (1.0 - float(distances[0])) if distances else 0.0
        return docs, metas, best_sim, distances

    def _rerank_with_filename(self, question: str, docs: list[str], metas: list[dict]):
        if not docs or not metas:
            return docs, metas
        q = question.lower()
        scored = []
        for doc, meta in zip(docs, metas):
            source = str(meta.get("source", ""))
            category = str(meta.get("category", ""))
            score = 0
            for pattern in _DOC_NAME_PATTERNS:
                if pattern in source or pattern in doc:
                    score += 4
                if pattern.lower() in q:
                    score += 2
            if source and source.replace(".md", "") in q:
                score += 6
            for cat, kws in _CATEGORY_KEYWORDS.items():
                if cat in category:
                    score += 1
                    if any(kw in q for kw in kws):
                        score += 3
            # a chunk is very likely relevant if question terms are inside the source name
            if any(token and token in source for token in q.split()):
                score += 1
            scored.append((score, doc, meta))
        scored.sort(key=lambda x: x[0], reverse=True)
        best_score = scored[0][0]
        if best_score > 0:
            top = [item for item in scored if item[0] == best_score]
            # Preserve original relative order among equally-scored chunks
            selected = top + [item for item in scored if item[0] != best_score]
            return [d for _, d, _ in selected], [m for _, _, m in selected]
        return docs, metas

    def _fallback(self, category: str | None = None) -> str:
        dept = FALLBACK.get(category or "default", FALLBACK["default"])
        return (
            f"抱歉，暂未检索到与您问题直接相关的政策文件。\n"
            f"建议联系：**{dept}**\n"
            f"或前往学校综合服务中心（行政楼大厅）咨询。"
        )

    # ── 同步非流式回答 ────────────────────────────────────────
    def answer(
        self,
        question: str,
        role: str = "student",
        session_id: str = "",
        category_filter: str | None = None,
    ) -> dict:
        role_label = ROLE_LABEL_MAP.get(role, "用户")
        history = self.session_manager.get_history(session_id)
        docs, metas, best_sim, distances = self._retrieve(question, category_filter)
        docs, metas = self._rerank_with_filename(question, docs, metas)

        if best_sim < settings.similarity_threshold or not docs:
            text = self._fallback(category_filter)
            sources = []
        else:
            messages = _build_prompt(question, role_label, docs, history)
            with _gpu_lock:
                full = "".join(
                    _batch_generate(self.model, self.tokenizer, messages,
                                    max_new_tokens=settings.max_new_tokens)
                )
            text = full.strip()
            sources = [
                {"source": m.get("source", ""), "category": m.get("category", ""),
                 "similarity": round(1.0 - d, 3)}
                for m, d in zip(metas, distances)
            ]

        self.session_manager.append(session_id, question, text)
        return {
            "answer": text,
            "emotion": self.emotion_analyzer.analyze(question),
            "sources": sources,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "similarity_score": round(best_sim, 3),
            "used_fallback": best_sim < settings.similarity_threshold,
        }

    # ── 异步生成器（SSE 流式输出）── 预生成 + 分块推送 ────────
    async def answer_stream(
        self,
        question: str,
        role: str = "student",
        session_id: str = "",
        category_filter: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        1. 用 GPU 锁 + 线程在后台预生成完整响应
        2. 生成完毕后，按每 3 个字符分块 SSE 推送（模拟打字机效果）
        这样 FastAPI 的 StreamingResponse 可以及时 flush，
        不会因为模型推理慢而被阻塞。
        """
        import json as _json

        role_label = ROLE_LABEL_MAP.get(role, "用户")
        history = self.session_manager.get_history(session_id)
        docs, metas, best_sim, distances = self._retrieve(question, category_filter)
        docs, metas = self._rerank_with_filename(question, docs, metas)

        if best_sim < settings.similarity_threshold or not docs:
            text = self._fallback(category_filter)
        else:
            messages = _build_prompt(question, role_label, docs, history)
            loop = asyncio.get_event_loop()
            full = await loop.run_in_executor(
                None,
                lambda: "".join(
                    _batch_generate(self.model, self.tokenizer, messages,
                                   max_new_tokens=settings.max_new_tokens)
                )
            )
            text = full.strip()

        # 生成完毕后，按每 3 字符分块推送（用锁保护 GPU）
        chunk_size = 3
        for i in range(0, len(text), chunk_size):
            chunk = text[i : i + chunk_size]
            if chunk:
                yield f"data: {_json.dumps({'type': 'content', 'content': chunk})}\n\n"
            await asyncio.sleep(0.02)

        yield f"data: {_json.dumps({'type': 'quick_actions', 'actions': []})}\n\n"
        yield "data: [DONE]\n\n"
        self.session_manager.append(session_id, question, text)
