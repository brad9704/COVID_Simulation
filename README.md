# Flattening the Curve

UNIST에서 개발한 COVID-19 방역정책 교육용 시리어스 게임입니다.
에이전트 기반 SEIHR 시뮬레이션 위에서 싱글/멀티플레이어(협력 COOP / 경쟁 COMP)로 방역정책을 설계하고 그 결과를 확인합니다.

## 구조

```
core/     공유 시뮬레이션 로직 (simNode.js, worker.js — Web Worker에서 실행)
client/   프론트엔드 (game.html, js/, css/, img/, data/)
server/   Express REST API + Socket.IO 멀티플레이어 서버
```

## 실행

```bash
cd server
npm install
cp .env.example .env    # 필요 시 SERVER_PORT, DATA_DIR 수정
node index.js
```

서버가 `client/`와 `core/`를 정적 파일로 함께 서빙하므로 브라우저에서 `http://localhost:3000/game.html`로 접속합니다.
클라이언트는 로그인과 멀티플레이 동기화에 Socket.IO를 사용하므로 서버가 실행 중이어야 합니다.

배포 환경에서 서버 주소가 다르면 `client/game.html`에서 `window.SERVER_URL`을 설정합니다.

## 서버 데이터

`DATA_DIR`(기본 `./data`) 아래에 학교별 디렉토리를 둡니다.

```
data/
└── <school>/
    ├── students.json   # [{ "studentID": "...", "name": "..." }, ...]
    ├── team.json       # { "teamType": "COOP" | "COMP" }
    └── <studentID>/trials.json   # 결과 (서버가 자동 기록)
```

### REST API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/list` | 학교 목록 |
| GET | `/api/list?school=X` | 학교 내 학생 목록 |
| GET | `/api/score?school=X&student=Y` | 학생 결과 조회 |
| POST | `/api/score?school=X&student=Y` | 결과 저장 |
| GET | `/api/file?filename=X` | `DATA_DIR` 내 설정 파일 |

## 라이선스

[LICENSE.md](LICENSE.md) 참조.
