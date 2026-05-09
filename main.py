"""AI 服务入口：/chat、/chat/stream、/embed-document、/rebuild-index、/health 接口。"""

from __future__ import annotations

import uuid
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ai_service.core.config import get_settings
from ai_service.services.qa_engine import CampusQAEngine
from ai_service.services.vector_store import (
    build_vector_store,
    embed_single_document,
    load_collection,
)

settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局单例
_collection = None
_embeddings_model = None
_qa_engine: CampusQAEngine | None = None


@app.on_event("startup")
def on_startup() -> None:
    global _collection, _embeddings_model, _qa_engine
    _collection, _embeddings_model = load_collection()
    _qa_engine = CampusQAEngine(_collection, _embeddings_model)
    print("[ai_service] 智校行 Smart1 AI 服务启动完成")


# ─── 请求/响应模型 ───────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    role: str = "student"
    session_id: str | None = None
    category_filter: str | None = None
    openid: str | None = None


class EmbedRequest(BaseModel):
    file_path: str
    document_id: str | None = None


class EmbedResponse(BaseModel):
    success: bool
    chunks_written: int
    file_path: str
    message: str


# ─── 接口 ────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    count = _collection.count() if _collection is not None else -1
    return {
        "status": "ok",
        "service": "ai_service",
        "model": str(settings.qwen_model_local_dir),
        "device": settings.device,
        "indexed_chunks": count,
    }


@app.post("/chat")
def chat(payload: ChatRequest) -> dict:
    """非流式回答（便于调试和兼容）"""
    if _qa_engine is None:
        raise HTTPException(status_code=503, detail="AI 服务尚未就绪")
    session_id = payload.session_id or f"session_{uuid.uuid4().hex[:8]}"
    return _qa_engine.answer(
        question=payload.question,
        role=payload.role,
        session_id=session_id,
        category_filter=payload.category_filter,
    )


@app.post("/chat/stream")
async def chat_stream(payload: ChatRequest):
    """SSE 流式回答（推荐）"""
    if _qa_engine is None:
        raise HTTPException(status_code=503, detail="AI 服务尚未就绪")
    session_id = payload.session_id or f"session_{uuid.uuid4().hex[:8]}"

    import asyncio
    from ai_service.services.qa_engine import _stream_generate, _build_prompt, ROLE_LABEL_MAP

    role_label = ROLE_LABEL_MAP.get(payload.role, "用户")
    docs, metas, best_sim, distances = _qa_engine._retrieve(
        payload.question, payload.category_filter
    )

    if best_sim < settings.similarity_threshold or not docs:
        text = _qa_engine._fallback(payload.category_filter)
    else:
        messages = _build_prompt(payload.question, role_label, docs,
                                 _qa_engine.session_manager.get_history(session_id))
        def gen():
            for chunk in _stream_generate(
                _qa_engine.model, _qa_engine.tokenizer,
                messages, max_new_tokens=settings.max_new_tokens
            ):
                import json
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

        return StreamingResponse(
            gen(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"},
        )

    # fallback 路径：逐字发送
    async def fallback_stream():
        import json, asyncio
        for i in range(0, len(text), 4):
            chunk = text[i : i + 4]
            if chunk:
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
            await asyncio.sleep(0.02)
        yield f"data: {json.dumps({'type': 'quick_actions', 'actions': []})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        fallback_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@app.post("/embed-document", response_model=EmbedResponse)
def embed_document(payload: EmbedRequest) -> EmbedResponse:
    """单文件增量向量化入库"""
    global _collection, _embeddings_model
    try:
        count = embed_single_document(payload.file_path)
        from ai_service.services.vector_store import get_chroma_collection
        _collection = get_chroma_collection()
        if _qa_engine is not None:
            _qa_engine.collection = _collection
        return EmbedResponse(
            success=True,
            chunks_written=count,
            file_path=payload.file_path,
            message=f"成功写入 {count} 个 chunk",
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"向量化失败: {exc}") from exc


@app.post("/rebuild-index")
def rebuild_index() -> dict:
    """全量重建 ChromaDB 索引（管理员操作）"""
    global _collection
    try:
        _collection = build_vector_store()
        if _qa_engine is not None:
            _qa_engine.collection = _collection
        return {"success": True, "indexed_chunks": _collection.count()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"重建失败: {exc}") from exc


if __name__ == "__main__":
    uvicorn.run(app, host=settings.host, port=settings.port)
