// Authored static templates only; account and mail values are rendered as text.
export const connectionMarkup=`<section id="connection-page" class="page-view connection-page" aria-labelledby="connection-title" hidden>
      <div class="page-heading"><div><p class="eyebrow">CONNECT YOUR INBOX</p><h1 id="connection-title" tabindex="-1">메일 연결</h1><p class="subtitle">처음 한 번 설정하고, 내 Gmail의 구매 기록을 가져오세요.</p></div></div>
      <div class="connection-summary" id="connection-summary" role="status"></div>
      <div class="notice" id="connection-notice" role="status" aria-live="polite"></div>
      <ol class="connection-overview" aria-label="메일 연결 순서"><li><span>01</span>Google 앱 준비</li><li><span>02</span>클라이언트 ID 저장</li><li><span>03</span>Gmail 연결</li></ol>
      <section class="connection-step" aria-labelledby="setup-google-title">
        <div class="step-intro"><span class="step-number">01</span><h2 id="setup-google-title">Google 앱 준비</h2><p>내 메일을 읽을 앱을 Google에 등록하는 단계예요. 처음 한 번만 진행하세요.</p><span class="step-status" id="google-step-status">Google Cloud에서 설정</span></div>
        <div class="step-content"><ol class="setup-steps">
          <li><strong>프로젝트를 선택하고 Gmail API 사용 설정</strong><p><a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener noreferrer">Gmail API 라이브러리 열기 ↗</a>에서 프로젝트를 선택한 뒤 <b>사용</b>을 누르세요. 이후 설정도 같은 프로젝트에서 진행합니다.</p></li>
          <li><strong>Google 인증 플랫폼에서 앱 등록</strong><p><a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener noreferrer">Google 인증 플랫폼 열기 ↗</a> → <b>시작하기</b>. 앱 이름은 Mailtrace, 지원 이메일과 연락처는 본인 이메일로 입력하세요. 개인 Gmail이라면 대상은 <b>외부</b>로 설정합니다. 이미 등록했다면 다음 단계로 이동하세요.</p></li>
          <li><strong>실제로 연결할 Gmail을 테스트 사용자로 추가</strong><p><b>대상 → 테스트 사용자 → 사용자 추가</b>에서 메일을 읽을 계정을 등록하세요. Google Cloud 관리 계정과 달라도 됩니다. 게시 상태는 <b>테스트</b>로 유지하세요.</p></li>
          <li><strong>Gmail 읽기 권한만 추가</strong><p><b>데이터 액세스 → 범위 추가 또는 삭제</b>에서 아래 범위를 등록하세요.</p><code class="scope-value">https://www.googleapis.com/auth/gmail.readonly</code><p>발송·수정·삭제 권한은 필요하지 않아요.</p></li>
        </ol></div>
      </section>
      <section class="connection-step" aria-labelledby="setup-client-title">
        <div class="step-intro"><span class="step-number">02</span><h2 id="setup-client-title">이 사이트 등록</h2><p>Google에 사이트 주소를 등록한 뒤, 발급받은 클라이언트 ID를 저장하세요.</p><span class="step-status" id="client-step-status">클라이언트 ID 미등록</span></div>
        <div class="step-content"><ol class="setup-steps">
          <li><strong>웹 애플리케이션 클라이언트 만들기</strong><p><b>클라이언트 → 클라이언트 만들기</b>에서 유형은 <b>웹 애플리케이션</b>, 이름은 Mailtrace Web으로 설정하세요. 기존 클라이언트가 있다면 열어서 수정하면 됩니다.</p></li>
          <li><strong>승인된 JavaScript 원본에 아래 주소 추가</strong><div class="origin-block"><span>현재 사이트 주소</span><code class="origin" id="current-origin"></code><button type="button" class="button small" id="copy-origin">주소 복사</button><span id="copy-origin-status" role="status"></span></div><p class="setup-important"><b>‘승인된 JavaScript 원본’ 칸에 입력하세요.</b> 리디렉션 URI는 비워둡니다. 주소 끝의 <code>/</code>나 경로도 넣지 마세요. 수정 후에는 Google 화면에서 저장하세요.</p></li>
          <li><strong>클라이언트 ID를 복사해 저장</strong><p><code>…apps.googleusercontent.com</code>으로 끝나는 ID입니다. API 키·비밀키·액세스 토큰을 넣는 곳이 아니에요.</p></li>
        </ol><div class="client-config"><label class="client-label">Google OAuth 클라이언트 ID<input id="client-id-input" type="text" placeholder="123456789-abc.apps.googleusercontent.com" autocomplete="off" spellcheck="false" aria-describedby="client-help"></label><p class="field-help" id="client-help">앱을 식별하는 공개 값이며 이 브라우저에 저장됩니다.</p><p id="settings-status" role="status" aria-live="polite"></p><button class="button primary" id="save-settings">클라이언트 ID 저장</button></div></div>
      </section>
      <section class="connection-step" aria-labelledby="setup-connect-title">
        <div class="step-intro"><span class="step-number">03</span><h2 id="setup-connect-title">내 Gmail 연결</h2><p>테스트 사용자로 등록한 계정을 선택하고, 읽기 권한을 허용하세요.</p><span class="step-status" id="auth-step-status">연결 대기</span></div>
        <div class="step-content"><ol class="setup-steps">
          <li><strong>Google 로그인 창에서 계정 선택</strong><p>아래 버튼이나 왼쪽의 Gmail 연결 버튼을 누르세요. 연결한 사람 자신의 메일만 읽습니다.</p><button class="button primary" id="connect-page-button">Google에서 Gmail 연결</button><p id="connect-page-help" class="field-help">02단계에서 클라이언트 ID를 먼저 저장하세요.</p></li>
          <li><strong>테스트 앱 안내와 읽기 권한 확인</strong><p>본인이 만든 앱으로 시작한 연결인지 확인하세요. 테스트 앱 안내에서는 <b>계속</b>이 작게 표시될 수 있습니다. <b>안전한 환경으로 돌아가기</b>는 연결을 취소하는 버튼입니다.</p><p>이어서 Google 동의 화면에서 Gmail 읽기 권한을 허용하세요. 차단 사유가 표시되면 아래 ‘연결이 막힐 때’를 확인하세요.</p></li>
          <li><strong>Home에서 전체 주문 가져오기</strong><p>연결된 계정이 표시되면 준비가 끝납니다. Home의 <b>전체 주문 가져오기</b>를 눌러 기록을 불러오세요.</p><button class="button" id="go-home">Home으로 이동</button></li>
        </ol><button class="text-button danger" id="disconnect-button" hidden>Gmail 연결만 해제</button></div>
      </section>
      <div class="connection-extras"><details class="setup-section"><summary>다시 방문했을 때 · 저장과 재연결</summary><div class="setup-body"><p>클라이언트 ID와 가져온 기록은 이 브라우저에 남습니다. Google 인증이 만료되면 새 메일을 가져올 때 <b>Gmail 다시 연결</b>만 누르세요. 클라이언트 ID를 새로 만들 필요는 없습니다.</p><p data-requires-page="storage">다른 기기로 옮기거나 브라우저 데이터를 지우기 전에는 <b>보관 · 복원</b> 메뉴에서 기록을 백업하세요.</p></div></details>  <details class="setup-section">
    <summary><span class="step-chip">?</span><span>연결이 막힐 때<small>화면에 나온 오류 문구로 확인</small></span></summary>
    <dl class="troubleshooting">
      <dt>no registered origin / 401 invalid_client / origin_mismatch</dt><dd>유형이 웹 애플리케이션인지, <b>승인된 JavaScript 원본</b>에 02단계의 사이트 주소를 저장했는지 확인하세요. 리디렉션 URI에만 넣었다면 원본 칸에도 등록해야 합니다. 입력한 ID와 수정한 클라이언트가 같은지도 확인하세요. Google 안내상 반영에 5분에서 몇 시간이 걸릴 수 있어요.</dd>
      <dt>테스트 사용자만 접근 가능 / 403 access_denied</dt><dd><b>Google 인증 플랫폼 → 대상 → 테스트 사용자</b>에 로그인할 Gmail을 추가하세요. 권한을 거절했다면 다시 연결하고, 조직 계정이라면 관리자 제한도 확인하세요.</dd>
      <dt>Gmail API가 사용 설정되지 않음 / 메일 조회 403</dt><dd>OAuth 클라이언트를 만든 <b>같은 프로젝트</b>에서 Gmail API를 활성화했는지, Gmail 읽기 권한에 동의했는지 확인하세요.</dd>
      <dt>로그인 창이 안 열림 / 브라우저 관련 차단</dt><dd>이 사이트의 팝업 허용 여부를 확인하세요. 앱 내부 브라우저에서 Google 로그인이 제한되면 Chrome 또는 Edge에서 사이트를 열어 시도하세요. 새 브라우저에는 클라이언트 ID를 한 번 입력해야 합니다.</dd>
      <dt>연결 만료 / 새로고침 후 연결된 계정 없음</dt><dd>저장된 구매 기록은 유지됩니다. 새 메일을 가져올 때 왼쪽 <b>Gmail 연결</b>로 다시 인증하세요. 저장된 클라이언트 ID는 그대로 사용합니다.</dd>
      <dt>가져온 메일이 0건</dt><dd>주문·결제·영수증·구매·환불 또는 order·receipt·purchase·payment·refund가 제목에 있는지 확인하세요. 다른 언어의 제목이나 이미지·첨부 영수증은 지원하지 않을 수 있어요.</dd>
    </dl>
  </details>
  <details class="setup-section">
    <summary><span class="step-chip">i</span><span>누가 어떤 메일을 볼 수 있나요?<small>사이트 접근과 Gmail 연결은 별개</small></span></summary>
    <div class="setup-body"><p><b>사이트 접근:</b> 사이트 공유 설정이 누가 페이지를 열 수 있는지 결정합니다. Google 테스트 사용자 등록과는 별개예요.</p><p><b>Gmail 연결:</b> 테스트 사용자로 등록된 사람이 직접 로그인하고 동의해야 합니다. 연결한 사람 자신의 메일을 읽으며, 내 계정을 다른 방문자에게 공유하지 않아요.</p><p><b>데이터 처리:</b> 메일과 검토 기록은 브라우저에 저장됩니다. 인증 토큰은 만료 시각과 함께 현재 탭의 sessionStorage에만 두고, 영구 구매 기록이나 백업에 포함하지 않습니다. 사이트 서버나 외부 AI로 전송하지 않습니다. 외화 가격 환산에 필요한 <b>구매일·통화 코드</b>만 Frankfurter 환율 서비스에 전달하며 메일·금액·계정·토큰은 보내지 않아요.</p></div>
  </details>
</div>
    </section>`;

export const homeImportMarkup=`<section class="workflow-card import-card" aria-labelledby="import-title">
        <div class="workflow-heading"><h2 id="import-title">주문 가져오기</h2><button class="notice-button" id="guide-button" aria-label="검증 기준 안내" title="검증 기준 안내" aria-haspopup="dialog" aria-controls="guide-dialog"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-10v.5"/></svg></button><span class="pill" id="source-badge">샘플 데이터</span></div>
        <p class="workflow-lead">모든 판매처의 구매 기록을 한곳에.</p>
        <p class="workflow-description">기간·건수 제한 없이 주문·결제 메일을 가져와요. 같은 메일은 중복해서 쌓이지 않습니다.</p>
        <form id="fetch-form" class="workflow-actions"><button type="submit" class="button primary" id="fetch-button">전체 주문 가져오기</button><button type="button" class="button" id="cancel-button" hidden>취소</button></form>
        <div id="notice" class="notice" role="status" aria-live="polite"></div>
        <details id="fetch-report" class="fetch-report" hidden><summary id="fetch-report-title">가져오기 결과</summary><div id="fetch-report-body" class="disclosure-content"></div></details>
        <div class="workflow-support"><p>버튼을 눌렀을 때만 조회 · Gmail 원본은 그대로</p><div class="source-help-actions"><button class="text-button" id="connection-help">연결 가이드</button><button class="text-button" id="sample-button">샘플로 둘러보기</button><button class="text-button" id="return-records" hidden>내 기록으로 돌아가기</button></div></div>
      </section>
      <div class="home-next"><p>가져온 주문의 상품별 가격 변화와 검토할 내역은 가격 추적에서 확인하세요.</p><button class="button" data-page="tracking">가격 추적으로 이동</button></div>`;

export const accountMarkup=`<span class="connection" id="connection">연결된 계정 없음</span><button class="button" id="connect-button">Gmail 연결</button>`;

export const guideMarkup=`<dialog id="guide-dialog" class="modal" aria-labelledby="guide-title"><div class="dialog-top"><span class="eyebrow">HOW WE COMPARE</span><button class="icon-button" data-close="guide-dialog" aria-label="검증 기준 닫기">×</button></div><h2 id="guide-title">가격을 비교하는 기준.</h2>
<div class="guide-section"><b>01 · 상품 → 구매 이력, 두 단계</b><p>상품명을 기준으로 묶고 옵션·용량·구성은 구분해요. 대소문자·공백과 구분용 쉼표만 정리하며, 판매자와 플랫폼은 구매 이력에 남깁니다. 같은 이름이어도 제조사 정보가 충돌하면 검토 대상으로 두고 가격 비교를 보류해요. 상품을 한곳에 모으는 것과 여러 메일을 같은 주문으로 통합하는 것은 별개입니다.</p></div>
<div class="guide-section"><b>02 · 소비자가가 없으면 결제·주문가 사용</b><p>명시된 소비자가·단가를 우선 사용하고, 없으면 할인가나 상품 결제액을 소비자가로 간주해요. 단일 상품이면 주문 결제액도 사용합니다. 수량이 있으면 개당 가격으로 계산하고, 없으면 구매 단위 가격으로 표시해 서로 섞어 비교하지 않아요. 여러 상품의 주문 총액을 각각의 상품 가격으로 넣지는 않습니다. 할인 근거가 있을 때만 별도 표시하며 결제액에 할인을 두 번 적용하지 않아요.</p></div>
<div class="guide-section"><b>03 · 원화가 기본, 외화는 함께</b><p>메일에 원화 상품금액이 있으면 우선 사용해요. 없으면 <a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter</a>의 구매일 기준환율로 추정하고 원가·환율 기준일을 함께 남겨요. 휴일은 이전 공시일이 적용될 수 있고, 카드 수수료·실제 청구 환율과 다릅니다. 원화 주문 총액을 개별 상품에 나누지는 않아요.</p></div>
<div class="guide-section"><b>04 · 필요한 경우에만 검토 요청</b><p>주문번호가 없어도 기록합니다. 구매일이 없으면 전달 원문의 발송일, 그 정보도 없으면 수신일을 사용해요. 단일 상품 주문서·영수증은 구매처·날짜·상품·옵션·금액이 일대일로 맞을 때 통합합니다. 여러 상품의 결제 영수증은 구매처·날짜·총액·대표 상품명·상품 수가 모두 맞는 주문서가 하나일 때 연결하고, 상품 가격은 주문서에서 가져옵니다. 연결은 상세에서 해제할 수 있어요. 부분 취소는 주문 조정액으로 표시하며, 금액으로 추정한 취소 상품은 검토 대상으로 남깁니다.</p></div>
<div class="guide-section"><b>05 · 자동 추출의 범위</b><p>한국어·영어 항목과 값, HTML 표의 열 제목, Schema.org Order를 공통 주문 형식으로 변환해요. 모든 판매처의 표, 이미지·첨부 영수증을 지원하지 않아요. 샘플의 HTML 메일과 환율은 모두 가상이며 실제 메일 정확도를 나타내지 않아요. 기록은 이 브라우저에 저장되며 백업 파일로 보관·복원할 수 있습니다.</p></div><p class="field-help">메일은 브라우저에서 규칙 기반으로 처리하며 외부 AI 호출은 없습니다. 원문과 대조한 표시는 데이터 오류를 자동 수정하지 않습니다.</p></dialog>`;
