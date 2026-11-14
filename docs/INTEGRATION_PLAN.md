# 기존 프로토타입의 점진적 코드 통합 계획

2026-11-14 · 계획 상태. 이 문서는 구현된 프로토타입을 검증 가능한 커밋으로 나누어 통합하는 순서를 정한다. 아직 앱 코드를 `main`에 반영하거나 `stage`·GitHub Pages를 구성한 것은 아니다. 역할과 Git 제어는 [AGENTS.md](../AGENTS.md)를 따른다.

## 출발점과 보존할 것

| 기준 | 커밋과 상태 |
| --- | --- |
| `main` | `d4078e301e1c9bbb3a1bbcfe4b3d239e5079c3fa` — 사용자 수정 README와 작업 규약만 있는 출발점 |
| 원본 보관 | `chore/import-existing-app`, `d64effeb608a160bb2a4356743c6dec6b1c698b6` |
| 통합할 최신 구현 | `fix/product-table-readability`, `8660628bc04e0860c7d8564825084640a3f3ef21` — 메뉴 수량 배지 대비, 판매자 접두어 제거, 상품 열 확대 포함 |

현재 `main`과 보관 브랜치는 서로 다른 최초 커밋을 가진다. Git 담당이 검증된 `main`으로 `stage`를 준비하고, 단계마다 검증된 기준 커밋에서 작업 브랜치와 worktree를 만들어 필요한 파일이나 패치만 옮긴다. 기존 구현 브랜치를 통째로 병합하거나 보관 커밋 전체를 cherry-pick하지 않는다. 작업 개시 때 위 기준 이후의 변경도 확인한다.

- 사용자 작성 `README.md`와 현재 `AGENTS.md`를 원본 보관본으로 덮어쓰지 않는다.
- `core.VERSION`의 `3.2.0`, IndexedDB와 백업·검토 판정의 키는 그대로 유지한다. 표시 버전에 숫자를 맞추기 위해 저장 형식이나 식별 키를 바꾸지 않는다.
- 프레임워크 전환이나 추가 파일 분리는 이번 통합의 목적이 아니다. 실제 의존성 때문에 필요한 변경만 별도로 설명한다.
- 기존에 해결한 오류를 일부러 다시 넣거나 커밋 시각을 과거로 바꾸지 않는다. PR에는 완성된 프로토타입의 점진 통합임을 밝힌다.

## 앱 코드: 기능 검토 PR 4개, 기능 커밋 7개

기능 PR은 검토할 책임의 단위이고 커밋은 그 안에서 독립적으로 검증할 단계다. 아래 수는 현재 모듈의 의존성에 따른 계획이며 개수를 맞추기 위한 분할이 아니다. 각 커밋에는 그 시점에 존재하는 코드와 테스트만 포함한다. `stage`에서 `main`으로 승격하는 PR과 파이프라인·Pages 운영 PR은 이 4개에 포함하지 않는다.

| PR | 커밋 | 목적과 완료 기준 |
| --- | --- | --- |
| 1. 주문·상품·가격 도메인 | C1–C3 | 메일 입력을 주문으로 해석하고 같은 구매·상품을 구분하며 원화 비교 근거를 준비한다. UI 없이 검사할 수 있다. |
| 2. 기록 보관 | C4 | 브라우저 저장·백업 형식과 인증값 제외 정책을 검증한다. |
| 3. Gmail 수집 | C5 | Gmail 응답 해석·페이지 순회·재시도·인증 오류 처리를 검증한다. |
| 4. 사용 흐름과 검증 자료 | C6–C7 | 준비된 모듈을 화면에 연결하고 재현 가능한 평가 결과와 한계를 남긴다. |

`PR 1 → PR 2·PR 3 → PR 4` 순서로 의존한다. PR 1을 `stage`에서 통합 검증한 뒤 그 확정 커밋을 PR 2와 PR 3의 공통 기준으로 삼는다. 저장과 Gmail은 서로 다른 작성 담당이 병렬로 준비할 수 있으며, 각각 `stage`에 반영할 때 통합 상태를 다시 검증한다. PR 4는 도메인과 두 어댑터가 준비된 `stage`를 기준으로 진행한다. 공통 설정 파일은 동시에 수정하지 않고 Git 담당이 반영 순서를 조정한다.

최종 통합 검증 후 별도의 `stage → main` 승격 PR을 만든다. 단계별 기능 커밋을 보존하여 검토·추적할 수 있는 병합 방식을 권장한다. 작업 브랜치의 기준 커밋과 승격 후보는 Git 담당이 기록한다.

아래 파일명은 저장소 루트 기준이다. 테스트 개수는 위 최신 구현에서 확인한 기준값이며, 통합 중 변경이 생기면 검사 결과와 계획을 함께 갱신한다.

| 커밋 예시 | 포함 파일 | 검증과 완료 기준 |
| --- | --- | --- |
| C1 `feat(parser): import order parsing and price evidence` | `dist/document.js`, `dist/pricing.js`, `dist/core.js`, `dist/samples.js`, `tests/core.test.mjs`; `.gitignore`, `.gitattributes`, 최소 `package.json` | Node 문법·모듈 해석과 core 검사 11개. 입력 메일에서 주문·가격 근거를 얻는다. 아직 없는 파일을 import하거나 script에서 참조하지 않는다. |
| C2 `feat(catalog): identify purchases and product histories` | `dist/duplicates.js`, `dist/order-links.js`, `dist/catalog.js`; `tests/catalog.test.mjs`, `tests/document.test.mjs`, `tests/duplicates.test.mjs`, `tests/forwarded.test.mjs`, `tests/order-links.test.mjs`, `tests/review-policy.test.mjs` | 64개 추가, 누적 75개. 같은 구매의 복수 메일 연결, 반복 구매·상품 옵션 구분, 불확실한 판정의 검토 유지. |
| C3 `feat(pricing): import historical currency conversion` | `dist/rates.js`, `tests/rates.test.mjs` | 4개 추가, 누적 79개. 실제 원화 금액 우선과 환율 조회·실패 처리를 확인한다. |
| C4 `feat(storage): preserve purchase records locally` | `dist/storage.js`, `tests/storage.test.mjs` | 저장 검사 4개. 백업 검증, 재수집 보존, OAuth 인증값의 기록 제외, 동일 클라이언트에서 만료 전 세션 복원을 확인한다. 실제 IndexedDB 확인은 C6의 브라우저 검증과 연결한다. |
| C5 `feat(gmail): import Gmail collection and MIME decoding` | `dist/gmail.js`, `tests/gmail.test.mjs` | Gmail 검사 11개. MIME·인코딩·검색·페이지 순회·재시도·401 오류를 가상 응답으로 확인한다. C4와 C5가 모두 반영되면 전체 Node 검사 94개. 실제 Google OAuth 승인·해제와 실계정 수집은 별도의 브라우저 검증으로 구분한다. |
| C6 `feat(ui): connect price tracking and mail workflows` | `dist/app.js`, `dist/index.html`, `dist/styles.css`, `dist/icon.svg`, `dist/demo-mails.js`, `scripts/serve.mjs`, `tests/browser.html`; `package.json`의 실행 script | 전체 Node 검사와 기존 브라우저 HTML 검사 11개. 샘플, 메뉴, 구매 이력, 검토, 저장·복원, 새로고침을 확인한다. 모든 화면 의존 모듈이 존재하고 로컬 서버로 실행된다. |
| C7 `test(evaluation): record reproducible extraction results` | `scripts/evaluate.mjs`, `validation.json`, `VERIFICATION.md`; `package.json`의 평가 script | 가상 자료 평가를 다시 생성해 결과를 대조한다. 현재 자동 결과와 과거 실제 데이터 관찰을 분리하고 각 대상 커밋·날짜·방법·한계를 명시한다. |

C1의 `package.json`은 ES Modules 해석을 위한 `type: module`, `private`, 이미 존재하는 테스트를 실행하는 script 등 최소 메타정보만 담는다. C6·C7의 실행·평가 script는 해당 파일을 가져오는 시점에 추가한다. 의존 패키지 설치는 필요하지 않으며 Node 내장 테스트 러너를 직접 사용할 수 있다. 포매터·린터와 엄격한 코드 컨벤션은 스택 전환 때 다룬다.

C6의 화면 파일은 함께 가져온다. HTML·CSS·이벤트 처리를 따로 커밋해 존재하지 않는 요소나 모듈을 참조하는 중간 상태를 만들지 않는다. 긴 상품명, 비활성 메뉴 수량 배지, 12px 이상의 테이블 글자, 구매 이력 열과 상품 열의 배치도 기존 수용 기준에 포함한다.

C7에서 현재 `VERIFICATION.md`에 섞여 있는 여러 버전의 기록을 정리한다. 과거 실제 데이터의 관찰 수치를 현재 코드의 정확도로 표현하지 않는다. 실제 메일 원문·개인 백업·계정 정보는 저장소나 공개 fixture에 넣지 않는다. 기존의 비활성 Pages 워크플로 예시도 실행 중인 배포로 설명하지 않는다.

## 전후 운영 PR

앱 코드의 기능 검토 PR 4개, 최종 승격 PR, 다음 운영 변경은 구분한다. 현재 자동 훅·CI·원격 보호가 구현된 상태로 간주하지 않는다.

| 순서 | 작업 | 완료 기준 |
| --- | --- | --- |
| 코드 업로드 전 | `chore/git-pipeline` | 브랜치·커밋 형식, 비밀정보 검사, 문서/앱 변경에 맞는 검증을 GitHub 검사와 원격 보호로 구성한다. 문서 단계에서 없는 앱 실행을 요구하지 않는다. 검사 도입 자체의 초기 PR과 보호 적용 순서도 기록한다. 새 패키지·포매터·린터 설치는 포함하지 않는다. |
| 코드 통합 후 | Pages 배포용 운영 PR, 예: `ci(pages): deploy verified static assets` | 검증된 `main`의 확정 SHA에서 `dist`만 배포한다. 소유자·배포 권한, 실제 실행 결과, GitHub Pages의 프로젝트 경로와 Google OAuth 허용 출처를 확인한다. 외부 공개 범위를 확정한 뒤 게시한다. |

`stage`는 통합 검증 후보, `main`은 승인된 기준으로 운영할 예정이다. Git 담당이 단독으로 동기화하고 검증이 끝난 후보만 `main`에 반영한다. 병합 방식은 의미 있는 커밋을 보존하는 방식을 권장한다. PR 전체를 squash하여 위의 검증 가능한 7단계를 없애지 않도록 운영 PR에서 정책을 정한다. 실제 `stage` 생성, 보호 설정, merge 방식은 해당 작업에서 구현·확인한다.

기존 Sites 배포와 GitHub Pages는 별개의 배포 대상이다. 현재 GitHub Pages가 배포됐다고 보고하지 않는다.

## 단계별 담당과 인계

| 담당 | 이번 통합에서 맡을 일 |
| --- | --- |
| 루트 조정 | 단계별 범위와 병렬 의존성을 배정하고 사용자에게 계획·결과를 설명한다. 코드 통합 착수 여부와 진행 상태를 구분한다. |
| 정책 검토 | 상품·구매 구분, 가격 근거, 검토 사유, IA·화면 수용 기준을 확인한다. 변경이 필요하면 별도 근거를 남긴다. |
| 코드 작성 | 할당된 단계의 소스와 테스트를 함께 이관하고 기존 사용자 문서와 저장 호환성을 보존한다. |
| 독립 검증 | 커밋 또는 diff·파일 해시를 기준으로 해당 단계의 의미 있는 검사를 수행하고 실패·미검증 항목을 명시한다. 작성자의 자기 승인은 허용하지 않는다. |
| Git 저장소 제어 | 브랜치·worktree 준비, 검증된 변경의 커밋, PR 업로드, `stage`·`main` 동기화와 배포를 독점한다. 최종 커밋과 검증 대상의 일치를 확인한다. |

현재 작업의 완료 범위는 이 계획과 하네스 규칙의 문서화다. 앱 코드 통합, 파이프라인 구현, 공개 배포의 실행 완료를 뜻하지 않는다.
