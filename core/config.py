"""
AI 服务配置：模型路径、向量库路径、推理参数、兜底部门联系人。
"""
from functools import lru_cache
from pathlib import Path

import torch
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "智校行 Smart1 AI 服务"
    # 知识库根目录
    knowledge_base_dir: Path = ROOT_DIR / "knowledge_base"
    # ChromaDB 持久化目录
    chroma_db_dir: Path = ROOT_DIR / "campus_data" / "chroma"
    # Qwen3.5-2B 本地目录（默认 E 盘；目录不存在或缺权重时回退到 model_name 在线下载）
    # 可在项目根 .env 中设置 qwen_model_local_dir=其他路径 覆盖
    qwen_model_local_dir: Path = Path("E:/QianWen3.5-2B")
    # 备选 ModelScope 模型 ID
    model_name: str = r"E:/QianWen3.5-2B"
    # Embedding 模型（m3e-base 向量化）
    embedding_model: str = "moka-ai/m3e-base"
    host: str = "0.0.0.0"
    port: int = 8001
    # 推理参数
    max_new_tokens: int = 800
    temperature: float = 1.0
    top_p: float = 0.95
    repetition_penalty: float = 1.1
    # device: cuda 或 cpu（显存不足或报错时设为 cpu）
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    # 相似度阈值：低于此值返回兜底回答
    similarity_threshold: float = 0.45
    top_k: int = 4
    # 各分类兜底部门联系方式
    fallback_contacts: dict[str, str] = {
        "教务管理": "教务处（行政楼 201）",
        "奖学金政策": "学生处（行政楼 101）",
        "教师发展": "人事处（行政楼 401）",
        "系统操作手册": "信息中心（综合楼 301）",
        "学生指南": "学生处（行政楼 101）",
        "教学操作手册": "教务处（行政楼 201）",
        "default": "学校综合服务中心（行政楼大厅）",
    }

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        protected_namespaces=("settings_",),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.chroma_db_dir.mkdir(parents=True, exist_ok=True)
    settings.knowledge_base_dir.mkdir(parents=True, exist_ok=True)
    return settings
