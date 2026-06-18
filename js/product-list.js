// product-list.js - 상품 카드 렌더링 및 관리
// product-list.html이 로드된 후 ProductList.init() 호출 필요

(function () {
    'use strict';

    const PAGE_SIZE = 100;

    let products = [];        // 현재까지 로드된 상품들
    let totalCount = 0;       // 서버상 전체 개수
    let hasMore = false;      // 더 불러올 상품이 있는지
    let selectedIds = new Set();
    let isSelectionMode = false;
    let activeSeason = '';
    let activeAcc = '';

    let isLoading = false;   // 로딩 중 중복 방지
    let observer = null;     // IntersectionObserver

    // DOM 캐시
    let els = {};

    /**
     * 가격 포맷 (텍스트에서 숫자만 추출)
     */
    function formatPrice(raw) {
        if (!raw) return '₩0';
        const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
        return isNaN(num) ? '₩0' : '₩' + num.toLocaleString();
    }

    /**
     * 서버 요청 URL 생성
     */
    function buildURL(offset) {
        const params = new URLSearchParams();
        params.set('limit', PAGE_SIZE);
        params.set('offset', offset || 0);
        if (activeSeason) params.set('season', activeSeason);
        if (activeAcc) params.set('acc', activeAcc);
        const searchTerm = (els.searchInput?.value || '').trim();
        if (searchTerm) params.set('search', searchTerm);
        return 'http://localhost:19877/products?' + params.toString();
    }

    /**
     * 서버에서 상품 목록 로드 (초기 로드)
     */
    async function loadProducts() {
        try {
            const res = await fetch(buildURL(0));
            if (res.ok) {
                const data = await res.json();
                products = data.rows;
                totalCount = data.total;
                hasMore = data.hasMore;
            }
        } catch (e) {
            // 서버 준비 안 됨
        }
        if (els.grid) {
            render();
        }
    }

    /**
     * 더 보기 - 추가 100개 로드 (IntersectionObserver가 호출)
     */
    async function loadMore() {
        if (isLoading || !hasMore) return;
        isLoading = true;
        try {
            const res = await fetch(buildURL(products.length));
            if (res.ok) {
                const data = await res.json();
                products = products.concat(data.rows);
                totalCount = data.total;
                hasMore = data.hasMore;
            }
        } catch (e) {
            // 서버 준비 안 됨
        }
        isLoading = false;
        if (els.grid) {
            render();
        }
    }

    /**
     * 상품 카드 HTML 생성
     */
    function createCardHTML(p) {
        const imageAlt = p.productName || p.storeName || '';
        const imageHTML = p.image
            ? `<img class="product-card-image" src="${escapeHTML(p.image)}" alt="${escapeHTML(imageAlt)}" loading="lazy" onerror="this.classList.add('no-image');this.src=''">`
            : `<div class="product-card-image no-image"></div>`;

        const dateStr = p.registeredAt
            ? new Date(p.registeredAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '';

        const colorTags = p.color
            ? p.color.split(/[,/]/).map(c => `<span class="color-tag">${escapeHTML(c.trim())}</span>`).join('')
            : '';

        const sizeTags = p.size
            ? p.size.split(/[,/]/).map(s => `<span class="color-tag">${escapeHTML(s.trim())}</span>`).join('')
            : '';

        const seasonBadges = p.season
            ? p.season.split(',').map(s => `<span class="season-badge season-${s.trim()}">${escapeHTML(s.trim())}</span>`).join('')
            : '';

        const accBadges = p.acc
            ? p.acc.split(',').map(a => `<span class="acc-badge acc-${a.trim()}">${escapeHTML(a.trim())}</span>`).join('')
            : '';

        return `
      <div class="product-card${selectedIds.has(p.id) ? ' selected' : ''}" data-id="${p.id}">
        <input type="checkbox" class="selection-checkbox-item" data-select="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}>
        <button class="btn-delete-product" data-delete="${p.id}" title="삭제">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        ${imageHTML}
        <div class="product-card-body">
          <div class="product-card-name-row">
            <div class="product-card-name">${escapeHTML(p.productName || p.storeName || '이름 없음')}</div>
            <button class="btn-edit-product" data-edit="${p.id}" data-edit-field="productName" title="상품명 수정">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
          <div class="product-card-supplier">${escapeHTML(p.storeName || '')}${p.storeAddress ? ' · ' + escapeHTML(p.storeAddress) : ''}</div>
          <div class="product-card-meta">
            <span>코드: ${escapeHTML(p.productCode || '-')}</span>
            ${seasonBadges}
          </div>
          ${accBadges ? `<div class="product-card-colors">${accBadges}</div>` : ''}
          <div class="product-card-price">${formatPrice(p.productPrice)}</div>
          ${colorTags ? `<div class="product-card-colors">${colorTags}</div>` : ''}
          ${sizeTags ? `<div class="product-card-colors">${sizeTags}</div>` : ''}
          <div class="product-card-footer">
            <span class="product-card-date">${dateStr}</span>
          </div>
        </div>
      </div>`;
    }

    /**
     * 리스트 행 HTML 생성
     */
    function createRowHTML(p) {
        const imageAlt = p.productName || p.storeName || '';
        const imageHTML = p.image
            ? `<img class="product-row-image" src="${escapeHTML(p.image)}" alt="${escapeHTML(imageAlt)}" loading="lazy" onerror="this.classList.add('no-image');this.src=''">`
            : `<div class="product-row-image no-image"></div>`;

        const dateStr = p.registeredAt
            ? new Date(p.registeredAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '';

        const colorTags = p.color
            ? p.color.split(/[,/]/).map(c => `<span class="color-tag">${escapeHTML(c.trim())}</span>`).join('')
            : '';

        const sizeTags = p.size
            ? p.size.split(/[,/]/).map(s => `<span class="color-tag">${escapeHTML(s.trim())}</span>`).join('')
            : '';

        const seasonBadges = p.season
            ? p.season.split(',').map(s => `<span class="season-badge season-${s.trim()}">${escapeHTML(s.trim())}</span>`).join('')
            : '';

        const accBadges = p.acc
            ? p.acc.split(',').map(a => `<span class="acc-badge acc-${a.trim()}">${escapeHTML(a.trim())}</span>`).join('')
            : '';

        return `
      <div class="product-row${selectedIds.has(p.id) ? ' selected' : ''}" data-id="${p.id}">
        <input type="checkbox" class="selection-checkbox-item" data-select="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}>
        <button class="btn-delete-product" data-delete="${p.id}" title="삭제">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        ${imageHTML}
        <div class="product-row-body">
          ${seasonBadges ? `<div class="product-row-season">${seasonBadges}</div>` : ''}
          <div class="product-row-name-row">
            <div class="product-row-name">${escapeHTML(p.productName || p.storeName || '이름 없음')}</div>
            <button class="btn-edit-product" data-edit="${p.id}" data-edit-field="productName" title="상품명 수정">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
          <div class="product-row-info">
            <span class="product-row-supplier">${escapeHTML(p.storeName || '')}</span>
            ${p.productCode ? `<span>코드: ${escapeHTML(p.productCode)}</span>` : ''}
            ${dateStr ? `<span>${dateStr}</span>` : ''}
          </div>
          ${accBadges ? `<div class="product-row-tags">${accBadges}</div>` : ''}
          ${colorTags || sizeTags ? `<div class="product-row-tags">${colorTags}${sizeTags}</div>` : ''}
        </div>
        <div class="product-row-price">${formatPrice(p.productPrice)}</div>
      </div>`;
    }

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
     * 날짜 포맷 (그룹 헤더용)
     */
    function formatDateHeader(dateStr) {
        if (!dateStr) return '날짜 없음';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    }

    /**
     * 날짜 YYYY-MM-DD 추출
     */
    function getDateKey(dateStr) {
        if (!dateStr) return '0000-00-00';
        const d = new Date(dateStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * 등록일 기준 내림차순 정렬 후 날짜별 그룹핑
     */
    function groupByDate(list) {
        const sorted = [...list].sort((a, b) => {
            const da = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
            const db = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
            return db - da;
        });

        const groups = [];
        let lastKey = null;
        for (const item of sorted) {
            const key = getDateKey(item.registeredAt);
            if (key !== lastKey) {
                groups.push({ dateKey: key, dateHeader: formatDateHeader(item.registeredAt), items: [] });
                lastKey = key;
            }
            groups[groups.length - 1].items.push(item);
        }
        return groups;
    }

    /** 현재 뷰 모드: 'card' | 'list' */
    let currentView = 'card';

    /**
     * 뷰 전환
     */
    function switchView(view) {
        currentView = view;
        if (els.btnCard) els.btnCard.classList.toggle('active', view === 'card');
        if (els.btnList) els.btnList.classList.toggle('active', view === 'list');
        if (els.grid) els.grid.classList.toggle('view-list', view === 'list');
        render();
    }

    /**
     * 렌더링 (서버에서 이미 필터링된 데이터 사용)
     */
    function render() {
        if (!els.grid) return;

        const searchTerm = (els.searchInput?.value || '').trim();
        const displayed = products; // 서버에서 이미 필터링/검색된 결과

        if (els.count) {
            els.count.textContent = totalCount + '개';
        }

        if (displayed.length === 0) {
            const noResultMsg = activeSeason ? `'${activeSeason}' 시즌에 ` : '';
            els.grid.innerHTML = `
        <div class="product-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <p>${searchTerm ? '검색 결과가 없습니다' : (noResultMsg + '등록된 상품이 없습니다')}</p>
          <small>크롬 확장프로그램을 통해 상품을 수집하고 등록해보세요</small>
        </div>`;
            return;
        }

        const groups = groupByDate(displayed);
        const isList = currentView === 'list';
        const cardFn = isList ? createRowHTML : createCardHTML;
        const cardsClass = isList ? 'date-group-rows' : 'date-group-cards';

        let html = '';
        for (const group of groups) {
            html += `<div class="date-group">
        <div class="date-group-header">
          <span class="date-group-label">${escapeHTML(group.dateHeader)}</span>
          <span class="date-group-count">${group.items.length}개</span>
        </div>
        <div class="${cardsClass}">`;
            html += group.items.map(cardFn).join('');
            html += `</div></div>`;
        }

        // Intersection Observer용 센티넬 + 로딩 인디케이터
        if (hasMore) {
            html += `<div id="load-more-sentinel" class="load-more-sentinel">
        <div class="load-more-spinner"></div>
        <span class="load-more-info">${displayed.length} / ${totalCount} 로드됨</span>
      </div>`;
        } else if (displayed.length > 0) {
            html += `<div class="load-more-sentinel load-more-done">
        <span class="load-more-info">${displayed.length} / ${totalCount} 전체 로드 완료</span>
      </div>`;
        }

        els.grid.innerHTML = html;

        // IntersectionObserver로 센티넬 감시
        setupObserver();

        // 선택 모드 클래스 토글
        els.grid.classList.toggle('is-selection-mode', isSelectionMode);

        // 체크박스 이벤트
        els.grid.querySelectorAll('.selection-checkbox-item').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = parseInt(cb.dataset.select);
                if (cb.checked) {
                    selectedIds.add(id);
                } else {
                    selectedIds.delete(id);
                }
                updateSelectionUI();
                render();
            });
        });

        // 수정 버튼 이벤트
        els.grid.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSelectionMode) return;
                const id = parseInt(btn.dataset.edit);
                const field = btn.dataset.editField;
                const card = btn.closest('.product-card, .product-row');
                const nameEl = card.querySelector('.product-card-name, .product-row-name');
                if (nameEl) startInlineEdit(nameEl, id, field);
            });
        });

        // 삭제 버튼 이벤트 - 확인 모달 후 삭제
        els.grid.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.delete);
                const product = products.find(p => p.id === id);
                const productName = product ? (product.productName || product.storeName || '이 상품') : '이 상품';
                Modal.open({
                    message: `"${productName}"`,
                    subMessage: '이 상품을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.',
                    onConfirm: () => deleteProduct(id)
                });
            });
        });
    }

    // ===== 선택 모드 관련 =====

    /**
     * 선택 툴바 업데이트
     */
    function updateSelectionUI() {
        if (!els.selectionToolbar) return;
        const count = selectedIds.size;
        if (count > 0) {
            isSelectionMode = true;
            els.selectionToolbar.style.display = 'flex';
            els.selectionCount.textContent = `${count}개 선택`;
        } else {
            els.selectionToolbar.style.display = 'none';
        }
        // 선택 버튼 액티브 상태
        if (els.btnSelectMode) {
            els.btnSelectMode.classList.toggle('active', isSelectionMode);
        }
        // 그리드 선택 모드 클래스
        if (els.grid) {
            els.grid.classList.toggle('is-selection-mode', isSelectionMode);
        }
        // 전체선택 체크박스 상태
        if (els.checkAll) {
            const visibleIds = getVisibleIds();
            els.checkAll.checked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
            els.checkAll.indeterminate = visibleIds.some(id => selectedIds.has(id)) && !els.checkAll.checked;
        }
    }

    /**
     * 현재 화면에 보이는 상품 ID 목록 (서버에서 이미 필터링됨)
     */
    function getVisibleIds() {
        return products.map(p => p.id);
    }

    /**
     * 전체 선택 / 해제
     */
    function toggleSelectAll() {
        const visibleIds = getVisibleIds();
        const allSelected = visibleIds.every(id => selectedIds.has(id));

        if (allSelected) {
            // 모두 선택되어 있으면 전체 해제
            visibleIds.forEach(id => selectedIds.delete(id));
        } else {
            // 전체 선택
            visibleIds.forEach(id => selectedIds.add(id));
        }
        updateSelectionUI();
        render();
    }

    /**
     * 선택 모드 진입/종료 토글
     */
    function toggleSelectionMode() {
        if (isSelectionMode) {
            // 선택 모드 종료
            cancelSelection();
        } else {
            // 선택 모드 진입
            isSelectionMode = true;
            updateSelectionUI();
            render();
        }
    }

    /**
     * 선택 모드 종료
     */
    function cancelSelection() {
        selectedIds.clear();
        isSelectionMode = false;
        updateSelectionUI();
        render();
    }

    /**
     * 선택된 상품들 일괄 삭제
     */
    async function deleteSelected() {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        Modal.open({
            message: `선택한 ${ids.length}개의 상품`,
            subMessage: '선택한 상품을 모두 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.',
            onConfirm: async () => {
                let successCount = 0;
                for (const id of ids) {
                    try {
                        const res = await fetch(`http://localhost:19877/product/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            products = products.filter(p => p.id !== id);
                            successCount++;
                        }
                    } catch (e) {
                        console.error('[Codiset] 상품 삭제 실패:', e);
                    }
                }
                totalCount = Math.max(0, totalCount - successCount);
                selectedIds.clear();
                isSelectionMode = false;
                updateSelectionUI();
                render();
                console.log(`[Codiset] ${successCount}개 상품 삭제 완료`);
            }
        });
    }

    /**
     * 상품 삭제 (단일)
     */
    async function deleteProduct(id) {
        try {
            const res = await fetch(`http://localhost:19877/product/${id}`, { method: 'DELETE' });
            if (res.ok) {
                products = products.filter(p => p.id !== id);
                totalCount = Math.max(0, totalCount - 1);
                selectedIds.delete(id);
                updateSelectionUI();
                render();
            }
        } catch (e) {
            console.error('[Codiset] 상품 삭제 실패:', e);
        }
    }

    /**
     * 인라인 편집 시작 - div를 input으로 전환
     */
    function startInlineEdit(el, id, field) {
        const currentValue = el.textContent.trim();

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.value = currentValue;

        el.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
            const newValue = input.value.trim();

            if (newValue && newValue !== currentValue) {
                // 로컬 데이터 즉시 갱신
                const product = products.find(p => p.id === id);
                if (product) {
                    product[field] = newValue;
                }
                // 서버 저장은 백그라운드로
                saveInlineEdit(id, field, newValue);
            }

            // render()로 전체 복원 (수정 버튼 포함)
            render();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
            if (e.key === 'Escape') {
                input.value = currentValue;
                input.removeEventListener('blur', save);
                render();
            }
        });
    }

    /**
     * 인라인 편집 저장 - 서버에 PUT 요청
     */
    async function saveInlineEdit(id, field, value) {
        try {
            const res = await fetch(`http://localhost:19877/product/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });
            if (res.ok) {
                // 로컬 데이터 갱신
                const product = products.find(p => p.id === id);
                if (product) {
                    product[field] = value;
                }
                console.log(`[Codiset] 상품 ${id} ${field} 업데이트 완료`);
            }
        } catch (e) {
            console.error('[Codiset] 상품 업데이트 실패:', e);
        }
    }

    /**
     * 검색 - 서버에 재요청 (debounce 없이 검색 실행)
     */
    let searchTimer = null;
    function onSearch() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            loadProducts();
        }, 300);
    }

    /**
     * 시즌 필터 변경 - 서버에 재요청
     */
    function onSeasonFilter(season) {
        activeSeason = season;
        if (els.seasonFilterBtns) {
            els.seasonFilterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.season === season);
            });
        }
        loadProducts();
    }

    /**
     * 시즌 필터 이벤트 바인딩
     */
    function bindSeasonFilter() {
        els.seasonFilterBtns = document.querySelectorAll('.season-filter-btn');
        els.seasonFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                onSeasonFilter(btn.dataset.season);
            });
        });
    }

    /**
     * ACC 필터 변경 - 서버에 재요청
     */
    function onAccFilter(acc) {
        activeAcc = acc;
        if (els.accFilterBtns) {
            els.accFilterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.acc === acc);
            });
        }
        loadProducts();
    }

    /**
     * ACC 필터 이벤트 바인딩
     */
    function bindAccFilter() {
        els.accFilterBtns = document.querySelectorAll('.acc-filter-btn');
        els.accFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                onAccFilter(btn.dataset.acc);
            });
        });
    }

    /**
     * 선택 모드 이벤트 바인딩
     */
    function bindSelectionEvents() {
        els.checkAll = document.getElementById('check-all');
        els.selectionToolbar = document.getElementById('selection-toolbar');
        els.selectionCount = document.getElementById('selection-count');
        els.btnDeleteSelected = document.getElementById('btn-delete-selected');
        els.btnCancelSelection = document.getElementById('btn-cancel-selection');
        els.btnSelectMode = document.getElementById('btn-select-mode');

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

    /**
     * IntersectionObserver 설정 - 센티넬이 보이면 loadMore() 호출
     */
    function setupObserver() {
        if (observer) observer.disconnect();

        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadMore();
            }
        }, { root: els.grid, rootMargin: '200px', threshold: 0 });

        // render 후 센티넬 감시 시작
        const sentinel = els.grid.querySelector('#load-more-sentinel');
        if (sentinel) {
            observer.observe(sentinel);
        }
    }

    /**
     * 초기화
     */
    function init() {
        els = {
            grid: document.getElementById('product-grid'),
            count: document.getElementById('product-count'),
            searchInput: document.getElementById('product-search'),
            refreshBtn: document.getElementById('btn-refresh-products'),
            btnCard: document.getElementById('btn-view-card'),
            btnList: document.getElementById('btn-view-list')
        };

        if (els.searchInput) {
            els.searchInput.addEventListener('input', onSearch);
        }

        if (els.refreshBtn) {
            els.refreshBtn.addEventListener('click', loadProducts);
        }

        if (els.btnCard) {
            els.btnCard.addEventListener('click', () => switchView('card'));
        }

        if (els.btnList) {
            els.btnList.addEventListener('click', () => switchView('list'));
        }

        // 시즌 필터 이벤트
        bindSeasonFilter();

        // ACC 필터 이벤트
        bindAccFilter();

        // 선택 모드 이벤트
        bindSelectionEvents();

        loadProducts();
    }

    // 전역 노출
    window.ProductList = { init, loadProducts };
})();
