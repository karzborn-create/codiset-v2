// store-list.js - 샘플 가능 매장 리스트 관리
// store-list.html이 로드된 후 StoreList.init() 호출 필요

(function () {
    'use strict';

    let stores = [];
    let selectedKindness = 1;
    let editingId = null; // 수정 중인 매장 id (null이면 추가 모드)

    // DOM 캐시
    let els = {};

    /**
     * HTML 이스케이프
     */
    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 친절도 별 SVG 5개 생성
     */
    function createStarsHTML(kindness) {
        let html = '<div class="store-stars">';
        for (let i = 1; i <= kindness; i++) {
            html += `<svg viewBox="0 0 24 24" class="store-star-filled"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        }
        html += '</div>';
        return html;
    }

    /**
     * 서버에서 매장 목록 로드
     */
    async function loadStores() {
        try {
            const res = await fetch('http://localhost:19877/stores');
            if (res.ok) {
                stores = await res.json();
            }
        } catch (e) {
            // 서버 준비 안 됨
        }
        render();
    }

    /**
     * 렌더링
     */
    function render() {
        if (!els.tbody) return;

        if (els.count) {
            els.count.textContent = stores.length + '개';
        }

        if (stores.length === 0) {
            if (els.empty) els.empty.style.display = '';
            if (els.tableWrapper) els.tableWrapper.style.display = 'none';
            return;
        }

        if (els.empty) els.empty.style.display = 'none';
        if (els.tableWrapper) els.tableWrapper.style.display = '';

        let html = '';
        for (const s of stores) {
            html += `
            <tr data-id="${s.id}" class="store-row">
                <td>${escapeHTML(s.name)}</td>
                <td>${escapeHTML(s.address)}</td>
                <td>${escapeHTML(s.category)}</td>
                <td>${createStarsHTML(s.kindness)}</td>
                <td class="col-memo-cell">${escapeHTML(s.memo)}</td>
            </tr>`;
        }

        els.tbody.innerHTML = html;

        // 각 행에 오버레이 액션 버튼 주입
        els.tbody.querySelectorAll('.store-row').forEach(row => {
            const id = parseInt(row.dataset.id);
            const actions = document.createElement('div');
            actions.className = 'store-row-actions';
            actions.innerHTML = `
                <button class="btn-store-edit" title="수정">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn-store-delete" title="삭제">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>`;
            row.appendChild(actions);

            // 수정 버튼
            actions.querySelector('.btn-store-edit').addEventListener('click', () => {
                const store = stores.find(s => s.id === id);
                if (store) openModal(store);
            });

            // 삭제 버튼
            actions.querySelector('.btn-store-delete').addEventListener('click', () => {
                const store = stores.find(s => s.id === id);
                const name = store ? store.name : '이 매장';
                Modal.open({
                    message: `"${name}"`,
                    subMessage: '이 매장을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.',
                    onConfirm: () => deleteStore(id)
                });
            });
        });
    }

    /**
     * 매장 삭제
     */
    async function deleteStore(id) {
        try {
            const res = await fetch(`http://localhost:19877/store/${id}`, { method: 'DELETE' });
            if (res.ok) {
                stores = stores.filter(s => s.id !== id);
                render();
            }
        } catch (e) {
            console.error('[StoreList] 매장 삭제 실패:', e);
        }
    }

    /**
     * 모달 열기
     * @param {object} [store] - 수정 모드일 경우 기존 매장 데이터
     */
    function openModal(store) {
        if (!els.modal) return;

        if (store) {
            // 수정 모드
            editingId = store.id;
            if (els.modalTitle) els.modalTitle.textContent = '거래처 수정';
            if (els.btnSave) {
                els.btnSave.textContent = '수정';
                els.btnSave.dataset.action = 'edit';
            }
            selectedKindness = store.kindness || 1;
            if (els.inputName) els.inputName.value = store.name || '';
            if (els.inputAddress) els.inputAddress.value = store.address || '';
            if (els.inputCategory) els.inputCategory.value = store.category || '';
            if (els.inputMemo) els.inputMemo.value = store.memo || '';
        } else {
            // 추가 모드
            editingId = null;
            if (els.modalTitle) els.modalTitle.textContent = '거래처 추가';
            if (els.btnSave) {
                els.btnSave.textContent = '추가';
                els.btnSave.dataset.action = 'add';
            }
            selectedKindness = 1;
            if (els.inputName) els.inputName.value = '';
            if (els.inputAddress) els.inputAddress.value = '';
            if (els.inputCategory) els.inputCategory.value = '';
            if (els.inputMemo) els.inputMemo.value = '';
        }

        updateStarUI();
        els.modal.style.display = '';
    }

    /**
     * 모달 닫기
     */
    function closeModal() {
        if (!els.modal) return;
        els.modal.style.display = 'none';
    }

    /**
     * 별점 UI 업데이트
     */
    function updateStarUI() {
        if (!els.starBtns) return;
        els.starBtns.forEach(btn => {
            const star = parseInt(btn.dataset.star);
            btn.classList.toggle('active', star <= selectedKindness);
        });
    }

    /**
     * 매장 저장
     */
    async function saveStore() {
        const name = (els.inputName?.value || '').trim();
        if (!name) {
            alert('매장명을 입력해주세요.');
            return;
        }

        const data = {
            name: name,
            address: (els.inputAddress?.value || '').trim(),
            category: (els.inputCategory?.value || '').trim(),
            kindness: selectedKindness,
            memo: (els.inputMemo?.value || '').trim()
        };

        const isEdit = editingId !== null;
        const url = isEdit
            ? `http://localhost:19877/store/${editingId}`
            : 'http://localhost:19877/store';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                closeModal();
                loadStores();
            } else {
                const err = await res.json();
                alert(err.error || '저장에 실패했습니다.');
            }
        } catch (e) {
            console.error('[StoreList] 매장 저장 실패:', e);
            alert('서버 연결에 실패했습니다.');
        }
    }

    /**
     * 이벤트 바인딩
     */
    function bindEvents() {
        // 거래처 추가 버튼
        if (els.btnAdd) {
            els.btnAdd.addEventListener('click', () => openModal());
        }

        // 모달 닫기
        if (els.btnCancel) {
            els.btnCancel.addEventListener('click', closeModal);
        }
        if (els.modalBackdrop) {
            els.modalBackdrop.addEventListener('click', closeModal);
        }

        // 저장
        if (els.btnSave) {
            els.btnSave.addEventListener('click', saveStore);
        }

        // 별점 클릭
        if (els.starBtns) {
            els.starBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedKindness = parseInt(btn.dataset.star);
                    updateStarUI();
                });
            });
        }

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.modal && els.modal.style.display !== 'none') {
                closeModal();
            }
        });
    }

    /**
     * 초기화
     */
    function init() {
        els = {
            empty: document.getElementById('store-empty'),
            tableWrapper: document.getElementById('store-table-wrapper'),
            tbody: document.getElementById('store-tbody'),
            count: document.getElementById('store-count'),
            btnAdd: document.getElementById('btn-store-add'),
            modal: document.getElementById('store-modal'),
            modalBackdrop: document.querySelector('#store-modal .store-modal-backdrop'),
            inputName: document.getElementById('store-name'),
            inputAddress: document.getElementById('store-address'),
            inputCategory: document.getElementById('store-category'),
            inputMemo: document.getElementById('store-memo'),
            starBtns: document.querySelectorAll('#star-rating .star-btn'),
            btnCancel: document.getElementById('btn-store-cancel'),
            btnSave: document.getElementById('btn-store-save'),
            modalTitle: document.getElementById('store-modal-title')
        };

        bindEvents();
        loadStores();
    }

    // 전역 노출
    window.StoreList = { init, loadStores };
})();
