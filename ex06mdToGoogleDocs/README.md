# MD → Google Docs

Markdown 파일을 Google Docs에 자동 등록합니다.

## 사전 준비

1. [Google Cloud Console](https://console.cloud.google.com/)에서 OAuth 클라이언트 JSON 다운로드
2. 프로젝트 루트에 `OAuth클라이언트파일.json` 저장
3. `.env.example`을 `.env`로 복사 후 `GOOGLE_DRIVE_FOLDER_ID` 설정

## 설치

```bash
npm install
```

## OAuth 인증

프로젝트 루트에서 실행 (Desktop/Installed OAuth 클라이언트 자동 지원):

```bash
npm run auth
```

- Desktop(`installed`) 클라이언트: `http://127.0.0.1:3000/oauth2callback` 루프백 방식 사용 (Console redirect 변경 불필요)
- Web 클라이언트: Console에 `http://localhost:3000/oauth2callback` 등록 필요
- 브라우저가 자동으로 열리며, 승인 후 `token.json` 생성

환경 변수 (선택, `.env` 또는 cmd `set`):

```bash
set GOOGLE_OAUTH_CLIENT_PATH=credentials.json
set GOOGLE_OAUTH_TOKEN_PATH=token.json
```

## 사용법

```bash
# 자동 감시 — job/ 에 .md 복사 시 자동 변환
npm run watch

# 단일 파일 처리
npm run process -- --file job/spec-excerpt-test.md

# job/ 전체 처리
npm run process -- --all
```

`npm run watch`를 켠 뒤 `job/`에 Markdown을 복사하면 자동으로 Google Docs로 변환되고, 성공 시 `job/completed/`, 실패 시 `job/failed/`로 이동합니다.

## 디렉터리

- `job/` — 처리 대기 MD
- `job/completed/` — 성공한 파일
- `job/failed/` — 실패한 파일 + `.error.log`

## Cursor MCP

`.cursor/mcp.json`에 `md-to-gdocs` server가 등록되어 있습니다.
Cursor에서 MCP tool을 직접 호출해 테스트할 수 있습니다.

자세한 사양은 [docs/SPEC-md-to-gdocs.md](docs/SPEC-md-to-gdocs.md) 참고.
