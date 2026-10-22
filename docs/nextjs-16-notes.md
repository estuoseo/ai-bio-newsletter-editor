# Next.js 16 변경점 노트 (PLAN 작업 1)

> 확인한 버전: next 16.4.2 · 출처: `node_modules/next/dist/docs/` · 작성일: 2026-10-22
> 목적: DESIGN.md를 코드로 옮길 때 예전 Next.js 습관대로 짜서 깨지는 일을 막기 위한 메모.
> 각 항목: **규칙** → **우리 앱에서 어떻게 지킬지** (출처 문서)

---

## 0. 이 프로젝트에 이미 켜져 있는 설정

`next.config.ts`에 다음이 켜져 있어요. 아래 규칙 대부분이 이 설정 때문에 생겨요.

- `cacheComponents: true`: 새 캐싱 방식(Cache Components)
- `partialPrefetching: true`
- Turbopack 기본 사용 (Tailwind CSS 로더 포함)

---

## 1. Proxy (예전 이름 Middleware)

- **규칙**
  - 파일 이름이 `middleware.ts`에서 **`proxy.ts`**로, 함수 이름이 `middleware`에서 **`proxy`**로 바뀌었어요.
  - 프로젝트 루트(`app`과 같은 위치)에 **하나만** 둘 수 있어요.
  - 항상 Node.js 환경에서 실행돼요(edge 불가).
  - **로그인 여부를 대충 확인하는 용도(optimistic check)로만 써야 해요.** 정식 권한 검사나 세션 관리를 하는 곳이 아니에요. 느린 DB 조회도 하지 않아요.
- **우리 앱**
  - `proxy.ts`는 "로그인 쿠키가 없으면 `/login`으로 보내기"만 해요.
  - 실제 로그인 확인은 아래 3번의 `verifySession()`으로 **모든 Server Action과 Route Handler 안에서 다시** 해요.
- 출처: `01-app/01-getting-started/16-proxy.md`, `02-guides/upgrading/version-16.md` §middleware to proxy

## 2. Route Handler (`app/api/.../route.ts`)

- **규칙**
  - 웹 표준 `Request`와 `Response`를 써요. `GET`·`POST` 같은 이름으로 함수를 내보내요.
  - `GET` 이외의 요청은 캐시되지 않아요.
  - **같은 경로에 `page.tsx`와 `route.ts`를 함께 둘 수 없어요.** 그래서 API는 `app/api/` 아래에 둬요.
  - `params`는 Promise예요 → `const { id } = await ctx.params` (타입 도우미 `RouteContext<'/api/articles/[id]/summarize'>`).
  - 오래 걸리는 작업은 `export const maxDuration = 60`으로 제한 시간을 정해요(초 단위, Vercel이 읽음).
- **우리 앱**
  - `POST /api/articles/ingest`(수집+요약)와 `/api/articles/[id]/summarize`에는 `maxDuration = 60`을 둬요.
  - 메일 발송 API에도 같은 값을 둬요.
- 출처: `01-getting-started/15-route-handlers.md`, `03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`

## 3. Server Action (`'use server'`)

- **규칙**
  - **누구나 POST로 직접 부를 수 있는 공개 입구**예요. 화면에서 버튼을 숨겨도 보호가 안 돼요. 그래서 action마다 ① 로그인 확인 ② 입력값 검사(Zod) ③ 돌려주는 값 최소화를 해요.
  - 브라우저에서 여러 개를 동시에 불러도 **한 번에 하나씩 차례로** 실행돼요(`Promise.all`로 병렬 처리 안 됨).
  - 요청 크기는 기본 **1MB**까지예요(`serverActions.bodySizeLimit`로 변경 가능).
  - Next.js가 막아주는 것: Origin 검사(CSRF), action ID 암호화.
  - 저장한 뒤 화면 갱신은 `updateTag`(내가 쓴 걸 바로 보기), `revalidatePath`, `refresh` 중에서 골라요.
- **우리 앱**
  - **로그인 확인:** `lib/server/session.ts`에 `verifySession()`(React `cache`로 한 번만 계산)을 두고 모든 action 첫 줄에서 불러요.
  - **ID만 받기:** action은 수정할 대상의 **id + 바뀐 내용만** 받고, 나머지는 DB에서 다시 읽어요.
  - **링크 수집:** 링크 여러 건을 수집할 때는 Server Action이 아니라 Route Handler(`/api/articles/ingest`)를 1건씩 불러요(DESIGN §4.1과 같음).
  - **CSV 크기:** 주소록 CSV가 1MB를 넘을 일은 거의 없지만, 넘으면 "파일이 너무 커요" 안내를 해요.
- 출처: `02-guides/server-actions.md`, `01-getting-started/07-mutating-data.md`

## 4. Cache Components (켜져 있음) — 가장 헷갈리기 쉬운 부분

- **규칙**
  - 페이지는 기본적으로 **미리 만들어 두는(prerender)** 방식이에요.
  - **DB 조회처럼 캐시하지 않는 데이터**나 **`cookies()`·`headers()` 같은 요청 정보**를 읽는 컴포넌트는 반드시 `<Suspense fallback={…}>`로 감싸요. 안 그러면 개발 화면에 "blocking-route" 경고가 떠요.
  - 캐시하려면 함수 안에 `'use cache'`를 쓰고 `cacheLife`·`cacheTag`를 써요. Route Handler 본문에는 직접 쓸 수 없고 따로 뺀 함수에 써요.
  - 예전 설정인 `export const dynamic`, `revalidate`, `fetchCache`는 **쓸 수 없어요**(지워졌어요).
  - `Math.random()`이나 현재 시각을 요청마다 새로 쓰려면 먼저 `await connection()`을 불러요.
- **우리 앱**
  - 기사 목록과 발송 이력은 매번 최신이어야 하니 **캐시하지 않고** `<Suspense>`로 감싸요.
  - 편집 후에는 `updateTag`나 `refresh`로 바로 다시 그려요.
  - 로딩 중에는 카드 모양의 빈 틀(skeleton)을 fallback으로 보여줘요.
- 출처: `01-getting-started/08-caching.md`, `03-api-reference/03-file-conventions/02-route-segment-config/index.md`

## 5. 요청 정보는 모두 `await`

- **규칙:** `cookies()`, `headers()`, `draftMode()`, 그리고 `page`·`layout`·`route`의 `params`·`searchParams`는 **반드시 `await`**로 읽어요(16에서 동기 방식이 완전히 없어졌어요).
- **우리 앱:** 타입은 Next.js가 만들어 주는 도우미 `PageProps<'/경로'>`, `LayoutProps`, `RouteContext`를 써요.
- 출처: `02-guides/upgrading/version-16.md` §Async Request APIs

## 6. 환경변수와 비밀 값

- **규칙**
  - `NEXT_PUBLIC_`이 붙은 값은 **빌드할 때 브라우저 코드에 그대로 박혀요.** 붙지 않은 값은 서버에서만 읽혀요.
  - 서버 전용 파일 맨 위에 `import 'server-only'`를 쓰면, 브라우저 코드에서 그 파일을 불러올 때 빌드가 실패해요.
- **우리 앱**
  - 비밀 값(`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*`, `APP_PASSWORD`, `SESSION_SECRET`)에는 `NEXT_PUBLIC_`을 **붙이지 않아요.**
  - `lib/server/env.ts`에서만 읽고, 그 파일은 `server-only`로 막아요(PLAN 작업 5).
- 출처: `02-guides/environment-variables.md`, `02-guides/data-security.md` §server-only

## 7. 로그인(세션) 방식

- **규칙(문서 권장)**
  - 세션 라이브러리는 `jose` 또는 `iron-session`을 권장해요.
  - 쿠키 옵션은 `httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/'`, 만료 시간이에요.
  - **Data Access Layer(DAL):** `verifySession()`을 데이터 조회·action·Route Handler에서 공통으로 써요.
- **우리 앱**
  - `jose`로 서명한 쿠키(1인용 비밀번호 로그인)를 써요.
  - `SESSION_SECRET`은 32자 이상 무작위 문자열로 만들어요.
- 출처: `02-guides/authentication.md` §Session Management, §Creating a Data Access Layer

## 8. 기타 바뀐 점

| 항목 | 내용 | 우리 앱 |
|---|---|---|
| `next lint` 제거 | `npm run lint`는 ESLint를 직접 실행해요. **`next build`는 lint를 하지 않아요.** | 성공 기준 8번은 `npm run build`와 `npm run lint`를 **둘 다** 돌려야 확인돼요 |
| Turbopack 기본 | `next dev`와 `next build` 모두 Turbopack을 써요. 설정은 `next.config.ts`의 `turbopack`에 해요 | webpack 전용 설정은 쓰지 않아요 |
| `next/image` | 로컬 이미지에 `?쿼리`를 쓰려면 설정이 필요하고, 사설 IP 이미지는 기본으로 막혀요 | 부처 사이트 이미지는 메일에 넣지 않으니 영향 없어요 |
| React 19.2 | 함께 설치된 React 버전 | 별도 조치 없음 |
| 개발·빌드 동시 실행 | `next dev`와 `next build`를 같이 돌릴 수 있어요 | — |

---

## DESIGN.md에 반영하면 좋을 점 (이번 작업에서는 DESIGN.md를 고치지 않음)

1. **로그인 확인:** §7은 "`proxy.ts`가 로그인을 확인한다"고만 적혀 있어요. **각 Server Action과 Route Handler 안에서도 `verifySession()`으로 다시 확인**한다는 문장을 더해야 해요. proxy만으로는 보안 경계가 되지 않아요.
2. **로딩 처리:** 화면 설계에 "DB를 읽는 부분은 `<Suspense>` + 빈 카드 틀로 로딩"을 넣어야 해요(Cache Components가 켜져 있기 때문).
3. **추가 기술:** 기술 목록에 `jose`(로그인 쿠키에 서명하는 도장)와 `server-only`(서버 전용 코드를 브라우저에서 못 쓰게 막는 자물쇠)를 더해야 해요.
