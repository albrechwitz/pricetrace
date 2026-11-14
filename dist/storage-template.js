export const storageMarkup=`
    <section id="storage-page" class="page-view storage-page" aria-labelledby="storage-title" hidden>
      <div class="page-heading"><div><p class="eyebrow">SETTINGS / LOCAL RECORDS</p><h1 id="storage-title" tabindex="-1">기록 보관 · 복원</h1><p class="subtitle">기록은 이 브라우저에 자동 저장됩니다. 다른 기기로 옮기거나 브라우저 데이터를 지우기 전 백업하세요.</p></div></div>
      <div class="storage-state"><span id="cache-status" role="status" aria-live="polite">저장된 기록 확인 중…</span></div>
      <p id="storage-info" class="storage-account"></p>
      <div class="storage-settings-grid">
        <section class="settings-card" aria-labelledby="backup-title"><h2 id="backup-title">백업 파일 저장</h2><p>현재 계정의 구매 기록을 파일로 보관합니다. 백업에는 메일 원문과 계정 주소가 포함되며, 인증 토큰은 포함되지 않습니다.</p><button class="button primary" id="backup-button">백업 파일 저장</button></section>
        <section class="settings-card" aria-labelledby="restore-title"><h2 id="restore-title">기록 복원</h2><p>백업 파일을 선택하면 같은 계정의 저장 기록과 합쳐 복원합니다. 같은 메일은 중복해서 쌓이지 않습니다.</p><label class="client-label">백업 파일 선택<input type="file" id="restore-file" accept=".json,application/json"></label><details class="setup-section"><summary>백업 내용으로 복원</summary><div class="disclosure-content"><label for="restore-text">Mailtrace 백업 내용</label><textarea id="restore-text" rows="5" placeholder="백업 JSON 내용을 붙여넣으세요" spellcheck="false"></textarea><button class="button" id="restore-button">기록 복원</button></div></details></section>
      </div>
      <p id="storage-result" role="status" aria-live="polite"></p>
      <section class="settings-card storage-privacy" aria-labelledby="privacy-title"><h2 id="privacy-title">이 브라우저 안에 보관</h2><p>메일 원문을 사이트 서버나 외부 AI에 전송하지 않습니다. 외화 환산에 필요한 구매일과 통화 코드만 환율 서비스에 전달합니다.</p><p>클라이언트 ID와 구매 기록은 이 브라우저에 남고, Google 인증이 만료되어도 저장된 기록은 볼 수 있습니다. 브라우저 데이터를 삭제하면 로컬 기록도 지워지므로 중요한 기록은 백업하세요.</p></section>
      <section class="settings-card storage-delete" aria-labelledby="delete-title"><h2 id="delete-title">이 브라우저의 기록 삭제</h2><p>현재 계정의 로컬 구매 기록만 지웁니다. Gmail 원본과 내려받은 백업 파일은 그대로 유지됩니다.</p><button class="text-button danger" id="clear-button">저장된 기록 지우기</button></section>
    </section>
`;
