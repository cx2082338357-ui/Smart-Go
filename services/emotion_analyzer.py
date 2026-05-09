from typing import Dict


EMOTION_THRESHOLDS = {
    "positive": 1,
    "negative": 1,
}


class EmotionAnalyzer:
    def __init__(self) -> None:
        self.positive_words = [
            "好",
            "优秀",
            "感谢",
            "帮助",
            "满意",
            "高兴",
            "喜欢",
            "谢谢",
            "棒",
            "精彩",
        ]
        self.negative_words = [
            "差",
            "问题",
            "错误",
            "不会",
            "不能",
            "无法",
            "困难",
            "麻烦",
            "失败",
            "糟糕",
        ]
        self.urgent_words = ["紧急", "马上", "立刻", "尽快", "急", "现在", "迅速"]

    def analyze(self, text: str) -> Dict:
        text_lower = text.lower()
        positive_score = sum(1 for word in self.positive_words if word in text_lower)
        negative_score = sum(
            1 for word in self.negative_words if word in text_lower
        )
        urgent_score = sum(1 for word in self.urgent_words if word in text_lower)

        if positive_score > negative_score and positive_score >= EMOTION_THRESHOLDS["positive"]:
            emotion = "positive"
        elif negative_score > positive_score and negative_score >= EMOTION_THRESHOLDS["negative"]:
            emotion = "negative"
        else:
            emotion = "neutral"

        return {
            "emotion": emotion,
            "urgency": urgent_score > 0,
            "positive_score": positive_score,
            "negative_score": negative_score,
        }
