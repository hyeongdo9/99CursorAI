# B04 거래처별 청구서·PDF 생성 프로젝트 README

## 개요

`yyyy-mm`을 지정하여 `매출.xlsx`의 매출 데이터를 거래처별로 추출하고, `청구서.xlsx`의 **청구서** 시트를 복사해 청구서를 작성한 뒤 PDF로 출력하는 Python 프로그램입니다.  
PDF 출력 완료 후 생성된 거래처별 시트는 삭제됩니다.

---

## 프로젝트 구조

```
ex08maechulManager/
├── PB_Make_Bill.py         # 청구서·PDF 생성 프로그램
├── WinB_Make_Bill.exe      # 독립 실행 파일 (GUI, PyInstaller)
├── WinA_CSV_to_Excel.exe   # CSV 적재 독립 실행 파일
├── PA_CSV_to_Excel.py      # CSV → 매출 적재 프로그램
├── requirements.txt        # Python 패키지 의존성
├── .venv/                  # 가상환경 (로컬 생성)
├── docs/
│   ├── B01Bill.md          # 사양서
│   ├── B02Bill_flow.md     # Mermaid Flow Chart
│   ├── B03Bill_sequence.md # Mermaid Sequence Chart
│   └── B04Bill_readme.md   # 본 문서 (작업 요약·사용 안내)
└── resData/
    ├── 매출.xlsx           # 매출·거래처 데이터
    ├── 청구서.xlsx         # 청구서 템플릿
    └── PDF/                # PDF 출력 폴더 (실행 시 생성)
```

---

## 문서 목록

| 파일 | 설명 |
|------|------|
| [B01Bill.md](B01Bill.md) | 요구사항·Excel 조사·CLI·기능 상세·검증 |
| [B02Bill_flow.md](B02Bill_flow.md) | 전체 처리·明細·PDF Flow Chart |
| [B03Bill_sequence.md](B03Bill_sequence.md) | 정상/dry-run/오류 Sequence Chart |
| [B04Bill_readme.md](B04Bill_readme.md) | 프로젝트 README (본 문서) |

---

## 사양 요약

### 입력·출력

| 항목 | 내용 |
|------|------|
| 입력 | `매출.xlsx` — 매출·거래처 시트 |
| 템플릿 | `청구서.xlsx` — **청구서** 시트 복사 |
| 출력 | GUI/CLI 지정 폴더 / `{거래처명}_{코드}_{YYMM}.pdf` |
| 대상 월 | GUI 연·월 입력 (기본) 또는 CLI `--no-gui -m yyyy-mm` |

### 확정된 동작 방식

| 항목 | 선택 |
|------|------|
| 실행 방식 | **GUI** (경로·연·월·로그) + **CLI** (`--no-gui`) + **`WinB_Make_Bill.exe`** |
| PDF 출력 | **3단계 fallback** — Excel COM → LibreOffice → ReportLab 내장 |
| 작업 파일 | **청구서.xlsx**에 임시 시트 → PDF → 삭제 |
| 시트명 | **거래처명_거래처코드_YYMM** (예: `청주식당_1002_2508`) |
| 미매칭 코드 | 경고 후 **skip** |

### 핵심 규칙

1. 매출 A열(매출일) 기준 월별 필터, K열 거래처코드 그룹핑
2. 거래처 시트 조인 → B5(우편번호), B6(주소), B7(거래처명)
3. 明細 R20~ : A←매출일, B←상품명, F←수량, G←단가, H←`=F*G`
4. 明細 16행 초과 시 R35~R36 사이 행 삽입, 합계 수식 동적 갱신
5. A열 날짜 서식 **`yy-mm-dd`**, 열 너비 ≥ 12, **`print_area`** 설정
6. PDF 3단계 fallback 후 생성 시트 삭제, 원본 3시트 유지

---

## 프로그램

### 파일

- **실행 스크립트**: [`PB_Make_Bill.py`](../PB_Make_Bill.py)
- **독립 exe**: [`WinB_Make_Bill.exe`](../WinB_Make_Bill.exe)
- **의존성**: [`requirements.txt`](../requirements.txt) — `openpyxl`, `pandas`, `pywin32`, `reportlab`

### 환경 구성

```powershell
cd c:\02Workspaces\99CursorAI\ex08maechulManager

# 최초 1회
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

- **Windows** 필수
- **Excel** 또는 **LibreOffice**가 있으면 해당 방식으로 PDF (템플릿 레이아웃 유지)
- 없으면 **ReportLab 내장 변환**으로 PDF 생성

### 실행 방법

```powershell
# GUI 실행 (기본) — Python
.\.venv\Scripts\python.exe PB_Make_Bill.py

# 독립 exe (Python 불필요)
.\WinB_Make_Bill.exe

# 검증만 (CLI)
.\.venv\Scripts\python.exe PB_Make_Bill.py --no-gui -m 2025-08 --dry-run

# 실제 실행 (CLI)
.\.venv\Scripts\python.exe PB_Make_Bill.py --no-gui -m 2025-08 --pdf-dir resData\PDF
```

### GUI 구성

| UI | 설명 |
|----|------|
| 매출.xlsx + 찾아보기 | 매출 Excel 선택 (기본 경로 `C:\`) |
| 청구서.xlsx + 찾아보기 | 청구서 Excel 선택 (기본 경로 `C:\`) |
| 매출 연도 | 입력 상자 (기본값 **2025**) |
| 매출 월 | 드롭다운 `01`~`12` |
| PDF 저장 폴더 + 찾아보기 | PDF 출력 경로 (기본 경로 `C:\`) |
| 작업 로그 | 진행 상황·fallback·완료 요약 표시 |
| **실행** | 처리 시작 (완료 후 창 유지) |
| **닫기** | 사용자 수동 종료 |

5. `--no-gui` 사용 시 `-m` 및 경로 CLI 인자 필수

### CLI 인자

| 인자 | 단축 | 기본값 | 설명 |
|------|------|--------|------|
| `--year-month` | `-m` | — | 대상 연월 `yyyy-mm` (`--no-gui` 시 필수) |
| `--no-gui` | | off | GUI 없이 CLI `-m`만 사용 |
| `--sales-xlsx` | | `resData/매출.xlsx` | 매출 Excel |
| `--invoice-xlsx` | | `resData/청구서.xlsx` | 청구서 Excel |
| `--pdf-dir` | | `resData/PDF` | PDF 출력 폴더 |
| `--dry-run` | | off | 대상·건수만 출력 |

### Excel 셀 서식 (明細)

| 컬럼 | 내용 | 서식 |
|------|------|------|
| A | 매출일 | `yy-mm-dd` (예: 25-08-31) |
| B | 상품명 | 문자열 (B:E 병합) |
| F | 수량 | 숫자 |
| G | 단가 | 숫자 |
| H | 금액 | `=F*G` 수식 |

### 출력 예시

```
대상 월: 2025-08
거래처: 67건
明細 행: 197건
PDF 출력: 67개 → resData/PDF/
삭제 시트: 67개
저장 완료: resData/청구서.xlsx
```

---

## 처리 흐름 (요약)

```
GUI/CLI 경로·연·월 지정
  → 매출 월별 필터·거래처 그룹핑
  → 청구서 시트 복사·수신처·明細 입력 (A열 yy-mm-dd, print_area)
  → 16행 초과 시 행 삽입·수식 갱신
  → 청구서.xlsx 저장
  → PDF 3단계 fallback (Excel COM → LibreOffice → ReportLab)
  → 생성 시트 삭제·저장
  → GUI 로그·요약 (닫기로 종료)
```

상세 다이어그램: [B02Bill_flow.md](B02Bill_flow.md), [B03Bill_sequence.md](B03Bill_sequence.md)

---

## PDF 미생성 문제 해결 (2025-08)

### 원인

| 원인 | 증상 |
|------|------|
| Excel 미설치 | COM 오류 `REGDB_E_CLASSNOTREG` (-2147221005) |
| GUI 스레드 COM 미초기화 | Excel 설치 환경에서도 COM 호출 실패 가능 |
| PyInstaller exe + `EnsureDispatch` | frozen 환경에서 Excel COM 불안정 |
| PDF 생성 미검증 | Export 호출 후 파일 없음 |

### 해결 방법

1. **3단계 PDF fallback** — `export_pdfs()`가 순서대로 시도
   - 1순위 **Excel COM**: `CoInitialize`, 절대경로, `ExportAsFixedFormat`, `_verify_pdf_file`
   - 2순위 **LibreOffice**: 시트별 임시 xlsx → `soffice --headless --convert-to pdf`
   - 3순위 **ReportLab**: `malgun.ttf`로 내장 PDF (Excel/LO 없을 때)
2. **인쇄 영역** — `fill_invoice_sheet`에서 `print_area = A1:I{tax_row}` 설정
3. **GUI 로그** — fallback 시도·진행·완료를 작업 로그창에 표시
4. **`reportlab`** — `requirements.txt` 추가, `WinB_Make_Bill.exe`에 포함

### 검증

Excel 미설치 환경에서 `2025-08` 실행 → **PDF 67개** 생성 확인 (`resData/PDF`, ReportLab fallback)

---

## 검증 결과

| 항목 | 결과 |
|------|------|
| dry-run 2025-08 (`--no-gui`) | 거래처 67건, 明細 197행 |
| dry-run 2025-02 | 거래처 82건, 明細 393행 |
| 27행 거래처 (5001) | `H47=SUM(H20:H46)`, `I17=H47+H48` 확인 |
| A열 날짜 서식 | `yy-mm-dd` 적용 확인 |
| PDF 일괄 생성 2025-08 | **67개** (ReportLab fallback, Excel 미설치 환경) |
| WinB_Make_Bill.exe | GUI·로그·PDF 생성 확인 |

---

## 주의사항

- Excel에서 `청구서.xlsx`를 **열어 둔 상태**에서는 저장·PDF 실패 가능
- Excel **미설치** 환경: ReportLab fallback으로 PDF 생성 (로그: `내장 PDF 변환`)
- Excel COM 실패 시 LibreOffice → ReportLab 순 자동 재시도
- ReportLab PDF는 Excel 템플릿과 **레이아웃이 다름** (데이터·금액 동일)
- PDF 실패 후 임시 시트가 남으면 원본 3시트만 남도록 수동/재실행 정리
- 원본 **청구서** 시트는 수정·삭제하지 않음

---

## 작업 이력

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | Excel 구조 조사·사용자 확인 | `docs/B01Bill.md` |
| 2 | Flow Chart | `docs/B02Bill_flow.md` |
| 3 | Sequence Chart | `docs/B03Bill_sequence.md` |
| 4 | Python 프로그램 구현 | `PB_Make_Bill.py`, `requirements.txt` |
| 5 | A열 날짜 `yy-mm-dd` 서식 수정 | `PB_Make_Bill.py`, 문서 갱신 |
| 6 | 프로젝트 README | `docs/B04Bill_readme.md` |
| 7 | tkinter GUI 연·월 선택 추가 | `PB_Make_Bill.py`, `docs/B01~B04` |
| 8 | GUI 확장·`WinB_Make_Bill.exe`·작업 로그 | `PB_Make_Bill.py`, `WinB_Make_Bill.exe` |
| 9 | PDF 3단계 fallback·미생성 문제 해결 | `PB_Make_Bill.py`, `requirements.txt`, `docs/B01~B04` |

---

## 관련 파일 빠른 링크

- [사양서 (B01)](B01Bill.md)
- [Flow Chart (B02)](B02Bill_flow.md)
- [Sequence Chart (B03)](B03Bill_sequence.md)
- [프로그램 (PB_Make_Bill.py)](../PB_Make_Bill.py)
- [독립 exe (WinB_Make_Bill.exe)](../WinB_Make_Bill.exe)
- [의존성 (requirements.txt)](../requirements.txt)
