# 점진 통합 실행 기록

2026-11-14. [계획](INTEGRATION_PLAN.md)에 따라 완성된 프로토타입을 11개 앱 구현 커밋으로 나누었습니다. 기능이 없는 상태를 고장 난 import나 빈 저장 함수로 연결하지 않고 공통 기반, 화면, 메일 수집, 보관 설정을 순서대로 추가했습니다. 새 제품을 과거에 개발한 이력으로 꾸미지 않았으며 기존 동작의 점진적 통합입니다.

## 기능별 이력

| 단계 | 구현 내용 | 커밋 |
| --- | --- | --- |
| C1 | 주문·가격 파서와 비실행 HTML 처리 | `ffa330ff70514627e07692d179548b3d7c73974f` |
| C2 | 상품·구매 식별, 중복·영수증 연결 | `7f899bcf5586437233bf5e00f3a151b8a60b2283` |
| C3 | 구매일 기준 원화 환산 | `98893fb87b93e4ac730b1be31b770d85397f56b7` |
| C4 | 실제 기록·인증 세션 저장 API | `14ac36e6f4b9fed938b67b4777ee060208b52b73` |
| C5 | 공통 상태·메뉴·실제 저장 자료 초기화 | `92d5f6854738dc4d93b748d574a5fcc14ac9b761` |
| C6 | HTML 샘플, 가격 변화·구매 이력·검색 | `7b2512038e89a0012347461cf09fbcb3617d6899` |
| C7 | 원문·검토·수동 통합과 분리 | `ae91e9e7a18c5e70852edba2eccc54cb2bae4396` |
| C8 | Gmail 조회·페이지 순회·MIME 처리 | `bc01a1db95b590fafa2e322a475b7642893f531d` |
| C9 | 연결 가이드·계정·Home 주문 가져오기 | `3a2f1f2e86e9984131c16faf4a9896306b75b99b` |
| C10 | 백업·복원·삭제 설정 | `042b0d3f8cfc8c378d2adfdf06fd7347307d628e` |
| C11 | 재현 가능한 브라우저 검사, 가상 평가와 실행 기록 | 이 문서를 추가하는 `test(integration)` 커밋 |

| 작업 PR | 반영 단계 | 결과 |
| --- | --- | --- |
| [#3](https://github.com/albrechwitz/pricetrace/pull/3) | 공통 기반 C1–C4 | 독립 검증·CI 통과 후 stage 병합 |
| [#4](https://github.com/albrechwitz/pricetrace/pull/4) | 가격 추적 C5–C7 | 독립 검증·CI 통과 후 stage 병합 |
| [#5](https://github.com/albrechwitz/pricetrace/pull/5) | 메일 연결 C8–C9 | 독립 검증·CI 통과 후 stage 병합 |
| [#6](https://github.com/albrechwitz/pricetrace/pull/6) | 기록 보관·복원 C10 | 독립 검증·CI 통과 후 stage 병합 |
| `test/integration-evidence → stage` | C11 | 최종 파일·검증·CI·병합 결과는 이 변경의 PR에 기록 |

정책 [PR #1](https://github.com/albrechwitz/pricetrace/pull/1)과 파이프라인 [PR #2](https://github.com/albrechwitz/pricetrace/pull/2), merge 커밋은 앱 구현 11개에 포함하지 않습니다. C1–C10의 원본 커밋을 merge로 보존했습니다. squash를 선택하는 후속 작업은 별도 [템플릿](SQUASH_COMMIT_TEMPLATE.md)에 원본 이력과 검증 근거를 남겨야 합니다.

## 최소한으로 분리한 화면 코드

`workspace.js`는 공통 상태, 페이지 등록, 실제 저장 초기화와 직렬 저장 큐를 제공합니다. 가격 추적·검토·메일 연결·보관 설정은 각각 자신의 화면과 이벤트를 설치하고 `app.js`가 조합합니다. 순서에 맞춰 존재하는 메뉴만 노출했으며 C6의 원문 수 표시는 C7 상세 기능을 설치한 뒤 버튼이 됐습니다.

파서·상품·환율·저장 모듈, `core.VERSION` 3.2.0, IndexedDB·세션·백업·검토 키는 유지했습니다. 사용자 README, 상품명 전체 줄바꿈, 표 최소 12px, 넓은 상품 열과 좁은 구매 이력 열도 보존했습니다. 보관 설정을 연결할 때는 복원과 삭제가 대기 중 저장 이후에 수행되도록 순서를 검증했습니다.

## 검증과 현재 경계

[검증 기록](../VERIFICATION.md)에 현재 Node 100개, 파이프라인 8개, HTML 브라우저 11개와 실제 IndexedDB·가상 Gmail 응답 흐름을 구분했습니다. `validation.json`은 개인 메일이 아닌 24개의 가상 회귀 자료이며, 화면의 HTML 샘플 13건은 별도 자료입니다. 실제 Google 동의와 실계정 메일 수집은 이번 통합에서 다시 실행하지 않았습니다.

작성·독립 검증·Git 제어를 분리했습니다. Git 담당만 검증된 단계별 파일을 커밋하고 작업 PR을 stage에 반영합니다. 저장소 CI는 설치됐지만 로컬 Git 훅과 원격 강제 보호가 자동 설치된 것은 아닙니다. 비공개 저장소 보호 API의 요금제 제한 403은 그대로 남아 있습니다.

이번 실행의 대상은 stage 통합입니다. main 반영은 이후 `stage → main` 승격 PR만 허용하며, 이 기록은 main 승격이나 GitHub Pages 배포 완료를 의미하지 않습니다.
