"""ChromaDB 向量存储服务（替代原 FAISS 实现）。

提供：
- load_embeddings()          加载 embedding 模型
- get_chroma_collection()    获取/创建 ChromaDB Collection
- build_vector_store()       全量扫描 knowledge_base 并入库
- embed_single_document()    增量处理单个文件并入库
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ai_service.core.config import get_settings

settings = get_settings()

COLLECTION_NAME = "campus_knowledge"
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}


def load_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_model,
        model_kwargs={"device": settings.device},
        encode_kwargs={"device": settings.device},
    )


def get_chroma_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=str(settings.chroma_db_dir),
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_chroma_collection(
    client: chromadb.PersistentClient | None = None,
) -> chromadb.Collection:
    c = client or get_chroma_client()
    return c.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def _load_file(file_path: Path) -> list[Any]:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        loader = PyPDFLoader(str(file_path))
    elif suffix in {".docx", ".doc"}:
        loader = Docx2txtLoader(str(file_path))
    else:
        loader = TextLoader(str(file_path), encoding="utf-8")
    docs = loader.load()
    title = file_path.stem
    for doc in docs:
        doc.page_content = f"文件标题：{title}\n文件来源：{file_path.name}\n\n{doc.page_content}"
        doc.metadata["title"] = title
        doc.metadata["source"] = file_path.name
        doc.metadata["path"] = str(file_path)
        doc.metadata["category"] = file_path.parent.name
        doc.metadata["doc_type"] = file_path.suffix.lstrip(".").upper()
    return docs


def _split_docs(docs: list[Any]) -> list[Any]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=80,
        separators=["\n\n", "\n", "。", "！", "？", "；", "，", " "],
    )
    return splitter.split_documents(docs)


def _upsert_chunks(
    collection: chromadb.Collection,
    embeddings_model: HuggingFaceEmbeddings,
    chunks: list[Any],
) -> int:
    """将 chunks 向量化并 upsert 进 collection，返回写入数量。"""
    if not chunks:
        return 0

    texts = [c.page_content for c in chunks]
    metadatas = [c.metadata for c in chunks]
    vectors = embeddings_model.embed_documents(texts)

    source = chunks[0].metadata.get("source", "unknown")
    ids = [f"{source}_{i}" for i in range(len(chunks))]

    collection.upsert(
        ids=ids,
        embeddings=vectors,
        documents=texts,
        metadatas=metadatas,
    )
    return len(chunks)


def build_vector_store() -> chromadb.Collection:
    """全量扫描 knowledge_base_dir，重建 ChromaDB 索引。"""
    client = get_chroma_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = get_chroma_collection(client)
    embeddings_model = load_embeddings()

    total = 0
    for file_path in settings.knowledge_base_dir.rglob("*"):
        if (
            not file_path.is_file()
            or file_path.suffix.lower() not in SUPPORTED_EXTENSIONS
        ):
            continue
        try:
            docs = _load_file(file_path)
            chunks = _split_docs(docs)
            total += _upsert_chunks(collection, embeddings_model, chunks)
        except Exception as exc:
            print(f"[vector_store] 跳过 {file_path.name}: {exc}")

    print(f"[vector_store] 全量重建完成，共写入 {total} 个 chunk")
    return collection


def embed_single_document(file_path: str | Path) -> int:
    """增量处理单个文件并 upsert 进已有 collection，返回写入 chunk 数。"""
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"不支持的文件类型: {file_path.suffix}")

    collection = get_chroma_collection()
    embeddings_model = load_embeddings()
    docs = _load_file(file_path)
    chunks = _split_docs(docs)
    count = _upsert_chunks(collection, embeddings_model, chunks)
    print(f"[vector_store] 增量入库 {file_path.name}，写入 {count} 个 chunk")
    return count


def query_collection(
    collection: chromadb.Collection,
    embeddings_model: HuggingFaceEmbeddings,
    query: str,
    top_k: int | None = None,
    category_filter: str | None = None,
) -> dict:
    """查询 ChromaDB，返回原始 query_results 字典。"""
    k = top_k or settings.top_k
    vector = embeddings_model.embed_query(query)
    where = {"category": category_filter} if category_filter else None
    results = collection.query(
        query_embeddings=[vector],
        n_results=k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )
    return results


def load_collection() -> tuple[chromadb.Collection, HuggingFaceEmbeddings]:
    """服务启动时调用：加载（或首次构建）collection 和 embedding 模型。"""
    client = get_chroma_client()
    collection = get_chroma_collection(client)
    if collection.count() == 0:
        print("[vector_store] ChromaDB 为空，触发全量重建...")
        collection = build_vector_store()
    embeddings_model = load_embeddings()
    return collection, embeddings_model
