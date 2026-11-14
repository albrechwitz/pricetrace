# 기존 프로토타입의 점진적 코드 통합 계획

2026-11-14 · 통합 실행 계획. 이 문서는 구현된 프로토타입을 11개의 검증 가능한 구현 커밋으로 나누어 통합하는 순서를 정한다. `stage`는 문서 출발점인 `d4078e3`에서 생성·게시됐고, 정책 문서 PR도 `stage`를 대상으로 한다. 실제 의존성에 따라 공통 저장 기반을 먼저 도입하고 기능별 화면을 이어 붙인다. 이번 실행 범위는 `stage` 통합까지이며 `main` 자동 승격은 포함하지 않는다. 아직 앱 코드를 `main`에 반영하거나 GitHub Pages에 배포한 것은 아니다. 역할과 Git 제어는 [AGENTS.md](../AGENTS.md)를 따른다.

## 출발점과 보존할 것

| 기준 | 커밋과 상태 |
| --- | --- |
| `main` | `d4078e301e1c9bbb3a1bbcfe4b3d239e5079c3fa` — 사용자 수정 README와 작업 규약만 있는 출발점 |
| 원본 보관 | `chore/import-existing-app`, `d64effeb608a160bb2a4356743c6dec6b1c698b6` |
| 통합할 최신 구현 | `fix/product-table-readability`, `8660628bc04e0860c7d8564825084640a3f3ef21` — 메뉴 수량 배지 대비, 판매자 접두어 제거, 상품 열 확대 포함 |

현재 `main`과 보관 브랜치는 서로 다른 최초 커밋을 가진다. Git 담당이 확인한 `stage` 커밋에서 각 작업 브랜치와 worktree를 만들어 필요한 파일이나 패치만 옮긴다. 기존 구현 브랜치를 통째로 병합하거나 보관 커밋 전체를 cherry-pick하지 않는다. 작업 개시 때 위 기준 이후의 변경도 확인한다. `stage`에서 작업 브랜치로 분기하고 다시 `stage`에 PR로 반영하는 경로는 문서·설정·긴급 수정에도 동일하게 적용한다.

- 사용자 작성 `README.md`와 현재 `AGENTS.md`를 원본 보관본으로 덮어쓰지 않는다.
- `core.VERSION`의 `3.2.0`, IndexedDB와 백업·검토 판정의 키는 그대로 유지한다. 표시 버전에 숫자를 맞추기 위해 저장 형식이나 식별 키를 바꾸지 않는다.
- 프레임워크 전환은 이번 통합에 포함하지 않는다. 가격 추적·메일 연결·보관 복원을 독립적으로 도입하기 위한 최소 UI 모듈 분리는 허용하며, 실제 의존성과 변경 이유를 설명한다.
- 기존에 해결한 오류를 일부러 다시 넣거나 커밋 시각을 과거로 바꾸지 않는다. PR에는 완성된 프로토타입의 점진 통합임을 밝힌다.

## 앱 코드: 구현 커밋 11개

사용자의 최신 기준인 11개는 앱 구현 커밋 수다. 정책 문서·파이프라인·배포 설정과 merge 커밋은 별도다. 각 커밋은 실제 변경과 그 시점의 검증 가능한 동작을 갖는다. 완성 앱을 먼저 넣고 빈 커밋이나 형식만의 수정으로 수를 맞추지 않는다.

| 작업 브랜치와 PR | 커밋 | 목적과 완료 기준 |
| --- | --- | --- |
| 공통 기반용 `feat` 브랜치 | C1–C4 | 주문·상품·가격 판단과 실제 저장 API를 준비한다. Gmail 수집에 의존하지 않는 HTML 처리 경계를 만든다. |
| `feat/price-tracking` | C5–C7 | 실제 저장 자료로 시작하는 공통 화면과 샘플 가격 추적, 구매 이력·상세·검토까지 실행한다. |
| `feat/mail-connection` | C8–C9 | Gmail 수집과 계정 연결 가이드·수집 흐름을 추가한다. |
| `feat/record-storage` | C10 | 이미 준비된 저장 API에 보관·복원 설정 화면을 연결한다. |
| `test/integration-evidence` | C11 | 전체 브라우저·가상 자료 평가와 현재 검증 근거를 정리한다. |

총 5개의 기능·검증 PR이다. 공통 기반 PR을 `stage`에서 검증한 뒤 가격 추적의 공통 화면·상태 전달 계약을 확정한다. 이후 메일 연결과 보관 복원은 계약 파일의 소유 범위를 나누어 병렬로 준비할 수 있다. `app.js`, 메뉴, 공통 설정을 함께 바꿔야 하면 순서를 조정한다. Git 담당은 각 PR을 `stage`에 순차 반영하고 통합 상태를 재검증한다. C11은 세 기능이 준비된 `stage`에서 분기한다.

이번에는 최종 통합 검증을 마친 `stage`까지 완성한다. 이후 `main` 반영을 진행할 때는 별도의 `stage → main` 승격 PR을 사용한다. 위 기능·검증 PR, 향후 승격 PR, 전후 운영 PR은 각각 구분해 집계한다. 작업 브랜치의 기준 커밋과 통합 후보는 Git 담당이 기록한다.

아래는 실제 모듈 의존성을 반영한 11단계다. 파일명은 저장소 루트 기준이며 UI 모듈의 최종 경로는 각 PR의 파일 목록에 기록한다. 현재 완성 원본은 Node 검사 94개와 브라우저 HTML 검사 11개를 기준으로 삼되 새 구조에서 검사 범위가 바뀌면 그 이유와 결과를 기록한다.

| 커밋 예시 | 포함 파일 | 검증과 완료 기준 |
| --- | --- | --- |
| C1 `feat(parser): import order parsing and price evidence` | `dist/document.js`, `dist/pricing.js`, `dist/core.js`, `dist/samples.js`, `tests/core.test.mjs`; 공용 `dist/mail-html.js`; `.gitignore`, `.gitattributes`, 최소 `package.json` | Node 문법·모듈 해석과 core 검사 11개. `gmail.js`의 HTML 비실행 처리 함수 `htmlContent`만 공용 모듈로 추출해 샘플이 Gmail 클라이언트에 의존하지 않게 한다. HTML 안전 처리와 브라우저 저장 자료의 외부 전송 금지를 유지한다. |
| C2 `feat(catalog): identify purchases and product histories` | `dist/duplicates.js`, `dist/order-links.js`, `dist/catalog.js`; `tests/catalog.test.mjs`, `tests/document.test.mjs`, `tests/duplicates.test.mjs`, `tests/forwarded.test.mjs`, `tests/order-links.test.mjs`, `tests/review-policy.test.mjs` | 64개 추가, 누적 75개. 같은 구매의 복수 메일 연결, 반복 구매·상품 옵션 구분, 불확실한 판정의 검토 유지. |
| C3 `feat(pricing): import historical currency conversion` | `dist/rates.js`, `tests/rates.test.mjs` | 4개 추가, 누적 79개. 실제 원화 금액 우선과 환율 조회·실패 처리를 확인한다. |
| C4 `feat(storage): import record and session storage primitives` | `dist/storage.js`, `tests/storage.test.mjs` | 저장 검사 4개, Node 누적 83개. 백업 검증, 재수집 보존, OAuth 인증값의 기록 제외, 동일 클라이언트에서 만료 전 세션 복원을 확인한다. |
| C5 `feat(shell): introduce routing and persistent application context` | `dist/index.html`, `dist/styles.css`, `dist/icon.svg`, `scripts/serve.mjs`, 공통 상태·라우팅·실제 저장 초기화 코드; `package.json`의 실행 script | 로컬 서버와 실제 저장 API로 시작·복원하는 공통 화면을 실행한다. 구현된 페이지만 노출하며 없는 모듈·요소를 참조하지 않는다. |
| C6 `feat(tracking): present sample product price histories` | `dist/demo-mails.js`, 기존 `dist/app.js`에서 분리한 가격 추적 렌더링·샘플 처리와 관련 화면 | 샘플·검색·필터·가격 변화와 구매 이력을 확인한다. 전체 상품명, 메뉴 배지 대비, 테이블 글자·열 배치를 보존한다. |
| C7 `feat(review): connect evidence and review decisions` | 기존 `dist/app.js`의 상세·원문·검토·수동 연결 처리와 관련 화면 | 원문 근거, 상세창, 검토·통합·분리와 새로고침 후 판정 보존을 확인한다. 샘플에서 한 변경을 실제 기록에 저장하지 않는다. |
| C8 `feat(gmail): import collection and MIME decoding` | `dist/gmail.js`, `tests/gmail.test.mjs`; 공용 `htmlContent`의 호환 re-export | Gmail 검사 11개, 전체 Node 기준 94개. MIME·인코딩·검색·페이지 순회·재시도·401 오류를 가상 응답으로 확인한다. 기존 `htmlContent` import 경로의 호환성을 유지한다. |
| C9 `feat(connection): connect Gmail setup and order import` | 기존 화면의 연결 가이드·계정 상태·전체 주문 가져오기 Home과 필요한 UI 모듈 | 연결 설정 가이드, 계정·오류 표시, 주문 수집·저장·가격 추적 전달을 확인한다. 실제 Google OAuth 승인·해제와 실계정 수집은 별도의 브라우저 검증으로 구분한다. |
| C10 `feat(storage): connect backup restore and retention settings` | 기존 화면의 보관·복원·기록 상태 처리와 필요한 UI 모듈 | 실제 IndexedDB 저장·복원, 계정 분리, 새로고침 후 기록·판정 유지, 백업·복원 설정 화면을 확인한다. 샘플과 실제 기록의 저장 경계를 보존한다. |
| C11 `test(integration): record reproducible browser and extraction evidence` | `tests/browser.html`, `scripts/evaluate.mjs`, `validation.json`, `VERIFICATION.md`; `package.json`의 평가 script | 전체 Node 검사와 기존 브라우저 HTML 검사, 기능 간 사용 흐름 및 가상 자료 평가를 확인한다. 현재 자동 결과와 과거 실제 관찰을 분리하고 대상 커밋·날짜·방법·한계를 명시한다. |

C1의 `package.json`은 ES Modules 해석을 위한 `type: module`, `private`, 이미 존재하는 테스트를 실행하는 script 등 최소 메타정보만 담는다. C5·C11의 실행·평가 script는 해당 파일을 가져오는 시점에 추가한다. 의존 패키지 설치는 필요하지 않으며 Node 내장 테스트 러너를 직접 사용할 수 있다. 포매터·린터와 엄격한 코드 컨벤션은 스택 전환 때 다룬다.

저장 API는 앱 초기화와 메일 수집의 실제 선행 조건이므로 C4에서 준비한다. 보관·복원 설정 화면이 나중에 들어온다고 해서 저장을 하지 않는 임시 함수로 기존 동작을 가장하지 않는다. 이번 통합은 원본과 동등한 동작을 단계별로 연결하는 작업이며 새로운 제품 정책을 끼워 넣지 않는다.

화면은 기능별로 HTML·CSS·이벤트 처리를 함께 가져온다. 확장자별로 나누어 존재하지 않는 요소나 모듈을 참조하는 중간 상태를 만들지 않는다. 공통 초기화는 C4에서 도입한 저장 API를 사용하되, 아직 도입하지 않은 Gmail 클라이언트나 보관·복원 설정 UI를 필수 import하지 않는다. 완성 앱을 한 번에 들여놓고 커밋 제목만 나누는 방식은 사용하지 않는다.

C11에서 현재 `VERIFICATION.md`에 섞여 있는 여러 버전의 기록을 정리한다. 과거 실제 데이터의 관찰 수치를 현재 코드의 정확도로 표현하지 않는다. 실제 메일 원문·개인 백업·계정 정보는 저장소나 공개 fixture에 넣지 않는다. 기존의 비활성 Pages 워크플로 예시도 실행 중인 배포로 설명하지 않는다.

## 전후 운영 PR

앱 구현 커밋 11개와 기능·검증 PR, 최종 승격 PR, 다음 운영 변경은 구분한다. 현재 비공개 저장소의 `main`·`stage` 원격 보호 API는 요금제 제한으로 403을 반환했다. CI 검사와 Git 담당의 운영 게이트가 있어도 서버 강제 보호와 같다고 보고하지 않는다. 파이프라인 작업의 실제 완료 여부도 검증 결과로 갱신한다.

| 순서 | 작업 | 완료 기준 |
| --- | --- | --- |
| 코드 업로드 전 | `stage`에서 분기한 `chore/git-pipeline` | 브랜치·커밋 형식, stage 경로, 비밀정보 검사, 문서/앱 변경에 맞는 검증과 squash 기록을 검사한다. 문서 단계에서 없는 앱 실행을 요구하지 않는다. `stage` 대상 초기 PR과 검사 도입 순서, 원격 보호의 현재 제한도 기록한다. 새 패키지·포매터·린터 설치는 포함하지 않는다. |
| 코드 통합 후 | Pages 배포용 운영 PR, 예: `ci(pages): deploy verified static assets` | 검증된 `main`의 확정 SHA에서 `dist`만 배포한다. 소유자·배포 권한, 실제 실행 결과, GitHub Pages의 프로젝트 경로와 Google OAuth 허용 출처를 확인한다. 외부 공개 범위를 확정한 뒤 게시한다. |

`stage`는 통합 검증 후보이며 `main`으로 들어가는 유일한 경로다. Git 담당이 단독으로 동기화하고 `stage → main` 승격 PR로만 배포 기준을 갱신한다. 문서·설정·긴급 수정에도 이 경로의 예외는 없다.

기능 PR을 squash하면 [커밋 본문 템플릿](SQUASH_COMMIT_TEMPLATE.md)에 원본 브랜치·전체 SHA·커밋 목록·PR·변경 범위·검증·한계를 기록한다. 이 경우 작업 브랜치의 11개 구현 커밋과 `stage`에 남은 squash 커밋 수는 다르다. 텍스트 내역 보존과 원본 객체의 영구 접근을 구분하며, `stage → main` 승격은 기능 커밋을 보존하는 merge로 진행하고 squash하지 않는다.

기존 Sites 배포와 GitHub Pages는 별개의 배포 대상이다. 현재 GitHub Pages가 배포됐다고 보고하지 않는다.

## 단계별 담당과 인계

| 담당 | 이번 통합에서 맡을 일 |
| --- | --- |
| 루트 조정 | 단계별 범위와 병렬 의존성을 배정하고 사용자에게 계획·결과를 설명한다. 코드 통합 착수 여부와 진행 상태를 구분한다. |
| 정책 검토 | 상품·구매 구분, 가격 근거, 검토 사유, IA·화면 수용 기준을 확인한다. 변경이 필요하면 별도 근거를 남긴다. |
| 코드 작성 | 할당된 단계의 소스와 테스트를 함께 이관하고 기존 사용자 문서와 저장 호환성을 보존한다. |
| 독립 검증 | 커밋 또는 diff·파일 해시를 기준으로 해당 단계의 의미 있는 검사를 수행하고 실패·미검증 항목을 명시한다. 작성자의 자기 승인은 허용하지 않는다. |
| Git 저장소 제어 | 브랜치·worktree 준비, 검증된 변경의 커밋, PR 업로드, `stage`·`main` 동기화와 배포를 독점한다. 최종 커밋과 검증 대상의 일치를 확인한다. |

이 문서의 작성만으로 앱 코드 통합, 파이프라인 구현, 공개 배포가 완료된 것은 아니다. 단계별 작성·검증·PR·병합·배포 상태를 실제 결과와 구분해서 기록한다.
