// sample-check.js - 샘플 체크/반납 페이지 로직
// sample-check.html이 로드된 후 SampleCheck.init() 호출 필요

(function () {
    'use strict';

    let sampleLists = [];       // DB에서 불러온 샘플 리스트
    let currentView = 'card';
    let editingId = null;       // 수정 중인 리스트 ID (null이면 생성 모드)
    let els = {};

    // ===== 헬퍼 =====

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    // ===== API =====

    async function loadSampleLists() {
        try {
            const res = await fetch('http://localhost:19877/sample-lists');
            if (res.ok) {
                sampleLists = await res.json();
            }
        } catch (e) { /* 서버 준비 안 됨 */ }
        if (els.grid) render();
    }

    async function saveSampleList(data) {
        try {
            const res = await fetch('http://localhost:19877/sample-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) { return false; }
    }

    async function updateSampleList(id, data) {
        try {
            const res = await fetch(`http://localhost:19877/sample-list/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) { return false; }
    }

    async function deleteSampleList(id) {
        try {
            const res = await fetch(`http://localhost:19877/sample-list/${id}`, { method: 'DELETE' });
            if (res.ok) {
                sampleLists = sampleLists.filter(s => s.id !== id);
            }
        } catch (e) { console.error('[SampleCheck] 삭제 실패:', e); }
    }

    // ===== 모달 =====

    function openCreateModal() {
        editingId = null;
        if (els.modalTitle) els.modalTitle.textContent = '새 샘플 리스트';
        if (els.dateInput) els.dateInput.value = '';
        if (els.nameInput) els.nameInput.value = '';
        if (els.memoInput) els.memoInput.value = '';
        if (els.btnSave) els.btnSave.textContent = '생성';
        els.modal.style.display = '';
        if (els.nameInput) els.nameInput.focus();
    }

    function openEditModal(item) {
        editingId = item.id;
        if (els.modalTitle) els.modalTitle.textContent = '샘플 리스트 수정';
        if (els.dateInput) els.dateInput.value = item.date || '';
        if (els.nameInput) els.nameInput.value = item.name || '';
        if (els.memoInput) els.memoInput.value = item.memo || '';
        if (els.btnSave) els.btnSave.textContent = '저장';
        els.modal.style.display = '';
        if (els.nameInput) els.nameInput.focus();
    }

    function closeModal() {
        if (!els.modal) return;
        els.modal.style.display = 'none';
    }

    // ===== 생성/수정 =====

    async function saveOrUpdateSampleList() {
        const name = (els.nameInput?.value || '').trim();
        if (!name) { if (els.nameInput) els.nameInput.focus(); return; }

        const data = {
            name: name,
            date: els.dateInput?.value || '',
            memo: (els.memoInput?.value || '').trim()
        };

        let ok;
        if (editingId) {
            const existing = sampleLists.find(s => s.id === editingId);
            data.groups = existing ? existing.groups : [];
            ok = await updateSampleList(editingId, data);
        } else {
            data.groups = [];
            ok = await saveSampleList(data);
        }

        if (ok) {
            editingId = null;
            closeModal();
            await loadSampleLists();
        }
    }

    // ===== 카드/행 HTML =====

    function getStoreNames(item) {
        const groups = item.groups || [];
        const names = groups.map(g => g.storeName || '거래처 미정');
        const unique = [...new Set(names)];
        return unique.slice(0, 3).join(', ') + (unique.length > 3 ? ' 외' : '');
    }

    function createCardHTML(item) {
        const dateStr = formatDate(item.date);
        const groupCount = (item.groups || []).length;
        const totalItems = (item.groups || []).reduce((sum, g) => sum + (g.items ? g.items.length : 0), 0);
        const storeNames = getStoreNames(item);

        return `<div class="sample-check-card" data-id="${item.id}">
            <div class="sample-check-card-actions">
                <button class="btn-edit-sample-list" data-edit="${item.id}" title="수정">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
                <button class="btn-delete-codiset" data-delete="${item.id}" title="삭제">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
            <div class="sample-check-card-header">
                <span class="sample-check-card-name">${escapeHTML(item.name)}</span>
            </div>
            ${item.memo ? `<div class="sample-check-card-memo">${escapeHTML(item.memo)}</div>` : ''}
            ${storeNames ? `<div class="sample-check-card-stores">${escapeHTML(storeNames)}</div>` : ''}
            <div class="sample-check-card-footer">
                <span class="sample-check-card-date">입고일: ${dateStr}</span>
                <span class="sample-check-card-count">${groupCount}개 그룹 · ${totalItems}개</span>
            </div>
        </div>`;
    }

    function createRowHTML(item) {
        const dateStr = formatDate(item.date);
        const totalItems = (item.groups || []).reduce((sum, g) => sum + (g.items ? g.items.length : 0), 0);
        const storeNames = getStoreNames(item);

        return `<div class="sample-check-row" data-id="${item.id}">
            <div class="sample-check-row-body">
                <div class="sample-check-row-header">
                    <span class="sample-check-row-name">${escapeHTML(item.name)}</span>
                </div>
                ${item.memo ? `<div class="sample-check-row-memo">${escapeHTML(item.memo)}</div>` : ''}
                ${storeNames ? `<div class="sample-check-row-stores">${escapeHTML(storeNames)}</div>` : ''}
            </div>
            <div class="sample-check-row-meta">
                <span class="sample-check-row-date">입고일: ${dateStr}</span>
                <span class="sample-check-row-count">${totalItems}개</span>
                <button class="btn-edit-sample-list" data-edit="${item.id}" title="수정">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
            </div>
        </div>`;
    }

    // ===== 뷰 전환 =====

    function switchView(view) {
        currentView = view;
        if (els.btnCard) els.btnCard.classList.toggle('active', view === 'card');
        if (els.btnList) els.btnList.classList.toggle('active', view === 'list');
        if (els.grid) els.grid.classList.toggle('view-list', view === 'list');
        render();
    }

    // ===== 렌더링 =====

    function render() {
        if (!els.grid) return;

        const searchTerm = (els.searchInput?.value || '').toLowerCase();
        let filtered = sampleLists;

        if (searchTerm) {
            filtered = filtered.filter(item =>
                (item.name || '').toLowerCase().includes(searchTerm) ||
                (item.memo || '').toLowerCase().includes(searchTerm) ||
                (item.date || '').includes(searchTerm)
            );
        }

        if (els.count) els.count.textContent = filtered.length + '개';

        if (filtered.length === 0) {
            const msg = searchTerm ? '검색 결과가 없습니다' : '생성된 샘플 리스트가 없습니다';
            els.grid.innerHTML = `<div class="sample-check-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <p>${msg}</p>
                <small>우측 상단의 '+ 샘플 리스트 생성' 버튼을 눌러 새로운 샘플 리스트를 만들어보세요</small>
            </div>`;
            return;
        }

        const isList = currentView === 'list';
        const itemFn = isList ? createRowHTML : createCardHTML;
        els.grid.innerHTML = filtered.map(itemFn).join('');

        // 카드/행 클릭 → 편집 페이지
        filtered.forEach((item, i) => {
            const cardEl = els.grid.children[i];
            if (cardEl) {
                cardEl.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    navigateToEdit(item);
                });
            }
        });

        // 수정 버튼
        els.grid.querySelectorAll('.btn-edit-sample-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.edit);
                const item = sampleLists.find(s => s.id === id);
                if (item) openEditModal(item);
            });
        });

        // 삭제 버튼
        els.grid.querySelectorAll('.btn-delete-codiset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.delete);
                const item = sampleLists.find(s => s.id === id);
                Modal.open({
                    message: `"${item ? item.name : '이 샘플 리스트'}"`,
                    subMessage: '이 샘플 리스트를 삭제하시겠습니까?',
                    onConfirm: async () => {
                        await deleteSampleList(id);
                        render();
                    }
                });
            });
        });
    }

    function navigateToEdit(sampleList) {
        if (typeof window.SampleCheckEdit_navigate === 'function') {
            window.SampleCheckEdit_navigate(sampleList);
        }
    }

    function updateData(updated) {
        const idx = sampleLists.findIndex(s => s.id === updated.id);
        if (idx >= 0) sampleLists[idx] = updated;
    }

    // ===== 이벤트 =====

    function bindEvents() {
        if (els.btnCard) els.btnCard.addEventListener('click', () => switchView('card'));
        if (els.btnList) els.btnList.addEventListener('click', () => switchView('list'));
        if (els.btnCreate) els.btnCreate.addEventListener('click', openCreateModal);
        if (els.btnCancel) els.btnCancel.addEventListener('click', closeModal);
        if (els.modalBackdrop) els.modalBackdrop.addEventListener('click', closeModal);
        if (els.btnSave) els.btnSave.addEventListener('click', saveOrUpdateSampleList);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.modal && els.modal.style.display !== 'none') closeModal();
        });

        if (els.searchInput) els.searchInput.addEventListener('input', render);

        if (els.nameInput) {
            els.nameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') saveOrUpdateSampleList();
            });
        }
    }

    function init() {
        els = {
            grid: document.getElementById('sample-check-grid'),
            count: document.getElementById('sample-check-count'),
            searchInput: document.getElementById('sample-check-search'),
            btnCreate: document.getElementById('btn-sample-check-create'),
            btnCard: document.getElementById('btn-sample-check-view-card'),
            btnList: document.getElementById('btn-sample-check-view-list'),
            modal: document.getElementById('sample-check-modal'),
            modalTitle: document.getElementById('sample-check-modal-title'),
            modalBackdrop: document.querySelector('#sample-check-modal .sample-check-modal-backdrop'),
            dateInput: document.getElementById('sample-check-date'),
            nameInput: document.getElementById('sample-check-name'),
            memoInput: document.getElementById('sample-check-memo'),
            btnCancel: document.getElementById('btn-sample-check-cancel'),
            btnSave: document.getElementById('btn-sample-check-save')
        };
        bindEvents();
        loadSampleLists();
    }

    window.SampleCheck = { init, updateData, loadSampleLists };
})();
