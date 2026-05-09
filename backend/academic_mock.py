"""按登录学号区分的学业模拟数据（答辩演示用）。"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

PRIMARY_SCORE_STUDENT_ID = "2367219001"


def parse_student_id_from_auth(authorization: Optional[str]) -> Optional[str]:
    """从 Bearer mock_token_{学号} 或 mock_token_{学号}_{时间戳} 解析学号。"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    if not token.startswith("mock_token_"):
        return None
    suffix = token[len("mock_token_") :]
    candidate = suffix.split("_")[0]
    if re.fullmatch(r"236721900[1-8]", candidate):
        return candidate
    return None


def academic_profile_for_ai(student_id: Optional[str]) -> Dict[str, Any]:
    """2367219001 保留原高分演示；其余学号为另一套偏低数据。"""
    if student_id == PRIMARY_SCORE_STUDENT_ID:
        return {
            "earned": 92,
            "required": 160,
            "need": 68,
            "gpa": "3.72",
            "avg": 85.5,
            "rank": "前 15%",
            "highlight": "高数 92、数据结构 95",
        }
    return {
        "earned": 73,
        "required": 160,
        "need": 87,
        "gpa": "3.29",
        "avg": 79.6,
        "rank": "约前 38%",
        "highlight": "数据结构 85、高等数学与英语仍有提升空间",
    }


def build_ai_score_keyword_mock(p: Dict[str, Any]) -> Dict[str, str]:
    e, r, n = p["earned"], p["required"], p["need"]
    g, avg, rk = p["gpa"], p["avg"], p["rank"]
    hl = p["highlight"]
    return {
        "学分": (
            f"根据您的学籍信息，您的已获学分为 {e} 学分，总毕业要求 {r} 学分，还需要修读 {n} 学分。"
            "请对照培养方案核对必修课进度，合理安排选课与重修。"
        ),
        "毕业": (
            f"根据培养方案，您已获 {e} 学分，还需 {n} 学分达到 {r} 学分要求。"
            "如有不及格课程请及时重修，以免影响毕业审核。"
        ),
        "gpa": (
            f"您当前的 GPA 为 {g}，在本专业排名 {rk}。"
            f"最近一学期的加权平均分为 {avg} 分。"
        ),
        "成绩": (
            f"您最近一学期加权平均分 {avg}，GPA {g}，专业排名 {rk}。"
            f"{hl} 等课程可作为参考，薄弱科目建议针对性巩固。"
        ),
        "绩点": (
            f"您当前 GPA 为 {g}，折算百分制约 {avg} 分。"
            "毕业要求 GPA 不低于 2.0，请继续关注核心课程表现。"
        ),
    }
