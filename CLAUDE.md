# Flattening the Curve — 리팩토링 지시서

## 프로젝트 개요

UNIST에서 개발한 COVID-19 방역정책 교육용 시리어스 게임.
agent-based SEIHR 시뮬레이션, 싱글/멀티플레이어 모드.
교육 실험 재진행을 위해 리팩토링.

원본 레포: https://github.com/brad9704/COVID_Simulation

---

## 현재 구조의 문제

### 파일 중복
- `en-us/`, `ko-kr/`, `unstable/en-us/singleplayer/`, `unstable/en-us/multiplayer/` 4개 디렉토리가
  거의 동일한 파일을 복붙으로 관리 중
- `simNode_game.js`, `worker_game.js`는 en-us와 ko-kr이 **완전히 동일** (diff 0줄)
- 버그 수정 시 4~6군데 동시에 수정해야 하는 구조

### 하드코딩된 서버 주소
- `chickenberry.ddns.net:8192` — DNS 사망, 서버 없음
- `ko-kr/main_game.js`, `ko-kr/netSocket.js`, `ko-kr/network.js` 세 파일에 분산

### Performance: O(n²) 충돌 감지 (최우선)
`worker_game.js`의 `ticked()` 함수:
```javascript
this.nodes().forEach(node1 => {
    this.nodes().forEach(node2 => {   // 1000노드 × 1000 = 매 프레임 100만 번
        let a = (node1.x - node2.x), b = node1.y - node2.y;
        if (a*a+b*b < param.size*param.size*4)
            collision(node1, node2);
    })
});
```
1000 노드, 24fps → 초당 2,400만 번 거리 계산. 노드 많으면 렉 원인.

### 기타 버그
- `collision()` 내부에 `postMessage({type: "CONSOLE_LOG", ...})` 호출이 감염 이벤트마다 실행됨.
  디버그 코드 잔재. 제거 필요.
- `simNode_game.js` 215번 줄: `simulation.nodes().filter(e => e.state === state.H2).length`를
  state change 이벤트마다 전체 노드 스캔. `hospitalCount` 카운터 변수로 대체 필요.
- `node_modules/`(13MB)가 커밋되어 있음. 실제로는 CDN에서 로드하므로 불필요.

### Flask 서버 코드 버그 (SimFlaskServer)
기존 Flask 서버 코드에 다음 버그 존재:
- `json.read()` → `json.load()` 로 수정 필요
- `json.dump(data, self.path)` → `json.dump(data, json_file)` (인자 순서 오류)
- `Student(student).write_trial()` → `Student(school, student).write_trial()` (인자 누락)

---

## 목표 구조

```
COVID_Simulation/
├── CLAUDE.md
├── .gitignore                  # node_modules, .env, data/ 추가
├── core/                       # 언어 무관 공유 시뮬레이션 로직
│   ├── simNode.js              # (기존 simNode_game.js — 수정 없이 이동)
│   └── worker.js               # (기존 worker_game.js — performance 수정 후 이동)
├── client/                     # 프론트엔드
│   ├── index.html              # 언어 선택 또는 ko 기본
│   ├── game.html               # 통합 게임 HTML (ko-kr 기반, 멀티플레이어 포함)
│   ├── js/
│   │   ├── main.js             # (기존 main_game.js 정리)
│   │   ├── network.js          # 서버 주소 환경변수화, 오프라인 모드 지원
│   │   └── socket.js           # (기존 netSocket.js)
│   ├── css/
│   │   └── style.css
│   ├── img/                    # 에셋 (현행 유지)
│   └── data/
│       ├── default_params.json
│       ├── virus_info.json
│       └── Key_facts.json
└── server/                     # 백엔드
    ├── package.json
    ├── .env.example            # SERVER_PORT, DATA_DIR 등
    ├── index.js                # Express + Socket.IO 통합 서버
    └── data/                   # 게임 결과 저장 (gitignore)
```

---

## 작업 순서

### 1단계: Git 정리 (먼저 할 것)
```bash
# .gitignore 생성
echo "node_modules/\n.env\nserver/data/" > .gitignore

# node_modules 히스토리에서 제거
git rm -r --cached node_modules
git commit -m "chore: remove node_modules from tracking"
```

### 2단계: 공유 코어 분리
- `en-us/simNode_game.js` → `core/simNode.js` (내용 동일, 이동만)
- `en-us/worker_game.js` → `core/worker.js` (performance 수정 후 이동)
- `worker.js`에서 `importScripts` 경로 업데이트

### 3단계: Performance 수정 (핵심)

`core/worker.js`의 `ticked()` 함수를 spatial grid 방식으로 교체:

```javascript
// 기존 O(n²) — 삭제
this.nodes().forEach(node1 => {
    this.nodes().forEach(node2 => { ... })
});

// 교체: spatial grid O(n)
function buildGrid(nodes, cellSize) {
    const grid = new Map();
    nodes.forEach(node => {
        const cx = Math.floor(node.x / cellSize);
        const cy = Math.floor(node.y / cellSize);
        const key = `${cx},${cy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(node);
    });
    return grid;
}

function checkCollisions(nodes, cellSize) {
    const grid = buildGrid(nodes, cellSize);
    nodes.forEach(node1 => {
        const cx = Math.floor(node1.x / cellSize);
        const cy = Math.floor(node1.y / cellSize);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbors = grid.get(`${cx+dx},${cy+dy}`);
                if (!neighbors) continue;
                neighbors.forEach(node2 => {
                    if (node1.index >= node2.index) return; // 중복 방지
                    const a = node1.x - node2.x, b = node1.y - node2.y;
                    if (a*a + b*b < param.size * param.size * 4)
                        collision(node1, node2);
                });
            }
        }
    });
}
```

`ticked()` 내부의 이중 루프를 `checkCollisions(simulation.nodes(), param.size * 2)`로 교체.

아울러 같은 파일에서:
- `collision()` 함수 내 `postMessage({type: "CONSOLE_LOG", ...})` 두 줄 삭제
- `hospitalCount` 전역 변수 추가, H2 state 진입/퇴출 시점에 증감,
  `simulation.nodes().filter(e => e.state === state.H2).length` 참조를 `hospitalCount`로 교체

### 4단계: 클라이언트 통합
- `ko-kr/` 기반으로 `client/` 구성 (멀티플레이어 코드 포함된 버전)
- `en-us/`는 참조용으로만 유지하거나 삭제
- `unstable/` 삭제 (브랜치로 관리할 것)
- `main.js` 상단의 하드코딩 제거:
  ```javascript
  // 삭제
  const REQUEST_ID = "https://chickenberry.ddns.net:8192/FTC";
  // 교체
  const SERVER_URL = window.SERVER_URL || "http://localhost:3000";
  ```
- `game.html`에 `<script>window.SERVER_URL = "..."</script>` 주입 방식으로 배포 환경별 설정

### 5단계: 서버 재구축

기존 서버는 두 개였음:
- Flask REST API (결과 저장/조회) — `SimFlaskServer.ipynb`
- Node.js + Socket.IO (멀티플레이어 실시간) — 코드 없음, 재구축 필요

**이를 Node.js Express + Socket.IO 하나로 통합.**

`server/index.js` 구현 사항:

**REST API (기존 Flask 역할 대체):**
```
GET  /api/list                     학교 목록
GET  /api/list?school=X            학교 내 학생 목록
GET  /api/score?school=X&student=Y 학생 결과 조회
POST /api/score?school=X&student=Y 결과 저장
GET  /api/file?filename=X          설정 파일 서빙
```

결과 저장 포맷 (기존 Flask Student.write_trial 기준):
```json
{
  "RecordedTime": "...",
  "DifficultyLevel": "",
  "ElapsedTime": 0,
  "TotalInfection": 0,
  "TotalDeath": 0,
  "GDP": 0,
  "SpentBudget": 0
}
```

**Socket.IO 이벤트 (기존 netSocket.js 클라이언트 기준으로 역방향 구현):**

클라이언트 → 서버:
- `connection` — 접속
- `login` `{ studentID }` — 로그인
- `gameReady` `{ is: bool }` — 준비 상태 토글
- `gameStart` — 게임 시작 (host만)
- `turnReady` `{ is, week, action }` — 주차 종료 준비
- `turnStart` — 다음 턴 시작 (host만)
- `weekOver` `{ week, infected, ICU, death, GDP, vaccine }` — 주간 결과 전송
- `gameOver` — 게임 종료
- `gameReset` — 게임 리셋
- `hintFound` `{ type: hintTopic }` — 힌트 발견

서버 → 클라이언트:
- `loginSuccess` `{ studentID, studentName, teamType, team, host, hint, students }` — 로그인 성공
- `loginFail` `{ Reason }` — 로그인 실패
- `updateUserLogin` `{ students }` — 유저 상태 변경
- `chat` `{ studentID, message }` — 채팅
- `weekOver` `{ studentID, result }` — 타 플레이어 주간 결과
- `turnReady` `{ students }` — 턴 준비 상태
- `gameStart` `{ students }` — 게임 시작
- `turnStart` `{ students }` — 턴 시작 (+ multiplayer queue)
- `gameOver` `{ students }` — 게임 오버
- `hintFound` `{ HINT }` — 힌트 동기화
- `announce` `{ content }` — 공지
- `refresh` — 강제 새로고침
- `redir` `{ link }` — 리다이렉트

팀 타입: `"COMP"` (경쟁) / `"COOP"` (협력)

학교/팀/학생 정보는 서버 시작 시 `./data/` 디렉토리의 JSON에서 로드.
`.env`로 `SERVER_PORT`, `DATA_DIR` 설정.

---

## 건드리지 말 것

- `core/simNode.js`의 Node 클래스, state 전이 로직, SEIHR 모델 파라미터
- `default_params.json`, `virus_info.json`의 수치값 (논문에서 검증된 값)
- d3-force-bounce, d3-force-surface 라이브러리 연동 방식

---

## 완료 기준

- [ ] `core/worker.js`: `ticked()` O(n²) → spatial grid, 디버그 postMessage 제거, hospitalCount 카운터
- [ ] `core/simNode.js`: 경로만 이동, 내용 변경 없음
- [ ] `.gitignore`: node_modules, .env, server/data/ 포함
- [ ] `client/`: ko-kr 기반 통합, 서버 URL 하드코딩 제거
- [ ] `server/index.js`: Express REST + Socket.IO 통합, 위 이벤트 전부 구현
- [ ] `server/.env.example` 제공
- [ ] `unstable/` 제거, `en-us/`/`ko-kr/` 중복 제거
