# GitHub Pages 배포

검증한 `stage → main` 승격 PR의 merge 커밋에서 `dist`만 게시합니다. 소스 저장소의 공개 설정과 Pages 활성화는 Git 담당이 관리하며, 이 파일이나 workflow가 있다는 사실만으로 배포가 완료된 것은 아닙니다.

## 실행 경로와 권한

1. 작업 브랜치의 PR을 stage에 반영합니다. `Repository checks`가 경로·커밋·민감값·코드 검사를 수행합니다.
2. 동일 저장소의 `stage → main` 승격 PR을 검사한 뒤 merge 방식으로 병합합니다. stage의 원본 커밋을 보존합니다.
3. main push가 Pages workflow를 시작합니다. 읽기 전용 job이 현재 원격 main과 동일한 SHA인지, 해당 SHA의 병합 PR, 두 번째 부모인 stage SHA, 그 stage SHA에 대한 최신 `Repository checks` 성공을 GitHub API에서 대조합니다. 직접 push, 다른 브랜치·저장소에서의 승격, squash, 실패·취소·진행 중 검사는 배포를 통과하지 못합니다. 병합 뒤 run의 PR 목록이 비어도 정확한 저장소·stage 브랜치·head SHA·PR 이벤트·검사 workflow를 대조합니다.
4. 같은 main SHA의 Node 검사를 실행하고 정적 파일을 검사합니다. 링크·비공개 경로·알려진 인증값 패턴·누락 자산·프로젝트 경로 이탈을 거부합니다. `dist` 변경이나 추적되지 않은 파일도 거부합니다. 파일 목록의 SHA-256 digest와 소스 SHA를 실행 요약에 남깁니다.
5. 검사 job 성공 뒤 별도 job이 artifact를 배포합니다. 이 job만 `pages: write`와 `id-token: write`를 가지며 저장소 소스를 실행하지 않습니다. `github-pages` 환경과 job 간 `needs`로 연결합니다. [GitHub Pages workflow 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

검사 job 권한은 `contents`, `pull-requests`, `actions`의 read뿐입니다. 배포에 PAT나 사용자 OAuth 토큰을 넣지 않습니다. GitHub가 제공하는 `GITHUB_TOKEN`과 OIDC를 사용합니다. main에서 수동 재실행해도 같은 승격·CI 조건을 확인합니다. 동시 배포는 직렬로 처리합니다. [Workflow run 조회 API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow), [커밋에 연결된 PR 조회 API](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit)

## Git 담당의 최초 설정

- 사용자 승인에 따라 저장소를 공개로 전환하고 Pages 배포 소스를 **GitHub Actions**로 설정했습니다(API 201, `build_type: workflow`). 비공개 당시의 Pages 요금제 제한 422와 원격 보호 403은 과거 설정 시점의 결과입니다. GitHub Free의 Pages 지원은 공개 저장소를 기준으로 합니다. [지원 범위와 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- main·stage 보호를 API 200으로 설정하고 재조회했습니다. PR 필수, 최신 base 기준 `repository-checks` 필수(GitHub Actions app 15368), 관리자 적용, force push·삭제 금지를 확인했습니다. GitHub의 필수 승인 수는 0이며 독립 에이전트 검증은 별도로 수행합니다.
- `github-pages` 환경은 custom branch policy를 사용하며 `main` 단일 브랜치 규칙을 API 200으로 확인했습니다. 배포 대기시간과 추가 승인자는 설정하지 않았습니다. 브랜치 보호, 환경 규칙과 독립 에이전트 검증은 각각 구분합니다.
- 이 운영 변경도 작업 PR → stage → main 승격 PR 순서를 따릅니다. 첫 main 병합 후 workflow의 성공, 배포된 소스 SHA, 실제 공개 URL과 브라우저 동작을 확인합니다.

## 게시 경로와 Gmail

Pages 설정에서 확인한 프로젝트 사이트 주소는 `https://albrechwitz.github.io/pricetrace/`입니다. 실제 게시 성공은 배포 job의 `page_url`과 HTTP·브라우저 확인으로 별도 검증합니다. HTML 자산과 ES Module import는 상대 경로이므로 프로젝트 하위 경로를 유지합니다. 별도 빌드·npm 설치는 필요하지 않습니다.

Google OAuth의 승인된 JavaScript 원본에는 프로젝트 경로 없이 `https://albrechwitz.github.io`를 등록합니다. [Google의 원본 검증 규칙](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#origin-validation)에 따라 경로를 포함하지 않습니다. 방문자는 자기 클라이언트 ID와 계정으로 연결해야 합니다. 공개 사이트에 개발자의 토큰·계정·메일 기록을 넣지 않습니다. 다른 출처에서 사용하던 브라우저 기록은 자동 이동하지 않으며 필요하면 기존 환경에서 백업한 뒤 새 출처에서 복원합니다.

`dist` 이외의 테스트, 개발 문서, 평가 보고서와 로컬 백업은 Pages artifact에 포함하지 않습니다. 공개 저장소의 소스 이력은 별도의 공개 범위이며 Pages artifact 제한과 혼동하지 않습니다.

## 사용한 Actions

2026-11-14에 공식 release와 commit을 확인하고 전체 SHA로 고정했습니다. 권한·공급망 범위가 바뀌는 갱신은 같은 검증 절차를 거칩니다.

| Action | 버전 / commit |
| --- | --- |
| checkout | v7.0.1 · `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| setup-node | v7.1.0 · `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [upload-pages-artifact](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) | v5.0.0 · `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| [deploy-pages](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) | v5.0.1 · `368f82528645a54fb793d4d04e342629a3f51346` |

로컬 확인은 `node --test scripts/check-pages.test.mjs`와 `node scripts/check-pages.mjs --site-only`로 수행합니다. 실제 승격·CI metadata API, artifact 업로드와 Pages 게시 성공은 온라인 실행에서 따로 확인해야 합니다.
