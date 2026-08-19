# B02 거래처별 청구서·PDF 생성 Flow Chart

기준 사양: [B01Bill.md](B01Bill.md)

## 개요

`PB_Make_Bill.py` 실행 시 GUI 또는 CLI로 연·월을 지정한 뒤, 월별 매출 추출부터 거래처별 청구서 시트 생성, PDF 출력, 임시 시트 삭제까지의 처리 흐름이다.

## 전체 처리 흐름

```mermaid
flowchart TD
    start([시작]) --> parseArgs[CLI 인자 파싱]
    parseArgs --> guiCheck{--no-gui?}
    guiCheck -->|No| selectGui["tkinter GUI: 경로·연·월·PDF 폴더"]
    selectGui --> runGui[실행 클릭]
    runGui --> checkMonth{입력 검증}
    guiCheck -->|Yes| checkMonthCli{-m 지정?}
    checkMonthCli -->|No| errNoMonth[CLI -m 누락 오류]
    errNoMonth --> exitFail
    checkMonthCli -->|Yes| checkMonth
    checkMonth -->|No| errMonth[오류 메시지·로그 출력]
    errMonth --> exitFail([종료 exit code != 0])

    checkMonth -->|Yes| checkPaths{경로·시트 존재?}
    checkPaths -->|No| errPaths[오류 메시지 출력]
    errPaths --> exitFail

    checkPaths -->|Yes| loadSales[매출.xlsx 매출·거래처 시트 로드]
    loadSales --> filterMonth[A열 매출일로 월별 필터]
    filterMonth --> checkData{해당 월 데이터 0건?}
    checkData -->|Yes| printEmpty[0건 요약 출력]
    printEmpty --> exitOk([종료 exit code 0])

    checkData -->|No| groupByCode[K열 거래처코드별 그룹핑]
    groupByCode --> checkDryRun{--dry-run?}
    checkDryRun -->|Yes| printDryRun[거래처·明細 건수 출력]
    printDryRun --> exitOk

    checkDryRun -->|No| openInvoice[청구서.xlsx load_workbook]
    openInvoice --> customerLoop{다음 거래처}

    customerLoop -->|있음| joinClient{거래처 시트 조인?}
    joinClient -->|No| warnSkip[경고 후 skip]
    warnSkip --> customerLoop

    joinClient -->|Yes| copySheet[청구서 시트 복사]
    copySheet --> nameSheet["시트명: 거래처명_코드_YYMM"]
    nameSheet --> fillHeader[B5/B6/B7 수신처 입력]
    fillHeader --> fillDetail[R20~ 明細 데이터 입력]
    fillDetail --> dateFormat["A열 yy-mm-dd·열 너비·print_area"]
    dateFormat --> checkRows{明細 16행 초과?}
    checkRows -->|Yes| insertRows[R35~R36 사이 행 삽입]
    checkRows -->|No| updateFormula[합계·I17 수식 갱신]
    insertRows --> updateFormula
    updateFormula --> customerLoop

    customerLoop -->|없음| saveXlsx[청구서.xlsx 저장]
    saveXlsx --> checkSave{저장 성공?}
    checkSave -->|No| errLocked["오류: Excel 파일 닫기 안내"]
    errLocked --> exitFail

    checkSave -->|Yes| mkdirPdf[pdf_dir 폴더 생성]
    mkdirPdf --> pdfTry1[1순위 Excel COM PDF]
    pdfTry1 --> pdfOk1{성공?}
    pdfOk1 -->|No| pdfTry2[2순위 LibreOffice PDF]
    pdfTry2 --> pdfOk2{성공?}
    pdfOk2 -->|No| pdfTry3[3순위 ReportLab 내장 PDF]
    pdfTry3 --> pdfOk3{성공?}
    pdfOk3 -->|No| errPdf[PDF 출력 실패]
    errPdf --> exitFail
    pdfOk1 -->|Yes| deleteSheets
    pdfOk2 -->|Yes| deleteSheets
    pdfOk3 -->|Yes| deleteSheets[생성 시트 전부 삭제]
    deleteSheets --> finalSave[청구서.xlsx 최종 저장]
    finalSave --> printSummary[로그·요약 출력]
    printSummary --> exitOk([종료 — GUI는 닫기로 수동 종료])
```

## 明細 입력·행 삽입 상세

```mermaid
flowchart TD
    startDetail[거래처 明細 N건] --> writeStart[R20부터 순차 입력]

    writeStart --> mapCols["A←매출일, B←상품명, F←수량, G←단가"]
    mapCols --> dateFmt["A열 number_format = yy-mm-dd"]
    dateFmt --> colWidth["A열 width >= 12"]
    colWidth --> printArea["print_area = A1:I{tax_row}"]
    printArea --> formulaH["H = F × G 수식"]
    formulaH --> checkN{N > 16?}

    checkN -->|No| clearUnused[미사용 20~35행 clear]
    checkN -->|Yes| calcInsert["insert = N - 16"]
    calcInsert --> insertAt[R35와 R36 사이 insert행 삽입]
    insertAt --> copyMerge[B:E 병합·수식 패턴]

    clearUnused --> updateSum
    copyMerge --> updateSum[합계 행 수식 갱신]

    updateSum --> sumRow["H_sum = SUM(H20:H_last)"]
    sumRow --> taxRow["H_tax = INT(H_sum × 0.1)"]
    taxRow --> summaryRow["E17,G17,I17 참조 갱신"]
    summaryRow --> fixI17["I17 = H_sum + H_tax 보정"]
```

## PDF 출력·정리 상세 (3단계 fallback)

```mermaid
flowchart TD
    saveOk[청구서.xlsx 저장] --> tryExcel[1순위 Excel COM]
    tryExcel --> excelOk{성공?}
    excelOk -->|Yes| verifyPdf[PDF 파일 존재·크기 검증]
    excelOk -->|No| tryLO[2순위 LibreOffice headless]
    tryLO --> loOk{성공?}
    loOk -->|Yes| verifyPdf
    loOk -->|No| tryRL[3순위 ReportLab 내장]
    tryRL --> rlOk{성공?}
    rlOk -->|No| failPdf[BillError]
    rlOk -->|Yes| verifyPdf

    verifyPdf --> delLoop[생성 시트 삭제]
    delLoop --> keepOrig["청구서, BackUp, sample 유지"]
    keepOrig --> finalSave[workbook 저장]
```

| 순위 | 함수 | 조건 |
|------|------|------|
| 1 | `export_pdfs_with_excel_com` | Excel 설치, COM 정상 |
| 2 | `export_pdfs_with_libreoffice` | `soffice.exe` 존재 |
| 3 | `export_pdfs_with_reportlab` | `reportlab` + Windows 한글 폰트 |

## 데이터 매핑 요약

```mermaid
flowchart LR
    subgraph maecheul [매출 시트]
        mA[A 매출일]
        mG[G 상품명]
        mK[K 거래처코드]
        mM[M 수량]
        mP[P 단가]
    end

    subgraph georae [거래처 시트]
        gA[A 코드]
        gB[B 거래처명]
        gC[C 우편번호]
        gD[D 주소]
    end

    subgraph invoice [청구서 시트]
        iB5[B5 우편번호]
        iB6[B6 주소]
        iB7[B7 거래처명]
        iA["A 날짜 yy-mm-dd"]
        iB[B 상품명]
        iF[F 수량]
        iG[G 단가]
        iH[H 금액]
    end

    mK --> gA
    gC --> iB5
    gD --> iB6
    gB --> iB7
    mA --> iA
    mG --> iB
    mM --> iF
    mP --> iG
    iF --> iH
    iG --> iH
```

## 범례

| 기호 | 의미 |
|------|------|
| `--dry-run` | 시트/PDF 생성 없이 대상·건수만 출력 |
| `--no-gui` | GUI 없이 CLI `-m`만 사용 |
| GUI | 기본 실행 — 경로·연·월·PDF 폴더·작업 로그·실행/닫기 |
| WinB_Make_Bill.exe | PyInstaller 독립 실행 (콘솔 없음) |
| fallback | Excel COM → LibreOffice → ReportLab 순 PDF 시도 |
| YYMM | 2자리 연도+월 (2025-08 → 2508) |
| yy-mm-dd | A열 날짜 표시 (예: 25-08-31) |
| 16행 | 청구서 템플릿 明細 행 (R20~R35) |
| COM | Windows Excel `pywin32` 자동화 |
| skip | 거래처코드 미매칭 시 해당 거래처 제외 |
