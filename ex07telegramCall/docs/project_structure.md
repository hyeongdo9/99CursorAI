# ex07telegramCall 프로젝트 구조

> 생성일: 2026-08-19  
> Telegram ↔ Cursor 연동 및 MCP 테스트 프로젝트

## 디렉터리 트리

```
ex07telegramCall/
├── .cursor/
│   └── mcp.json              # MCP 서버 설정 (telegram, fetch, yfinance)
├── .env                      # 환경 변수 (봇 토큰, API 키 등)
├── .gitignore
├── docs/
│   └── project_structure.md  # 프로젝트 구조 문서 (본 파일)
├── homepy/
│   └── portfolio/            # 포트폴리오 웹 페이지
│       ├── css/
│       │   └── style.css
│       ├── js/
│       │   └── main.js
│       └── index.html
├── package.json              # Node.js 패키지 및 스크립트
├── package-lock.json
├── src/                      # Telegram → Cursor 브릿지 소스
│   ├── config.ts             # .env 설정 로드
│   ├── cursor-bridge.ts      # @cursor/sdk 연동
│   ├── index.ts              # 진입점
│   ├── telegram-bot.ts       # Telegram 메시지 수신 (grammy)
│   └── util.ts               # 유틸 (메시지 분할 등)
├── stock/
│   └── samsung.md            # 삼성전자 관련 문서
└── tsconfig.json             # TypeScript 설정
```

## 제외 항목

| 경로 | 설명 |
|------|------|
| `node_modules/` | npm 의존성 (자동 생성) |
| `dist/` | TypeScript 빌드 결과물 (`npm run build`) |

## 주요 구성 요소

### MCP 설정 (`.cursor/mcp.json`)

- **telegram** — Cursor → Telegram 메시지 전송
- **fetch** — URL 콘텐츠 조회
- **yfinance** — Yahoo Finance 데이터

### Telegram → Cursor 브릿지 (`src/`)

Telegram에서 수신한 메시지를 Cursor 로컬 에이전트로 전달하는 Node.js/TypeScript 프로그램.

| 스크립트 | 명령 |
|----------|------|
| 개발 실행 | `npm run dev` |
| 빌드 | `npm run build` |
| 프로덕션 실행 | `npm start` |

### 기타

- **homepy/portfolio/** — 정적 HTML 포트폴리오 사이트
- **stock/samsung.md** — 주식 관련 마크다운 문서
