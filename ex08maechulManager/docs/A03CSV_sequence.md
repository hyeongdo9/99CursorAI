# A03 CSV → 매출.xlsx 적재 Sequence Chart

기준 사양: [A01CSV.md](A01CSV.md)

## 개요

사용자, CLI 프로그램, CSV 폴더, Excel 파일 간의 상호작용 순서를 나타낸다.

## 정상 실행 시퀀스

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py
    participant CsvDir as resData/csv
    participant Completed as resData/csv/completed
    participant Xlsx as resData/매출.xlsx

    User->>CLI: python PA_CSV_to_Excel.py 실행
    Note over CLI: --dry-run, --no-gui 파싱

    alt GUI 모드 (기본)
        CLI->>User: askdirectory CSV 폴더 (initialdir C:\)
        User-->>CLI: csv_dir
        CLI->>User: askopenfilename 매출.xlsx (initialdir C:\)
        User-->>CLI: xlsx_path
    else --no-gui
        Note over CLI: CLI --csv-dir, --xlsx-path 사용
    end

    CLI->>CsvDir: *.csv 목록 조회 (pending)
    CsvDir-->>CLI: pending CSV 목록

    CLI->>Completed: *.csv 목록 조회
    Completed-->>CLI: completed CSV 목록

    loop 파일명 오름차순
        CLI->>CsvDir: CSV 파일 읽기 (utf-8-sig)
        CsvDir-->>CLI: 헤더 + 데이터 행
    end

    loop completed CSV
        CLI->>Completed: CSV 파일 읽기 (utf-8-sig)
        Completed-->>CLI: 헤더 + 데이터 행
    end

    Note over CLI: 헤더 16열 검증 및 데이터 병합

    CLI->>Xlsx: load_workbook
    Xlsx-->>CLI: workbook (다른 시트 포함)

    CLI->>Xlsx: 매출 시트 2행~ 데이터 clear
    CLI->>Xlsx: 병합 데이터 2행부터 기록
    Note over CLI,Xlsx: 날짜·숫자 타입 변환, 매출금액·매출이익·단가 #,##0 서식

    CLI->>Xlsx: save
    Xlsx-->>CLI: 저장 성공

    alt completed 폴더 없음
        CLI->>Completed: mkdir completed
    end

    loop csv/ 직하위 pending 파일
        CLI->>CsvDir: 파일 이동 요청
        CsvDir->>Completed: shutil.move
        Completed-->>CLI: 이동 완료
    end

    CLI-->>User: 처리 요약 출력
    Note over User,CLI: 읽은 CSV 수, 적재 행 수, 이동 파일 수
```





## GUI 경로 선택 시퀀스

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py

    User->>CLI: python PA_CSV_to_Excel.py
    CLI->>User: filedialog.askdirectory (initialdir C:\)
    alt 폴더 선택 취소
        User-->>CLI: cancel
        CLI-->>User: 오류 exit 1
    else 폴더 선택
        User-->>CLI: csv_dir 경로
        CLI->>User: filedialog.askopenfilename (initialdir C:\)
        alt 파일 선택 취소
            User-->>CLI: cancel
            CLI-->>User: 오류 exit 1
        else 파일 선택
            User-->>CLI: xlsx_path
            Note over CLI: 기존 집계·completed 이동 로직 수행
        end
    end
```

## dry-run 실행 시퀀스

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py
    participant CsvDir as resData/csv
    participant Completed as resData/csv/completed
    participant Xlsx as resData/매출.xlsx

    User->>CLI: python PA_CSV_to_Excel.py --dry-run
    CLI->>CsvDir: *.csv 목록 조회
    CsvDir-->>CLI: pending CSV 목록
    CLI->>Completed: *.csv 목록 조회
    Completed-->>CLI: completed CSV 목록

    loop 모든 CSV
        CLI->>CsvDir: CSV 읽기 및 헤더 검증
        CsvDir-->>CLI: 데이터
    end

    Note over CLI: 병합 건수 계산

    CLI-->>User: 검증 결과·건수 출력
    Note over CLI,Xlsx: Excel 저장 및 파일 이동 없음
```





## 오류 처리 시퀀스



### 헤더 불일치

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py
    participant CsvDir as resData/csv
    participant Xlsx as resData/매출.xlsx

    User->>CLI: python PA_CSV_to_Excel.py
    CLI->>CsvDir: CSV 순차 읽기
    CsvDir-->>CLI: 헤더 불일치 파일 반환

    CLI-->>User: 오류 메시지 (파일명 + 컬럼 불일치)
    Note over CLI,Xlsx: Excel 수정 없음, 파일 이동 없음
    CLI-->>User: exit code != 0
```





### Excel 저장 실패 (파일 잠금)

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py
    participant CsvDir as resData/csv
    participant Xlsx as resData/매출.xlsx

    User->>CLI: python PA_CSV_to_Excel.py
    CLI->>CsvDir: CSV 읽기 및 병합
    CLI->>Xlsx: load_workbook
    CLI->>Xlsx: 매출 시트 데이터 기록
    CLI->>Xlsx: save
    Xlsx-->>CLI: PermissionError

    CLI-->>User: Excel 파일을 닫아 달라는 안내
    Note over CsvDir: pending CSV 이동 없음
    CLI-->>User: exit code != 0
```





### 경로·시트·CSV 없음

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py
    participant CsvDir as resData/csv
    participant Xlsx as resData/매출.xlsx

    User->>CLI: python PA_CSV_to_Excel.py

    alt 경로不存在
        CLI-->>User: 경로 오류 메시지
    else 시트不存在
        CLI->>Xlsx: load_workbook
        CLI-->>User: 시트不存在 오류
    else CSV 0건
        CLI->>CsvDir: *.csv 조회
        CsvDir-->>CLI: 빈 목록
        CLI-->>User: CSV 없음 오류
    end

    Note over CLI: Excel 수정·파일 이동 없음
    CLI-->>User: exit code != 0
```





## 재실행 시퀀스 (pending + completed)

```mermaid
sequenceDiagram
    actor User as 사용자
    participant CLI as PA_CSV_to_Excel.py
    participant CsvDir as resData/csv
    participant Completed as resData/csv/completed
    participant Xlsx as resData/매출.xlsx

    Note over Completed: 1차 실행 후 36개 CSV 보관 중
    User->>CsvDir: 신규 CSV 1개 추가

    User->>CLI: python PA_CSV_to_Excel.py (2차 실행)

    CLI->>CsvDir: pending 1개 조회
    CLI->>Completed: completed 36개 조회
    Note over CLI: 37개 CSV 병합

    CLI->>Xlsx: 매출 시트 clear 후 37개 전체 재적재
    Xlsx-->>CLI: 저장 성공

    CLI->>CsvDir: 신규 1개만 completed로 이동
    Note over Completed: completed 37개 유지

    CLI-->>User: 처리 요약 (적재 행 수 = 전체 합계)
```





## 참여자 설명


| 참여자                   | 설명                               |
| --------------------- | -------------------------------- |
| 사용자                   | CLI를 실행하고 결과를 확인                 |
| PA_CSV_to_Excel.py   | CSV 수집·검증·병합, Excel 적재, 금액 서식, 파일 이동 담당 |
| resData/csv           | 미처리(pending) CSV 보관              |
| resData/csv/completed | 처리 완료 CSV 보관                     |
| resData/매출.xlsx       | 매출 시트만 갱신, 다른 시트는 보존             |


