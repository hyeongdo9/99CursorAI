# B03 거래처별 청구서·PDF 생성 Sequence Chart

기준 사양: [B01Bill.md](B01Bill.md)

## 개요

사용자, CLI 프로그램, Excel 파일, Excel COM 간의 상호작용 순서를 나타낸다.

## 정상 실행 시퀀스

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PB_Make_Bill.py
    participant Sales as resData/매출.xlsx
    participant Invoice as resData/청구서.xlsx
    participant PDF as resData/PDF
    participant ExcelCOM as Excel COM

    User->>CLI: python PB_Make_Bill.py
    Note over CLI: --sales-xlsx, --invoice-xlsx, --pdf-dir 파싱

    alt GUI 모드 (기본)
        CLI->>User: tkinter GUI (매출·청구서·PDF 폴더·연·월)
        User->>CLI: 실행
        CLI->>User: 작업 로그 실시간 표시
    else --no-gui
        User->>CLI: -m 2025-08 및 경로 인자
    end

    CLI->>Sales: pandas read_excel
    Sales-->>CLI: 매출·거래처 시트

    CLI->>Sales: 매출 A열 yyyy-mm 필터
    Sales-->>CLI: 월별 明細 데이터
    Note over CLI: K열 거래처코드별 그룹핑

    loop 거래처별
        CLI->>Sales: 거래처 A열 코드 조회
        alt 코드 매칭
            Sales-->>CLI: 우편번호·주소·거래처명
            CLI->>Invoice: 청구서 시트 copy_worksheet
            CLI->>Invoice: B5/B6/B7 수신처 입력
            CLI->>Invoice: R20~ 明細 A,B,F,G,H 입력
            CLI->>Invoice: A열 yy-mm-dd 서식 적용
            opt 明細 16행 초과
                CLI->>Invoice: R35~R36 사이 행 삽입
            end
            CLI->>Invoice: 합계·I17 수식 갱신
        else 코드 미매칭
            CLI-->>User: 경고 (skip)
        end
    end

    CLI->>Invoice: save (시트 생성 완료)
    Invoice-->>CLI: 저장 성공

    CLI->>PDF: mkdir pdf_dir

    CLI->>ExcelCOM: 1순위 Excel COM PDF 시도
    alt Excel COM 성공
        ExcelCOM->>Invoice: Open 청구서.xlsx
        loop 생성된 거래처 시트
            ExcelCOM->>PDF: ExportAsFixedFormat PDF
        end
        ExcelCOM->>ExcelCOM: Quit
    else Excel COM 실패
        CLI->>CLI: 2순위 LibreOffice 또는 3순위 ReportLab
        CLI->>PDF: 시트별 PDF 생성·검증
    end

    CLI->>Invoice: 생성 시트 삭제
    Note over Invoice: 청구서·BackUp·sample 유지
    CLI->>Invoice: save (최종)
    Invoice-->>CLI: 저장 성공

    CLI-->>User: 로그·처리 요약 출력
    Note over User,CLI: GUI는 닫기 버튼으로 수동 종료
```

## dry-run 실행 시퀀스

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PB_Make_Bill.py
    participant Sales as resData/매출.xlsx
    participant Invoice as resData/청구서.xlsx

    User->>CLI: python PB_Make_Bill.py --no-gui -m 2025-08 --dry-run

    CLI->>Sales: read_excel + 월별 필터
    CLI->>Sales: 거래처코드별 그룹핑
    Sales-->>CLI: 거래처별 明細 건수

    CLI-->>User: 대상 월·거래처·明細 행 수 출력
    Note over CLI,Invoice: 시트 생성·PDF·삭제 없음
```

## GUI 실행 시퀀스

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PB_Make_Bill.py / WinB_Make_Bill.exe
    participant GUI as tkinter GUI

    User->>CLI: 프로그램 실행
    CLI->>GUI: 매출·청구서·PDF 폴더·연·월 입력 화면
    Note over GUI: 파일 대화상자 initialdir=C:\

    User->>GUI: 경로 선택·연·월 입력
    User->>GUI: 실행 클릭
    GUI->>CLI: run(log_fn=append_log)

    loop 처리 단계
        CLI->>GUI: 작업 로그 append (시트 생성·PDF 진행)
    end

    CLI->>GUI: 완료 요약 로그
    Note over User,GUI: 창 유지 — 닫기 버튼으로 종료
```

## 明細 날짜 서식 적용 시퀀스

```mermaid
sequenceDiagram
    participant CLI as PB_Make_Bill.py
    participant Invoice as 청구서.xlsx

    Note over CLI: 明細 행 R20~

    CLI->>Invoice: A열 ← 매출일 date 값
    CLI->>Invoice: number_format = yy-mm-dd
    CLI->>Invoice: column A width >= 12
    Note over Invoice: PDF에서 #### 대신 25-08-31 표시
```

## 明細 16행 초과 시퀀스

```mermaid
sequenceDiagram
    participant CLI as PB_Make_Bill.py
    participant Invoice as 청구서.xlsx

    Note over CLI: 거래처코드 5001, 明細 27건

    CLI->>Invoice: copy 청구서 시트
    CLI->>Invoice: R20~R46 明細 입력 (27건)

    CLI->>Invoice: insert_rows at R36, count=11
    Note over Invoice: insert = 27 - 16 = 11

    CLI->>Invoice: H20~H46 = F*G 수식
    CLI->>Invoice: H47 = SUM(H20:H46)
    CLI->>Invoice: H48 = INT(H47*0.1)
    CLI->>Invoice: E17=H47, G17=H48, I17=H47+H48
```

## PDF 출력 시퀀스 (3단계 fallback)

```mermaid
sequenceDiagram
    participant CLI as PB_Make_Bill.py
    participant ExcelCOM as Excel COM
    participant LO as LibreOffice
    participant RL as ReportLab
    participant Invoice as resData/청구서.xlsx
    participant PDF as PDF 저장 폴더

    CLI->>ExcelCOM: CoInitialize + Dispatch/EnsureDispatch
    alt 1순위 Excel COM
        ExcelCOM->>Invoice: Workbooks.Open (ReadOnly)
        loop 거래처 시트 N개
            ExcelCOM->>PDF: ExportAsFixedFormat + _verify_pdf_file
        end
        ExcelCOM->>ExcelCOM: Quit
    else COM 실패
        CLI->>LO: 2순위 soffice --headless --convert-to pdf
        alt LibreOffice 성공
            LO->>PDF: 시트별 PDF
        else LO 실패
            CLI->>RL: 3순위 malgun.ttf + canvas PDF
            RL->>PDF: 시트별 PDF
        end
    end
```

## PDF 후 시트 삭제 시퀀스

```mermaid
sequenceDiagram
    participant CLI as PB_Make_Bill.py
    participant Invoice as resData/청구서.xlsx

    Note over Invoice: PDF 출력 완료

    loop 이번 실행 생성 시트
        CLI->>Invoice: del sheet (거래처명_코드_YYMM)
    end

    Note over Invoice: 유지: 청구서, 청구서 BackUp, 청구서 sample
    CLI->>Invoice: save
    CLI-->>CLI: 삭제 시트 수 집계
```

## 오류 처리 시퀀스

### Excel COM 실패 → fallback 성공

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PB_Make_Bill.py
    participant Invoice as resData/청구서.xlsx
    participant ExcelCOM as Excel COM
    participant RL as ReportLab

    User->>CLI: 실행 (Excel 미설치)
    CLI->>Invoice: 시트 생성·save 성공
    CLI->>ExcelCOM: Dispatch Excel.Application
    ExcelCOM-->>CLI: REGDB_E_CLASSNOTREG
    CLI->>CLI: 로그: Excel COM 실패, 재시도
    CLI->>RL: export_pdfs_with_reportlab
    RL->>CLI: PDF N개 생성·검증
    CLI->>Invoice: 임시 시트 삭제·save
    CLI-->>User: 로그: PDF 출력 완료 (내장 변환)
```

### Excel 파일 잠금

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PB_Make_Bill.py
    participant Invoice as resData/청구서.xlsx

    User->>CLI: python PB_Make_Bill.py -m 2025-08
    CLI->>Invoice: save 또는 COM Open
    Invoice-->>CLI: PermissionError

    CLI-->>User: Excel 파일을 닫아 달라는 안내
    CLI-->>User: exit code != 0
```

### 거래처코드 미매칭

```mermaid
sequenceDiagram
    participant CLI as PB_Make_Bill.py
    participant Sales as resData/매출.xlsx

    CLI->>Sales: K열 코드 조회
    Sales-->>CLI: 거래처 시트에 없는 코드

    CLI-->>CLI: stderr 경고 출력
    Note over CLI: 해당 거래처 skip, 나머지 계속
```

## 참여자 설명

| 참여자 | 설명 |
|--------|------|
| 사용자 | GUI 또는 CLI 실행 및 결과 확인 |
| PB_Make_Bill.py / WinB_Make_Bill.exe | 매출 추출, 시트 생성, PDF 3단계 fallback, 시트 삭제, GUI 로그 |
| resData/매출.xlsx | 매출·거래처 시트 (읽기) |
| resData/청구서.xlsx | 청구서 템플릿 복사·임시 시트·저장 |
| resData/PDF (또는 GUI 지정 폴더) | PDF 출력 폴더 |
| Excel COM | 1순위 PDF (`ExportAsFixedFormat`) |
| LibreOffice | 2순위 PDF (`soffice --headless`) |
| ReportLab | 3순위 내장 PDF (Excel/LO 없을 때) |
