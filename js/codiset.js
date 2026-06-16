// codiset.js - 코디세트 페이지 로직
// codiset.html이 로드된 후 Codiset.init() 호출 필요

(function () {
    'use strict';

    let codisets = [];
    let editingCodisetId = null; // 현재 편집 중인 코디세트 ID (null이면 생성 모드)
    let selectedSeason = ''; // 생성/편집 모달에서 선택된 시즌 태그
    let activeFilterSeason = ''; // 필터용 시즌 ('' = 전체)
    let currentView = 'card'; // 'card' | 'list'
    let selectedIds = new Set(); // 선택된 코디세트 ID 집합
    let isSelectionMode = false; // 선택 모드 활성 여부
    let els = {};

    // ===== API =====

    async function loadCodisets() {
        try {
            const res = await fetch('http://localhost:19877/codisets');
            if (res.ok) {
                codisets = await res.json();
            }
        } catch (e) {
            // 서버 준비 안 됨
        }
        if (els.grid) render();
    }

    async function saveCodiset(data) {
        try {
            const res = await fetch('http://localhost:19877/codiset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async function updateCodiset(id, data) {
        try {
            const res = await fetch(`http://localhost:19877/codiset/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    // ===== 모달 =====

    function openCreateModal() {
        editingCodisetId = null;
        if (els.modalTitle) els.modalTitle.textContent = '새 코디세트';
        if (els.nameInput) els.nameInput.value = '';
        if (els.memoInput) els.memoInput.value = '';
        selectedSeason = '';
        updateSeasonButtons();
        if (els.btnSave) els.btnSave.textContent = '생성';
        els.modal.style.display = '';
        if (els.nameInput) els.nameInput.focus();
    }

    function openEditModal(codiset) {
        editingCodisetId = codiset.id;
        if (els.modalTitle) els.modalTitle.textContent = '코디세트 수정';
        if (els.nameInput) els.nameInput.value = codiset.name || '';
        if (els.memoInput) els.memoInput.value = codiset.memo || '';
        selectedSeason = codiset.season || '';
        updateSeasonButtons();
        if (els.btnSave) els.btnSave.textContent = '저장';
        els.modal.style.display = '';
        if (els.nameInput) els.nameInput.focus();
    }

    function closeModal() {
        if (!els.modal) return;
        els.modal.style.display = 'none';
        editingCodisetId = null;
    }

    function onSeasonClick(season) {
        selectedSeason = (selectedSeason === season) ? '' : season;
        updateSeasonButtons();
    }

    function updateSeasonButtons() {
        if (!els.seasonBtns) return;
        els.seasonBtns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.season === selectedSeason);
        });
    }

    // ===== 생성 / 수정 =====

    async function submitCodiset() {
        const name = (els.nameInput?.value || '').trim();
        if (!name) {
            if (els.nameInput) els.nameInput.focus();
            return;
        }

        const data = {
            name: name,
            season: selectedSeason,
            memo: (els.memoInput?.value || '').trim()
        };

        let ok;
        if (editingCodisetId) {
            ok = await updateCodiset(editingCodisetId, data);
        } else {
            data.sets = [];
            ok = await saveCodiset(data);
        }

        if (ok) {
            closeModal();
            await loadCodisets();
        }
    }

    // ===== 헬퍼 =====

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function createSeasonBadge(season) {
        if (!season) return '';
        return `<span class="season-badge season-${season}">${escapeHTML(season)}</span>`;
    }

    function getProductCount(c) {
        if (!c.sets || !Array.isArray(c.sets)) return 0;
        return c.sets.reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
    }

    // ===== 카드/행 HTML =====

    function createCardHTML(c) {
        const dateStr = c.createdAt
            ? new Date(c.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '';
        const count = getProductCount(c);

        return `<div class="codiset-card${selectedIds.has(c.id) ? ' selected' : ''}" data-id="${c.id}">
            <button class="btn-delete-codiset" data-delete="${c.id}" title="삭제">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
            <button class="btn-edit-codiset" data-edit="${c.id}" title="수정">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                </svg>
            </button>
            <div class="codiset-card-header">
                <span class="codiset-card-name">${escapeHTML(c.name)}</span>
                ${c.season ? `<div class="codiset-card-season">${createSeasonBadge(c.season)}</div>` : ''}
            </div>
            ${c.memo ? `<div class="codiset-card-memo">${escapeHTML(c.memo)}</div>` : ''}
            <div class="codiset-card-footer">
                <span class="codiset-card-date">${dateStr}</span>
                <span class="codiset-card-count">상품 ${count}개</span>
            </div>
        </div>`;
    }

    function createRowHTML(c) {
        const dateStr = c.createdAt
            ? new Date(c.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '';
        const count = getProductCount(c);

        return `<div class="codiset-row${selectedIds.has(c.id) ? ' selected' : ''}" data-id="${c.id}">
            <button class="btn-delete-codiset" data-delete="${c.id}" title="삭제">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
            <button class="btn-edit-codiset" data-edit="${c.id}" title="수정">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                </svg>
            </button>
            <div class="codiset-row-body">
                <div class="codiset-row-header">
                    <span class="codiset-row-name">${escapeHTML(c.name)}</span>
                    ${c.season ? `<div class="codiset-row-season">${createSeasonBadge(c.season)}</div>` : ''}
                </div>
                ${c.memo ? `<div class="codiset-row-memo">${escapeHTML(c.memo)}</div>` : ''}
            </div>
            <div class="codiset-row-meta">
                <span class="codiset-row-date">${dateStr}</span>
                <span class="codiset-row-count">상품 ${count}개</span>
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

    // ===== 시즌 필터 =====

    function onSeasonFilter(season) {
        activeFilterSeason = season;
        if (els.seasonFilterBtns) {
            els.seasonFilterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.season === season);
            });
        }
        render();
    }

    // ===== 편집 페이지 이동 =====

    function navigateToEdit(codiset) {
        if (typeof window.CodisetEdit_navigate === 'function') {
            window.CodisetEdit_navigate(codiset);
        }
    }

    // ===== 렌더링 =====

    function render() {
        if (!els.grid) return;

        const searchTerm = (els.searchInput?.value || '').toLowerCase();
        let filtered = codisets;

        if (activeFilterSeason) {
            filtered = filtered.filter(c => c.season === activeFilterSeason);
        }

        if (searchTerm) {
            filtered = filtered.filter(c =>
                (c.name || '').toLowerCase().includes(searchTerm) ||
                (c.memo || '').toLowerCase().includes(searchTerm)
            );
        }

        if (els.count) {
            els.count.textContent = filtered.length + '개';
        }

        if (filtered.length === 0) {
            const msg = searchTerm ? '검색 결과가 없습니다' : (activeFilterSeason ? `'${activeFilterSeason}' 시즌 코디세트가 없습니다` : '생성된 코디세트가 없습니다');
            els.grid.innerHTML = `
            <div class="codiset-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
                </svg>
                <p>${msg}</p>
                <small>우측 상단의 '+ 코디생성' 버튼을 눌러 새로운 코디세트를 만들어보세요</small>
            </div>`;
            return;
        }

        const isList = currentView === 'list';
        const itemFn = isList ? createRowHTML : createCardHTML;
        const html = filtered.map(itemFn).join('');
        els.grid.innerHTML = html;

        // 선택 모드 클래스
        els.grid.classList.toggle('is-selection-mode', isSelectionMode);

        // 삭제 버튼 이벤트
        els.grid.querySelectorAll('.btn-delete-codiset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.delete);
                const codiset = codisets.find(c => c.id === id);
                const name = codiset ? codiset.name : '이 코디세트';
                Modal.open({
                    message: `"${name}"`,
                    subMessage: '이 코디세트를 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.',
                    onConfirm: () => deleteCodiset(id)
                });
            });
        });

        // 수정 버튼 이벤트
        els.grid.querySelectorAll('.btn-edit-codiset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.edit);
                const codiset = codisets.find(c => c.id === id);
                if (codiset) {
                    openEditModal(codiset);
                }
            });
        });

        // 카드/행 클릭 이벤트
        filtered.forEach((c, i) => {
            const cardEl = els.grid.children[i];
            if (cardEl) {
                cardEl.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    if (isSelectionMode) {
                        if (selectedIds.has(c.id)) {
                            selectedIds.delete(c.id);
                        } else {
                            selectedIds.add(c.id);
                        }
                        updateSelectionUI();
                        render();
                    } else {
                        navigateToEdit(c);
                    }
                });
            }
        });
    }

    // ===== 삭제 =====

    async function deleteCodiset(id) {
        try {
            const res = await fetch(`http://localhost:19877/codiset/${id}`, { method: 'DELETE' });
            if (res.ok) {
                codisets = codisets.filter(c => c.id !== id);
                selectedIds.delete(id);
                if (selectedIds.size === 0) {
                    isSelectionMode = false;
                }
                updateSelectionUI();
                render();
            }
        } catch (e) {
            console.error('[Codiset] 삭제 실패:', e);
        }
    }

    // ===== 선택 모드 =====

    function getVisibleIds() {
        const searchTerm = (els.searchInput?.value || '').toLowerCase();
        let filtered = codisets;
        if (activeFilterSeason) {
            filtered = filtered.filter(c => c.season === activeFilterSeason);
        }
        if (searchTerm) {
            filtered = filtered.filter(c =>
                (c.name || '').toLowerCase().includes(searchTerm) ||
                (c.memo || '').toLowerCase().includes(searchTerm)
            );
        }
        return filtered.map(c => c.id);
    }

    function updateSelectionUI() {
        if (!els.selectionToolbar) return;
        const count = selectedIds.size;
        if (count > 0) {
            els.selectionToolbar.style.display = 'flex';
            els.selectionCount.textContent = `${count}개 선택`;
        } else {
            els.selectionToolbar.style.display = 'none';
        }
        if (els.btnSelectMode) {
            els.btnSelectMode.classList.toggle('active', isSelectionMode);
        }
        if (els.grid) {
            els.grid.classList.toggle('is-selection-mode', isSelectionMode);
        }
        if (els.checkAll) {
            const visibleIds = getVisibleIds();
            els.checkAll.checked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
            els.checkAll.indeterminate = visibleIds.some(id => selectedIds.has(id)) && !els.checkAll.checked;
        }
    }

    function toggleSelectAll() {
        const visibleIds = getVisibleIds();
        const allSelected = visibleIds.every(id => selectedIds.has(id));
        if (allSelected) {
            visibleIds.forEach(id => selectedIds.delete(id));
        } else {
            visibleIds.forEach(id => selectedIds.add(id));
        }
        updateSelectionUI();
        render();
    }

    function toggleSelectionMode() {
        if (isSelectionMode) {
            cancelSelection();
        } else {
            isSelectionMode = true;
            updateSelectionUI();
            render();
        }
    }

    function cancelSelection() {
        selectedIds.clear();
        isSelectionMode = false;
        updateSelectionUI();
        render();
    }

    async function deleteSelected() {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        Modal.open({
            message: `선택한 ${ids.length}개의 코디세트`,
            subMessage: '선택한 코디세트를 모두 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.',
            onConfirm: async () => {
                for (const id of ids) {
                    try {
                        const res = await fetch(`http://localhost:19877/codiset/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            codisets = codisets.filter(c => c.id !== id);
                        }
                    } catch (e) {
                        console.error('[Codiset] 일괄 삭제 실패:', e);
                    }
                }
                selectedIds.clear();
                isSelectionMode = false;
                updateSelectionUI();
                render();
            }
        });
    }

    function bindSelectionEvents() {
        els.checkAll = document.getElementById('codiset-check-all');
        els.selectionToolbar = document.getElementById('codiset-selection-toolbar');
        els.selectionCount = document.getElementById('codiset-selection-count');
        els.btnDeleteSelected = document.getElementById('btn-codiset-delete-selected');
        els.btnCancelSelection = document.getElementById('btn-codiset-cancel-selection');
        els.btnSelectMode = document.getElementById('btn-codiset-select-mode');

        if (els.checkAll) {
            els.checkAll.addEventListener('change', toggleSelectAll);
        }
        if (els.btnDeleteSelected) {
            els.btnDeleteSelected.addEventListener('click', deleteSelected);
        }
        if (els.btnCancelSelection) {
            els.btnCancelSelection.addEventListener('click', cancelSelection);
        }
        if (els.btnSelectMode) {
            els.btnSelectMode.addEventListener('click', toggleSelectionMode);
        }
    }

    // ===== 이벤트 바인딩 =====

    function bindSeasonFilter() {
        els.seasonFilterBtns = document.querySelectorAll('#codiset-season-filter .season-filter-btn');
        els.seasonFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                onSeasonFilter(btn.dataset.season);
            });
        });
    }

    function bindEvents() {
        if (els.btnCreate) els.btnCreate.addEventListener('click', openCreateModal);
        if (els.btnCancel) els.btnCancel.addEventListener('click', closeModal);
        if (els.modalBackdrop) els.modalBackdrop.addEventListener('click', closeModal);
        if (els.btnSave) els.btnSave.addEventListener('click', submitCodiset);

        els.seasonBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                onSeasonClick(btn.dataset.season);
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.modal && els.modal.style.display !== 'none') {
                closeModal();
            }
        });

        if (els.nameInput) {
            els.nameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') submitCodiset();
            });
        }
    }

    // ===== 초기화 =====

    function init() {
        els = {
            grid: document.getElementById('codiset-grid'),
            count: document.getElementById('codiset-count'),
            searchInput: document.getElementById('codiset-search'),
            btnCreate: document.getElementById('btn-codiset-create'),
            btnCard: document.getElementById('btn-codiset-view-card'),
            btnList: document.getElementById('btn-codiset-view-list'),
            modal: document.getElementById('codiset-modal'),
            modalTitle: document.getElementById('codiset-modal-title'),
            modalBackdrop: document.querySelector('#codiset-modal .codiset-modal-backdrop'),
            nameInput: document.getElementById('codiset-name'),
            memoInput: document.getElementById('codiset-memo'),
            btnCancel: document.getElementById('btn-codiset-cancel'),
            btnSave: document.getElementById('btn-codiset-save'),
            seasonBtns: document.querySelectorAll('#codiset-season-select .codiset-season-btn')
        };

        if (els.searchInput) els.searchInput.addEventListener('input', render);
        if (els.btnCard) els.btnCard.addEventListener('click', () => switchView('card'));
        if (els.btnList) els.btnList.addEventListener('click', () => switchView('list'));

        bindEvents();
        bindSeasonFilter();
        bindSelectionEvents();
        loadCodisets();
    }

    window.Codiset = { init, loadCodisets };
})();
