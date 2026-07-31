# -*- coding: utf-8 -*-
"""
경기도 공공배달앱 가맹점 CSV의 시군명 기준으로
정제도로명주소 / 정제지번주소 / 정제우편번호 / 정제WGS84위도 / 정제WGS84경도
를 시·군 행정구역 범위 안에서 그럴싸하게 채우는 스크립트.

재사용: python generate_dummy_addresses.py [입력CSV] [출력CSV]
기본: 동일 파일에 덮어씀(원본은 .bak 백업).
"""

from __future__ import annotations

import csv
import hashlib
import math
import random
import shutil
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 시·군별 참조 데이터
# - center: (위도, 경도) 대략적 중심
# - delta: 중심에서 허용하는 좌표 반경(도). 시/군이 겹치지 않도록 보수적으로 설정
# - zip_range: (시작, 끝) 5자리 우편번호 구간
# - gus: 일반구가 있으면 구 목록, 없으면 []
# - dongs: 법정동/읍·면·동 이름 (그럴싸한 샘플)
# - roads: 도로명 본체 (뒤에 '로'/'길' 붙임)
# ---------------------------------------------------------------------------

SIGUN_DATA: dict[str, dict] = {
    "가평군": {
        "center": (37.8315, 127.5095),
        "delta": (0.12, 0.15),
        "zip_range": (12400, 12449),
        "gus": [],
        "dongs": ["가평읍", "설악면", "청평면", "상면", "조종면", "북면"],
        "roads": ["석봉", "가화", "호반", "유명", "청평", "설악", "북한강"],
    },
    "고양시": {
        "center": (37.6584, 126.8320),
        "delta": (0.08, 0.12),
        "zip_range": (10200, 10599),
        "gus": ["덕양구", "일산동구", "일산서구"],
        "gu_dongs": {
            "덕양구": ["화정동", "행신동", "원흥동", "삼송동", "고양동", "성사동"],
            "일산동구": ["마두동", "장항동", "백석동", "식사동", "풍동", "고봉동"],
            "일산서구": ["주엽동", "대화동", "일산동", "탄현동", "덕이동", "가좌동"],
        },
        "roads": ["중앙", "일산", "호수", "중앙로", "고양대로", "덕양", "백석"],
    },
    "과천시": {
        "center": (37.4292, 126.9876),
        "delta": (0.03, 0.04),
        "zip_range": (13800, 13849),
        "gus": [],
        "dongs": ["갈현동", "별양동", "부림동", "원문동", "주암동", "중앙동", "과천동"],
        "roads": ["별양상가", "과천대로", "중앙", "갈현", "부림", "관문"],
    },
    "광명시": {
        "center": (37.4786, 126.8644),
        "delta": (0.04, 0.05),
        "zip_range": (14200, 14349),
        "gus": [],
        "dongs": ["철산동", "하안동", "소하동", "광명동", "일직동", "옥길동", "학온동"],
        "roads": ["오리", "디지털", "광명", "철산", "하안", "소하", "도덕파크"],
    },
    "광주시": {
        "center": (37.4294, 127.2550),
        "delta": (0.08, 0.10),
        "zip_range": (12700, 12849),
        "gus": [],
        "dongs": ["경안동", "송정동", "쌍령동", "탄벌동", "회덕동", "오포읍", "초월읍", "곤지암읍"],
        "roads": ["경안", "광주대로", "태전", "곤지암", "오포", "회안대로", "중앙"],
    },
    "구리시": {
        "center": (37.5943, 127.1296),
        "delta": (0.035, 0.04),
        "zip_range": (11900, 11949),
        "gus": [],
        "dongs": ["갈매동", "동구동", "인창동", "교문동", "수택동", "토평동", "아천동"],
        "roads": ["경춘", "안골", "건원대로", "인창", "교문", "수택", "토평"],
    },
    "군포시": {
        "center": (37.3616, 126.9352),
        "delta": (0.04, 0.05),
        "zip_range": (15800, 15849),
        "gus": [],
        "dongs": ["당동", "당정동", "산본동", "금정동", "대야미동", "도마교동", "부곡동"],
        "roads": ["산본", "군포", "금정", "한세", "당정", "엘에스", "번영"],
    },
    "김포시": {
        "center": (37.6153, 126.7155),
        "delta": (0.08, 0.10),
        "zip_range": (10000, 10199),
        "gus": [],
        "dongs": ["사우동", "장기동", "구래동", "마산동", "운양동", "풍무동", "고촌읍", "통진읍"],
        "roads": ["김포대로", "사우중", "장기", "구래", "운양", "솔터", "돌문"],
    },
    "남양주시": {
        "center": (37.6360, 127.2165),
        "delta": (0.10, 0.14),
        "zip_range": (12000, 12299),
        "gus": [],
        "dongs": [
            "별내동", "다산동", "지금동", "와부읍", "진접읍", "화도읍",
            "오남읍", "퇴계원읍", "호평동", "평내동", "금곡동",
        ],
        "roads": ["경춘로", "다산로", "별내", "진접", "화도", "오남", "경의"],
    },
    "동두천시": {
        "center": (37.9036, 127.0606),
        "delta": (0.05, 0.06),
        "zip_range": (11300, 11349),
        "gus": [],
        "dongs": ["생연동", "중앙동", "보산동", "송내동", "지행동", "상패동", "불현동"],
        "roads": ["평화로", "동두천", "중앙", "생연", "지행", "송내"],
    },
    "부천시": {
        "center": (37.5034, 126.7660),
        "delta": (0.05, 0.07),
        "zip_range": (14400, 14799),
        "gus": [],
        "dongs": [
            "중동", "상동", "심곡동", "원미동", "소사동", "역곡동",
            "괴안동", "오정동", "여월동", "송내동", "도당동",
        ],
        "roads": ["길주로", "부천로", "중동로", "소사로", "역곡로", "송내대로", "신흥로"],
    },
    "성남시": {
        "center": (37.4201, 127.1265),
        "delta": (0.07, 0.08),
        "zip_range": (13100, 13699),
        "gus": ["수정구", "중원구", "분당구"],
        "gu_dongs": {
            "수정구": ["신흥동", "태평동", "수진동", "단대동", "복정동", "위례동"],
            "중원구": ["성남동", "금광동", "상대원동", "하대원동", "도촌동", "중앙동"],
            "분당구": ["정자동", "서현동", "야탑동", "이매동", "수내동", "분당동", "판교동", "백현동"],
        },
        "roads": ["분당로", "성남대로", "판교로", "서현로", "야탑로", "돌마로", "희망로"],
    },
    "성동구": {
        # 원본 데이터에 서울 성동구로 표기된 행이 있어 해당 범위로 생성
        "center": (37.5634, 127.0368),
        "delta": (0.025, 0.03),
        "zip_range": (4700, 4799),
        "gus": [],
        "prefix": "서울특별시",
        "dongs": ["성수동1가", "성수동2가", "왕십리동", "행당동", "금호동", "옥수동", "마장동"],
        "roads": ["왕십리로", "성수일로", "뚝섬로", "독서당로", "금호로", "고산자로"],
    },
    "수원시": {
        "center": (37.2636, 127.0286),
        "delta": (0.07, 0.08),
        "zip_range": (16200, 16699),
        "gus": ["장안구", "권선구", "팔달구", "영통구"],
        "gu_dongs": {
            "장안구": ["정자동", "율전동", "조원동", "송죽동", "파장동", "연무동"],
            "권선구": ["권선동", "세류동", "곡선동", "구운동", "입북동", "평동", "오목천동"],
            "팔달구": ["인계동", "매교동", "화서동", "우만동", "지동", "매산로1가"],
            "영통구": ["영통동", "매탄동", "원천동", "이의동", "하동", "망포동"],
        },
        "roads": [
            "동수원로", "경수대로", "중부대로", "영통로", "권선로",
            "효원로", "매탄로", "광교중앙로", "월드컵로", "덕영대로",
        ],
    },
    "시흥시": {
        "center": (37.3800, 126.8030),
        "delta": (0.08, 0.10),
        "zip_range": (14900, 15099),
        "gus": [],
        "dongs": [
            "대야동", "신천동", "은행동", "매화동", "정왕동", "배곧동",
            "목감동", "능곡동", "군자동", "월곶동",
        ],
        "roads": ["시흥대로", "정왕대로", "배곧1로", "목감중앙로", "은계중앙로", "서해안로"],
    },
    "안산시": {
        "center": (37.3219, 126.8309),
        "delta": (0.07, 0.09),
        "zip_range": (15200, 15699),
        "gus": ["상록구", "단원구"],
        "gu_dongs": {
            "상록구": ["본오동", "사동", "월피동", "성포동", "이동", "부곡동", "건건동"],
            "단원구": ["고잔동", "중앙동", "원곡동", "초지동", "선부동", "와동", "대부동동"],
        },
        "roads": ["중앙대로", "단원로", "상록수", "고잔로", "해안로", "광덕대로", "예술대학로"],
    },
    "안성시": {
        "center": (37.0079, 127.2797),
        "delta": (0.10, 0.12),
        "zip_range": (17500, 17649),
        "gus": [],
        "dongs": ["봉산동", "금산동", "인지동", "아양동", "공도읍", "대덕면", "미양면", "양성면"],
        "roads": ["안성맞춤대로", "중앙로", "공도", "비룡", "아양로", "서동대로"],
    },
    "안양시": {
        "center": (37.3943, 126.9568),
        "delta": (0.05, 0.06),
        "zip_range": (13900, 14199),
        "gus": ["만안구", "동안구"],
        "gu_dongs": {
            "만안구": ["안양동", "석수동", "박달동", "안양1동", "안양2동"],
            "동안구": ["비산동", "관양동", "평촌동", "호계동", "범계동", "갈산동"],
        },
        "roads": ["평촌대로", "관평로", "시민대로", "경수대로", "흥안대로", "동안로", "만안로"],
    },
    "양주시": {
        "center": (37.7853, 127.0458),
        "delta": (0.10, 0.12),
        "zip_range": (11400, 11549),
        "gus": [],
        "dongs": ["옥정동", "고읍동", "광사동", "회정동", "덕계동", "백석읍", "장흥면", "남면"],
        "roads": ["옥정로", "회천중앙로", "부흥로", "평화로", "광적로", "고읍남로"],
    },
    "양평군": {
        "center": (37.4914, 127.4876),
        "delta": (0.12, 0.15),
        "zip_range": (12500, 12599),
        "gus": [],
        "dongs": ["양평읍", "용문면", "지평면", "청운면", "양서면", "옥천면", "강상면", "강하면"],
        "roads": ["경강로", "양평중앙로", "용문로", "북한강로", "중앙로", "양수로"],
    },
    "여주시": {
        "center": (37.2983, 127.6370),
        "delta": (0.10, 0.12),
        "zip_range": (12600, 12649),
        "gus": [],
        "dongs": ["여흥동", "중앙동", "오학동", "가남읍", "점동면", "능서면", "흥천면", "금사면"],
        "roads": ["세종로", "여양로", "중앙로", "가남로", "영릉로", "청심로"],
    },
    "연천군": {
        "center": (38.0965, 127.0748),
        "delta": (0.12, 0.14),
        "zip_range": (11000, 11049),
        "gus": [],
        "dongs": ["연천읍", "전곡읍", "군남면", "청산면", "백학면", "미산면", "왕징면"],
        "roads": ["연천로", "전곡로", "평화로", "연대로", "청산로", "군남로"],
    },
    "오산시": {
        "center": (37.1498, 127.0772),
        "delta": (0.04, 0.05),
        "zip_range": (18100, 18149),
        "gus": [],
        "dongs": ["오산동", "원동", "궐동", "금암동", "수청동", "세교동", "부산동", "청학동"],
        "roads": ["오산로", "경기대로", "궐리사로", "수목원로", "운암로", "대원로"],
    },
    "용인시": {
        "center": (37.2411, 127.1775),
        "delta": (0.10, 0.14),
        "zip_range": (16800, 17199),
        "gus": ["처인구", "기흥구", "수지구"],
        "gu_dongs": {
            "처인구": ["김량장동", "역북동", "삼가동", "모현읍", "포곡읍", "양지면", "남사읍"],
            "기흥구": ["구갈동", "신갈동", "보정동", "마북동", "구성동", "동백동", "중동"],
            "수지구": ["풍덕천동", "죽전동", "동천동", "성복동", "상현동", "신봉동"],
        },
        "roads": [
            "용인대로", "중부대로", "포은대로", "수지로", "기흥로",
            "동백죽전대로", "성복2로", "보정로",
        ],
    },
    "의왕시": {
        "center": (37.3449, 126.9683),
        "delta": (0.04, 0.05),
        "zip_range": (16000, 16049),
        "gus": [],
        "dongs": ["고천동", "오전동", "내손동", "청계동", "포일동", "학의동", "왕곡동"],
        "roads": ["의왕로", "경수대로", "오전로", "내손중앙로", "청계로", "포일로"],
    },
    "의정부시": {
        "center": (37.7381, 127.0338),
        "delta": (0.06, 0.07),
        "zip_range": (11600, 11849),
        "gus": [],
        "dongs": [
            "의정부동", "호원동", "장암동", "신곡동", "용현동",
            "민락동", "낙양동", "금오동", "가능동", "녹양동",
        ],
        "roads": ["평화로", "의정부대로", "호국로", "신곡로", "민락로", "용현로", "장암"],
    },
    "이천시": {
        "center": (37.2720, 127.4348),
        "delta": (0.10, 0.12),
        "zip_range": (17300, 17449),
        "gus": [],
        "dongs": ["창전동", "중리동", "관고동", "증포동", "장호원읍", "부발읍", "신둔면", "백사면"],
        "roads": ["이섭대천로", "중리천로", "경충대로", "부발", "장호원", "증포로"],
    },
    "파주시": {
        "center": (37.7599, 126.7800),
        "delta": (0.12, 0.14),
        "zip_range": (10800, 10999),
        "gus": [],
        "dongs": [
            "금촌동", "아동동", "야동동", "운정동", "다율동",
            "교하동", "문산읍", "파주읍", "조리읍", "광탄면",
        ],
        "roads": ["경의로", "운정로", "금정로", "교하로", "문산로", "중앙로", "와석순환로"],
    },
    "평택시": {
        "center": (36.9921, 127.1127),
        "delta": (0.12, 0.14),
        "zip_range": (17700, 17999),
        "gus": [],
        "dongs": [
            "평택동", "비전동", "동삭동", "세교동", "합정동",
            "소사동", "신장동", "안중읍", "포승읍", "진위면", "고덕동",
        ],
        "roads": ["평택로", "중앙로", "비전5로", "서동대로", "안중로", "포승공단", "고덕로"],
    },
    "포천시": {
        "center": (37.8949, 127.2002),
        "delta": (0.12, 0.14),
        "zip_range": (11100, 11199),
        "gus": [],
        "dongs": ["신읍동", "어룡동", "선단동", "소흘읍", "군내면", "내촌면", "가산면", "일동면"],
        "roads": ["중앙로", "호국로", "소흘로", "포천로", "군내로", "일동로"],
    },
    "하남시": {
        "center": (37.5393, 127.2149),
        "delta": (0.05, 0.06),
        "zip_range": (12900, 12999),
        "gus": [],
        "dongs": [
            "창우동", "신장동", "덕풍동", "풍산동", "미사동",
            "망월동", "감일동", "감북동", "춘궁동",
        ],
        "roads": ["미사강변대로", "하남대로", "덕풍북로", "신장로", "감일로", "풍산로"],
    },
    "화성시": {
        "center": (37.1995, 126.8312),
        "delta": (0.14, 0.18),
        "zip_range": (18200, 18699),
        "gus": [],
        "dongs": [
            "병점동", "진안동", "능동", "반월동", "기산동",
            "동탄동", "반송동", "석우동", "청계동", "오산동",
            "봉담읍", "향남읍", "남양읍", "우정읍", "매송면",
        ],
        "roads": [
            "동탄대로", "동탄중심상가", "병점중앙로", "봉담로",
            "향남로", "서동탄로", "삼성1로", "능동",
        ],
    },
}

# 원본 CSV에 나타나는 변형 표기 → 정규 키
SIGUN_ALIASES: dict[str, str] = {
    "남양주": "남양주시",
    "동두천": "동두천시",
    "의정부": "의정부시",
    "성남시분": "성남시",
}


def normalize_sigun(name: str) -> str:
    name = (name or "").strip()
    return SIGUN_ALIASES.get(name, name)


def seeded_rng(*parts: str) -> random.Random:
    h = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return random.Random(int(h[:16], 16))


def pick_road_name(rng: random.Random, roads: list[str]) -> str:
    base = rng.choice(roads)
    if base.endswith(("로", "길", "대로")):
        return base
    # 본체 + 로/길 + 가끔 숫자
    suffix = rng.choice(["로", "로", "로", "길", "대로"])
    if suffix == "길" and rng.random() < 0.4:
        return f"{base}{rng.randint(1, 48)}길"
    if suffix == "로" and rng.random() < 0.25:
        return f"{base}{rng.randint(1, 24)}로"
    return f"{base}{suffix}"


def make_building_no(rng: random.Random) -> str:
    main = rng.randint(1, 320)
    if rng.random() < 0.35:
        return f"{main}-{rng.randint(1, 28)}"
    return str(main)


def make_jibun(rng: random.Random) -> str:
    main = rng.randint(1, 980)
    if rng.random() < 0.55:
        return f"{main}-{rng.randint(1, 45)}"
    return str(main)


def make_zip(rng: random.Random, zip_range: tuple[int, int]) -> str:
    lo, hi = zip_range
    return f"{rng.randint(lo, hi):05d}"


def make_coords(rng: random.Random, center: tuple[float, float], delta: tuple[float, float]) -> tuple[str, str]:
    # 원형에 가깝게 샘플링해 모서리로 튀는 값 완화
    lat0, lon0 = center
    dlat, dlon = delta
    angle = rng.uniform(0, 2 * math.pi)
    r = math.sqrt(rng.random())  # 면적 균등
    lat = lat0 + r * dlat * math.sin(angle)
    lon = lon0 + r * dlon * math.cos(angle)
    return f"{lat:.6f}", f"{lon:.6f}"


def generate_for_row(sigun_raw: str, store: str, biz: str) -> dict[str, str]:
    key = normalize_sigun(sigun_raw)
    meta = SIGUN_DATA.get(key)
    if meta is None:
        # 알 수 없는 시군 → 경기도 중앙 근처 폴백 (드묾)
        meta = {
            "center": (37.4138, 127.5183),
            "delta": (0.05, 0.05),
            "zip_range": (16000, 16099),
            "gus": [],
            "dongs": ["중앙동"],
            "roads": ["중앙"],
            "prefix": "경기도",
        }
        display = key or "경기도"
    else:
        display = key

    rng = seeded_rng(key, store, biz)
    prefix = meta.get("prefix", "경기도")
    gu = rng.choice(meta["gus"]) if meta["gus"] else ""
    if gu and meta.get("gu_dongs"):
        dong = rng.choice(meta["gu_dongs"][gu])
    else:
        dong = rng.choice(meta.get("dongs") or ["중앙동"])
    road = pick_road_name(rng, meta["roads"])
    bno = make_building_no(rng)
    jibun = make_jibun(rng)
    zipcode = make_zip(rng, meta["zip_range"])
    lat, lon = make_coords(rng, meta["center"], meta["delta"])

    mid = f"{display} {gu}".strip() if gu else display
    road_addr = f"{prefix} {mid} {road} {bno}"
    jibun_addr = f"{prefix} {mid} {dong} {jibun}"

    return {
        "정제도로명주소": road_addr,
        "정제지번주소": jibun_addr,
        "정제우편번호": zipcode,
        "정제WGS84위도": lat,
        "정제WGS84경도": lon,
    }


def process(input_path: Path, output_path: Path) -> None:
    # 원본 백업
    bak = input_path.with_suffix(input_path.suffix + ".bak")
    if input_path.resolve() == output_path.resolve() and not bak.exists():
        shutil.copy2(input_path, bak)
        print(f"backup: {bak}")

    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    fill_cols = [
        "정제도로명주소",
        "정제지번주소",
        "정제우편번호",
        "정제WGS84위도",
        "정제WGS84경도",
    ]
    for c in fill_cols:
        if c not in fieldnames:
            fieldnames.append(c)

    missing_keys: dict[str, int] = {}
    for row in rows:
        raw = row.get("시군명", "")
        key = normalize_sigun(raw)
        if key not in SIGUN_DATA:
            missing_keys[raw] = missing_keys.get(raw, 0) + 1
        filled = generate_for_row(raw, row.get("매장명", ""), row.get("사업자등록번호", ""))
        row.update(filled)

    with output_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"wrote {len(rows)} rows -> {output_path}")
    if missing_keys:
        print("unknown 시군명 (fallback used):")
        for k, v in sorted(missing_keys.items(), key=lambda x: -x[1]):
            print(f"  {k!r}: {v}")


def main() -> None:
    base = Path(__file__).resolve().parent
    default_csv = base / "경기도공공배달앱배달특급가맹점.csv"
    inp = Path(sys.argv[1]) if len(sys.argv) > 1 else default_csv
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else inp
    process(inp, out)


if __name__ == "__main__":
    main()
