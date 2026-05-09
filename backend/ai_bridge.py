r"""
智慧校园后端 → AI 桥接层（降级版）。

ai_bridge 不再直接加载 AI 模型，而是：
1. 优先用 httpx 调用 ai_service (port 8001) 的非流式 /chat 接口
   获取完整回答后，再按 SSE 分 chunk 推送（解决流式 HTTP 连接卡住的问题）
2. 连接失败时自动降级到规则模拟回答

如果需要启用真正的 AI 模型推理，请单独启动：
    python -m ai_service.main
（确保 GPU 显存 > 6GB）
"""

from __future__ import annotations

import asyncio
import httpx
import json as _json
import sys
from pathlib import Path
from typing import AsyncGenerator, List

_root = str(Path(__file__).resolve().parents[1])
if _root not in sys.path:
    sys.path.insert(0, _root)

_AI_SERVICE_URL = "http://localhost:8001"
_AI_TIMEOUT = 180.0  # 180 秒超时，足够模型推理


def _safe_content(text: str) -> str:
    """将特殊字符转义，防止 JSON 解析失败。"""
    return (
        text.replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    )


async def generate_ai_stream(
    message: str,
    history: List[dict],
    conversation_id: str = "",
) -> AsyncGenerator[str, None]:
    """
    策略：
    1. 先关键词匹配，命中则走模拟回答（2-3 秒延迟）—— 常见问题响应快
    2. 未命中则调用 ai_service /chat 获取模型回答
    3. 将完整回答按 15 字符分块，以 SSE 格式推送
    """
    # ── 关键词命中，走模拟降级 ───────────────────────────
    if _mock_answer(message) is not None:
        async for chunk in _fallback_stream(message):
            yield chunk
        return

    # ── 未命中，走真实 AI 模型 ───────────────────────────
    payload = {
        "question": message,
        "role": "student",
        "session_id": conversation_id or "",
        "category_filter": None,
    }
    try:
        async with httpx.AsyncClient(timeout=_AI_TIMEOUT) as client:
            resp = await client.post(
                f"{_AI_SERVICE_URL}/chat",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                async for chunk in _fallback_stream(message):
                    yield chunk
                return

            data = resp.json()
            text = data.get("answer", "")
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.PoolTimeout, OSError):
        async for chunk in _fallback_stream(message):
            yield chunk
        return

    # SSE 分 chunk 推送（15字符/块，减少 WebSocket 帧数）
    chunk_size = 15
    for i in range(0, len(text), chunk_size):
        chunk = text[i : i + chunk_size]
        if chunk:
            yield f'data: {{"type":"content","content":"{_safe_content(chunk)}"}}\n\n'
        await asyncio.sleep(0.015)

    # quick_actions（目前为空）
    yield f'data: {{"type":"quick_actions","actions":[]}}\n\n'
    yield "data: [DONE]\n\n"


# ─── 降级规则模拟 ─────────────────────────────────────────

_MOCK_RESPONSES = {
    ("学分", "毕业"): (
        "根据您的学籍信息，您的已获学分为 92 学分，"
        "总毕业要求 160 学分，还需要修读 68 学分。"
        "按照目前的修读进度，您可以按时毕业。"
    ),
    ("成绩", "gpa", "绩点"): (
        "您当前的 GPA 为 3.72，在本专业排名前 15%。"
        "最近一学期的加权平均分为 85.5 分，继续保持！"
    ),
    ("课表", "课程", "上课"): (
        "您今天的课程安排如下：\n\n"
        "1️⃣ 08:00-09:40 高等数学A\n📍 教学楼A301\n\n"
        "2️⃣ 10:00-11:40 大学英语IV\n📍 教学楼B205\n\n"
        "3️⃣ 14:00-15:40 数据结构\n📍 实验楼302"
    ),
    ("考试",): (
        "近期考试安排：\n\n"
        "1. 高等数学A\n📅 6月28日 09:00-11:00\n📍 A教学楼201\n\n"
        "2. 大学英语\n📅 6月29日 14:00-16:00\n📍 B教学楼301"
    ),
    ("图书馆",): (
        "📚 图书馆信息：\n\n"
        "🕐 开放时间：8:00-22:00\n"
        "📍 位置：校本部综合楼1-6层\n"
        "📞 咨询台：010-12345678\n\n"
        "当前座位剩余：约 120 个"
    ),
    ("空教室", "自习室"): (
        "可在「空教室」页按楼栋查看实时空闲座位与空位率；"
        "热门时段建议优先选择空位率较高的教室。"
    ),
    ("食堂", "餐厅", "饭"): (
        "🍽️ 校内食堂信息：\n\n"
        "1. 第一食堂（主校区）\n🕐 6:30-20:00\n\n"
        "2. 第二食堂（东门）\n🕐 7:00-21:00\n\n"
        "3. 清真食堂（图书馆旁）\n🕐 7:00-20:30"
    ),
}


def _mock_answer(message: str) -> str | None:
    """关键词匹配，返回模拟回答；未命中返回 None"""
    msg_lower = message.lower()
    for keywords, answer in _MOCK_RESPONSES.items():
        if any(k in msg_lower for k in keywords):
            return answer
    return None


async def _fallback_stream(message: str, delay: float = 2.5) -> AsyncGenerator[str, None]:
    """模拟降级流式输出：先等待 delay 秒模拟思考，再逐块发送"""
    import random
    # 等待模拟思考时间
    await asyncio.sleep(delay + random.uniform(-0.3, 0.3))

    # 获取匹配的回答，未命中则用通用引导语
    text = _mock_answer(message) or (
        "您好！我是智校行 Smart1 智慧校园 AI 助手，可以帮您：\n\n"
        "📚 查询学分与毕业进度\n"
        "📅 查看课表与考试安排\n"
        "📊 分析成绩与 GPA\n"
        "🏫 了解校园设施与服务\n\n"
        "请问有什么可以帮您？"
    )

    chunk_size = 15
    for i in range(0, len(text), chunk_size):
        chunk = text[i : i + chunk_size]
        if chunk:
            yield f'data: {{"type":"content","content":"{_safe_content(chunk)}"}}\n\n'
        await asyncio.sleep(0.015)

    actions = []
    msg_lower = message.lower()
    if any(k in msg_lower for k in ["学分", "毕业"]):
        actions = [{"type": "link", "text": "查看学分详情", "url": "/pages/score/score"}]
    elif any(k in msg_lower for k in ["成绩", "gpa"]):
        actions = [{"type": "link", "text": "查看全部成绩", "url": "/pages/score/score"}]
    elif any(k in msg_lower for k in ["课表", "课程"]):
        actions = [{"type": "link", "text": "查看课表", "url": "/pages/schedule/schedule"}]
    elif any(k in msg_lower for k in ["空教室", "自习室"]):
        actions = [{"type": "link", "text": "打开空教室查询", "url": "/pages/empty-classroom/empty-classroom"}]

    yield f'data: {{"type":"quick_actions","actions":{_json.dumps(actions, ensure_ascii=False)}}}\n\n'
    yield "data: [DONE]\n\n"
