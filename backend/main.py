"""
智慧校园 - FastAPI 后端服务
"""
import httpx
import socket
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os, pathlib
import asyncio
import json
import uuid
import hashlib
import random
import time as time_module
import string
import httpx as _req
import sqlite3
import re
from contextlib import contextmanager

from academic_mock import (
    PRIMARY_SCORE_STUDENT_ID,
    academic_profile_for_ai,
    build_ai_score_keyword_mock,
    parse_student_id_from_auth,
)

# ============ 模拟数据库 ============

_mock_students = {
    "2367219001": {
        "password": hashlib.sha256("Chenzihan2004!".encode()).hexdigest(),
        "name": "陈子涵",
        "college": "计算机学院",
        "major": "计算机科学与技术",
        "grade": "2023级",
        "class_name": "计科2301班"
    },
    "2367219002": {
        "password": hashlib.sha256("Lyh990328@".encode()).hexdigest(),
        "name": "刘宇航",
        "college": "软件学院",
        "major": "软件工程",
        "grade": "2023级",
        "class_name": "软工2302班"
    },
    "2367219003": {
        "password": hashlib.sha256("Ysq_imust1".encode()).hexdigest(),
        "name": "杨思琪",
        "college": "信息学院",
        "major": "电子信息工程",
        "grade": "2022级",
        "class_name": "电信2201班"
    },
    "2367219004": {
        "password": hashlib.sha256("GuoJJ_0521".encode()).hexdigest(),
        "name": "郭俊杰",
        "college": "机械学院",
        "major": "机械设计",
        "grade": "2024级",
        "class_name": "机械2401班"
    },
    "2367219005": {
        "password": hashlib.sha256("Msy#campus23".encode()).hexdigest(),
        "name": "马思远",
        "college": "经管学院",
        "major": "工商管理",
        "grade": "2023级",
        "class_name": "工管2303班"
    },
    "2367219006": {
        "password": hashlib.sha256("Zxy654321ok".encode()).hexdigest(),
        "name": "赵欣怡",
        "college": "外语学院",
        "major": "英语",
        "grade": "2024级",
        "class_name": "英语2401班"
    },
    "2367219007": {
        "password": hashlib.sha256("Hanwb_hello88".encode()).hexdigest(),
        "name": "韩文博",
        "college": "文学院",
        "major": "汉语言文学",
        "grade": "2022级",
        "class_name": "汉语言2201班"
    },
    "2367219008": {
        "password": hashlib.sha256("Tsy2003rain".encode()).hexdigest(),
        "name": "唐诗雨",
        "college": "理学院",
        "major": "数学",
        "grade": "2023级",
        "class_name": "数学2301班"
    }
}

# 手机号 → 学号 映射（正式上线后从数据库读取）
_phone_to_student = {
    # "13800000000": "2367219001",
}

# ============ 成绩模拟：2367219001 与其它学号区分 ============

_SCORE_SUMMARY_PRIMARY = {
    "currentGPA": "3.72",
    "totalCredits": 160,
    "earnedCredits": 92,
    "avgScore": 85.5,
    "requiredCredits": 160,
    "progressPercent": 57,
}

_SCORE_SUMMARY_OTHER = {
    "currentGPA": "3.29",
    "totalCredits": 160,
    "earnedCredits": 73,
    "avgScore": 79.6,
    "requiredCredits": 160,
    "progressPercent": 46,
}

_SCORE_SEMESTERS_PRIMARY = [
    {"value": "2024-1", "label": "2024-1", "gpa": "3.85"},
    {"value": "2023-2", "label": "2023-2", "gpa": "3.72"},
    {"value": "2023-1", "label": "2023-1", "gpa": "3.68"},
    {"value": "2022-2", "label": "2022-2", "gpa": "3.55"},
]

_SCORE_SEMESTERS_OTHER = [
    {"value": "2024-1", "label": "2024-1", "gpa": "3.36"},
    {"value": "2023-2", "label": "2023-2", "gpa": "3.21"},
    {"value": "2023-1", "label": "2023-1", "gpa": "3.02"},
    {"value": "2022-2", "label": "2022-2", "gpa": "2.91"},
]

_SCORE_MAP_PRIMARY: Dict[str, List[Dict[str, Any]]] = {
    "2024-1": [
        {"id": "1", "courseName": "高等数学A", "credits": 5, "score": 92, "type": "必修"},
        {"id": "2", "courseName": "大学英语IV", "credits": 3, "score": 88, "type": "必修"},
        {"id": "3", "courseName": "数据结构", "credits": 4, "score": 95, "type": "必修"},
        {"id": "4", "courseName": "计算机网络", "credits": 3, "score": 85, "type": "必修"},
        {"id": "5", "courseName": "人工智能导论", "credits": 2, "score": 90, "type": "选修"},
        {"id": "6", "courseName": "体育", "credits": 1, "score": 94, "type": "必修"},
    ],
    "2023-2": [
        {"id": "11", "courseName": "线性代数", "credits": 4, "score": 86, "type": "必修"},
        {"id": "12", "courseName": "大学物理", "credits": 4, "score": 81, "type": "必修"},
        {"id": "13", "courseName": "C语言程序设计", "credits": 3, "score": 89, "type": "必修"},
        {"id": "14", "courseName": "马克思主义基本原理", "credits": 3, "score": 84, "type": "必修"},
        {"id": "15", "courseName": "体育II", "credits": 1, "score": 91, "type": "必修"},
        {"id": "16", "courseName": "概率论与数理统计", "credits": 3, "score": 79, "type": "必修"},
    ],
    "2023-1": [
        {"id": "21", "courseName": "离散数学", "credits": 3, "score": 87, "type": "必修"},
        {"id": "22", "courseName": "操作系统", "credits": 4, "score": 83, "type": "必修"},
        {"id": "23", "courseName": "数据库原理", "credits": 3, "score": 85, "type": "必修"},
        {"id": "24", "courseName": "计算机组成原理", "credits": 4, "score": 80, "type": "必修"},
        {"id": "25", "courseName": "体育III", "credits": 1, "score": 93, "type": "必修"},
        {"id": "26", "courseName": "形势与政策", "credits": 1, "score": 90, "type": "选修"},
    ],
    "2022-2": [
        {"id": "31", "courseName": "大学英语III", "credits": 3, "score": 82, "type": "必修"},
        {"id": "32", "courseName": "面向对象程序设计", "credits": 4, "score": 84, "type": "必修"},
        {"id": "33", "courseName": "电路基础", "credits": 3, "score": 78, "type": "必修"},
        {"id": "34", "courseName": "工程制图", "credits": 2, "score": 88, "type": "必修"},
        {"id": "35", "courseName": "体育I", "credits": 1, "score": 92, "type": "必修"},
        {"id": "36", "courseName": "大学生心理健康", "credits": 2, "score": 89, "type": "选修"},
    ],
}

_SCORE_MAP_OTHER: Dict[str, List[Dict[str, Any]]] = {
    "2024-1": [
        {"id": "1", "courseName": "高等数学A", "credits": 5, "score": 77, "type": "必修"},
        {"id": "2", "courseName": "大学英语IV", "credits": 3, "score": 73, "type": "必修"},
        {"id": "3", "courseName": "数据结构", "credits": 4, "score": 85, "type": "必修"},
        {"id": "4", "courseName": "计算机网络", "credits": 3, "score": 70, "type": "必修"},
        {"id": "5", "courseName": "人工智能导论", "credits": 2, "score": 78, "type": "选修"},
        {"id": "6", "courseName": "体育", "credits": 1, "score": 87, "type": "必修"},
    ],
    "2023-2": [
        {"id": "11", "courseName": "线性代数", "credits": 4, "score": 76, "type": "必修"},
        {"id": "12", "courseName": "大学物理", "credits": 4, "score": 71, "type": "必修"},
        {"id": "13", "courseName": "C语言程序设计", "credits": 3, "score": 80, "type": "必修"},
        {"id": "14", "courseName": "马克思主义基本原理", "credits": 3, "score": 75, "type": "必修"},
        {"id": "15", "courseName": "体育II", "credits": 1, "score": 88, "type": "必修"},
        {"id": "16", "courseName": "概率论与数理统计", "credits": 3, "score": 66, "type": "必修"},
    ],
    "2023-1": [
        {"id": "21", "courseName": "离散数学", "credits": 3, "score": 79, "type": "必修"},
        {"id": "22", "courseName": "操作系统", "credits": 4, "score": 74, "type": "必修"},
        {"id": "23", "courseName": "数据库原理", "credits": 3, "score": 81, "type": "必修"},
        {"id": "24", "courseName": "计算机组成原理", "credits": 4, "score": 72, "type": "必修"},
        {"id": "25", "courseName": "体育III", "credits": 1, "score": 89, "type": "必修"},
        {"id": "26", "courseName": "形势与政策", "credits": 1, "score": 84, "type": "选修"},
    ],
    "2022-2": [
        {"id": "31", "courseName": "大学英语III", "credits": 3, "score": 76, "type": "必修"},
        {"id": "32", "courseName": "面向对象程序设计", "credits": 4, "score": 78, "type": "必修"},
        {"id": "33", "courseName": "电路基础", "credits": 3, "score": 73, "type": "必修"},
        {"id": "34", "courseName": "工程制图", "credits": 2, "score": 83, "type": "必修"},
        {"id": "35", "courseName": "体育I", "credits": 1, "score": 85, "type": "必修"},
        {"id": "36", "courseName": "大学生心理健康", "credits": 2, "score": 81, "type": "选修"},
    ],
}


def _pick_score_map(student_id: Optional[str]) -> Dict[str, List[Dict[str, Any]]]:
    return _SCORE_MAP_PRIMARY if student_id == PRIMARY_SCORE_STUDENT_ID else _SCORE_MAP_OTHER


# 会话存储（token → 用户信息）
_sessions: Dict[str, dict] = {}

# 骑手认证状态
_rider认证 = {}

# 配送订单数据
_delivery_orders = [
    {
        "id": f"order_{i}",
        "pickupLocation": location,
        "deliveryLocation": f"学生宿舍{random.choice(['1','2','3','4','5'])}号楼{random.choice(['101','202','305','401','502'])}室",
        "goodsSummary": random.choice([
            "矿泉水x2, 零食若干",
            "快递包裹1件",
            "外卖一份",
            "文具+笔记本",
            "水果篮一份",
            "咖啡x2",
            "打印资料5份",
            "药品一盒"
        ]),
        "distance": random.randint(100, 800),
        "deliveryFee": f"{random.uniform(2.5, 5.0):.2f}",
        "tip": f"{random.uniform(0.5, 3.0):.2f}",
        "status": "available"
    }
    for i, location in enumerate([
        "校内超市", "菜鸟驿站", "南门小吃街", "北门快递点",
        "打印店", "水果店", "咖啡厅", "药店",
        "图书馆便利店", "食堂外卖柜"
    ] * 3)
]

# 商品数据
_products = [
    {"id": "1", "name": "农夫山泉 550ml", "description": "天然弱碱性水", "price": "2.00", "originalPrice": "2.50", "image": "/assets/icons/drinks.png", "tag": "热卖", "sales": 5200, "category": "drinks", "stock": 200},
    {"id": "2", "name": "可口可乐 330ml", "description": "快乐水 冰镇更佳", "price": "3.00", "originalPrice": "3.50", "image": "/assets/icons/drinks.png", "tag": "", "sales": 4800, "category": "drinks", "stock": 150},
    {"id": "3", "name": "康师傅方便面", "description": "红烧牛肉味 桶装", "price": "4.50", "originalPrice": "5.00", "image": "/assets/icons/snacks.png", "tag": "特惠", "sales": 4200, "category": "snacks", "stock": 100},
    {"id": "4", "name": "奥利奥夹心饼干", "description": "巧克力味 整箱", "price": "12.80", "originalPrice": "15.00", "image": "/assets/icons/snacks.png", "tag": "", "sales": 3200, "category": "snacks", "stock": 80},
    {"id": "5", "name": "蒙牛纯牛奶 250ml", "description": "24盒装", "price": "48.00", "originalPrice": "58.00", "image": "/assets/icons/drinks.png", "tag": "特惠", "sales": 1800, "category": "drinks", "stock": 50},
    {"id": "6", "name": "得力文具套装", "description": "中性笔+笔记本+尺子", "price": "15.90", "originalPrice": "20.00", "image": "/assets/icons/stationery.png", "tag": "", "sales": 890, "category": "stationery", "stock": 60},
    {"id": "7", "name": "统一冰红茶 500ml", "description": "畅爽一下", "price": "3.00", "originalPrice": "3.50", "image": "/assets/icons/drinks.png", "tag": "新品", "sales": 450, "category": "drinks", "stock": 120},
    {"id": "8", "name": "薯片组合装", "description": "3包不同口味", "price": "9.90", "originalPrice": "12.00", "image": "/assets/icons/snacks.png", "tag": "热卖", "sales": 2100, "category": "snacks", "stock": 70},
    {"id": "9", "name": "农夫果园 300ml", "description": "混合果汁", "price": "4.00", "originalPrice": "5.00", "image": "/assets/icons/fruits.png", "tag": "", "sales": 680, "category": "drinks", "stock": 90},
    {"id": "10", "name": "乐事薯片 罐装", "description": "104g 经典原味", "price": "6.50", "originalPrice": "8.00", "image": "/assets/icons/snacks.png", "tag": "", "sales": 1500, "category": "snacks", "stock": 85},
    {"id": "11", "name": "得力笔记本", "description": "A5 80页", "price": "5.00", "originalPrice": "6.00", "image": "/assets/icons/stationery.png", "tag": "", "sales": 3200, "category": "stationery", "stock": 200},
    {"id": "12", "name": "晨光中性笔", "description": "0.5mm 黑/红/蓝", "price": "2.00", "originalPrice": "2.50", "image": "/assets/icons/stationery.png", "tag": "", "sales": 4500, "category": "stationery", "stock": 300},
    {"id": "13", "name": "苹果 4个装", "description": "红富士 新鲜水果", "price": "15.80", "originalPrice": "19.80", "image": "/assets/icons/fruits.png", "tag": "新鲜", "sales": 890, "category": "fruits", "stock": 40},
    {"id": "14", "name": "香蕉 一把", "description": "进口香蕉 约500g", "price": "6.80", "originalPrice": "8.00", "image": "/assets/icons/fruits.png", "tag": "", "sales": 560, "category": "fruits", "stock": 50},
    {"id": "15", "name": "三明治 早餐套餐", "description": "火腿鸡蛋 校内面包房", "price": "8.00", "originalPrice": "10.00", "image": "/assets/icons/fresh.png", "tag": "早餐", "sales": 1200, "category": "fresh", "stock": 30},
    {"id": "16", "name": "雀巢咖啡 瓶装", "description": "原味 280ml", "price": "5.50", "originalPrice": "7.00", "image": "/assets/icons/drinks.png", "tag": "", "sales": 780, "category": "drinks", "stock": 60},
    {"id": "17", "name": "卫生纸 12卷", "description": "家用卷纸", "price": "18.00", "originalPrice": "22.00", "image": "/assets/icons/daily.png", "tag": "必备", "sales": 1100, "category": "daily", "stock": 45},
    {"id": "18", "name": "充电宝 10000mAh", "description": "小米移动电源", "price": "69.00", "originalPrice": "79.00", "image": "/assets/icons/daily.png", "tag": "热卖", "sales": 650, "category": "daily", "stock": 25},
    {"id": "19", "name": "洗衣液 500ml", "description": "薰衣草香", "price": "12.50", "originalPrice": "15.00", "image": "/assets/icons/daily.png", "tag": "", "sales": 430, "category": "daily", "stock": 35},
    {"id": "20", "name": "蛋黄派 礼盒装", "description": "12枚入", "price": "16.80", "originalPrice": "20.00", "image": "/assets/icons/snacks.png", "tag": "送礼", "sales": 980, "category": "snacks", "stock": 40},
]

# 寻物启事数据
_lost_found_items = [
    {"id": "1", "type": "lost", "title": "丢失黑色小米手机一台", "description": "昨天下午在图书馆三楼自习室丢失，屏幕有裂纹，壳是透明的，有一只小熊挂件", "location": "图书馆三楼", "lostTime": "昨天 14:00", "timeAgo": "2小时前", "images": [], "views": 156, "comments": 12, "nickname": "陈子涵", "avatar": "", "isMatch": False, "contact": "138****1234"},
    {"id": "2", "type": "lost", "title": "校园卡丢失", "description": "一食堂到图书馆的路上丢失，卡套是蓝色的，上面写着努力两个字", "location": "一食堂附近", "lostTime": "今天 09:30", "timeAgo": "5小时前", "images": [], "views": 89, "comments": 5, "nickname": "刘宇航", "avatar": "", "isMatch": True, "contact": "139****5678"},
    {"id": "3", "type": "lost", "title": "白色AirPods Pro", "description": "在操场跑步时丢失，耳机盒有刻字", "location": "操场跑道", "lostTime": "昨天 20:30", "timeAgo": "1天前", "images": [], "views": 234, "comments": 18, "nickname": "跑步爱好者", "avatar": "", "isMatch": False, "contact": "137****9012"},
    {"id": "4", "type": "lost", "title": "蓝色双肩包", "description": "在教学楼A301教室丢失，里面有笔记本电脑", "location": "教学楼A301", "lostTime": "今天 11:00", "timeAgo": "3小时前", "images": [], "views": 178, "comments": 22, "nickname": "计算机学院", "avatar": "", "isMatch": True, "contact": "136****3456"},
    {"id": "5", "type": "found", "title": "捡到一串钥匙（4把）", "description": "教学楼A座门口捡到，有一把是防盗门钥匙，钥匙扣是蓝色的", "location": "教学楼A座", "lostTime": "今天 11:00", "timeAgo": "1小时前", "images": [], "views": 67, "comments": 8, "nickname": "好心人", "avatar": "", "isMatch": True, "contact": "135****7890"},
    {"id": "6", "type": "found", "title": "捡到学生证一张", "description": "在图书馆二楼阅览室捡到，姓王", "location": "图书馆二楼", "lostTime": "今天 10:00", "timeAgo": "2小时前", "images": [], "views": 45, "comments": 3, "nickname": "图书馆管理员", "avatar": "", "isMatch": True, "contact": ""},
    {"id": "7", "type": "found", "title": "眼镜一副", "description": "在食堂门口捡到，黑框眼镜", "location": "第二食堂门口", "lostTime": "昨天 12:30", "timeAgo": "12小时前", "images": [], "views": 89, "comments": 6, "nickname": "路人甲", "avatar": "", "isMatch": False, "contact": "134****2345"},
]

_LF_CATEGORY_KEYWORDS = {
    "手机": ["手机", "iphone", "华为", "小米", "oppo", "vivo"],
    "校园卡": ["校园卡", "一卡通", "学生证", "证件", "饭卡"],
    "钥匙": ["钥匙", "钥匙串", "门禁卡"],
    "耳机": ["耳机", "airpods", "蓝牙耳机"],
    "背包": ["背包", "书包", "双肩包", "包"],
    "眼镜": ["眼镜", "镜框"],
}

_LF_COLORS = ["黑", "白", "蓝", "红", "绿", "黄", "紫", "粉", "灰", "棕"]
_LF_LOCATIONS = [
    "图书馆", "食堂", "一食堂", "第二食堂", "操场", "教学楼", "宿舍", "实验楼",
    "春晖学堂", "文馨书院", "明德楼", "逸夫楼", "秋实楼"
]

def _lf_text(item: Dict[str, Any]) -> str:
    return f"{item.get('title','')} {item.get('description','')} {item.get('location','')}".lower()

def _lf_infer_category(item: Dict[str, Any]) -> str:
    text = _lf_text(item)
    for cat, words in _LF_CATEGORY_KEYWORDS.items():
        if any(w.lower() in text for w in words):
            return cat
    return "其他"

def _lf_extract_keywords(text: str) -> set:
    tokens = set()
    for kw_list in _LF_CATEGORY_KEYWORDS.values():
        for kw in kw_list:
            if kw.lower() in text:
                tokens.add(kw.lower())
    words = re.findall(r"[a-zA-Z0-9]{2,}", text)
    tokens.update(words)
    return tokens

def _lf_extract_colors(text: str) -> set:
    return {c for c in _LF_COLORS if c in text}

def _lf_extract_location_tags(text: str) -> set:
    return {loc for loc in _LF_LOCATIONS if loc in text}

def _lf_parse_time(raw: str) -> Optional[datetime]:
    if not raw:
        return None
    now = datetime.now()
    m = re.search(r"(\d{1,2}):(\d{2})", raw)
    hh = int(m.group(1)) if m else 12
    mm = int(m.group(2)) if m else 0
    if "今天" in raw:
        return now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if "昨天" in raw:
        base = now - timedelta(days=1)
        return base.replace(hour=hh, minute=mm, second=0, microsecond=0)
    m2 = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m2:
        y, mo, d = map(int, m2.groups())
        return datetime(y, mo, d, hh, mm)
    return None

def _lf_score_pair(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []

    cat_a = _lf_infer_category(a)
    cat_b = _lf_infer_category(b)
    if cat_a != "其他" and cat_a == cat_b:
        score += 40
        reasons.append(f"同类物品（{cat_a}）")

    ta = _lf_text(a)
    tb = _lf_text(b)
    kw_a = _lf_extract_keywords(ta)
    kw_b = _lf_extract_keywords(tb)
    inter = kw_a.intersection(kw_b)
    if inter:
        kw_score = min(20, 6 + len(inter) * 4)
        score += kw_score
        reasons.append("关键词重合：" + "、".join(list(inter)[:3]))

    color_inter = _lf_extract_colors(ta).intersection(_lf_extract_colors(tb))
    if color_inter:
        score += 10
        reasons.append("颜色特征一致：" + "、".join(color_inter))

    loc_inter = _lf_extract_location_tags(ta).intersection(_lf_extract_location_tags(tb))
    if loc_inter:
        score += 15
        reasons.append("地点接近：" + "、".join(list(loc_inter)[:2]))

    dt_a = _lf_parse_time(str(a.get("lostTime", "")))
    dt_b = _lf_parse_time(str(b.get("lostTime", "")))
    if dt_a and dt_b:
        diff_hours = abs((dt_a - dt_b).total_seconds()) / 3600
        if diff_hours <= 12:
            score += 12
            reasons.append("时间高度接近（12小时内）")
        elif diff_hours <= 24:
            score += 8
            reasons.append("时间接近（24小时内）")
        elif diff_hours <= 72:
            score += 4
            reasons.append("时间可关联（3天内）")

    return {"score": int(score), "reasons": reasons}

def _lf_build_matches(match_type: str) -> List[Dict[str, Any]]:
    t = (match_type or "").strip()
    if t not in ("lost", "found"):
        source = _lost_found_items[:]
        pool = _lost_found_items[:]
    else:
        source = [i for i in _lost_found_items if i["type"] == t]
        opposite = "found" if t == "lost" else "lost"
        pool = [i for i in _lost_found_items if i["type"] == opposite]

    results: List[Dict[str, Any]] = []
    for item in source:
        best_score = -1
        best_reasons: List[str] = []
        best_id = None
        for cand in pool:
            if cand["id"] == item["id"]:
                continue
            s = _lf_score_pair(item, cand)
            if s["score"] > best_score:
                best_score = s["score"]
                best_reasons = s["reasons"]
                best_id = cand["id"]
        if best_score >= 35:
            row = dict(item)
            row["isMatch"] = True
            row["aiScore"] = best_score
            row["bestMatchId"] = best_id
            row["matchReasons"] = best_reasons
            results.append(row)

    results.sort(key=lambda x: x.get("aiScore", 0), reverse=True)
    return results

# 社区帖子数据
_community_posts = [
    {"id": "1", "nickname": "小明同学", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "10分钟前", "content": "今天图书馆好多人啊，有没有人知道哪个教学楼还有空位置？", "images": [], "tags": ["图书馆", "自习"], "likes": 42, "comments": 15, "liked": False, "aiTags": []},
    {"id": "2", "nickname": "校园达人", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "1小时前", "content": "强烈推荐学校北门的螺蛳粉！味道正宗，老板超热情～", "images": [], "tags": ["美食", "推荐"], "likes": 128, "comments": 32, "liked": True, "aiTags": ["#美食推荐"]},
    {"id": "3", "nickname": "健身爱好者", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "2小时前", "content": "有没有人想一起夜跑？每晚8点在操场集合，5公里起步，欢迎加入！", "images": [], "tags": ["运动", "夜跑"], "likes": 56, "comments": 18, "liked": False, "aiTags": ["#运动约伴"]},
    {"id": "4", "nickname": "学霸小李", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "3小时前", "content": "期末复习交流群成立了，需要入群的同学可以私信我~", "images": [], "tags": ["学习", "交流"], "likes": 89, "comments": 45, "liked": False, "aiTags": ["#学习相关"]},
    {"id": "5", "nickname": "吃货一枚", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "5小时前", "content": "南门小吃街新开了一家烤肉拌饭，15元一份，超级好吃！", "images": [], "tags": ["美食", "南门"], "likes": 201, "comments": 67, "liked": True, "aiTags": ["#美食推荐"]},
    {"id": "6", "nickname": "求职小哥", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "6小时前", "content": "校内兼职：招聘图书馆助理，每周工作8小时，有兴趣的同学私聊", "images": [], "tags": ["兼职", "求职"], "likes": 76, "comments": 23, "liked": False, "aiTags": ["#校园兼职"]},
    {"id": "7", "nickname": "电影发烧友", "avatar": "/assets/icons/default-avatar.png", "timeAgo": "昨天", "content": "今晚学校礼堂放《肖申克的救赎》，晚上7点开始，免费观看！", "images": [], "tags": ["活动", "电影"], "likes": 312, "comments": 89, "liked": True, "aiTags": ["#校园活动"]},
]

_COMMUNITY_CATEGORY_RULES = {
    "study": ["学习", "自习", "图书馆", "考试", "课程", "复习", "学术"],
    "life": ["生活", "日常", "宿舍", "校园", "分享"],
    "food": ["美食", "吃", "餐", "食堂", "小吃", "螺蛳粉", "烤肉", "奶茶"],
    "sports": ["运动", "跑", "健身", "篮球", "足球", "羽毛球", "夜跑"],
    "activity": ["活动", "电影", "讲座", "社团", "比赛", "演出"],
    "help": ["互助", "求助", "帮忙", "失物", "寻物", "招领"],
    "jobs": ["兼职", "求职", "实习", "招聘", "工作"],
}

def _community_match_category(post: Dict[str, Any], category: str) -> bool:
    if category == "all":
        return True
    rules = _COMMUNITY_CATEGORY_RULES.get(category, [])
    if not rules:
        return True
    tags = post.get("tags") or []
    ai_tags = post.get("aiTags") or []
    text = f"{post.get('content', '')} {' '.join(tags)} {' '.join(ai_tags)}"
    return any(k in text for k in rules)

# 空教室数据（楼栋汇总 = 该楼教室总和；每栋楼不少于 10 个教室）
_BUILDING_ROOM_TEMPLATE = {
    "春晖学堂（主教）": [("101", 8, 7), ("102", 10, 6), ("103", 12, 9), ("104", 10, 6), ("201", 10, 3), ("202", 12, 7), ("203", 10, 5), ("301", 14, 9), ("302", 12, 7), ("305", 11, 7)],
    "文馨书院（二教）": [("101", 10, 7), ("102", 12, 8), ("103", 10, 6), ("201", 14, 8), ("202", 12, 7), ("203", 10, 5), ("301", 14, 9), ("302", 14, 3), ("303", 10, 5), ("405", 9, 7)],
    "明德楼": [("101", 12, 9), ("102", 10, 7), ("103", 13, 9), ("201", 12, 8), ("202", 10, 6), ("205", 10, 6), ("301", 14, 9), ("302", 12, 7), ("305", 12, 7), ("306", 12, 6)],
    "逸夫楼": [("101", 12, 7), ("102", 10, 6), ("201", 12, 7), ("202", 13, 8), ("203", 10, 5), ("301", 14, 8), ("302", 12, 6), ("305", 15, 7), ("401", 10, 4), ("402", 12, 6)],
    "秋实楼": [("101", 10, 6), ("102", 10, 5), ("103", 10, 7), ("104", 10, 5), ("201", 12, 6), ("202", 10, 5), ("203", 10, 4), ("204", 12, 6), ("305", 10, 4), ("306", 8, 3)],
    "图书馆": [("101", 24, 15), ("102", 24, 14), ("201", 30, 20), ("202", 24, 15), ("203", 24, 13), ("301", 28, 16), ("302", 24, 10), ("303", 24, 12), ("401", 28, 17), ("405", 28, 22)],
}

def _build_empty_classrooms():
    data = []
    for building, rooms in _BUILDING_ROOM_TEMPLATE.items():
        room_items = []
        total_sum = 0
        available_sum = 0
        for room_no, total, available in rooms:
            rate = round((available / total) * 100) if total else 0
            item = {
                "name": f"{building} {room_no}",
                "building": building,
                "availableRate": rate,
                "total": total,
                "available": available,
            }
            room_items.append(item)
            total_sum += total
            available_sum += available
        building_rate = round((available_sum / total_sum) * 100) if total_sum else 0
        data.append({
            "name": building,
            "building": building,
            "availableRate": building_rate,
            "total": total_sum,
            "available": available_sum,
        })
        data.extend(room_items)
    return data

_empty_classrooms = _build_empty_classrooms()

# ============ FastAPI 应用 ============

def _get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


app = FastAPI(
    title="智慧校园 API",
    version="2.0.0",
    description="智慧校园后端服务"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 小程序静态资源（商品占位图等）
assets_path = pathlib.Path("d:/Smart-Go/miniprogram/assets")
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")


# ============ AI 流式对话（SSE，适合 ngrok 免费版）============

class ChatRequest(BaseModel):
    conversationId: Optional[str] = None
    message: str
    history: Optional[List[Dict[str, str]]] = []


@app.post("/api/ai/stream", response_class=StreamingResponse)
async def ai_chat_sse(request: ChatRequest):
    """
    HTTP SSE 流式端点：ngrok 免费版不支持 WebSocket，使用此端点。
    小程序通过 HTTP POST 请求，服务器以 text/event-stream 格式返回。
    """
    from ai_bridge import generate_ai_stream

    conv_id = request.conversationId or f"conv_{uuid.uuid4().hex[:8]}"

    async def event_stream():
        try:
            async for chunk in generate_ai_stream(
                message=request.message,
                history=request.history or [],
                conversation_id=conv_id,
            ):
                yield chunk.encode("utf-8")
        except Exception as exc:
            err = f'data: {{"type":"error","message":"{str(exc).replace(chr(34), chr(92)+chr(34)).replace(chr(10), chr(92)+"n").replace(chr(13), "")}"}}\n\n'
            yield err.encode("utf-8")
        finally:
            yield b"data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@app.post("/api/ai/chat")
async def ai_chat_nonstream(
    request: ChatRequest,
    authorization: Optional[str] = Header(None),
):
    """
    非流式对话端点：
    1. 关键词命中 → 直接返回模拟回答（毫秒响应）
    2. 未命中 → 调用本地大模型（localhost:8001），超时 / 不可用时返回引导语
    """
    conv_id = request.conversationId or f"conv_{uuid.uuid4().hex[:8]}"
    msg = request.message or ""

    # ── 关键词匹配模拟回答库 ───────────────────────────
    _MOCK = {
        # ── 学分 / 成绩 / 绩点（按登录学号区分，见 academic_mock）──
        **build_ai_score_keyword_mock(
            academic_profile_for_ai(parse_student_id_from_auth(authorization))
        ),
        "社会实践学分": "社会实践学分可通过以下方式获得：\n\n参加志愿服务活动\n参与社会调研或实践项目\n企业实习或校外实践\n\n完成后需提交证明材料进行认定，具体可咨询学院辅导员或教务处。",
        "社会实践": "社会实践学分获取途径：\n\n参加志愿服务活动\n参与社会调研或实践项目\n企业实习或校外实践\n\n完成后需提交证明材料至学院教务办进行认定。",
        "奖学金": "奖学金评定主要依据以下条件：\n\n📊 学习成绩（GPA）\n🏆 综合素质测评成绩\n🎯 社会实践与竞赛表现\n✅ 无违纪记录\n\n每学年评定一次，成绩优秀且综合表现突出者更具竞争力。",
        "奖学金评定": "奖学金评定标准：\n\n📊 学习成绩（GPA）\n🏆 综合素质测评成绩\n🎯 社会实践与竞赛表现\n✅ 无违纪记录\n\n各学院略有差异，具体以学院通知为准。",
        "毕业学分": "毕业学分要求如下：\n\n按专业培养方案要求完成学分\n不同专业学分要求不同（一般 150-180 学分）\n\n若未修满，可采取以下方式：\n重修相关课程获取学分\n参加补考获取学分\n及时关注教务系统补选通知",
        # ── 教务相关 ──
        "学生证": "学生证补办流程：\n\n📍 办理地点：学生事务中心\n📄 所需材料：本人身份证\n💰 费用：一般 10 元左右\n🕒 时间：工作日办理\n\n建议先在教务系统申请，再前往办理。",
        "学生证补办": "学生证补办流程：\n\n📍 办理地点：学生事务中心\n📄 所需材料：本人身份证\n💰 费用：一般 10 元左右\n🕒 时间：工作日办理",
        "成绩单": "成绩单打印方式：\n\n登录教务系统下载电子成绩单\n或到学院办公室 / 自助打印机打印\n部分学校需盖章可到教务处办理\n\n建议提前准备，以备出国或就业之需。",
        "成绩单打印": "成绩单获取途径：\n\n登录教务系统下载电子成绩单\n或到学院办公室 / 自助打印机打印\n如需盖章可到教务处办理",
        "选课": "选课时间安排：\n\n一般在每学期开学前开放\n具体时间以教务处通知为准\n需在规定时间内完成选课\n\n建议提前了解培养方案，做好选课规划。",
        "选课时间": "选课系统开放时间：\n\n一般在每学期开学前开放\n具体时间以教务处通知为准\n需在规定时间内完成选课",
        "挂科": "挂科后处理方式：\n\n大多数课程允许补考\n补考时间一般在下学期开学初\n需关注教务系统或辅导员通知报名\n补考通过后成绩会更新\n\n部分选修课也可重修，详情咨询教务处。",
        "补考": "补考相关流程：\n\n大多数课程允许补考\n补考时间一般在下学期开学初\n需关注教务系统通知及时报名\n补考通过后成绩会更新\n\n部分核心课程仅有补考无重修，请注意。",
        "请假": "请假流程说明：\n\n在智慧校园系统提交请假申请\n填写请假时间和原因\n需要辅导员审批\n审批通过后方可生效\n\n紧急情况可先口头请假，事后及时补齐手续。",
        "请假流程": "请假审批流程：\n\n在智慧校园系统提交请假申请\n填写请假时间和原因\n需要辅导员审批\n审批通过后方可生效",
        # ── 校园生活 ──
        "一卡通": "校园一卡通服务：\n\n可使用一卡通在校内食堂、超市、打印店消费\n支持门禁、图书借阅功能\n余额查询请到一卡通服务中心或自助机\n\n如丢失，请尽快挂失并补办。",
        "校园卡": "校园一卡通服务：\n\n可使用一卡通在校内食堂、超市、打印店消费\n支持门禁、图书借阅功能\n余额查询请到一卡通服务中心或自助机\n\n如丢失，请尽快挂失并补办。",
        "一卡通补办": "一卡通补办流程：\n\n先在系统或服务点挂失\n前往一卡通服务中心补办\n携带身份证\n一般需要支付补卡费用",
        "校园卡补办": "校园卡补办流程：\n\n先在系统或服务点挂失\n前往一卡通服务中心补办\n携带身份证\n一般需要支付补卡费用",
        "宿舍报修": "宿舍报修流程：\n\n打开校园APP或后勤系统\n提交报修申请\n填写宿舍号和问题描述\n后勤人员会安排维修\n\n紧急情况可拨打后勤服务热线。",
        "报修": "宿舍报修流程：\n\n打开校园APP或后勤系统\n提交报修申请\n填写宿舍号和问题描述\n后勤人员会安排维修",
        "空调": "宿舍空调报修：\n\n打开校园APP或后勤系统\n提交报修申请\n填写宿舍号和问题描述\n后勤人员会安排维修\n\n如遇紧急情况（如漏电）请立即报修。",
        # ── 课表考试 ──
        "课表": "您今天的课程安排如下：\n\n1️⃣ 08:00-09:40 高等数学A\n📍 教学楼A301\n\n2️⃣ 10:00-11:40 大学英语IV\n📍 教学楼B205\n\n3️⃣ 14:00-15:40 数据结构\n📍 实验楼302",
        "课程": "您当前学期必修课包括：高等数学、大学英语、数据结构、操作系统、数据库原理、离散数学、计算机网络、体育等，选修课有软件工程、人工智能导论等。",
        "考试": "近期考试安排：\n\n1. 高等数学A\n📅 6月28日 09:00-11:00\n📍 A教学楼201\n\n2. 大学英语\n📅 6月29日 14:00-16:00\n📍 B教学楼301",
        # ── 空教室 ──
        "空教室": "可在「空教室」页按楼栋查看实时空闲座位与空位率；热门时段建议优先选择空位率 70% 以上的教室。\n\n数据来源对接教务空闲教室查询（演示为模拟数据）。",
        # ── 图书馆 ──
        "图书馆": "📚 图书馆信息：\n\n🕐 开放时间：8:00-22:00\n📍 位置：校本部综合楼1-6层\n📞 咨询台：010-12345678\n\n当前座位剩余：约 120 个",
        # ── 食堂 ──
        "食堂": "🍽️ 校内食堂信息：\n\n1. 颐园\n🕐 6:30-20:00\n\n2. 喣园\n🕐 7:00-21:00\n\n3. 梅园\n🕐 7:00-20:30",
        "饭": "🍽️ 校内食堂营业时间：\n\n颐园 6:30-20:00\n喣园 7:00-21:00\n梅园 7:00-20:30\n\n现在是就餐高峰期，建议错峰前往。",
        "餐厅": "🍽️ 推荐食堂：\n\n颐园：主打大众菜，价格实惠\n喣园：品种丰富，有特色窗口\n梅园：适合快速就餐",
    }

    # 精确匹配关键词 → 模拟推理延迟 + 返回
    matched_content = None
    for kw, ans in _MOCK.items():
        if kw in msg:
            matched_content = ans
            break

    if matched_content is not None:
        # 模拟 AI 推理过程，等待 2-3 秒
        await asyncio.sleep(2.0 + random.random())
        msg_lower = msg.lower()
        if any(k in msg_lower for k in ["学分", "毕业"]):
            quick_actions = [{"type": "link", "text": "查看学分详情", "url": "/pages/score/score"}]
        elif any(k in msg_lower for k in ["成绩", "gpa", "绩点"]):
            quick_actions = [{"type": "link", "text": "查看全部成绩", "url": "/pages/score/score"}]
        elif any(k in msg_lower for k in ["课表", "课程"]):
            quick_actions = [{"type": "link", "text": "查看课表", "url": "/pages/schedule/schedule"}]
        elif any(k in msg_lower for k in ["考试", "挂科", "补考"]):
            quick_actions = [{"type": "link", "text": "查看考试安排", "url": "/pages/exam/exam"}]
        elif any(k in msg_lower for k in ["学生证"]):
            quick_actions = [{"type": "link", "text": "去学生事务中心", "url": "/pages/profile/profile"}]
        elif any(k in msg_lower for k in ["社会实践"]):
            quick_actions = [{"type": "link", "text": "查看学分详情", "url": "/pages/score/score"}]
        elif any(k in msg_lower for k in ["成绩单"]):
            quick_actions = [{"type": "link", "text": "查看全部成绩", "url": "/pages/score/score"}]
        elif any(k in msg_lower for k in ["选课"]):
            quick_actions = [{"type": "link", "text": "查看课表", "url": "/pages/schedule/schedule"}]
        elif any(k in msg_lower for k in ["奖学金"]):
            quick_actions = [{"type": "link", "text": "查看全部成绩", "url": "/pages/score/score"}]
        elif any(k in msg_lower for k in ["宿舍", "空调", "报修"]):
            quick_actions = [{"type": "link", "text": "联系后勤", "url": "/pages/profile/profile"}]
        elif any(k in msg_lower for k in ["请假", "辅导员", "审批"]):
            quick_actions = [{"type": "link", "text": "查看我的", "url": "/pages/profile/profile"}]
        elif any(k in msg_lower for k in ["一卡通", "校园卡"]):
            quick_actions = [{"type": "link", "text": "查看校园卡余额", "url": "/pages/profile/profile"}]
        elif any(k in msg_lower for k in ["空教室"]):
            quick_actions = [{"type": "link", "text": "打开空教室查询", "url": "/pages/empty-classroom/empty-classroom"}]
        else:
            quick_actions = []
        return {
            "code": 0,
            "data": {"conversationId": conv_id, "content": matched_content, "quickActions": quick_actions},
        }

    # ── 未命中，调用本地大模型 ─────────────────────────
    try:
        # 与 ai_bridge 一致：本地推理可能较慢，避免 15s 误判为失败
        async with _req.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                "http://localhost:8001/chat",
                json={
                    "question": msg,
                    "role": "student",
                    "session_id": conv_id,
                    "category_filter": None,
                },
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("answer", "").strip()
                if content:
                    return {
                        "code": 0,
                        "data": {"conversationId": conv_id, "content": content, "quickActions": []},
                    }
    except Exception as e:
        print(f"[AI] 模型调用失败: {e}")

    # 模型不可用 → 返回引导语
    content = (
        "您好！我是智校行 Smart1 智慧校园 AI 助手，可以帮您：\n\n"
        "📚 查询学分与毕业进度\n"
        "📅 查看课表与考试安排\n"
        "📊 分析成绩与 GPA\n"
        "🏫 了解校园设施与服务\n\n"
        "请问有什么可以帮您？"
    )
    return {
        "code": 0,
        "data": {"conversationId": conv_id, "content": content, "quickActions": []},
    }


# ============ Pydantic Models ============

class LoginRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    conversationId: Optional[str] = None
    message: str
    history: Optional[List[Dict[str, str]]] = []

class PublishPostRequest(BaseModel):
    content: str
    images: Optional[List[str]] = []
    tags: Optional[List[str]] = []

class PublishLostFoundRequest(BaseModel):
    type: str
    title: str
    description: str
    location: str
    images: Optional[List[str]] = []
    contact: Optional[str] = ""

class CreateDeliveryOrderRequest(BaseModel):
    address: Dict
    goods: List[Dict]
    remark: str = ""

# ============ 辅助函数 ============

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_from_header(authorization: str = None) -> dict:
    if not authorization:
        return {"user_id": "demo_user"}
    if authorization.startswith("Bearer "):
        token = authorization[7:]
        if token.startswith("mock_token_"):
            return {"user_id": token.replace("mock_token_", "")}
    return {"user_id": "demo_user"}

def verify_student_account(student_id: str, password: str) -> Optional[Dict]:
    student = _mock_students.get(student_id)
    if not student:
        return None
    if student["password"] != hash_password(password):
        return None
    return {
        "studentId": student_id,
        "name": student["name"],
        "college": student["college"],
        "major": student["major"],
        "grade": student["grade"],
        "class_name": student["class_name"],
        "avatar": ""
    }

# ============ 首页 ============

@app.get("/")
async def root():
    return {"name": "智慧校园 API", "version": "2.0.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "uptime": "running", "localIp": _get_local_ip(), "port": 8080}


@app.get("/api/system/local-ip")
async def get_local_ip():
    return {"code": 0, "data": {"ip": _get_local_ip(), "port": 8080, "baseUrl": f"http://{_get_local_ip()}:8080"}}

# ============ 认证接口 ============

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """微信一键登录 - 简化版"""
    token = f"mock_token_{request.username}_{int(datetime.now().timestamp())}"
    student = _mock_students.get(request.username)
    if student:
        name = student["name"]
    else:
        name = "新生用户"
    return {
        "code": 0,
        "message": "登录成功",
        "data": {
            "token": token,
            "userInfo": {
                "id": request.username,
                "name": name,
                "studentId": request.username,
                "college": "计算机学院",
                "major": "计算机科学与技术",
                "grade": "2023级"
            }
        }
    }

class BindAccountRequest(BaseModel):
    studentId: str
    password: str
    code: Optional[str] = None

@app.post("/api/auth/bind")
async def bind_account(request: BindAccountRequest):
    """绑定教务账号"""
    user_info = verify_student_account(request.studentId, request.password)
    if not user_info:
        return {"code": 1001, "message": "学号或密码错误"}
    return {
        "code": 0,
        "message": "绑定成功",
        "data": {
            "isBindAccount": True,
            "token": f"mock_token_{request.studentId}",
            "userInfo": user_info
        }
    }

class WechatLoginRequest(BaseModel):
    code: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    gender: Optional[str] = None

class PhoneLoginRequest(BaseModel):
    phone_code: str
    login_code: Optional[str] = None

class AnalyticsTrackRequest(BaseModel):
    action: str
    page: str
    timestamp: Optional[int] = None

# ============ AI 对话接口 ============

@app.get("/api/ai/history")
async def get_ai_history(limit: int = 20, before: Optional[str] = None):
    """获取 AI 对话历史"""
    return {
        "code": 0,
        "data": {
            "messages": [],
            "hasMore": False
        }
    }

@app.post("/api/analytics/track")
async def track_analytics(request: AnalyticsTrackRequest):
    """埋点数据收集"""
    return {"code": 0, "message": "ok"}

@app.post("/api/auth/phone-login")
async def phone_login(request: PhoneLoginRequest):
    """
    微信一键登录：
    1. 前端 wx.getPhoneNumber 返回 code（手机号授权）
    2. 前端 wx.login 返回 login_code（获取 session_key）
    3. 后端用 code 调微信 getuserphonenumber 获取真实手机号
    4. 后端用 login_code 调微信 code2Session 获取 openid
    """
    phone_code = request.phone_code
    login_code = request.login_code

    # 详细日志记录，便于排查问题
    print(f"[PhoneLogin] 收到请求: phone_code={phone_code[:20] if phone_code else None}..., login_code={login_code[:20] if login_code else None}...")

    async with _req.AsyncClient(timeout=10) as client:
        # ---------- Step 1: 用 login_code 换 openid ----------
        try:
            session_resp = await client.get(
                "https://api.weixin.qq.com/sns/jscode2session",
                params={
                    "appid": _WX_APP["app_id"],
                    "secret": _WX_APP["app_secret"],
                    "js_code": login_code,
                    "grant_type": "authorization_code"
                }
            )
            session_data = session_resp.json()
            print(f"[PhoneLogin] Step1 (jscode2session) 响应: {session_data}")
            if session_data.get("errcode"):
                return {"code": 4001, "message": f"微信登录失败: {session_data.get('errmsg', '')}"}
            openid = session_data.get("openid")
        except Exception as e:
            print(f"[PhoneLogin] Step1 异常: {str(e)}")
            return {"code": 4002, "message": f"连接微信服务器失败: {str(e)}"}

        if not openid:
            print(f"[PhoneLogin] Step1 失败: openid 为空")
            return {"code": 4003, "message": "获取用户标识失败"}

        # ---------- Step 2: 用 phone_code 换手机号 ----------
        # 先获取 access_token
        try:
            at_resp = await client.get(
                "https://api.weixin.qq.com/cgi-bin/token",
                params={
                    "grant_type": "client_credential",
                    "appid": _WX_APP["app_id"],
                    "secret": _WX_APP["app_secret"]
                }
            )
            at_data = at_resp.json()
            print(f"[PhoneLogin] Step2 (get_token) 响应: errcode={at_data.get('errcode')}, has_token={'access_token' in at_data}")
            access_token = at_data.get("access_token")
            if not access_token:
                print(f"[PhoneLogin] Step2 失败: access_token 为空, errmsg={at_data.get('errmsg')}")
                return {"code": 4004, "message": f"获取access_token失败: {at_data.get('errmsg', '')}"}
        except Exception as e:
            print(f"[PhoneLogin] Step2 异常: {str(e)}")
            return {"code": 4005, "message": f"获取access_token失败: {str(e)}"}

        # 再用 phone_code 换手机号
        try:
            phone_resp = await client.post(
                "https://api.weixin.qq.com/wxa/business/getuserphonenumber",
                params={"access_token": access_token},
                json={"code": phone_code}
            )
            phone_data = phone_resp.json()
            print(f"[PhoneLogin] Step3 (getuserphonenumber) 响应: errcode={phone_data.get('errcode')}, has_phone={'phone_info' in phone_data and 'phoneNumber' in phone_data.get('phone_info', {})}")
            if phone_data.get("errcode") == 0:
                phone_number = phone_data["phone_info"].get("phoneNumber")
            else:
                print(f"[PhoneLogin] Step3 失败: errcode={phone_data.get('errcode')}, errmsg={phone_data.get('errmsg')}")
                return {"code": 4006, "message": f"获取手机号失败: {phone_data.get('errmsg', '')}"}
        except Exception as e:
            print(f"[PhoneLogin] Step3 异常: {str(e)}")
            return {"code": 4007, "message": f"获取手机号失败: {str(e)}"}

        if not phone_number:
            return {"code": 4008, "message": "手机号为空"}

        # ---------- Step 3: 生成 Token，返回用户信息 ----------
        token = f"wx_{openid}_{int(datetime.now().timestamp())}"
        _sessions[token] = {
            "openid": openid,
            "phone": phone_number,
            "student_id": None
        }

        # 检查手机号是否已绑定教务账号
        student_id = _phone_to_student.get(phone_number)
        if student_id and student_id in _mock_students:
            stu = _mock_students[student_id]
            return {
                "code": 0,
                "data": {
                    "token": token,
                    "openid": openid,
                    "userInfo": {
                        "id": student_id,
                        "name": stu["name"],
                        "studentId": student_id,
                        "college": stu["college"],
                        "major": stu["major"],
                        "grade": stu["grade"],
                        "avatar": ""
                    },
                    "isBind": True
                }
            }

        # 新用户：手机号未绑定 → 引导绑定教务账号
        return {
            "code": 0,
            "data": {
                "token": token,
                "openid": openid,
                "userInfo": {
                    "id": f"phone_{phone_number[:7]}",
                    "name": "微信用户",
                    "phone": phone_number,
                    "studentId": "",
                    "college": "",
                    "major": "",
                    "grade": "",
                    "avatar": ""
                },
                "isBind": False
            }
        }



@app.post("/api/auth/wechat-login")
async def wechat_login(request: WechatLoginRequest):
    """微信授权登录 - 简化版，不依赖真实微信API"""
    token = f"mock_wechat_{int(datetime.now().timestamp())}"
    return {
        "code": 0,
        "data": {
            "token": token,
            "userInfo": {
                "id": f"wx_{request.code[:8]}",
                "name": request.nickname or "微信用户",
                "studentId": "",
                "college": "",
                "major": "",
                "grade": "",
                "avatar": request.avatar or ""
            },
            "needBind": True
        }
    }

@app.post("/api/auth/oauth-bind")
async def oauth_bind(code: str):
    """微信OAuth绑定"""
    token = f"mock_oauth_{int(datetime.now().timestamp())}"
    return {
        "code": 0,
        "data": {
            "token": token,
            "userInfo": {
                "id": f"oauth_{code[:8]}",
                "name": "新用户",
                "studentId": "",
                "college": "",
                "major": "",
                "grade": "",
                "avatar": ""
            }
        }
    }


# ============ 手机号验证码登录 ============
_sms_codes: Dict[str, dict] = {}  # phone -> {code, expire_time}


class SendVerifyCodeRequest(BaseModel):
    phone: str


@app.post("/api/auth/send-verify-code")
async def send_verify_code(request: SendVerifyCodeRequest):
    """
    发送手机验证码
    注意：这是演示版本，真实环境需要接入短信服务商（如阿里云、腾讯云）
    """
    phone = request.phone.strip()
    
    # 验证手机号格式
    if not phone or len(phone) != 11 or not phone.isdigit():
        return {"code": 4001, "message": "手机号格式不正确"}
    
    # 生成4位验证码
    code = str(random.randint(1000, 9999))
    
    # 存储验证码（有效期5分钟）
    import time
    _sms_codes[phone] = {
        "code": code,
        "expire_time": time.time() + 300,
        "count": _sms_codes.get(phone, {}).get("count", 0) + 1
    }
    
    print(f"[SMS] 发送验证码到 {phone}: {code}")
    
    # 真实环境：调用短信服务商 API 发送验证码
    # 这里直接返回成功，实际请接入阿里云/腾讯云短信服务
    
    return {
        "code": 0,
        "message": "验证码已发送",
        "data": {
            "expire_seconds": 300
        }
    }


class PhoneLoginSimpleRequest(BaseModel):
    phone: str
    verifyCode: str


@app.post("/api/auth/phone-login-simple")
async def phone_login_simple(request: PhoneLoginSimpleRequest):
    """
    手机号+验证码登录（简化版）
    """
    phone = request.phone.strip()
    verify_code = request.verifyCode.strip()
    
    # 验证手机号格式
    if not phone or len(phone) != 11:
        return {"code": 4001, "message": "手机号格式不正确"}
    
    # 验证验证码
    if not verify_code or len(verify_code) != 4:
        return {"code": 4002, "message": "验证码格式不正确"}
    
    # 检查验证码
    import time
    sms_record = _sms_codes.get(phone)
    
    if not sms_record:
        return {"code": 4003, "message": "验证码已过期，请重新获取"}
    
    if sms_record["expire_time"] < time.time():
        del _sms_codes[phone]
        return {"code": 4003, "message": "验证码已过期，请重新获取"}
    
    if sms_record["code"] != verify_code:
        return {"code": 4004, "message": "验证码错误"}
    
    # 验证成功后删除验证码（一次性使用）
    del _sms_codes[phone]
    
    # 生成登录 Token
    token = f"phone_{phone[-4:]}_{int(time.time())}"
    
    # 检查是否已绑定教务账号
    student_id = _phone_to_student.get(phone)
    
    if student_id and student_id in _mock_students:
        stu = _mock_students[student_id]
        _sessions[token] = {
            "phone": phone,
            "student_id": student_id,
            "login_type": "phone"
        }
        return {
            "code": 0,
            "data": {
                "token": token,
                "userInfo": {
                    "id": student_id,
                    "name": stu["name"],
                    "studentId": student_id,
                    "college": stu["college"],
                    "major": stu["major"],
                    "grade": stu["grade"],
                    "phone": phone,
                    "avatar": ""
                },
                "isBind": True
            }
        }
    
    # 新用户：手机号未绑定
    _sessions[token] = {
        "phone": phone,
        "student_id": None,
        "login_type": "phone"
    }
    
    return {
        "code": 0,
        "data": {
            "token": token,
            "userInfo": {
                "id": f"phone_{phone[-4:]}",
                "name": "新用户",
                "phone": phone,
                "studentId": "",
                "college": "",
                "major": "",
                "grade": "",
                "avatar": ""
            },
            "isBind": False
        }
    }


# ============ AI 对话接口 ============

@app.post("/api/ai/stream")
async def ai_chat_stream(request: ChatRequest):
    """
    Qwen3.5-2B 流式对话入口。
    首次调用时自动加载模型（约 30-60 秒），之后复用。
    模型文件未就绪前自动降级到规则模拟。
    """
    conversation_id = request.conversationId or f"conv_{uuid.uuid4().hex[:8]}"

    from ai_bridge import generate_ai_stream

    return StreamingResponse(
        generate_ai_stream(
            message=request.message,
            history=request.history or [],
            conversation_id=conversation_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )

@app.post("/api/ai/feedback")
async def ai_feedback(messageId: str, feedback: str):
    return {"code": 0, "message": "反馈成功"}


@app.websocket("/api/ai/stream/ws")
async def ai_chat_websocket(websocket: WebSocket):
    """
    WebSocket 端点：支持微信小程序通过 WebSocket 模拟 SSE 进行流式对话。
    客户端连接后发送 JSON 消息体，服务器逐块返回 SSE 格式数据。
    """
    await websocket.accept()

    try:
        # 接收客户端发送的请求数据
        raw = await websocket.receive_text()
        payload = json.loads(raw)

        message = payload.get("message", "")
        history = payload.get("history", [])
        conversation_id = payload.get("conversationId", f"conv_{uuid.uuid4().hex[:8]}")

        from ai_bridge import generate_ai_stream

        async for chunk in generate_ai_stream(
            message=message,
            history=history,
            conversation_id=conversation_id,
        ):
            await websocket.send_text(chunk)
            await asyncio.sleep(0)

    except json.JSONDecodeError:
        await websocket.send_text('data: {"type":"error","message":"Invalid JSON"}\n\n')
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_text(f'data: {{"type":"error","message":"{str(exc)}"}}\n\n')
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@app.get("/api/ai/hot-topics")
async def get_hot_topics():
    return {
        "code": 0,
        "data": [
            {"question": "我的学分够毕业吗？", "count": 1256},
            {"question": "图书馆几点开门？", "count": 982},
            {"question": "如何申请奖学金？", "count": 756},
            {"question": "考试安排在哪查？", "count": 634},
            {"question": "校园卡丢失怎么办？", "count": 521}
        ]
    }


@app.post("/api/ai/conversation/save")
async def save_conversation(request_data: dict = None):
    """保存对话记录"""
    return {"code": 0, "message": "保存成功"}


@app.post("/api/ai/conversation/end")
async def end_conversation(request_data: dict = None):
    """结束对话会话"""
    return {"code": 0, "message": "会话已结束"}


# ============ 课表接口 ============

# 多周课程数据：每个课程有 startWeek 和 endWeek，表示在哪些周有课
_all_courses = [
    # 第1-8周
    {"id": "1", "courseName": "高等数学A", "type": "必修", "location": "春晖学堂（主教）301", "startTime": "08:00", "endTime": "09:40", "teacher": "张教授", "dayOfWeek": 1, "startWeek": 1, "endWeek": 16},
    {"id": "2", "courseName": "大学英语IV", "type": "必修", "location": "文馨书院（二教）205", "startTime": "10:00", "endTime": "11:40", "teacher": "李老师", "dayOfWeek": 1, "startWeek": 1, "endWeek": 16},
    {"id": "3", "courseName": "数据结构", "type": "必修", "location": "逸夫楼302", "startTime": "14:00", "endTime": "15:40", "teacher": "王老师", "dayOfWeek": 1, "startWeek": 1, "endWeek": 12},
    {"id": "4", "courseName": "计算机网络", "type": "必修", "location": "春晖学堂（主教）502", "startTime": "16:00", "endTime": "17:40", "teacher": "刘老师", "dayOfWeek": 2, "startWeek": 1, "endWeek": 16},
    {"id": "5", "courseName": "操作系统", "type": "必修", "location": "逸夫楼301", "startTime": "14:00", "endTime": "15:40", "teacher": "吴老师", "dayOfWeek": 2, "startWeek": 5, "endWeek": 16},  # 第5周开始
    {"id": "6", "courseName": "人工智能导论", "type": "选修", "location": "文馨书院（二教）401", "startTime": "10:00", "endTime": "11:40", "teacher": "陈教授", "dayOfWeek": 3, "startWeek": 9, "endWeek": 16},  # 第9周开始
    {"id": "7", "courseName": "体育", "type": "必修", "location": "体育馆", "startTime": "15:00", "endTime": "16:00", "teacher": "赵老师", "dayOfWeek": 4, "startWeek": 1, "endWeek": 16},
    {"id": "8", "courseName": "数据库原理", "type": "必修", "location": "春晖学堂（主教）402", "startTime": "10:00", "endTime": "11:40", "teacher": "郑老师", "dayOfWeek": 4, "startWeek": 1, "endWeek": 12},  # 第12周结课
    {"id": "9", "courseName": "离散数学", "type": "必修", "location": "明德楼201", "startTime": "08:00", "endTime": "09:40", "teacher": "周老师", "dayOfWeek": 5, "startWeek": 1, "endWeek": 10},  # 第10周结课
    {"id": "10", "courseName": "软件工程", "type": "选修", "location": "文馨书院（二教）305", "startTime": "16:00", "endTime": "17:40", "teacher": "冯老师", "dayOfWeek": 5, "startWeek": 11, "endWeek": 16},  # 第11周开始
    {"id": "11", "courseName": "马克思主义基本原理", "type": "必修", "location": "明德楼101", "startTime": "08:00", "endTime": "09:40", "teacher": "孙老师", "dayOfWeek": 3, "startWeek": 1, "endWeek": 8},  # 第1-8周
    {"id": "12", "courseName": "中国近现代史纲要", "type": "必修", "location": "明德楼102", "startTime": "10:00", "endTime": "11:40", "teacher": "钱老师", "dayOfWeek": 2, "startWeek": 9, "endWeek": 16},  # 第9-16周接上
]

# 课程提醒存储
_schedule_reminders: Dict[str, dict] = {}


@app.get("/api/schedule/week")
async def get_week_schedule(week: int = 1):
    """获取指定周的课程，根据 startWeek 和 endWeek 筛选"""
    courses = [
        c for c in _all_courses
        if c["startWeek"] <= week <= c["endWeek"]
    ]
    # 添加当前周信息
    return {
        "code": 0,
        "data": {
            "courses": courses,
            "currentWeek": week,
            "totalWeeks": 20
        }
    }

@app.get("/api/schedule/today")
async def get_today_schedule():
    now = datetime.now()
    day_map = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}
    day_of_week = day_map.get(now.weekday(), 1)

    # 与 /api/schedule/semester-info、前端课表页保持一致：2-7 月按春季学期，其他按秋季学期。
    year = now.year
    month = now.month
    if 2 <= month <= 7:
        semester_start = datetime(year, 2, 24)
    else:
        semester_year = year if month >= 8 else year - 1
        semester_start = datetime(semester_year, 9, 1)

    current_week = max(1, min(20, ((now - semester_start).days // 7) + 1))
    today_courses = [
        c for c in _all_courses
        if c["dayOfWeek"] == day_of_week and c["startWeek"] <= current_week <= c["endWeek"]
    ]
    today_courses.sort(key=lambda c: c.get("startTime", ""))

    data = [
        {
            "courseId": c["id"],
            "courseName": c["courseName"],
            "startTime": c["startTime"],
            "endTime": c["endTime"],
            "location": c["location"],
            "teacher": c.get("teacher", ""),
            "type": c.get("type", "")
        }
        for c in today_courses
    ]
    return {"code": 0, "data": data}

@app.get("/api/schedule/semester-info")
async def get_semester_info():
    """获取学期信息"""
    today = datetime.now()
    year = today.year
    month = today.month
    if month >= 2 and month <= 7:
        semester_year = year
        semester_num = 1
        semester_start = f"{year}-02-24"
        semester_end = f"{year}-07-15"
    else:
        semester_year = year if month >= 8 else year - 1
        semester_num = 2
        semester_start = f"{semester_year}-09-01"
        semester_end = f"{semester_year}-01-20"
    
    start_date = datetime.strptime(semester_start, "%Y-%m-%d")
    diff_days = (today - start_date).days
    current_week = max(1, min(20, (diff_days // 7) + 1))
    
    return {
        "code": 0,
        "data": {
            "year": semester_year,
            "semester": semester_num,
            "startDate": semester_start,
            "endDate": semester_end,
            "currentWeek": current_week,
            "totalWeeks": 20
        }
    }

# ============ 成绩接口 ============

@app.get("/api/score/summary")
async def get_score_summary(authorization: Optional[str] = Header(None)):
    sid = parse_student_id_from_auth(authorization)
    payload = _SCORE_SUMMARY_PRIMARY if sid == PRIMARY_SCORE_STUDENT_ID else _SCORE_SUMMARY_OTHER
    return {"code": 0, "data": payload}

@app.get("/api/score/semesters")
async def get_score_semesters(authorization: Optional[str] = Header(None)):
    sid = parse_student_id_from_auth(authorization)
    payload = _SCORE_SEMESTERS_PRIMARY if sid == PRIMARY_SCORE_STUDENT_ID else _SCORE_SEMESTERS_OTHER
    return {"code": 0, "data": payload}

@app.get("/api/score/list")
async def get_score_list(semester: str = "2024-1", authorization: Optional[str] = Header(None)):
    sid = parse_student_id_from_auth(authorization)
    score_map = _pick_score_map(sid)
    raw_scores = score_map.get(semester, score_map["2024-1"])
    scores = [{**item, "semester": semester} for item in raw_scores]
    return {"code": 0, "data": scores}

# ============ 社区接口 ============

@app.get("/api/community/posts")
async def get_community_posts(category: str = "all", page: int = 1, limit: int = 10):
    filtered = [p for p in _community_posts if _community_match_category(p, category)]
    start = max(0, (page - 1) * limit)
    end = start + limit
    return {
        "code": 0,
        "data": {
            "list": filtered[start:end],
            "hasMore": end < len(filtered)
        }
    }

@app.post("/api/community/posts")
async def create_post(request: PublishPostRequest):
    post_id = str(uuid.uuid4())
    ai_tags = await recognize_ai_tags(request.content)
    new_post = {
        "id": post_id,
        "nickname": "当前用户",
        "avatar": "/assets/icons/default-avatar.png",
        "timeAgo": "刚刚",
        "content": request.content,
        "images": request.images or [],
        "tags": request.tags or [],
        "likes": 0,
        "comments": 0,
        "liked": False,
        "aiTags": ai_tags
    }
    _community_posts.insert(0, new_post)
    return {"code": 0, "data": {"id": post_id, "aiTags": ai_tags}}

class LikeRequest(BaseModel):
    postId: str
    action: str

@app.post("/api/community/like")
async def toggle_like(request: LikeRequest):
    return {"code": 0, "message": "操作成功"}

async def recognize_ai_tags(content: str) -> List[str]:
    await asyncio.sleep(0.1)
    tags = []
    keyword_map = {"丢失": "#寻物启事", "捡到": "#失物招领", "美食": "#美食推荐", "图书馆": "#学习相关", "跑": "#运动约伴", "兼职": "#校园兼职"}
    for keyword, tag in keyword_map.items():
        if keyword in content:
            tags.append(tag)
    return tags[:2]

# ============ SQLite 数据库连接 ============

def get_db_connection():
    """获取数据库连接"""
    # 使用项目内相对路径，避免写死盘符导致无法打开数据库
    base_dir = pathlib.Path(__file__).resolve().parent
    db_path = base_dir / "data" / "tmall_products.db"
    if not db_path.exists():
        raise FileNotFoundError(f"数据库文件不存在: {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db():
    """上下文管理器"""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

# ============ 商城接口 ============
# 库内 category 多为空，按标题推导分类（杯壶/饮料/糕点/坚果/零食）
# 杯壶规则不宜过宽（避免「大容量」等把零食误判为杯具），零食 tab 以真零食为主
_SHOP_DERIVED_CAT = """CASE
  WHEN (title LIKE '%水杯%' OR title LIKE '%玻璃杯%' OR title LIKE '%保温杯%' OR title LIKE '%茶杯%' OR title LIKE '%马克杯%' OR title LIKE '%tritan%' OR title LIKE '%水壶%' OR title LIKE '%吸管杯%' OR title LIKE '%刻度杯%' OR title LIKE '%泡茶杯%' OR title LIKE '%咖啡杯%' OR title LIKE '%便携杯%' OR title LIKE '%随行杯%' OR title LIKE '%塑料杯%' OR title LIKE '%1000ml%' OR (title LIKE '%无印%' AND title LIKE '%杯%')) THEN '杯壶'
  WHEN (title LIKE '%零食%' OR title LIKE '%薯片%' OR title LIKE '%辣条%' OR title LIKE '%凤爪%' OR title LIKE '%豆干%' OR title LIKE '%海苔%' OR title LIKE '%肉脯%' OR title LIKE '%牛肉干%' OR title LIKE '%鸭脖%' OR title LIKE '%巧克力%' OR title LIKE '%糖果%' OR title LIKE '%果冻%' OR title LIKE '%蜜饯%' OR title LIKE '%话梅%' OR title LIKE '%山楂%' OR title LIKE '%锅巴%' OR title LIKE '%干脆面%' OR title LIKE '%螺蛳粉%' OR title LIKE '%方便面%') THEN '零食'
  WHEN (title LIKE '%糕点%' OR title LIKE '%面包%' OR title LIKE '%蛋糕%' OR title LIKE '%饼干%') THEN '糕点'
  WHEN (title LIKE '%坚果%' OR title LIKE '%夏威夷果%' OR title LIKE '%腰果%' OR title LIKE '%核桃%' OR title LIKE '%巴旦木%') THEN '坚果'
  WHEN (
    title LIKE '%饮料%' OR title LIKE '%奶茶%' OR title LIKE '%酸奶%' OR title LIKE '%果汁%' OR
    title LIKE '%可乐%' OR title LIKE '%汽水%' OR title LIKE '%茶饮%' OR title LIKE '%矿泉水%' OR
    title LIKE '%苏打水%' OR title LIKE '%咖啡%' OR title LIKE '%ml%' OR title LIKE '%瓶%' OR title LIKE '%罐%'
  ) AND (
    title NOT LIKE '%巧克力%' AND title NOT LIKE '%饼干%' AND title NOT LIKE '%蛋糕%' AND
    title NOT LIKE '%糖果%' AND title NOT LIKE '%牛乳黑%' AND title NOT LIKE '%牛奶味%'
  ) THEN '饮料'
  ELSE '零食'
END"""

_SHOP_ORDER_VARIETY = """((id * 7919) % 500000),
                  (ABS(CAST(price * 100 AS INTEGER)) % 997),
                  sold_count DESC,
                  id ASC"""


def _row_val(row, key: str, default=None):
    """兼容 sqlite3.Row 和 dict 的取值"""
    if isinstance(row, dict):
        return row.get(key, default)
    return row[key] if key in row.keys() else default


def _shop_image_url(row, dcat: str) -> str:
    """返回商品图片 URL：优先 main_pic，其次 pics[0]，最后用分类占位图"""
    main_pic = _row_val(row, "main_pic") or ""
    pics_raw = _row_val(row, "pics", "[]") or "[]"
    import json as _json
    pics_list = []
    try:
        pics_list = _json.loads(pics_raw)
    except Exception:
        pass
    if main_pic and main_pic.strip():
        return main_pic.strip()
    if pics_list and len(pics_list) > 0:
        return pics_list[0]
    # 分类占位图
    cat_map = {"杯壶": "cups", "饮料": "drinks", "糕点": "cake", "坚果": "nuts"}
    filename = cat_map.get(dcat, "snacks")
    return f"/assets/products/{filename}.png"


def _shop_format_product_row(row) -> dict:
    price_f = float(_row_val(row, "price") or 0)
    orig = _row_val(row, "original_price")
    orig_f = float(orig) if orig not in (None, "") else 0.0
    discount = 0
    if orig_f > 0:
        discount = round(price_f / orig_f * 10, 1)
    show_orig = orig_f > price_f * 1.005
    dcat = _row_val(row, "dcat", "零食")
    raw_short = _row_val(row, "short_title") or ""
    if not raw_short.strip():
        raw_short = (_row_val(row, "title") or "")[:18]
    import json as _json
    pics_raw = _row_val(row, "pics", "[]") or "[]"
    pics_list = []
    try:
        pics_list = _json.loads(pics_raw)
    except Exception:
        pass
    return {
        "id": str(_row_val(row, "id")),
        "name": raw_short,
        "fullName": _row_val(row, "title") or "",
        "description": _row_val(row, "title") or "",
        "price": f"{price_f:.2f}",
        "originalPrice": f"{orig_f:.2f}" if show_orig else f"{price_f:.2f}",
        "image": _shop_image_url(row, dcat),
        "images": pics_list if pics_list else [_shop_image_url(row, dcat)],
        "tag": (_row_val(row, "tags") or "").split(",")[0] if _row_val(row, "tags") else "",
        "sales": _row_val(row, "sold_count") or 0,
        "commentCount": _row_val(row, "comment_count") or 0,
        "category": dcat,
        "shopName": _row_val(row, "shop_name") or "",
        "location": _row_val(row, "location") or "",
        "stock": random.randint(50, 500),
        "discount": discount if (show_orig and discount > 0 and discount < 10) else 10,
        "isTmall": bool(_row_val(row, "is_tmall")),
        "detailUrl": _row_val(row, "detail_url") or "",
    }


@app.get("/api/shop/products")
async def get_products(category: str = "all", keyword: str = "", page: int = 1, limit: int = 20):
    """获取商品列表，从真实数据库读取"""
    try:
        with get_db() as conn:
            where = "WHERE 1=1"
            params: list = []

            if category and category != "all":
                where += f" AND ({_SHOP_DERIVED_CAT}) = ?"
                params.append(category)

            if keyword:
                where += " AND (title LIKE ? OR short_title LIKE ? OR shop_name LIKE ?)"
                params.extend([f"%{keyword}%", f"%{keyword}%", f"%{keyword}%"])

            count_sql = f"SELECT COUNT(*) FROM products {where}"
            total = conn.execute(count_sql, params).fetchone()[0]

            order_tail = f"ORDER BY {_SHOP_ORDER_VARIETY}"
            if category == "all":
                order_tail = f"""ORDER BY CASE WHEN ({_SHOP_DERIVED_CAT}) = '零食' THEN 0 ELSE 1 END,
                  {_SHOP_ORDER_VARIETY}"""

            rows = []
            if category == "all" and not keyword.strip():
                # 「全部」每页约 90% 零食 + 10% 非零食，避免一屏全是杯壶
                n_snack = max(1, int(round(limit * 0.9)))
                n_other = limit - n_snack
                off_s = (page - 1) * n_snack
                off_o = (page - 1) * n_other
                sql_s = f"""SELECT *, ({_SHOP_DERIVED_CAT}) AS dcat FROM products {where}
                  AND ({_SHOP_DERIVED_CAT}) = '零食'
                  ORDER BY {_SHOP_ORDER_VARIETY} LIMIT ? OFFSET ?"""
                sql_o = f"""SELECT *, ({_SHOP_DERIVED_CAT}) AS dcat FROM products {where}
                  AND ({_SHOP_DERIVED_CAT}) != '零食'
                  ORDER BY {_SHOP_ORDER_VARIETY} LIMIT ? OFFSET ?"""
                cur_s = conn.execute(sql_s, [*params, n_snack, off_s])
                cur_o = conn.execute(sql_o, [*params, n_other, off_o])
                rows = list(cur_s.fetchall()) + list(cur_o.fetchall())
                ts = conn.execute(
                    f"SELECT COUNT(*) FROM products {where} AND ({_SHOP_DERIVED_CAT}) = '零食'",
                    params,
                ).fetchone()[0]
                to = conn.execute(
                    f"SELECT COUNT(*) FROM products {where} AND ({_SHOP_DERIVED_CAT}) != '零食'",
                    params,
                ).fetchone()[0]
                has_more = (off_s + n_snack < ts) or (off_o + n_other < to)
            else:
                offset = (page - 1) * limit
                sql = f"""SELECT *, ({_SHOP_DERIVED_CAT}) AS dcat FROM products {where}
                  {order_tail} LIMIT ? OFFSET ?"""
                cur = conn.execute(sql, [*params, limit, offset])
                rows = cur.fetchall()
                has_more = offset + limit < total

            products = [_shop_format_product_row(row) for row in rows]

            return {
                "code": 0,
                "data": {
                    "list": products,
                    "hasMore": has_more,
                    "total": total,
                    "page": page,
                    "limit": limit,
                },
            }
    except Exception as e:
        print(f"获取商品失败: {e}")
        # 失败时返回模拟数据
        return {
            "code": 0,
            "data": {
                "list": _products[:limit],
                "hasMore": limit < len(_products),
                "total": len(_products),
                "page": page,
                "limit": limit
            }
        }

@app.get("/api/shop/product/{product_id}")
async def get_product_detail(product_id: int):
    """获取商品详情"""
    try:
        with get_db() as conn:
            cursor = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,))
            row = cursor.fetchone()
            
            if not row:
                return {"code": 1, "message": "商品不存在"}

            dcur = conn.execute(
                f"SELECT ({_SHOP_DERIVED_CAT}) AS dcat FROM products WHERE id = ?",
                (product_id,),
            )
            dcat = dcur.fetchone()["dcat"]

            cursor = conn.execute(
                f"""SELECT * FROM products WHERE id != ? AND ({_SHOP_DERIVED_CAT}) = ?
                ORDER BY RANDOM() LIMIT 6""",
                (product_id, dcat),
            )
            similar_rows = cursor.fetchall()
            
            similar_products = []
            for r in similar_rows:
                r_short = r['short_title'] if r['short_title'] else r['title'][:18]
                similar_products.append({
                    "id": str(r['id']),
                    "name": r_short,
                    "price": f"{float(r['price']):.2f}",
                    "image": _shop_image_url(dict(r), dcat)
                })

            price_f = float(row['price'] or 0)
            orig = row['original_price']
            orig_f = float(orig) if orig not in (None, "") else 0.0
            discount = 0
            if orig_f > 0:
                discount = round(price_f / orig_f * 10, 1)
            show_orig = orig_f > price_f * 1.005
            row_d = dict(row)
            row_short = row_d.get('short_title') or ""
            if not row_short.strip():
                row_short = (row_d.get('title') or "")[:18]

            return {
                "code": 0,
                "data": {
                    "id": str(row['id']),
                    "name": row_short,
                    "fullName": row['title'] or "",
                    "description": row['title'] or "",
                    "price": f"{price_f:.2f}",
                    "originalPrice": f"{orig_f:.2f}" if show_orig else f"{price_f:.2f}",
                    "image": _shop_image_url(row_d, dcat),
                    "images": row_d.get('pics', '[]') and json.loads(row_d.get('pics', '[]')) or [_shop_image_url(row_d, dcat)],
                    "sales": row['sold_count'] or 0,
                    "commentCount": row['comment_count'] or 0,
                    "category": dcat,
                    "shopName": row['shop_name'] or "",
                    "location": row['location'] or "",
                    "stock": random.randint(50, 500),
                    "discount": discount if (show_orig and discount > 0 and discount < 10) else 10,
                    "isTmall": bool(row['is_tmall']),
                    "tags": row['tags'].split(',') if row['tags'] else [],
                    "attrs": json.loads(row['attrs']) if row['attrs'] else {},
                    "similarProducts": similar_products
                }
            }
    except Exception as e:
        print(f"获取商品详情失败: {e}")
        return {"code": 1, "message": "获取失败"}

@app.get("/api/shop/categories")
async def get_categories():
    """获取商品分类（与列表同一套标题推导分类）"""
    try:
        with get_db() as conn:
            total_row = conn.execute("SELECT COUNT(*) FROM products").fetchone()
            total_all = total_row[0] if total_row else 0

            cursor = conn.execute(
                f"""
                SELECT dcat AS cat, COUNT(*) AS count FROM (
                    SELECT ({_SHOP_DERIVED_CAT}) AS dcat FROM products
                ) GROUP BY dcat ORDER BY count DESC
                """
            )
            rows = cursor.fetchall()

            order = ["零食", "杯壶", "饮料", "糕点", "坚果"]
            by_name = {row["cat"]: row["count"] for row in rows if row["cat"]}
            categories = [{"name": "全部", "id": "all", "count": total_all}]
            for name in order:
                if name in by_name:
                    categories.append({"name": name, "id": name, "count": by_name[name]})
            for row in rows:
                c = row["cat"]
                if c and c not in order:
                    categories.append({"name": c, "id": c, "count": row["count"]})

            return {"code": 0, "data": categories}
    except Exception as e:
        print(f"获取分类失败: {e}")
        return {"code": 0, "data": [
            {"name": "全部", "id": "all", "count": 1131},
            {"name": "零食", "id": "零食", "count": 500},
            {"name": "饮料", "id": "饮料", "count": 200},
            {"name": "糕点", "id": "糕点", "count": 200},
            {"name": "坚果", "id": "坚果", "count": 231}
        ]}

@app.post("/api/shop/create-order")
async def create_order(request: CreateDeliveryOrderRequest):
    """创建商城订单"""
    ts = int(datetime.now().timestamp() * 1000)
    order_id = f"shop_{ts}"
    order_no = f"DD{datetime.now().strftime('%Y%m%d%H%M%S')}"
    total_price = sum(float(g["price"]) * g["count"] for g in request.goods)
    new_order = {
        "id": order_id,
        "orderNo": order_no,
        "shopName": "天猫超市",
        "shopIcon": "",
        "status": "pending",
        "createTime": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "totalPrice": f"{total_price:.2f}",
        "products": request.goods,
        "address": request.address,
    }
    _mock_orders.insert(0, new_order)
    return {
        "code": 0,
        "data": {
            "orderId": order_id,
            "orderNo": order_no,
            "payment": {
                "timeStamp": str(int(datetime.now().timestamp())),
                "nonceStr": uuid.uuid4().hex[:16],
                "package": f"prepay_id={order_id}",
                "signType": "MD5",
                "paySign": "mock_sign"
            }
        }
    }

# ============ 寻物接口 ============

@app.get("/api/lost-found/list")
async def get_lost_found_list(type: str = "lost", page: int = 1, limit: int = 10):
    # 小程序详情页会传 type=all 拉全量再找 id；须支持，否则列表为空导致详情空白
    tnorm = (type or "lost").strip().lower()
    if tnorm in ("all", "any"):
        filtered = list(_lost_found_items)
        matched_ids = {i["id"] for i in _lf_build_matches("lost")} | {
            i["id"] for i in _lf_build_matches("found")
        }
    else:
        filtered = [i for i in _lost_found_items if i["type"] == type]
        matched_ids = {i["id"] for i in _lf_build_matches(type)}
    decorated = []
    for item in filtered:
        row = dict(item)
        row["isMatch"] = row["id"] in matched_ids
        decorated.append(row)
    start = (page - 1) * limit
    end = start + limit
    return {
        "code": 0,
        "data": {
            "list": decorated[start:end],
            "hasMore": end < len(filtered),
            "lostCount": len([i for i in _lost_found_items if i["type"] == "lost"]),
            "foundCount": len([i for i in _lost_found_items if i["type"] == "found"])
        }
    }

@app.post("/api/lost-found/publish")
async def publish_lost_found(request: PublishLostFoundRequest):
    item_id = str(uuid.uuid4())
    new_item = {
        "id": item_id,
        "type": request.type,
        "title": request.title,
        "description": request.description,
        "location": request.location,
        "images": request.images or [],
        "timeAgo": "刚刚",
        "lostTime": "今天",
        "views": 0,
        "comments": 0,
        "nickname": "当前用户",
        "avatar": "",
        "isMatch": False,
        "contact": request.contact or ""
    }
    _lost_found_items.insert(0, new_item)
    return {"code": 0, "data": {"id": item_id}}

@app.get("/api/lost-found/matches")
async def get_lost_found_matches(type: str = "lost"):
    matches = _lf_build_matches(type)
    return {
        "code": 0,
        "data": {
            "hasMatch": len(matches) > 0,
            "count": len(matches),
            "list": matches
        }
    }

# ============ 配送接口 ============

@app.get("/api/delivery/available-orders")
async def get_available_orders():
    return {"code": 0, "data": _delivery_orders[:15]}


@app.get("/api/delivery/quick-goods")
async def get_delivery_quick_goods():
    """
    校园配送页快捷商品，从数据库读取销量最高的 6 个零食/饮料/杯壶商品。
    """
    try:
        with get_db() as conn:
            cursor = conn.execute(
                f"""SELECT *, ({_SHOP_DERIVED_CAT}) AS dcat
                FROM products
                WHERE ({_SHOP_DERIVED_CAT}) IN ('零食', '饮料', '杯壶')
                ORDER BY sold_count DESC, id DESC
                LIMIT 6"""
            )
            rows = cursor.fetchall()
        goods = [_shop_format_product_row(dict(r)) for r in rows]
        return {"code": 0, "data": goods}
    except Exception as e:
        print(f"[delivery/quick-goods] error: {e}")
        return {"code": 0, "data": []}

@app.post("/api/delivery/apply-rider")
async def apply_rider():
    rider_id = f"rider_{int(datetime.now().timestamp())}"
    _rider认证[rider_id] = {"status": "pending", "certified": False}
    return {"code": 0, "data": {"riderId": rider_id, "status": "pending"}}

@app.get("/api/delivery/rider-status")
async def get_rider_status():
    return {"code": 0, "data": {"certified": True, "status": "approved", "todayOrders": 5, "todayEarning": "38.50", "rating": "4.9"}}

@app.post("/api/delivery/accept")
async def accept_order(orderId: str):
    return {"code": 0, "message": "接单成功"}

# ============ 空教室接口 ============

@app.get("/api/classroom/heatmap")
async def get_classroom_heatmap():
    return {"code": 0, "data": _empty_classrooms}

@app.get("/api/classroom/available")
async def get_available_classrooms(building: str = ""):
    if building:
        filtered = [c for c in _empty_classrooms if building in c["name"]]
    else:
        filtered = _empty_classrooms
    return {"code": 0, "data": filtered}

# ============ 用户接口 ============

@app.get("/api/user/stats")
async def get_user_stats(authorization: Optional[str] = Header(None)):
    sid = parse_student_id_from_auth(authorization)
    if sid == PRIMARY_SCORE_STUDENT_ID:
        return {"code": 0, "data": {"credits": 92, "gpa": "3.72", "rank": "前15%"}}
    return {"code": 0, "data": {"credits": 73, "gpa": "3.29", "rank": "约前38%"}}

@app.get("/api/order/counts")
async def get_order_counts():
    counts = {"pending": 0, "paid": 0, "delivering": 0, "delivered": 0, "completed": 0, "cancelled": 0}
    for o in _mock_orders:
        status = o.get("status", "pending")
        if status in counts:
            counts[status] += 1
        else:
            counts["pending"] += 1
    return {"code": 0, "data": counts}

# ============ 课表提醒接口 ============

class ScheduleReminderRequest(BaseModel):
    courseId: str
    courseName: str
    courseTime: str
    location: str = ""
    remindBefore: int = 15

@app.post("/api/schedule/reminder")
async def set_schedule_reminder(request: ScheduleReminderRequest):
    """设置课程提醒"""
    reminder_id = f"rem_{request.courseId}_{int(datetime.now().timestamp())}"
    _schedule_reminders[reminder_id] = {
        "courseId": request.courseId,
        "courseName": request.courseName,
        "courseTime": request.courseTime,
        "location": request.location,
        "remindBefore": request.remindBefore,
        "enabled": True,
        "createdAt": datetime.now().isoformat()
    }
    print(f"[Reminder] 设置提醒成功: {request.courseName} at {request.courseTime}")
    return {"code": 0, "data": {"id": reminder_id, "enabled": True}, "message": "提醒设置成功"}

class CancelReminderRequest(BaseModel):
    courseId: str

@app.post("/api/schedule/reminder/cancel")
async def cancel_schedule_reminder(request: CancelReminderRequest):
    """取消课程提醒"""
    # 查找并删除对应的提醒
    keys_to_delete = [k for k, v in _schedule_reminders.items() if v["courseId"] == request.courseId]
    for key in keys_to_delete:
        del _schedule_reminders[key]
    print(f"[Reminder] 取消提醒成功: courseId={request.courseId}")
    return {"code": 0, "message": "已取消提醒"}

# ============ 考试安排接口 ============

_mock_exams = [
    {"id": "1", "courseName": "高等数学A", "examDate": "2026-04-15", "examTime": "09:00-11:00", "location": "春晖学堂（主教）301", "examType": "闭卷", "credits": 5, "status": "upcoming"},
    {"id": "2", "courseName": "大学英语IV", "examDate": "2026-04-18", "examTime": "14:00-16:00", "location": "文馨书院（二教）205", "examType": "闭卷", "credits": 3, "status": "upcoming"},
    {"id": "3", "courseName": "数据结构", "examDate": "2026-04-20", "examTime": "09:00-11:00", "location": "逸夫楼302", "examType": "闭卷+上机", "credits": 4, "status": "upcoming"},
    {"id": "4", "courseName": "计算机网络", "examDate": "2026-04-25", "examTime": "14:00-16:00", "location": "春晖学堂（主教）502", "examType": "闭卷", "credits": 3, "status": "upcoming"},
    {"id": "5", "courseName": "操作系统", "examDate": "2026-05-10", "examTime": "09:00-11:00", "location": "逸夫楼301", "examType": "闭卷+上机", "credits": 4, "status": "upcoming"},
    {"id": "6", "courseName": "数据库原理", "examDate": "2026-05-15", "examTime": "14:00-16:00", "location": "春晖学堂（主教）402", "examType": "闭卷", "credits": 3, "status": "upcoming"},
    {"id": "7", "courseName": "人工智能导论", "examDate": "2026-05-20", "examTime": "09:00-11:00", "location": "文馨书院（二教）401", "examType": "开卷", "credits": 2, "status": "upcoming"},
    {"id": "8", "courseName": "软件工程", "examDate": "2026-05-25", "examTime": "14:00-16:00", "location": "文馨书院（二教）305", "examType": "闭卷", "credits": 2, "status": "upcoming"},
    {"id": "9", "courseName": "离散数学", "examDate": "2026-03-15", "examTime": "09:00-11:00", "location": "明德楼201", "examType": "闭卷", "credits": 3, "status": "completed"},
    {"id": "10", "courseName": "体育", "examDate": "2026-03-20", "examTime": "14:00-16:00", "location": "体育馆", "examType": "实践", "credits": 1, "status": "completed"},
]

@app.get("/api/exam/list")
async def get_exam_list():
    """获取考试安排列表"""
    return {"code": 0, "data": {"exams": _mock_exams}}

# ============ 订单接口 ============

@app.get("/api/order/list")
async def get_order_list(status: str = "pending", page: int = 1, limit: int = 10):
    filtered = _mock_orders[:]
    if status != "all":
        filtered = [o for o in filtered if o["status"] == status]
    # 按创建时间倒序
    start = (page - 1) * limit
    end = start + limit
    page_orders = filtered[start:end]
    return {
        "code": 0,
        "data": {
            "list": page_orders,
            "total": len(filtered),
            "page": page,
            "limit": limit,
            "hasMore": end < len(filtered)
        }
    }


class ReorderRequest(BaseModel):
    orderId: str

@app.post("/api/order/reorder")
async def reorder(request: ReorderRequest):
    """再来一单：基于原订单商品从数据库生成新订单"""
    original_order = None
    for order in _mock_orders:
        if order.get("id") == request.orderId or order.get("orderNo") == request.orderId:
            original_order = order
            break
    
    products = []
    total_price = 0.0
    try:
        with get_db() as conn:
            if original_order:
                # 尝试从原订单商品ID找到真实商品
                for p in original_order.get("products", []):
                    row = conn.execute(
                        "SELECT * FROM products WHERE id = ?",
                        (int(p.get("id", 0)),)
                    ).fetchone()
                    if row:
                        products.append({
                            "id": str(row['id']),
                            "name": row['short_title'] if row['short_title'] else row['title'][:20],
                            "price": str(row['price']),
                            "count": p.get("count", 1),
                            "image": row['main_pic'],
                            "spec": p.get("spec", "默认")
                        })
                        total_price += float(row['price']) * p.get("count", 1)
                
                if not products:
                    # 原订单商品不在库里，随机取商品
                    rows = conn.execute("SELECT * FROM products ORDER BY RANDOM() LIMIT 2").fetchall()
                    for row in rows:
                        products.append({
                            "id": str(row['id']),
                            "name": row['short_title'] if row['short_title'] else row['title'][:20],
                            "price": str(row['price']),
                            "count": 1,
                            "image": row['main_pic'],
                            "spec": "默认"
                        })
                        total_price += float(row['price'])
            else:
                # 无原订单，随机取商品
                rows = conn.execute("SELECT * FROM products ORDER BY RANDOM() LIMIT 2").fetchall()
                for row in rows:
                    products.append({
                        "id": str(row['id']),
                        "name": row['short_title'] if row['short_title'] else row['title'][:20],
                        "price": str(row['price']),
                        "count": 1,
                        "image": row['main_pic'],
                        "spec": "默认"
                    })
                    total_price += float(row['price'])
    except Exception:
        # 兜底：随机模拟商品
        import random as _r
        mock_prods = [
            {"id": "101", "name": "薯片组合装", "price": "9.90", "count": 1, "image": "", "spec": "默认"},
            {"id": "102", "name": "蒙牛纯牛奶", "price": "48.00", "count": 1, "image": "", "spec": "250ml*24盒"},
        ]
        products = mock_prods
        total_price = 9.90

    new_order_id = f"order_{int(datetime.now().timestamp())}"
    new_order_no = f"DD{datetime.now().strftime('%Y%m%d%H%M%S')}"
    shop_name = original_order.get("shopName", "天猫超市") if original_order else "天猫超市"

    new_order = {
        "id": new_order_id,
        "orderNo": new_order_no,
        "shopName": shop_name,
        "status": "pending",
        "createTime": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "totalPrice": f"{total_price:.2f}",
        "products": products,
        "address": "校内配送地址"
    }

    _mock_orders.insert(0, new_order)

    return {
        "code": 0,
        "data": {
            "orderId": new_order_id,
            "orderNo": new_order_no
        }
    }


# 评价存储
_order_reviews: Dict[str, dict] = {}


class OrderReviewRequest(BaseModel):
    orderId: str
    rating: int = 5
    content: str = ""
    tags: List[str] = []
    anonymous: bool = False
    images: List[str] = []
    deliveryRating: int = 5
    serviceRating: int = 5


@app.post("/api/order/review")
async def submit_order_review(request: OrderReviewRequest):
    """提交订单评价"""
    review_id = f"review_{int(datetime.now().timestamp())}"
    
    review = {
        "id": review_id,
        "orderId": request.orderId,
        "rating": request.rating,
        "content": request.content,
        "tags": request.tags,
        "anonymous": request.anonymous,
        "images": request.images,
        "deliveryRating": request.deliveryRating,
        "serviceRating": request.serviceRating,
        "createTime": datetime.now().isoformat(),
        "status": "published"
    }
    
    _order_reviews[review_id] = review
    
    print(f"[Review] 新评价: orderId={request.orderId}, rating={request.rating}")
    
    return {
        "code": 0,
        "data": {
            "reviewId": review_id,
            "message": "评价成功"
        }
    }

# ============ 微信小程序配置（用于一键登录）============
_WX_APP = {
    "app_id": "wxbf7b85474c671c42",
    "app_secret": "030599d3af24153693ad32ee532d86b4",
}

# ============ 微信支付配置（请替换为真实参数）============
# 登录微信商户平台 https://pay.weixin.qq.com 获取以下信息
_WX_PAY = {
    "app_id": "wxxxxxxxxxxxxxxxxx",          # 小程序 appId
    "mch_id": "1234567890",                  # 商户号
    "api_key": "xxxxxxxxxxxxxxxxxxxxxxxx",  # 商户API密钥（32位）
    "notify_url": "http://your-domain.com/api/pay/notify",  # 支付结果通知地址
    "cert_path": "",                         # 商户证书路径（退款时需要）
}

def _gen_nonce_str(length=32):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))

def _make_pay_sign(app_id, nonce_str, prepay_id, time_stamp, sign_type="MD5"):
    """生成微信支付签名"""
    key = _WX_PAY["api_key"]
    sign_str = f"appid={app_id}&nonceStr={nonce_str}&package=prepay_id={prepay_id}&signType={sign_type}&timeStamp={time_stamp}&key={key}"
    if sign_type == "MD5":
        return hashlib.md5(sign_str.encode()).hexdigest().upper()
    else:
        return hashlib.sha256(sign_str.encode()).hexdigest().upper()

def _get_prepay_id(order_no, total_fee, description, openid):
    """
    调微信统一下单API获取 prepay_id。
    在此处替换为真实的微信支付 API 调用。
    当前返回模拟数据，仅供 UI 调试。
    """
    try:
        import httpx as _req
        time_stamp = str(int(time_module.time()))
        nonce_str = _gen_nonce_str()

        # 真实调用微信统一下单接口
        url = "https://api.mch.weixin.qq.com/pay/unifiedorder"
        trade_type = "JSAPI"
        sign_str = (
            f"appid={_WX_PAY['app_id']}&body={description[:64]}"
            f"&mch_id={_WX_PAY['mch_id']}&nonce_str={nonce_str}"
            f"&notify_url={_WX_PAY['notify_url']}&openid={openid}"
            f"&out_trade_no={order_no}&total_fee={int(total_fee)}"
            f"&trade_type={trade_type}&key={_WX_PAY['api_key']}"
        )
        sign = hashlib.md5(sign_str.encode()).hexdigest().upper()

        payload = {
            "appid": _WX_PAY["app_id"],
            "mch_id": _WX_PAY["mch_id"],
            "nonce_str": nonce_str,
            "sign": sign,
            "body": description[:64],
            "out_trade_no": order_no,
            "total_fee": int(total_fee),
            "trade_type": trade_type,
            "openid": openid,
            "notify_url": _WX_PAY["notify_url"],
        }
        resp = httpx.post(url, json=payload, timeout=10)
        result = resp.json()
        if result.get("prepay_id"):
            return result["prepay_id"], time_stamp
    except Exception:
        pass

    # 模拟 prepay_id（真实环境请去掉这段）
    return f"mock_prepay_{order_no}", str(int(time_module.time()))

# ============ 订单数据存储（内存）============

def _generate_db_orders():
    """从商品库生成演示订单数据，商品信息来自真实数据库"""
    orders = []
    try:
        with get_db() as conn:
            # 随机取几条商品做订单
            rows = conn.execute(
                "SELECT * FROM products ORDER BY RANDOM() LIMIT 8"
            ).fetchall()
            
            statuses = ["pending", "pending", "delivering", "delivered", "completed"]
            shop_names = ["天猫超市", "天猫国际", "天猫旗舰店"]
            
            for i, row in enumerate(rows):
                if i % 3 == 0 and i > 0 and i < len(rows):
                    # 合并相邻商品成一个订单
                    continue
                status = statuses[i % len(statuses)]
                create_days_ago = (i % 5)
                create_time = (datetime.now() - timedelta(days=create_days_ago)).strftime("%Y-%m-%d %H:%M")
                
                # 随机选1-3个商品组成订单
                product_rows = conn.execute(
                    "SELECT * FROM products WHERE id != ? ORDER BY RANDOM() LIMIT ?",
                    (row['id'], random.randint(1, 2))
                ).fetchall()
                all_rows = [row] + list(product_rows)
                
                products = []
                total = 0.0
                for pr in all_rows:
                    p_price = float(pr['price'])
                    p_count = random.randint(1, 3)
                    products.append({
                        "id": str(pr['id']),
                        "name": pr['short_title'] if pr['short_title'] else pr['title'][:20],
                        "price": str(pr['price']),
                        "count": p_count,
                        "image": pr['main_pic'],
                        "spec": "默认"
                    })
                    total += p_price * p_count
                
                order_id = f"db_order_{row['id']}_{int(datetime.now().timestamp())}"
                orders.append({
                    "id": order_id,
                    "orderNo": f"DD{datetime.now().strftime('%Y%m%d')}{str(i+1).zfill(4)}",
                    "shopName": shop_names[i % len(shop_names)],
                    "shopIcon": "",
                    "status": status,
                    "createTime": create_time,
                    "totalPrice": f"{total:.2f}",
                    "products": products
                })
    except Exception as e:
        print(f"未加载真实商品库，改用内置演示订单: {e}")
        orders = _fallback_mock_orders
    
    if not orders:
        orders = _fallback_mock_orders
    return orders

_fallback_mock_orders = [
    {"id": "1", "orderNo": "DD20260401001", "shopName": "天猫超市", "shopIcon": "", "status": "pending", "createTime": "2026-04-01 10:30", "totalPrice": "45.80",
     "products": [{"id": "1", "name": "农夫山泉550ml", "price": "2.00", "count": 2, "image": "", "spec": "默认"}, {"id": "2", "name": "奥利奥夹心饼干", "price": "12.80", "count": 1, "image": "", "spec": "巧克力味"}]},
    {"id": "2", "orderNo": "DD20260401002", "shopName": "天猫超市", "shopIcon": "", "status": "pending", "createTime": "2026-04-01 09:15", "totalPrice": "28.50",
     "products": [{"id": "3", "name": "可乐330ml", "price": "3.00", "count": 2, "image": "", "spec": "默认"}]},
    {"id": "3", "orderNo": "DD20260331003", "shopName": "天猫超市", "shopIcon": "", "status": "delivering", "createTime": "2026-03-31 14:20", "totalPrice": "32.00",
     "products": [{"id": "4", "name": "苹果 500g", "price": "8.00", "count": 4, "image": "", "spec": "默认"}]},
    {"id": "4", "orderNo": "DD20260331004", "shopName": "天猫超市", "shopIcon": "", "status": "delivered", "createTime": "2026-03-31 08:00", "totalPrice": "15.00",
     "products": [{"id": "5", "name": "香蕉 500g", "price": "5.00", "count": 3, "image": "", "spec": "默认"}]},
    {"id": "5", "orderNo": "DD20260330005", "shopName": "天猫超市", "shopIcon": "", "status": "completed", "createTime": "2026-03-30 18:30", "totalPrice": "66.00",
     "products": [{"id": "6", "name": "薯片", "price": "6.00", "count": 2, "image": "", "spec": "默认"}, {"id": "7", "name": "牛奶", "price": "12.00", "count": 4, "image": "", "spec": "默认"}]},
]

# 初始化订单（服务启动时从数据库生成一次）
_mock_orders = _generate_db_orders()
_order_store: Dict[str, dict] = {}

class PayOrderRequest(BaseModel):
    orderId: str
    openid: Optional[str] = None

@app.post("/api/order/pay")
async def pay_order(request: PayOrderRequest):
    """
    微信支付 JSAPI 下单接口。
    返回小程序 wx.requestPayment 所需的所有签名参数。
    """
    order_id = request.orderId
    openid = request.openid or "oDemoOpenid"

    # 从 mock 数据中查找订单
    order = next((o for o in _mock_orders if o["id"] == order_id), None)
    if not order:
        order = _order_store.get(order_id)

    if not order:
        return {"code": 404, "message": "订单不存在"}

    # 标记为已支付后进入配送中
    order["status"] = "delivering"

    # 生成订单号
    order_no = f"ORD{int(time_module.time() * 1000)}"

    # 获取 prepay_id（真实微信支付或模拟）
    total_fee = int(float(order["totalPrice"]) * 100)
    description = f"智慧校园-{order['shopName']}"
    prepay_id, time_stamp = _get_prepay_id(order_no, total_fee, description, openid)

    # 微信支付 JSAPI 签名
    nonce_str = _gen_nonce_str()
    app_id = _WX_PAY["app_id"]
    pay_sign = _make_pay_sign(app_id, nonce_str, prepay_id, time_stamp)

    return {
        "code": 0,
        "data": {
            "mock": True,   # True=模拟支付（跳过 wx.requestPayment）
            "payment": {
                "appId": app_id,
                "timeStamp": time_stamp,
                "nonceStr": nonce_str,
                "package": f"prepay_id={prepay_id}",
                "signType": "MD5",
                "paySign": pay_sign
            }
        }
    }

class CancelOrderRequest(BaseModel):
    orderId: str

@app.post("/api/order/cancel")
async def cancel_order(request: CancelOrderRequest):
    return {"code": 0, "message": "订单已取消"}

# ============ 配送订单创建 ============
class DeliveryGoodsItem(BaseModel):
    id: str
    name: str
    price: str
    count: int

class DeliveryAddress(BaseModel):
    contact: str
    phone: str
    province: str
    city: str
    district: str
    detail: str

class CreateDeliveryOrderRequest(BaseModel):
    address: DeliveryAddress
    goods: List[DeliveryGoodsItem]
    remark: Optional[str] = ""
    totalPrice: str
    deliveryFee: str

@app.post("/api/delivery/create")
async def create_delivery_order(request: CreateDeliveryOrderRequest):
    """
    配送下单接口（扫码支付模式）。
    用户扫码支付后，前端调用此接口创建配送订单。
    """
    order_no = f"DS{int(time_module.time() * 1000)}"
    order = {
        "id": order_no,
        "orderNo": order_no,
        "shopName": "校园配送",
        "status": "pending",
        "createTime": time_module.strftime("%Y-%m-%d %H:%M", time_module.localtime()),
        "totalPrice": request.totalPrice,
        "remark": request.remark or "",
        "deliveryFee": request.deliveryFee,
        "address": request.address.dict(),
        "products": [
            {"id": g.id, "name": g.name, "price": g.price, "count": g.count, "image": "", "spec": "默认"}
            for g in request.goods
        ]
    }
    _order_store[order_no] = order
    return {"code": 0, "data": {"orderId": order_no, "orderNo": order_no}}

class ConfirmOrderRequest(BaseModel):
    orderId: str

@app.post("/api/order/confirm")
async def confirm_order(request: ConfirmOrderRequest):
    return {"code": 0, "message": "已确认收货"}

class DeleteOrderRequest(BaseModel):
    orderId: str

@app.post("/api/order/delete")
async def delete_order(request: DeleteOrderRequest):
    return {"code": 0, "message": "订单已删除"}

# ============ 启动 ============

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("Smart Campus API v2.0 Started!")
    print("="*50)
    print(f"Mock students: {list(_mock_students.keys())}")
    print("="*50 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)
