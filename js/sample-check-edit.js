// sample-check-edit.js - 샘플 체크/반납 편집 페이지 로직
// sample-check-edit.html이 로드된 후 SampleCheckEdit.init(sampleList) 호출 필요
// "샘플 추가" 버튼으로 상품을 선택하면 storeName별로 그룹 자동 생성

(function () {
    'use strict';

    let currentSampleList = null;
    let groups = [];               // [{ id, storeName, items: [product, ...], returned: false }]
    let products = [];
    let selectedProductIds = new Set();
    let currentStoreName = null;
    let activeProductSeason = '';
    let els = {};

    // ===== 헬퍼 =====

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatPrice(raw) {
        if (!raw) return '₩0';
        const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
        return isNaN(num) ? '₩0' : '₩' + num.toLocaleString();
    }

    function parseOptions(str) {
        if (!str) return [];
        return str.split(/[,/]/).map(s => s.trim()).filter(Boolean);
    }

    // ===== API =====

    async function loadProducts() {
        try {
            const res = await fetch('http://localhost:19877/products?limit=10000');
            if (res.ok) {
                const data = await res.json();
                products = Array.isArray(data) ? data : (data.rows || []);
            }
        } catch (e) { /* 서버 준비 안 됨 */ }
    }

    function saveState() {
        if (!currentSampleList) return;
        currentSampleList.groups = groups;
        // DB 저장
        fetch(`http://localhost:19877/sample-list/${currentSampleList.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentSampleList.name,
                date: currentSampleList.date,
                memo: currentSampleList.memo,
                groups: groups
            })
        }).catch(() => { });
        // 메모리 동기화
        if (window.SampleCheck && typeof window.SampleCheck.updateData === 'function') {
            window.SampleCheck.updateData(currentSampleList);
        }
    }

    // ===== 초기화 =====

    function initSampleList(sampleList) {
        currentSampleList = sampleList;
        if (els.title) els.title.textContent = sampleList.name || '샘플 리스트';
        if (els.meta) {
            const dateStr = sampleList.date
                ? new Date(sampleList.date + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : '';
            const memoText = sampleList.memo ? ' · ' + sampleList.memo : '';
            els.meta.textContent = '입고일: ' + dateStr + memoText;
        }
        groups = (sampleList.groups || []).map(g => ({ ...g, id: Number(g.id) || 0 }));
        // 기존 그룹 ID보다 큰 값으로 카운터 초기화
        const maxId = groups.reduce((max, g) => Math.max(max, Number(g.id) || 0), 0);
        groupIdCounter = maxId + 1;
    }

    // ===== 그룹 관리 =====

    let groupIdCounter = 1;

    function getOrCreateGroup(storeName) {
        let group = groups.find(g => g.storeName === storeName);
        if (!group) {
            group = { id: groupIdCounter++, storeName: storeName, items: [], returned: false };
            groups.push(group);
        }
        return group;
    }

    function sortGroups() {
        groups.sort((a, b) => (a.storeName || '').localeCompare(b.storeName || '', 'ko'));
    }

    function deleteGroup(groupId) {
        groups = groups.filter(g => String(g.id) !== String(groupId));
        saveState();
        render();
    }

    function toggleReturnStatus(groupId) {
        const group = groups.find(g => String(g.id) === String(groupId));
        if (group) {
            group.returned = !group.returned;
            saveState();
            render();
        }
    }

    // ===== 상품 선택 모달 =====

    function openProductModal(storeName) {
        currentStoreName = storeName || null;
        selectedProductIds.clear();

        const allAddedIds = new Set();
        groups.forEach(g => g.items.forEach(item => allAddedIds.add(item.id)));
        allAddedIds.forEach(id => selectedProductIds.add(id));

        activeProductSeason = '';
        if (els.productModal) els.productModal.style.display = '';
        if (els.productSearch) els.productSearch.value = '';
        if (els.productSeasonBtns) {
            els.productSeasonBtns.forEach(b => b.classList.toggle('active', b.dataset.season === ''));
        }
        renderProductList();
    }

    function closeProductModal() {
        if (els.productModal) els.productModal.style.display = 'none';
        currentStoreName = null;
        selectedProductIds.clear();
    }

    function toggleProductSelect(productId) {
        const allAddedIds = new Set();
        groups.forEach(g => g.items.forEach(item => allAddedIds.add(item.id)));
        if (allAddedIds.has(productId)) return;

        if (selectedProductIds.has(productId)) selectedProductIds.delete(productId);
        else selectedProductIds.add(productId);
        renderProductList();
    }

    function addSelectedProducts() {
        const allAddedIds = new Set();
        groups.forEach(g => g.items.forEach(item => allAddedIds.add(item.id)));

        const newIds = [...selectedProductIds].filter(id => !allAddedIds.has(id));
        if (newIds.length === 0) { closeProductModal(); return; }

        let addedCount = 0;
        newIds.forEach(pid => {
            const product = products.find(p => p.id === pid);
            if (!product) return;
            const storeName = product.storeName || '거래처 미정';
            const group = getOrCreateGroup(storeName);
            if (!group.items.find(i => i.id === product.id)) {
                const sizes = parseOptions(product.size);
                if (sizes.length <= 1) {
                    const colors = parseOptions(product.color);
                    product._selections = colors.map(c => ({ color: c, size: sizes[0] || '' }));
                }
                group.items.push(product);
                addedCount++;
            }
        });

        sortGroups();
        closeProductModal();
        if (addedCount > 0) { saveState(); render(); }
    }

    function removeItemFromGroup(groupId, productId) {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.items = group.items.filter(i => i.id !== productId);
            if (group.items.length === 0) groups = groups.filter(g => g.id !== groupId);
            saveState();
            render();
        }
    }

    function moveItemInGroup(groupId, fromIndex, toIndex) {
        const group = groups.find(g => g.id === groupId);
        if (!group || fromIndex === toIndex) return;
        const items = group.items;
        const temp = items[fromIndex];
        items[fromIndex] = items[toIndex];
        items[toIndex] = temp;
        saveState();
        render();
    }

    let dragData = { groupId: null, fromIndex: -1 };

    // ===== 시즌 필터 =====

    function onProductSeasonFilter(season) {
        activeProductSeason = season;
        if (els.productSeasonBtns) {
            els.productSeasonBtns.forEach(b => b.classList.toggle('active', b.dataset.season === season));
        }
        renderProductList();
    }

    // ===== 상품 선택 리스트 렌더링 =====

    function renderProductList() {
        if (!els.productList) return;

        const searchTerm = (els.productSearch?.value || '').toLowerCase();
        let filtered = products;

        if (currentStoreName) {
            filtered = filtered.filter(p => (p.storeName || '') === currentStoreName);
        }
        if (activeProductSeason) {
            filtered = filtered.filter(p => {
                if (!p.season) return false;
                return p.season.split(',').map(s => s.trim()).includes(activeProductSeason);
            });
        }
        if (searchTerm) {
            filtered = filtered.filter(p =>
                (p.productName || '').toLowerCase().includes(searchTerm) ||
                (p.storeName || '').toLowerCase().includes(searchTerm) ||
                (p.productCode || '').toLowerCase().includes(searchTerm)
            );
        }

        const allAddedIds = new Set();
        groups.forEach(g => g.items.forEach(item => allAddedIds.add(item.id)));

        const newSelectedCount = [...selectedProductIds].filter(id => !allAddedIds.has(id)).length;
        if (els.productSelectedCount) els.productSelectedCount.textContent = newSelectedCount + '개 선택';

        if (filtered.length === 0) {
            els.productList.innerHTML = '<div class="sample-check-product-empty">' +
                (searchTerm ? '검색 결과가 없습니다' : '등록된 상품이 없습니다') + '</div>';
            return;
        }

        els.productList.innerHTML = filtered.map(p => {
            const isAlreadyAdded = allAddedIds.has(p.id);
            const isSelected = selectedProductIds.has(p.id);
            const thumbHTML = p.image
                ? `<img class="sample-check-product-select-thumb" src="${escapeHTML(p.image)}" alt="" loading="lazy" onerror="this.classList.add('no-image');this.src=''">`
                : `<div class="sample-check-product-select-thumb no-image"></div>`;

            return `<div class="sample-check-product-select-item${isSelected ? ' selected' : ''}${isAlreadyAdded ? ' already-added' : ''}" data-product-id="${p.id}">
                ${thumbHTML}
                <div class="sample-check-product-select-info">
                    <div class="sample-check-product-select-name">${escapeHTML(p.productName || p.storeName || '이름 없음')}</div>
                    <div class="sample-check-product-select-meta">${escapeHTML(p.storeName || '')} · ${formatPrice(p.productPrice)}</div>
                </div>
                <div class="sample-check-product-select-check">${isAlreadyAdded ? '✓' : (isSelected ? '✓' : '')}</div>
            </div>`;
        }).join('');

        els.productList.querySelectorAll('.sample-check-product-select-item').forEach(el => {
            if (el.classList.contains('already-added')) return;
            el.addEventListener('click', () => toggleProductSelect(parseInt(el.dataset.productId)));
        });
    }

    // ===== 메인 렌더링 =====

    function render() {
        if (!els.setList) return;

        if (groups.length === 0) {
            els.setList.innerHTML = `<div class="sample-check-edit-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <p>등록된 샘플이 없습니다</p>
                <small>'+ 샘플 추가' 버튼을 눌러 체크할 상품을 추가해보세요</small>
            </div>`;
            return;
        }

        els.setList.innerHTML = groups.map(group => {
            let itemsHTML = '';

            if (group.items.length > 0) {
                itemsHTML = group.items.map((item, idx) => {
                    const imageHTML = item.image
                        ? `<img class="product-card-image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.productName || '')}" loading="lazy" onerror="this.classList.add('no-image');this.src=''">`
                        : `<div class="product-card-image no-image"></div>`;

                    const dateStr = item.registeredAt
                        ? new Date(item.registeredAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                        : '';

                    const colorTags = item.color
                        ? item.color.split(/[,/]/).map(c => `<span class="color-tag">${escapeHTML(c.trim())}</span>`).join('')
                        : '';

                    const sizeTags = item.size
                        ? item.size.split(/[,/]/).map(s => `<span class="color-tag">${escapeHTML(s.trim())}</span>`).join('')
                        : '';

                    const seasonBadges = item.season
                        ? item.season.split(',').map(s => `<span class="season-badge season-${s.trim()}">${escapeHTML(s.trim())}</span>`).join('')
                        : '';

                    const accBadges = item.acc
                        ? item.acc.split(',').map(a => `<span class="acc-badge acc-${a.trim()}">${escapeHTML(a.trim())}</span>`).join('')
                        : '';

                    const itemReturnedClass = item._returned ? ' item-returned' : '';

                    return `<div class="product-card sample-check-item-card${itemReturnedClass}" draggable="true" data-item-key="${group.id}_${item.id}" data-group-id="${group.id}" data-index="${idx}">
                        ${item._returned ? `<div class="sample-check-item-returned-overlay">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>반납 완료</span>
                        </div>` : ''}
                        <button class="btn-delete-product" data-group="${group.id}" data-item="${item.id}" title="제거">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                        ${imageHTML}
                        <div class="product-card-body">
                            <div class="product-card-name">${escapeHTML(item.productName || item.storeName || '이름 없음')}</div>
                            <div class="product-card-supplier">${escapeHTML(item.storeName || '')}${item.storeAddress ? ' · ' + escapeHTML(item.storeAddress) : ''}</div>
                            <div class="product-card-meta">
                                <span>코드: ${escapeHTML(item.productCode || '-')}</span>
                                ${seasonBadges}
                            </div>
                            ${accBadges ? `<div class="product-card-colors">${accBadges}</div>` : ''}
                            <div class="product-card-price">${formatPrice(item.productPrice)}</div>
                            ${colorTags ? `<div class="product-card-colors">${colorTags}</div>` : ''}
                            ${sizeTags ? `<div class="product-card-colors">${sizeTags}</div>` : ''}
                            <div class="product-card-footer">
                                <span class="product-card-date">${dateStr}</span>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }

            const returnedClass = group.returned ? ' returned' : '';

            return `<div class="sample-check-set-block${returnedClass}">
                ${group.returned ? `<div class="sample-check-returned-overlay" data-toggle-return="${group.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>반납 완료</span>
                </div>` : ''}
                <div class="sample-check-set-block-header">
                    <span class="sample-check-set-block-label-text">${escapeHTML(group.storeName || '거래처 미정')}</span>
                    <span class="sample-check-set-block-label-count">(${group.items.length}개)</span>
                    <div class="sample-check-header-spacer"></div>
                    <button class="btn-toggle-return" data-toggle-return="${group.id}">${group.returned ? '반납 취소' : '반납 완료'}</button>
                    <button class="btn-delete-set" data-delete-set="${group.id}" title="그룹 삭제">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
                <div class="sample-check-set-items">
                    ${itemsHTML}
                    ${!group.returned ? `<button class="btn-add-sample" data-add-sample="${group.id}" data-store-name="${escapeHTML(group.storeName || '')}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        샘플추가
                    </button>` : ''}
                </div>
            </div>`;
        }).join('');

        // 그룹 삭제
        els.setList.querySelectorAll('.btn-delete-set').forEach(btn => {
            btn.addEventListener('click', () => deleteGroup(parseInt(btn.dataset.deleteSet)));
        });

        // 반납완료 토글
        els.setList.querySelectorAll('.btn-toggle-return').forEach(btn => {
            btn.addEventListener('click', () => toggleReturnStatus(parseInt(btn.dataset.toggleReturn)));
        });

        // 반납완료 오버레이 클릭
        els.setList.querySelectorAll('.sample-check-returned-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => toggleReturnStatus(parseInt(overlay.dataset.toggleReturn)));
        });

        // 샘플추가
        els.setList.querySelectorAll('.btn-add-sample').forEach(btn => {
            btn.addEventListener('click', () => openProductModal(btn.dataset.storeName));
        });

        // 아이템 제거
        els.setList.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeItemFromGroup(parseInt(btn.dataset.group), parseInt(btn.dataset.item));
            });
        });

        // 드래그 앤 드롭
        els.setList.querySelectorAll('.sample-check-item-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                dragData.groupId = parseInt(card.dataset.groupId);
                dragData.fromIndex = parseInt(card.dataset.index);
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                els.setList.querySelectorAll('.sample-check-item-card').forEach(c => c.classList.remove('drag-over'));
                dragData.groupId = null; dragData.fromIndex = -1;
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                if (!card.classList.contains('dragging')) card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', (e) => {
                e.preventDefault(); card.classList.remove('drag-over');
                const toIndex = parseInt(card.dataset.index);
                if (dragData.groupId === parseInt(card.dataset.groupId) && dragData.fromIndex !== toIndex) {
                    moveItemInGroup(dragData.groupId, dragData.fromIndex, toIndex);
                }
            });
        });

        // 카드 클릭 → 해당 아이템 반납/미반납 토글
        els.setList.querySelectorAll('.sample-check-item-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                e.stopPropagation();
                const groupId = parseInt(card.dataset.groupId);
                const itemId = parseInt(card.dataset.itemKey.split('_')[1]);
                toggleItemReturnStatus(groupId, itemId);
            });
        });
    }

    function getItem(groupId, itemId) {
        const group = groups.find(g => g.id === groupId);
        if (!group) return null;
        return group.items.find(i => i.id === itemId) || null;
    }

    function toggleItemReturnStatus(groupId, itemId) {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        // 이미 그룹 전체가 반납 상태면 개별 토글 불가
        if (group.returned) return;
        const item = group.items.find(i => i.id === itemId);
        if (!item) return;
        item._returned = !item._returned;
        saveState();
        render();
    }

    // ===== 이벤트 바인딩 =====

    function bindEvents() {
        if (els.btnAddGroup) els.btnAddGroup.addEventListener('click', () => openProductModal(null));

        if (els.btnBack) {
            els.btnBack.addEventListener('click', () => {
                saveState();
                if (window.SampleCheckEdit && typeof window.SampleCheckEdit.goBack === 'function') {
                    window.SampleCheckEdit.goBack();
                }
            });
        }

        if (els.btnProductModalClose) els.btnProductModalClose.addEventListener('click', closeProductModal);
        if (els.productModalBackdrop) els.productModalBackdrop.addEventListener('click', closeProductModal);
        if (els.btnProductModalAdd) els.btnProductModalAdd.addEventListener('click', addSelectedProducts);
        if (els.productSearch) els.productSearch.addEventListener('input', renderProductList);

        els.productSeasonBtns = document.querySelectorAll('#sample-check-product-season-filter .season-filter-btn');
        els.productSeasonBtns.forEach(btn => btn.addEventListener('click', () => onProductSeasonFilter(btn.dataset.season)));

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.productModal && els.productModal.style.display !== 'none') closeProductModal();
        });
    }

    // ===== 초기화 =====

    function init(sampleList) {
        els = {
            setList: document.getElementById('sample-check-set-list'),
            title: document.getElementById('sample-check-edit-title'),
            meta: document.getElementById('sample-check-edit-meta'),
            btnAddGroup: document.getElementById('btn-add-sample-group'),
            btnBack: document.getElementById('btn-sample-check-edit-back'),
            productModal: document.getElementById('sample-check-product-modal'),
            productModalBackdrop: document.querySelector('#sample-check-product-modal .sample-check-product-modal-backdrop'),
            productList: document.getElementById('sample-check-product-list'),
            productSearch: document.getElementById('sample-check-product-search'),
            productSelectedCount: document.getElementById('sample-check-product-selected-count'),
            btnProductModalClose: document.getElementById('btn-sample-check-product-modal-close'),
            btnProductModalAdd: document.getElementById('btn-sample-check-product-modal-add')
        };

        initSampleList(sampleList);
        bindEvents();
        loadProducts().then(() => render());
    }

    window.SampleCheckEdit = { init };
})();
