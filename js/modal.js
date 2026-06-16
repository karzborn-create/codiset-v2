// modal.js - 삭제 확인 모달 제어
// 사용법: Modal.confirm({ message: '...', subMessage: '...', onConfirm: () => { ... } })
// HTML 구조는 html/modal.html 참고

(function () {
    'use strict';

    let els = {};
    let resolveCallback = null;

    /**
     * 모달 DOM 캐싱
     */
    function cacheDOM() {
        if (els.overlay) return; // 이미 캐싱됨
        els = {
            overlay: document.getElementById('confirm-modal'),
            backdrop: document.querySelector('#confirm-modal .modal-backdrop'),
            message: document.getElementById('modal-message'),
            subMessage: document.getElementById('modal-sub-message'),
            btnCancel: document.getElementById('modal-btn-cancel'),
            btnConfirm: document.getElementById('modal-btn-confirm')
        };
    }

    /**
     * 모달 열기
     * @param {object} options
     * @param {string} options.message - 본문 메시지
     * @param {string} [options.subMessage] - 보조 메시지
     * @param {function} options.onConfirm - 확인 시 실행할 콜백
     */
    function open(options) {
        cacheDOM();
        if (!els.overlay) return;

        // 메시지 설정
        els.message.textContent = options.message || '선택한 상품을 삭제하시겠습니까?';
        els.subMessage.textContent = options.subMessage || '이 작업은 되돌릴 수 없습니다.';

        // 콜백 저장
        resolveCallback = options.onConfirm || null;

        // 표시
        els.overlay.style.display = '';
    }

    /**
     * 모달 닫기
     */
    function close() {
        if (!els.overlay) return;
        els.overlay.style.display = 'none';
        resolveCallback = null;
    }

    /**
     * 확인 처리
     */
    function confirm() {
        const cb = resolveCallback;
        close();
        if (typeof cb === 'function') {
            cb();
        }
    }

    /**
     * 이벤트 바인딩
     */
    function bindEvents() {
        cacheDOM();
        if (!els.overlay) return;

        // 취소 버튼
        if (els.btnCancel) {
            els.btnCancel.addEventListener('click', close);
        }

        // 확인 버튼
        if (els.btnConfirm) {
            els.btnConfirm.addEventListener('click', confirm);
        }

        // 백드롭 클릭 시 닫기
        if (els.backdrop) {
            els.backdrop.addEventListener('click', close);
        }

        // ESC 키
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.overlay && els.overlay.style.display !== 'none') {
                close();
            }
        });
    }

    /**
     * 초기화: DOM 로드 후 이벤트 바인딩
     */
    function init() {
        // 모달 HTML이 이미 DOM에 주입되었다고 가정
        bindEvents();
    }

    // 전역 노출
    window.Modal = {
        init: init,
        open: open,
        close: close,
        confirm: confirm
    };
})();
