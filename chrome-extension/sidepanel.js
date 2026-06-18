// sidepanel.js - 사이드 패널 로직
// 수집 버튼 → content.js에 수집 요청 → 미리보기 → 등록 → Electron HTTP 전송

const SERVER_URL = 'http://localhost:19877';
let collectedData = null;
let selectedSeasons = [];
let selectedAccs = [];

// DOM 요소
const els = {
    btnCollect: document.getElementById('btn-collect'),
    btnRegister: document.getElementById('btn-register'),
    previewContainer: document.getElementById('preview-container'),
    statusMessage: document.getElementById('status-message'),
    seasonBtns: document.querySelectorAll('.season-btn'),
    accBtns: document.querySelectorAll('.acc-btn')
};

// 필드 라벨 매핑
const FIELD_LABELS = {
    storeName: '상점명',
    storeAddress: '상점주소',
    productName: '상품명',
    productCode: '상품코드',
    productPrice: '상품가격',
    color: '색상',
    size: '사이즈'
};

/**
 * 상태 메시지 표시
 */
function showStatus(text, type) {
    els.statusMessage.textContent = text;
    els.statusMessage.className = 'status-message ' + type;
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            els.statusMessage.textContent = '';
            els.statusMessage.className = 'status-message';
        }, 3000);
    }
}

/**
 * 미리보기 렌더링
 */
function renderPreview(data) {
    if (!data) {
        els.previewContainer.innerHTML = `
      <div class="preview-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>수집 버튼을 눌러 상품 정보를 불러오세요</span>
      </div>`;
        return;
    }

    const rows = Object.entries(data)
        .filter(([key]) => key !== 'image')
        .map(([key, val]) => {
            if (key === 'productName') {
                return `
      <div class="preview-row preview-row-editable">
        <span class="preview-label">${FIELD_LABELS[key] || key}</span>
        <input type="text" class="preview-input" id="input-productName" value="${escapeHtml(val || '')}" placeholder="상품명 입력">
      </div>`;
            }
            return `
      <div class="preview-row">
        <span class="preview-label">${FIELD_LABELS[key] || key}</span>
        <span class="preview-value">${val || '-'}</span>
      </div>`;
        }).join('');

    els.previewContainer.innerHTML = `
    <div class="preview-data">
      ${data.image ? `<img class="preview-image" src="${data.image}" alt="상품 이미지" onerror="this.style.display='none'">` : ''}
      ${rows}
    </div>`;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 수집 실행
 */
async function collect() {
    showStatus('수집 중...', 'info');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showStatus('활성 탭을 찾을 수 없습니다', 'error');
            return;
        }

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'collect' });

        if (response && response.ok) {
            collectedData = response.data;
            renderPreview(collectedData);
            els.btnRegister.disabled = false;
            showStatus('수집 완료', 'success');
        } else {
            showStatus('데이터 수집에 실패했습니다', 'error');
        }
    } catch (err) {
        console.error('[Codiset] 수집 오류:', err);
        showStatus('페이지와 통신할 수 없습니다. 페이지를 새로고침 후 다시 시도하세요.', 'error');
    }
}

/**
 * 시즌 선택 처리 (다중 선택 토글)
 */
function initSeasonButtons() {
    els.seasonBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const season = btn.dataset.season;
            const idx = selectedSeasons.indexOf(season);
            if (idx === -1) {
                selectedSeasons.push(season);
                btn.classList.add('active');
            } else {
                selectedSeasons.splice(idx, 1);
                btn.classList.remove('active');
            }
            updateRegisterButton();
        });
    });
}

/**
 * 등록 버튼 활성화 상태 갱신
 */
function updateRegisterButton() {
    els.btnRegister.disabled = !(collectedData && (selectedSeasons.length > 0 || selectedAccs.length > 0));
}

/**
 * ACC 선택 처리 (다중 선택 토글)
 */
function initAccButtons() {
    els.accBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const acc = btn.dataset.acc;
            const idx = selectedAccs.indexOf(acc);
            if (idx === -1) {
                selectedAccs.push(acc);
                btn.classList.add('active');
            } else {
                selectedAccs.splice(idx, 1);
                btn.classList.remove('active');
            }
        });
    });
}

/**
 * 등록 실행 - Electron HTTP 서버로 전송
 */
async function register() {
    if (!collectedData) {
        showStatus('먼저 수집 버튼을 눌러주세요', 'error');
        return;
    }

    if (selectedSeasons.length === 0 && selectedAccs.length === 0) {
        showStatus('시즌 또는 ACC를 선택해주세요', 'error');
        return;
    }

    // 수정된 상품명 읽기
    const nameInput = document.getElementById('input-productName');
    if (nameInput) {
        collectedData.productName = nameInput.value.trim();
    }

    showStatus('등록 중...', 'info');

    try {
        const body = {
            ...collectedData,
            season: selectedSeasons.join(','),
            registeredAt: new Date().toISOString()
        };
        if (selectedAccs.length > 0) {
            body.acc = selectedAccs.join(',');
        }

        const response = await fetch(`${SERVER_URL}/product`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            showStatus('등록 완료! Codiset에서 확인하세요', 'success');
            collectedData = null;
            renderPreview(null);
            selectedSeasons = [];
            selectedAccs = [];
            els.seasonBtns.forEach(b => b.classList.remove('active'));
            els.accBtns.forEach(b => b.classList.remove('active'));
            els.btnRegister.disabled = true;
        } else {
            const err = await response.json().catch(() => ({}));
            showStatus(err.message || '등록 실패. Codiset 앱이 실행 중인지 확인하세요.', 'error');
        }
    } catch (err) {
        console.error('[Codiset] 등록 오류:', err);
        showStatus('Codiset 앱과 연결할 수 없습니다. 앱이 실행 중인지 확인하세요.', 'error');
    }
}

// 초기화
function init() {
    els.btnCollect.addEventListener('click', collect);
    els.btnRegister.addEventListener('click', register);
    initSeasonButtons();
    initAccButtons();
}

document.addEventListener('DOMContentLoaded', init);
