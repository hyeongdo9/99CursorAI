# A04 CSV → 매출.xlsx 적재 프로젝트 README

## 개요

`resData/csv/` 폴더의 CSV 파일을 읽어 `resData/매출.xlsx`의 **매출** 시트에 적재하는 Python 프로그램입니다.  
처리가 완료된 CSV는 `resData/csv/completed/` 폴더로 이동합니다.

---

## 프로젝트 구조

```
ex08maechulManager/
├── PA_CSV_to_Excel.py      # CSV → Excel 적재 프로그램
├── requirements.txt        # Python 패키지 의존성
├── .venv/                  # 가상환경 (로컬 생성)
├── docs/
│   ├── A01CSV.md           # 사양서
│   ├── A02CSV_flow.md      # Mermaid Flow Chart
│   ├── A03CSV_sequence.md    # Mermaid Sequence Chart
│   └── A04CSV_readme.md    # 본 문서 (작업 요약·사용 안내)
└── resData/
    ├── 매출.xlsx           # 적재 대상 Excel (매출 시트)
    └── csv/
        ├── *.csv           # 미처리(pending) CSV
        └── completed/      # 처리 완료 CSV
```

---

## 문서 목록

| 파일 | 설명 |
|------|------|
| [A01CSV.md](A01CSV.md) | 요구사항·동작 규칙·CLI 설계·구현 상세·검증 방법 |
| [A02CSV_flow.md](A02CSV_flow.md) | 전체 처리 흐름, CSV 병합, Excel 적재, 파일 이동 Flow Chart |
| [A03CSV_sequence.md](A03CSV_sequence.md) | 정상/dry-run/오류/재실행 Sequence Chart |
| [A04CSV_readme.md](A04CSV_readme.md) | 프로젝트 README (본 문서) |

---

## 사양 요약

### 입력·출력

| 항목 | 내용 |
|------|------|
| CSV 위치 | `resData/csv/` — `{영업소}_{YYYY-MM}.csv` 형식 |
| CSV 구조 | 16열 (매출일, 영업소, 영업담당, …, 단가), UTF-8 |
| Excel 대상 | `resData/매출.xlsx` — **매출** 시트만 수정 |
| 완료 파일 | `resData/csv/completed/` 로 이동 |

### 확정된 동작 방식

| 항목 | 선택 |
|------|------|
| 적재 방식 | **replace_all** — 시트 기존 데이터 삭제 후 전체 재적재 |
| 데이터 범위 | **pending + completed** — `csv/` + `completed/` CSV 전체 병합 |
| 실행 방식 | **GUI 경로 선택** (기본) + **CLI 인자** (`--no-gui`) |

### 핵심 규칙

1. `csv_dir/*.csv` + `csv_dir/completed/*.csv` 만 수집 (하위 재귀 없음)
2. `매출` 시트 1행 헤더 유지, 2행 이하 clear 후 병합 데이터 기록
3. Excel 저장 **성공 후에만** `csv/` 직하위 CSV를 `completed/`로 이동
4. `거래처`, `서울`, `매출01` 등 다른 시트는 변경하지 않음
5. 재실행 시 completed + pending CSV를 합쳐 시트 전체를 다시 구성
6. `매출금액`, `매출이익`, `단가`는 Excel `#,##0` 서식으로 3자리마다 콤마 표시
7. 기본 실행 시 **tkinter** 대화 상자로 CSV 폴더·매출.xlsx 선택 (초기 경로 `C:\`)

---

## 프로그램

### 파일

- **실행 스크립트**: [`PA_CSV_to_Excel.py`](../PA_CSV_to_Excel.py)
- **의존성**: [`requirements.txt`](../requirements.txt) — `openpyxl`, `pandas`

### 환경 구성

프로젝트 루트에서 가상환경을 사용합니다 (`.cursor/rules/executor.mdc` 규칙).

```powershell
cd c:\02Workspaces\99CursorAI\ex08maechulManager

# 최초 1회
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

### 실행 방법

```powershell
# GUI로 폴더·파일 선택 후 적재 (기본)
.\.venv\Scripts\python.exe PA_CSV_to_Excel.py

# 검증만 (GUI로 경로 선택)
.\.venv\Scripts\python.exe PA_CSV_to_Excel.py --dry-run

# CLI 경로만 사용 (자동화·스크립트)
.\.venv\Scripts\python.exe PA_CSV_to_Excel.py --no-gui --dry-run
.\.venv\Scripts\python.exe PA_CSV_to_Excel.py --no-gui
```

### GUI 경로 선택

1. **CSV 원본 폴더** — `filedialog.askdirectory` (초기 경로 `C:\`)
2. **매출.xlsx** — `filedialog.askopenfilename` (초기 경로 `C:\`, `*.xlsx`)
3. 선택 취소 시 오류 후 종료
4. `--no-gui` 사용 시 아래 CLI 기본 경로 사용

### CLI 인자

| 인자 | 기본값 | 설명 |
|------|--------|------|
| `--csv-dir` | `resData/csv` | CSV 입력 폴더 (`--no-gui` 시) |
| `--xlsx-path` | `resData/매출.xlsx` | 대상 Excel (`--no-gui` 시) |
| `--sheet-name` | `매출` | 적재 대상 시트명 |
| `--dry-run` | off | 검증·건수 출력만 수행 |
| `--no-gui` | off | GUI 없이 CLI 경로만 사용 |

`--no-gui` 사용 시 프로젝트 루트 기준 상대 경로를 지원합니다.

### Excel 셀 서식

| 컬럼 | 값 타입 | 표시 서식 |
|------|---------|-----------|
| 매출일 | date | `YYYY-MM-DD` |
| 기간, 전표번호, 상품코드, 거래처코드, 매출수량 | number | 기본 |
| **매출금액, 매출이익, 단가** | number | `#,##0` (3자리마다 콤마) |
| 나머지 | string | 기본 |

### 출력 예시

```
읽은 CSV: 36개 (pending 36, completed 0)
적재 행 수: 2442
이동 파일: 36개 → resData/csv/completed/
저장 완료: resData/매출.xlsx
```

---

## 처리 흐름 (요약)

```
CLI/GUI 실행
  → CSV 폴더·매출.xlsx 선택 (GUI) 또는 CLI 경로
  → csv/ + completed/ CSV 수집
  → 헤더·인코딩 검증
  → 데이터 병합 (파일명 오름차순)
  → 매출 시트 clear 후 2행부터 기록 (금액 컬럼 #,##0 서식)
  → 매출.xlsx 저장
  → csv/ pending 파일만 completed/ 로 이동
  → 처리 요약 출력
```

상세 다이어그램은 [A02CSV_flow.md](A02CSV_flow.md), [A03CSV_sequence.md](A03CSV_sequence.md)를 참고하세요.

---

## 검증 결과

프로그램 작성 후 아래 항목을 확인했습니다.

| 항목 | 결과 |
|------|------|
| dry-run | CSV 36개, 2442행 확인 |
| 실제 실행 | `매출` 시트 2442행 적재 |
| 금액 서식 | `매출금액`, `매출이익`, `단가`에 `#,##0` 콤마 서식 적용 |
| 파일 이동 | 36개 CSV → `resData/csv/completed/` |
| 재실행 dry-run | pending 0, completed 36, 2442행 유지 |

### 현재 데이터 상태

- `resData/csv/` — pending CSV **0개**
- `resData/csv/completed/` — 처리 완료 CSV **36개**
- `resData/매출.xlsx` — `매출` 시트 **2442행** 데이터

---

## 사용 시나리오

### 1. 최초 일괄 적재

1. CSV 파일을 `resData/csv/`에 넣습니다.
2. `PA_CSV_to_Excel.py`를 실행합니다.
3. `매출` 시트에 데이터가 적재되고, CSV는 `completed/`로 이동합니다.

### 2. 신규 CSV 추가 후 재적재

1. 새 CSV를 `resData/csv/`에 추가합니다.
2. 프로그램을 다시 실행합니다.
3. `completed/` 기존 CSV + `csv/` 신규 CSV를 **전체 병합**하여 시트를 다시 구성합니다.
4. 신규 CSV만 `completed/`로 이동합니다.

### 3. 검증만 수행

```powershell
.\.venv\Scripts\python.exe PA_CSV_to_Excel.py --dry-run
```

Excel 저장 및 파일 이동 없이 CSV 건수·행 수만 확인합니다.

---

## 주의사항

- Excel에서 `매출.xlsx`를 **열어 둔 상태**에서는 저장이 실패할 수 있습니다. 파일을 닫고 실행하세요.
- **replace_all** 방식이므로, `csv/` + `completed/`에 없는 데이터는 시트에서 사라집니다.
- `매출01` 시트는 수정 대상이 아닙니다.
- CSV 헤더(16열·순서)가 다르면 오류로 중단됩니다.

---

## 작업 이력

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | 요구사항 정리·사용자 확인 (replace_all, pending+completed, CLI) | `docs/A01CSV.md` |
| 2 | Flow Chart 작성 | `docs/A02CSV_flow.md` |
| 3 | Sequence Chart 작성 | `docs/A03CSV_sequence.md` |
| 4 | Python 프로그램 구현·검증 | `PA_CSV_to_Excel.py`, `requirements.txt` |
| 5 | 프로젝트 README 작성 | `docs/A04CSV_readme.md` |
| 6 | 금액 컬럼 콤마 서식 추가·문서 갱신 | `PA_CSV_to_Excel.py`, `docs/A01~A04` |
| 7 | tkinter GUI 경로 선택 추가 | `PA_CSV_to_Excel.py`, `docs/A01~A04` |

---

## 관련 파일 빠른 링크

- [사양서 (A01)](A01CSV.md)
- [Flow Chart (A02)](A02CSV_flow.md)
- [Sequence Chart (A03)](A03CSV_sequence.md)
- [프로그램 (PA_CSV_to_Excel.py)](../PA_CSV_to_Excel.py)
- [의존성 (requirements.txt)](../requirements.txt)
