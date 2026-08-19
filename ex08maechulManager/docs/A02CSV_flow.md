# A02 CSV → 매출.xlsx 적재 Flow Chart

기준 사양: [A01CSV.md](A01CSV.md)

## 개요

`PA_CSV_to_Excel.py` CLI 실행 시 CSV 수집부터 Excel 저장·파일 이동까지의 처리 흐름이다.

## 전체 처리 흐름

```mermaid
flowchart TD
    start([시작]) --> parseArgs[CLI 인자 파싱]
    parseArgs --> guiCheck{--no-gui?}
    guiCheck -->|No| selectGui["tkinter filedialog 선택"]
    selectGui -->|취소| exitFail([종료 exit code != 0])
    guiCheck -->|Yes| resolveCli[CLI 경로 resolve]
    selectGui -->|선택 완료| checkPaths
    resolveCli --> checkPaths{경로·시트 존재?}
    checkPaths -->|No| errPaths[오류 메시지 출력]
    errPaths --> exitFail([종료 exit code != 0])

    checkPaths -->|Yes| collectCsv["csv_dir/*.csv + csv_dir/completed/*.csv 수집"]
    collectCsv --> checkCsvCount{CSV 0건?}
    checkCsvCount -->|Yes| errNoCsv[오류 메시지 출력]
    errNoCsv --> exitFail

    checkCsvCount -->|No| sortFiles[파일명 오름차순 정렬]
    sortFiles --> readFirst[첫 CSV utf-8-sig 읽기]
    readFirst --> readRest[나머지 CSV 순차 읽기]
    readRest --> validateHeader{헤더 16열 일치?}
    validateHeader -->|No| errHeader["오류: 파일명 + 컬럼 불일치"]
    errHeader --> exitFail

    validateHeader -->|Yes| mergeData[모든 CSV 데이터 병합]
    mergeData --> checkDryRun{--dry-run?}
    checkDryRun -->|Yes| printDryRun["검증 결과·건수만 출력"]
    printDryRun --> exitOk([종료 exit code 0])

    checkDryRun -->|No| loadXlsx["load_workbook(xlsx_path)"]
    loadXlsx --> checkSheet{매출 시트 존재?}
    checkSheet -->|No| errSheet[오류 메시지 출력]
    errSheet --> exitFail

    checkSheet -->|Yes| clearSheet["매출 시트 2행~max_row 값 삭제"]
    clearSheet --> writeRows["2행부터 병합 데이터 기록"]
    writeRows --> convertTypes["날짜·숫자 타입 변환"]
    convertTypes --> formatAmount["매출금액·매출이익·단가 #,##0 서식"]
    formatAmount --> saveXlsx[매출.xlsx 저장]
    saveXlsx --> checkSave{저장 성공?}
    checkSave -->|No PermissionError| errLocked["오류: Excel 파일 닫기 안내"]
    errLocked --> exitFail

    checkSave -->|Yes| ensureCompleted{completed 폴더 존재?}
    ensureCompleted -->|No| mkdirCompleted["completed 폴더 생성"]
    ensureCompleted -->|Yes| movePending
    mkdirCompleted --> movePending["csv_dir 직하위 CSV만 completed로 이동"]

    movePending --> printSummary["처리 요약 출력"]
    printSummary --> exitOk
```

## CSV 읽기·병합 상세

```mermaid
flowchart TD
    subgraph collect [CSV 수집]
        pending["csv_dir/*.csv (pending)"]
        done["csv_dir/completed/*.csv"]
        pending --> allFiles[전체 CSV 목록]
        done --> allFiles
    end

    allFiles --> sortAsc[파일명 오름차순]
    sortAsc --> baseHeader[첫 파일 헤더를 기준 헤더로 설정]

    baseHeader --> loopRead{다음 CSV}
    loopRead -->|있음| readUtf8["utf-8-sig로 읽기"]
    readUtf8 --> compareHeader{컬럼명·순서 동일?}
    compareHeader -->|No| stopErr[중단 및 오류 보고]
    compareHeader -->|Yes| appendRows[행 데이터 누적]
    appendRows --> loopRead
    loopRead -->|없음| merged[병합 DataFrame 완료]
```

## Excel 적재 상세

```mermaid
flowchart TD
    openWb[workbook 열기] --> keepOthers["거래처·서울·매출01 등 다른 시트 유지"]
    keepOthers --> selectSheet[매출 시트 선택]
    selectSheet --> clearData["1행 헤더 유지, 2행 이하 clear"]
    clearData --> resetFormat["금액 컬럼 서식 General로 초기화"]
    resetFormat --> writeLoop{다음 데이터 행}

    writeLoop -->|있음| colDate["매출일 → date"]
    colDate --> colNum["기간·전표번호·상품코드·거래처코드·매출수량 → number"]
    colNum --> colAmount["매출금액·매출이익·단가 → number + #,##0"]
    colAmount --> colStr["나머지 → string"]
    colStr --> writeLoop

    writeLoop -->|없음| saveFile[workbook 저장]
```

## 파일 이동 규칙

```mermaid
flowchart TD
    saveOk[Excel 저장 성공] --> listPending["csv_dir 직하위 *.csv 목록"]
    listPending --> loopMove{다음 pending 파일}
    loopMove -->|있음| checkDup{completed에 동일 파일명?}
    checkDup -->|Yes| overwrite[덮어쓰기 이동]
    checkDup -->|No| moveFile[completed로 이동]
    overwrite --> loopMove
    moveFile --> loopMove
    loopMove -->|없음| skipCompleted["completed 내부 파일은 재이동하지 않음"]
    skipCompleted --> finish[이동 완료]
```

## replace_all 재실행 흐름

```mermaid
flowchart LR
    run1[1차 실행] --> pending1["csv/ 36개 처리"]
    pending1 --> sheet1["매출 시트 2442행 재적재"]
    sheet1 --> comp1["36개 → completed/"]

    comp1 --> run2[2차 실행]
    run2 --> sources2["csv/ 신규 + completed/ 기존"]
    sources2 --> sheet2["매출 시트 전체 재구성"]
    sheet2 --> comp2["신규 csv/ 파일만 completed로 이동"]
```

## 범례

| 기호 | 의미 |
|------|------|
| `--dry-run` | Excel 저장·파일 이동 없이 검증만 수행 |
| pending | `csv_dir` 직하위 미처리 CSV |
| completed | `csv_dir/completed/` 이미 처리된 CSV |
| replace_all | 매 실행마다 시트 데이터를 비운 뒤 전체 CSV를 다시 적재 |
| `#,##0` | 매출금액·매출이익·단가 컬럼의 Excel 천 단위 콤마 서식 |
| `--no-gui` | GUI 없이 CLI `--csv-dir`·`--xlsx-path` 사용 |
| `C:\` | GUI 대화 상자 초기 경로 |
