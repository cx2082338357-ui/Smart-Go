"""下载 Qwen3.5-2B（默认推理目录见 ai_service.core.config 的 qwen_model_local_dir，当前为 E:/QianWen3.5-2B）。"""

import os
from pathlib import Path

from modelscope import snapshot_download

MODEL_ID = "qwen/Qwen3.5-2B"
CACHE_DIR = str(Path.home() / ".cache" / "modelscope" / "hub")
LOCAL_DIR = str(Path.home() / ".cache" / "modelscope" / "hub" / "models" / "qwen" / "Qwen3.5-2B")

print(f"开始下载模型 {MODEL_ID} 到 {LOCAL_DIR} ...")
print("首次下载需要下载完整权重（约 4-5GB），请耐心等待...")

try:
    local_path = snapshot_download(
        model_id=MODEL_ID,
        cache_dir=CACHE_DIR,
        revision="master",
        local_files_only=False,
    )
    print(f"下载完成，模型路径: {local_path}")

    # 列出文件
    model_dir = local_path if os.path.isdir(local_path) else LOCAL_DIR
    files = [f for f in os.listdir(model_dir) if os.path.isfile(os.path.join(model_dir, f))]
    print(f"文件列表 ({len(files)} 个):")
    for f in sorted(files):
        size = os.path.getsize(os.path.join(model_dir, f))
        print(f"  {f}: {size/1024/1024:.1f} MB")
except Exception as e:
    print(f"下载失败: {e}")
    print("请检查网络连接后重试")
