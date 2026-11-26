# 경주 2박 3일 여행 페이지

친구 6명이 링크 하나로 같이 보는 여행 안내 페이지입니다. 빌드 도구 없는 정적 사이트예요.

```
index.html    화면 뼈대
style.css     디자인 (라이트/다크 모드, 반응형)
app.js        data.json을 읽어서 화면을 그림, 동선 지도, 정산 계산, 할 일 체크, 의견 보드
data.json     ← 내용은 이 파일만 고치면 됩니다
supabase.sql  의견 보드용 테이블 (한 번만 실행)
```

## 로컬에서 확인하기

`app.js`가 `data.json`을 fetch로 읽기 때문에 `index.html`을 더블클릭해서 열면(`file://`) 데이터가 안 뜨고
"일정 정보를 불러오지 못했어요" 문구가 나옵니다. 아래처럼 로컬 서버로 열어 주세요.

```bash
cd gyeongju-trip
npx serve .
# 터미널에 나온 주소(보통 http://localhost:3000)를 브라우저로 열기
```

Node가 없으면 Python으로도 됩니다.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

폰 화면은 크롬 개발자 도구(⌥⌘I → 기기 툴바 ⇧⌘M)에서 390px 폭으로 확인하면 됩니다.

## GitHub Pages로 배포하기

1. GitHub에서 새 저장소를 만듭니다. (예: `gyeongju-trip`)
2. 이 폴더의 파일 4개(+README)를 저장소 루트에 올립니다.
   ```bash
   cd gyeongju-trip
   git init
   git add index.html style.css app.js data.json README.md
   git commit -m "경주 여행 페이지"
   git branch -M main
   git remote add origin https://github.com/<내 아이디>/gyeongju-trip.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages**에서
   - Source: **Deploy from a branch**
   - Branch: **main** / **/(root)** → Save
4. 1~2분 뒤 `https://<내 아이디>.github.io/gyeongju-trip/` 주소가 생깁니다. 이 링크를 단톡에 공유하면 끝.

### 단톡 링크 미리보기 이미지 (선택)

배포 주소가 정해지면 `index.html`의 `<head>`에 아래 한 줄을 추가하면 카카오톡에 링크를 올릴 때 헤더 그림이 썸네일로 뜹니다. (상대 경로는 안 되고 전체 주소여야 해요)

```html
<meta property="og:image" content="https://<내 아이디>.github.io/gyeongju-trip/assets/header-800.jpg">
```

헤더 그림을 바꾸려면 `assets/header.jpg`(1400px)와 `assets/header-800.jpg`(800px)를 같은 이름으로 덮어쓰면 됩니다.

### 공개 범위 주의

- 무료 계정의 GitHub Pages는 **공개 저장소**에서만 됩니다. 저장소와 페이지 모두 주소를 아는 누구나 볼 수 있어요.
  이름과 정산 금액이 들어 있으니 계좌번호·전화번호 같은 정보는 data.json에 넣지 마세요.
- 검색엔진에 노출되지 않도록 `<meta name="robots" content="noindex">`를 넣어 두었습니다.
- 여행이 끝나면 저장소를 지우거나 Settings → Pages에서 배포를 끄면 됩니다.

## 내용 고치기 (data.json)

GitHub 웹에서 `data.json`을 열고 연필 아이콘으로 고친 뒤 Commit 하면 1~2분 뒤 페이지에 반영됩니다.
(GitHub Pages 캐시 때문에 바로 안 바뀌면 몇 분 뒤 새로고침)

쉼표·따옴표 하나만 틀려도 페이지 전체가 "불러오지 못했어요"로 바뀝니다. 고친 뒤 꼭 한 번 열어 보세요.

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 누가 입금했다 | `payment.rows`에서 그 사람의 `paid`를 입금액으로. 합계·남은 금액·총계·"받을 돈"은 자동 계산 |
| 정산 메모 | `memo` (빈 문자열이면 안 보임) |
| 일정 추가·변경 | `days[].stops`에 `{ "time", "name", "desc", "kind", "tag" }` |
| 식사 표시(빨간 점) | `"kind": "eat"` |
| 이동 표시(이름 얇게) | `"kind": "move"` |
| 주의 태그(빨간 테두리) | `"tag": "예약 필수"` |
| 설명 줄 없애기 | `desc`를 빼면 됨 |
| 이동 방법 | 그 장소로 **가는** 방법을 `"way": "택시 10분"`처럼. "택시"가 들어가면 빨간 점선, "걸어서/도보"면 회색 점선, 나머지는 렌트카(실선) |
| 지도에 표시 | `"place": "downtown"` — `places`에 있는 id. 없으면 타임라인에만 나옴 |
| 하루 출발지 | 1번 일정 전에 출발하는 곳이 따로 있으면 그날에 `"from": "stay"` |
| 장소 추가 | `places`에 `{ "name", "lat", "lng" }`. 좌표는 네이버/카카오 지도에서 장소 우클릭 → 좌표 복사 |
| 장소 옵션 | `"label": "l/r/t/b"` 이름표 위치 선호, `"far": true` 멀리 있는 곳(지도 테두리에 방향만 표시), `"query"` 지도 검색어, `"url"` 누르면 열 주소 |
| 할 일 추가 | `todos`에 `{ "text", "who" }` |
| D-day | `trip.start`, `trip.end` (`YYYY-MM-DD`). 여행 중에는 "여행 N일차"로 바뀌고 그날 일정 카드가 강조됨 |

## 의견 보드 연결하기 (Supabase, 무료)

"가고 싶은 곳 · 의견" 섹션은 친구들이 남긴 글을 서로 봐야 해서 저장소가 필요합니다.
연결 전에는 **미리보기 모드**로 동작해요(이 브라우저에만 저장, 노란 안내 문구 표시).

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (Free 플랜)
2. 대시보드 **SQL Editor**에 `supabase.sql` 내용을 통째로 붙여 넣고 **Run**
3. **Project Settings → API**(또는 API Keys)에서 두 값을 복사
   - Project URL: `https://xxxx.supabase.co`
   - anon / publishable 키: `eyJ…` 또는 `sb_publishable_…`
4. `data.json`의 `ideas`에 넣기
   ```json
   "ideas": {
     "supabaseUrl": "https://xxxx.supabase.co",
     "anonKey": "sb_publishable_…",
     "trip": "gyeongju-2026-12"
   }
   ```
5. 페이지를 새로고침하면 안내 문구가 사라지고, 남긴 글이 모두에게 보입니다. (1분마다·화면에 돌아올 때 새로고침)

알아둘 점
- anon/publishable 키는 원래 브라우저에 공개되는 키라 data.json에 넣어도 됩니다. **service_role / secret 키는 절대 넣지 마세요.**
- 로그인이 없어서 이름은 고르는 대로 믿습니다. 친구끼리 쓰는 용도로 생각해 주세요.
- 글 삭제는 그 글을 쓴 브라우저에서만 됩니다(쓸 때 만든 토큰으로 확인). 다른 기기에서 쓴 글은 Supabase **Table Editor → trip_posts**에서 지우면 돼요.
- 좋아요는 누구나 누르고 취소할 수 있습니다.
- 무료 프로젝트는 일주일 동안 요청이 없으면 일시 정지될 수 있어요. 그때는 대시보드에서 Restore.
- 다른 여행에 재사용할 땐 `trip` 값만 바꾸면 글이 따로 모입니다.

### 화면 규칙

- 금액 0은 `–`, 남은 금액이 0이면 비취색 굵게 "완료", 더 낸 경우엔 빨간색 "N 더 냄"
- 식당 영업시간에 "확인"이 들어 있으면 빨간 글씨
- 식당 이름은 네이버 지도 검색으로 연결
- 할 일 체크는 각자 브라우저(localStorage)에만 저장되고 다른 사람과 공유되지 않음.
  항목 문구를 키로 저장하므로 순서를 바꿔도 체크가 유지되고, 문구를 고치면 그 항목은 체크가 풀림
- 사생활 보호 모드처럼 저장이 안 되는 브라우저에서는 체크만 되고 저장은 안 된다는 안내가 나옴
- data.json의 값은 전부 텍스트로만 화면에 들어갑니다(HTML로 해석 안 함)
