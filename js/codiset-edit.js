// codiset-edit.js - 코디세트 편집 페이지 로직
// codiset-edit.html이 로드된 후 CodisetEdit.init(codisetId) 호출 필요

(function () {
    'use strict';

    let currentCodiset = null;     // 현재 편집 중인 코디세트
    let sets = [];                 // [{ id, label, items: [product, ...] }]
    let products = [];             // 서버에서 불러온 전체 상품
    let selectedProductIds = new Set(); // 모달에서 선택된 상품 ID
    let currentSetId = null;       // 현재 상품 추가 중인 세트 ID
    let activeProductSeason = '';  // 상품 모달 시즌 필터
    let optionModal = {            // 옵션 선택 모달 상태
        setId: null,
        itemId: null,
        colors: [],
        sizes: [],
        selColor: '',              // 현재 선택된 색상 (단일)
        selSizes: []               // 현재 선택된 사이즈들 (다중)
    };
    let katalkComment = '';      // 카톡 양식 사용자 코멘트
    let katalkActiveStore = '';  // 현재 선택된 거래처
    let katalkSetId = null;      // 특정 세트 필터 (null=전체세트)
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

    function getUnitPrice(item) {
        const raw = item.productPrice;
        if (!raw) return 0;
        const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
        return isNaN(num) ? 0 : num;
    }

    function calcItemTotal(item) {
        const unit = getUnitPrice(item);
        const selections = item._selections || [];
        return unit * selections.length;
    }

    // ===== 서버에서 상품 로드 =====

    async function loadProducts() {
        try {
            const res = await fetch('http://localhost:19877/products?limit=10000');
            if (res.ok) {
                const data = await res.json();
                products = Array.isArray(data) ? data : (data.rows || []);
            }
        } catch (e) {
            // 서버 준비 안 됨
        }
    }

    // ===== DB 저장 =====

    async function saveToDB() {
        if (!currentCodiset || !currentCodiset.id) return;
        try {
            await fetch(`http://localhost:19877/codiset/${currentCodiset.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: currentCodiset.name,
                    season: currentCodiset.season,
                    memo: currentCodiset.memo,
                    sets: sets
                })
            });
        } catch (e) {
            // 저장 실패
        }
    }

    // ===== 코디세트 정보 설정 =====

    function initCodiset(codiset) {
        currentCodiset = codiset;
        if (els.title) {
            els.title.textContent = codiset.name || '코디세트';
        }
        if (els.meta) {
            const seasonText = codiset.season ? ' · ' + codiset.season : '';
            els.meta.textContent = (codiset.memo || '') + seasonText;
        }
        // 기존 세트/아이템 복원 (있으면)
        sets = codiset.sets || [];
    }

    // ===== 세트 추가 =====

    function addSet() {
        const set = {
            id: Date.now(),
            label: '세트 ' + (sets.length + 1),
            items: []
        };
        sets.push(set);
        saveToDB();
        render();
    }

    // ===== 세트 삭제 =====

    function deleteSet(setId) {
        const set = sets.find(s => s.id === setId);
        const label = set ? set.label : '이 세트';
        if (window.Modal) {
            window.Modal.open({
                message: `"${label}" 세트를 삭제하시겠습니까?`,
                subMessage: '세트 내 상품이 모두 제거됩니다.',
                onConfirm: () => {
                    sets = sets.filter(s => s.id !== setId);
                    saveToDB();
                    render();
                }
            });
        } else {
            // fallback
            if (!confirm(`"${label}"을(를) 정말 삭제하시겠습니까?`)) return;
            sets = sets.filter(s => s.id !== setId);
            saveToDB();
            render();
        }
    }

    // ===== 상품 선택 모달 =====

    function openProductModal(setId) {
        currentSetId = setId;
        selectedProductIds.clear();
        // 현재 세트에 이미 추가된 상품 ID들을 미리 선택된 상태로 표시
        const set = sets.find(s => s.id === setId);
        if (set) {
            set.items.forEach(item => selectedProductIds.add(item.id));
        }
        activeProductSeason = '';
        if (els.productModal) els.productModal.style.display = '';
        if (els.productSearch) els.productSearch.value = '';
        // 시즌 필터 버튼 초기화
        if (els.productSeasonBtns) {
            els.productSeasonBtns.forEach(b => b.classList.toggle('active', b.dataset.season === ''));
        }
        renderProductList();
    }

    function closeProductModal() {
        if (els.productModal) els.productModal.style.display = 'none';
        currentSetId = null;
        selectedProductIds.clear();
    }

    function toggleProductSelect(productId) {
        // 현재 세트에 이미 추가된 상품은 토글 불가
        const set = sets.find(s => s.id === currentSetId);
        const alreadyInSet = set ? set.items.some(item => item.id === productId) : false;
        if (alreadyInSet) return;

        if (selectedProductIds.has(productId)) {
            selectedProductIds.delete(productId);
        } else {
            selectedProductIds.add(productId);
        }
        renderProductList();
    }

    function addSelectedProducts() {
        if (!currentSetId || selectedProductIds.size === 0) {
            closeProductModal();
            return;
        }
        const set = sets.find(s => s.id === currentSetId);
        if (!set) {
            closeProductModal();
            return;
        }
        let addedCount = 0;
        selectedProductIds.forEach(pid => {
            const product = products.find(p => p.id === pid);
            if (product && !set.items.find(i => i.id === product.id)) {
                // 사이즈가 1개 이하 → 모든 색상 자동 선택
                const sizes = parseOptions(product.size);
                if (sizes.length <= 1) {
                    const colors = parseOptions(product.color);
                    product._selections = colors.map(c => ({ color: c, size: sizes[0] || '' }));
                }
                set.items.push(product);
                addedCount++;
            }
        });
        closeProductModal();
        if (addedCount > 0) {
            saveToDB();
            render();
        }
    }

    // ===== 세트에서 상품 제거 =====

    // ===== 세트 이름 수정 =====

    function updateSetLabel(setId, newLabel) {
        const set = sets.find(s => s.id === setId);
        if (set && newLabel.trim()) {
            set.label = newLabel.trim();
            saveToDB();
            render();
        }
    }

    // ===== 상품 제거 =====

    function removeItemFromSet(setId, productId) {
        const set = sets.find(s => s.id === setId);
        if (set) {
            set.items = set.items.filter(i => i.id !== productId);
            saveToDB();
            render();
        }
    }

    // ===== 드래그 앤 드롭으로 상품 순서 변경 =====

    function moveItemInSet(setId, fromIndex, toIndex) {
        const set = sets.find(s => s.id === setId);
        if (!set || fromIndex === toIndex) return;
        const items = set.items;
        // 두 아이템 위치를 서로 교환 (swap)
        const temp = items[fromIndex];
        items[fromIndex] = items[toIndex];
        items[toIndex] = temp;
        saveToDB();
        render();
    }

    let dragData = { setId: null, fromIndex: -1 };

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

        // 시즌 필터
        if (activeProductSeason) {
            filtered = filtered.filter(p => {
                if (!p.season) return false;
                const seasons = p.season.split(',').map(s => s.trim());
                return seasons.includes(activeProductSeason);
            });
        }

        if (searchTerm) {
            filtered = filtered.filter(p =>
                (p.productName || '').toLowerCase().includes(searchTerm) ||
                (p.storeName || '').toLowerCase().includes(searchTerm) ||
                (p.productCode || '').toLowerCase().includes(searchTerm)
            );
        }

        if (els.productSelectedCount) {
            els.productSelectedCount.textContent = selectedProductIds.size + '개 선택';
        }

        if (filtered.length === 0) {
            els.productList.innerHTML = '<div class="codiset-product-empty">' +
                (searchTerm ? '검색 결과가 없습니다' : '등록된 상품이 없습니다') +
                '</div>';
            return;
        }

        // 현재 세트에 이미 추가된 상품 ID 집합
        const alreadyInSetIds = new Set();
        if (currentSetId) {
            const currentSet = sets.find(s => s.id === currentSetId);
            if (currentSet) {
                currentSet.items.forEach(item => alreadyInSetIds.add(item.id));
            }
        }

        els.productList.innerHTML = filtered.map(p => {
            const isAlreadyInSet = alreadyInSetIds.has(p.id);
            const isSelected = selectedProductIds.has(p.id);
            const thumbHTML = p.image
                ? `<img class="codiset-product-select-thumb" src="${escapeHTML(p.image)}" alt="" loading="lazy" onerror="this.classList.add('no-image');this.src=''">`
                : `<div class="codiset-product-select-thumb no-image"></div>`;

            return `<div class="codiset-product-select-item${isSelected ? ' selected' : ''}${isAlreadyInSet ? ' already-added' : ''}" data-product-id="${p.id}">
                ${thumbHTML}
                <div class="codiset-product-select-info">
                    <div class="codiset-product-select-name">${escapeHTML(p.productName || p.storeName || '이름 없음')}</div>
                    <div class="codiset-product-select-meta">${escapeHTML(p.storeName || '')} · ${formatPrice(p.productPrice)}</div>
                </div>
                <div class="codiset-product-select-check">${isAlreadyInSet ? '✓' : (isSelected ? '✓' : '')}</div>
            </div>`;
        }).join('');

        // 클릭 이벤트 (이미 추가된 상품은 클릭 불가)
        els.productList.querySelectorAll('.codiset-product-select-item').forEach(el => {
            if (el.classList.contains('already-added')) return;
            el.addEventListener('click', () => {
                toggleProductSelect(parseInt(el.dataset.productId));
            });
        });
    }

    // ===== 렌더링 =====

    function render() {
        if (!els.setList) return;

        if (sets.length === 0) {
            els.setList.innerHTML = `
            <div class="codiset-edit-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
                </svg>
                <p>세트가 없습니다</p>
                <small>'+ 세트 추가' 버튼을 눌러 코디 영역을 만들어보세요</small>
            </div>`;
            return;
        }

        els.setList.innerHTML = sets.map(set => {
            let itemsHTML = '';

            if (set.items.length > 0) {
                itemsHTML = set.items.map((item, idx) => {
                    const total = calcItemTotal(item);
                    const selections = item._selections || [];
                    const selectionSummary = selections.length > 0
                        ? selections.map(s => escapeHTML(s.color + (s.size ? '/' + s.size : ''))).join('<br>')
                        : '';
                    const totalDisplay = total > 0 ? `<div class="codiset-set-item-total">${formatPrice(total)}</div>` : '';

                    const imgHTML = item.image
                        ? `<div class="codiset-set-item-img-wrap">
                            <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.productName || '')}" loading="lazy" onerror="this.parentElement.classList.add('no-image');this.remove()">
                        </div>`
                        : `<div class="codiset-set-item-img-wrap no-image"></div>`;

                    return `<div class="codiset-set-item" draggable="true" data-item-key="${set.id}_${item.id}" data-set-id="${set.id}" data-index="${idx}">
                        ${imgHTML}
                        <div class="codiset-set-item-info">
                            <div class="codiset-set-item-name">${escapeHTML(item.productName || '이름 없음')}</div>
                            <div class="codiset-set-item-meta">${escapeHTML(item.storeName || '')}</div>
                            <div class="codiset-set-item-price">${formatPrice(item.productPrice)}</div>
                            ${selectionSummary ? `<div class="codiset-set-item-options">${selectionSummary}</div>` : ''}
                            ${totalDisplay}
                        </div>
                        <button class="btn-remove-item" data-set="${set.id}" data-item="${item.id}" title="제거">×</button>
                    </div>`;
                }).join('');
            }

            return `<div class="codiset-set-block">
                <div class="codiset-set-block-header">
                    <button class="btn-edit-label" data-edit-label="${set.id}" title="이름 수정">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            <path d="m15 5 4 4"/>
                        </svg>
                    </button>
                    <span class="codiset-set-block-label-text" data-label-text="${set.id}">${escapeHTML(set.label)}</span>
                    <span class="codiset-set-block-label-count">(${set.items.length}개)</span>
                    <button class="btn-set-katalk" data-set-katalk="${set.id}" title="세트 카톡 양식 생성">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0;">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        ${escapeHTML(set.label)} 카톡 양식
                    </button>
                    <button class="btn-delete-set" data-delete-set="${set.id}" title="세트 삭제">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
                <div class="codiset-set-items">
                    ${itemsHTML}
                    <button class="btn-add-sample" data-add-sample="${set.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        샘플추가
                    </button>
                </div>
            </div>`;
        }).join('');

        // 세트 삭제 이벤트
        els.setList.querySelectorAll('.btn-delete-set').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteSet(parseInt(btn.dataset.deleteSet));
            });
        });

        // 연필 버튼 → 인라인 편집 모드
        els.setList.querySelectorAll('.btn-edit-label').forEach(btn => {
            btn.addEventListener('click', () => {
                const setId = parseInt(btn.dataset.editLabel);
                const labelText = els.setList.querySelector(`[data-label-text="${setId}"]`);
                if (!labelText) return;
                const currentLabel = labelText.textContent;
                const input = document.createElement('input');
                input.className = 'codiset-set-block-label-input';
                input.value = currentLabel;
                input.style.width = '120px';
                labelText.replaceWith(input);
                input.focus();
                input.select();

                const save = () => {
                    updateSetLabel(setId, input.value);
                    const newSpan = document.createElement('span');
                    newSpan.className = 'codiset-set-block-label-text';
                    newSpan.setAttribute('data-label-text', setId);
                    newSpan.textContent = input.value || currentLabel;
                    input.replaceWith(newSpan);
                };

                input.addEventListener('blur', save);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                    if (e.key === 'Escape') {
                        input.value = currentLabel;
                        input.blur();
                    }
                });
            });
        });

        els.setList.querySelectorAll('.btn-add-sample').forEach(btn => {
            btn.addEventListener('click', () => {
                openProductModal(parseInt(btn.dataset.addSample));
            });
        });

        // 세트별 카톡 양식 버튼
        els.setList.querySelectorAll('.btn-set-katalk').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                katalkSetId = parseInt(btn.dataset.setKatalk);
                openKatalkModal();
            });
        });

        // 아이템 제거 이벤트
        els.setList.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeItemFromSet(parseInt(btn.dataset.set), parseInt(btn.dataset.item));
            });
        });

        // 드래그 앤 드롭 이벤트
        els.setList.querySelectorAll('.codiset-set-item').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                dragData.setId = parseInt(card.dataset.setId);
                dragData.fromIndex = parseInt(card.dataset.index);
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                els.setList.querySelectorAll('.codiset-set-item').forEach(c => c.classList.remove('drag-over'));
                dragData.setId = null;
                dragData.fromIndex = -1;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!card.classList.contains('dragging')) {
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                const toIndex = parseInt(card.dataset.index);
                if (dragData.setId === parseInt(card.dataset.setId) && dragData.fromIndex !== toIndex) {
                    moveItemInSet(dragData.setId, dragData.fromIndex, toIndex);
                }
            });
        });

        // 카드 클릭 → 옵션 팝오버 열기
        els.setList.querySelectorAll('.codiset-set-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                e.stopPropagation();
                const key = card.dataset.itemKey;
                const [setIdStr, itemIdStr] = key.split('_');
                openOptionPopover(parseInt(setIdStr), parseInt(itemIdStr), card);
            });
        });
    }

    // ===== 옵션 선택 팝오버 =====

    function getItem(setId, itemId) {
        const set = sets.find(s => s.id === setId);
        if (!set) return null;
        return set.items.find(i => i.id === itemId) || null;
    }

    function openOptionPopover(setId, itemId, cardEl) {
        const item = getItem(setId, itemId);
        if (!item) return;
        closeOptionPopover();

        optionModal.setId = setId;
        optionModal.itemId = itemId;
        optionModal.colors = parseOptions(item.color);
        optionModal.sizes = parseOptions(item.size);
        optionModal.selColor = (optionModal.colors.length > 0) ? optionModal.colors[0] : '';
        optionModal.selSizes = [];

        if (!els.optionPopover || !cardEl) return;
        els.optionPopover.style.display = '';

        // 카드 오른쪽 그리드 셀 위치 (viewport 기준)
        const cardRect = cardEl.getBoundingClientRect();
        els.optionPopover.style.top = cardRect.top + 'px';
        els.optionPopover.style.left = (cardRect.right + 10) + 'px';
        els.optionPopover.style.width = cardRect.width + 'px';

        renderOptionPopover();
    }

    function closeOptionPopover() {
        if (!els.optionPopover) return;
        els.optionPopover.style.display = 'none';
        optionModal.setId = null;
        optionModal.itemId = null;
    }

    function renderOptionPopover() {
        const { colors, sizes, selColor, selSizes } = optionModal;
        const item = getItem(optionModal.setId, optionModal.itemId);
        if (!item) return;

        if (els.optionPopoverTitle) {
            els.optionPopoverTitle.textContent = item.productName || '옵션 선택';
        }

        // 색상 칩
        if (els.optionColors) {
            els.optionColors.innerHTML = colors.map(c => {
                const active = c === selColor ? ' active' : '';
                return `<button class="cm-chip cm-color-chip${active}" data-color="${escapeHTML(c)}">${escapeHTML(c)}</button>`;
            }).join('');

            els.optionColors.querySelectorAll('.cm-color-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    optionModal.selColor = chip.dataset.color;
                    optionModal.selSizes = [];
                    renderOptionPopover();
                });
            });
        }

        const hasMultiSize = sizes.length > 1;
        if (els.optionSizeSection) {
            els.optionSizeSection.style.display = hasMultiSize ? '' : 'none';
        }
        if (hasMultiSize && els.optionSizes) {
            els.optionSizes.innerHTML = sizes.map(s => {
                const active = selSizes.includes(s) ? ' active' : '';
                return `<button class="cm-chip cm-size-chip${active}" data-size="${escapeHTML(s)}">${escapeHTML(s)}</button>`;
            }).join('');

            els.optionSizes.querySelectorAll('.cm-size-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const size = chip.dataset.size;
                    const idx = optionModal.selSizes.indexOf(size);
                    if (idx >= 0) {
                        optionModal.selSizes.splice(idx, 1);
                    } else {
                        optionModal.selSizes.push(size);
                    }
                    renderOptionPopover();
                });
            });
        }

        // 선택 리스트
        const selections = item._selections || [];
        if (els.optionSelectedList) {
            if (selections.length === 0) {
                els.optionSelectedList.innerHTML = '<div class="codiset-option-selected-empty">선택된 옵션이 없습니다</div>';
            } else {
                els.optionSelectedList.innerHTML = selections.map((s, i) =>
                    `<div class="codiset-option-selected-item">
                        <span>${escapeHTML(s.color)}${s.size ? ' / ' + escapeHTML(s.size) : ''}</span>
                        <button class="codiset-option-remove-btn" data-index="${i}" title="제거">×</button>
                    </div>`
                ).join('');

                els.optionSelectedList.querySelectorAll('.codiset-option-remove-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        removeOptionSelection(parseInt(btn.dataset.index));
                    });
                });
            }
        }

        if (els.optionTotal) {
            const total = calcItemTotal(item);
            els.optionTotal.textContent = total > 0 ? '총 ' + formatPrice(total) : '';
        }
    }

    function addOptionSelection() {
        const { selColor, selSizes } = optionModal;
        if (!selColor) return;
        const item = getItem(optionModal.setId, optionModal.itemId);
        if (!item) return;
        if (!item._selections) item._selections = [];

        if (optionModal.sizes.length <= 1) {
            const exist = item._selections.find(s => s.color === selColor);
            if (!exist) {
                item._selections.push({ color: selColor, size: optionModal.sizes[0] || '' });
            }
        } else {
            if (selSizes.length === 0) return;
            selSizes.forEach(size => {
                const exist = item._selections.find(s => s.color === selColor && s.size === size);
                if (!exist) {
                    item._selections.push({ color: selColor, size: size });
                }
            });
        }
        optionModal.selColor = optionModal.colors.length > 0 ? optionModal.colors[0] : '';
        optionModal.selSizes = [];
        saveToDB();
        renderOptionPopover();
        render();
    }

    function removeOptionSelection(index) {
        const item = getItem(optionModal.setId, optionModal.itemId);
        if (!item || !item._selections) return;
        item._selections.splice(index, 1);
        saveToDB();
        renderOptionPopover();
        render();
    }

    // ===== 카톡 양식 모달 =====

    function openKatalkModal() {
        if (!currentCodiset || !currentCodiset.id) return;
        // DB에서 저장된 코멘트 불러오기
        fetch('http://localhost:19877/katalk-comment')
            .then(res => res.json())
            .then(data => { katalkComment = data.comment || ''; })
            .catch(() => { katalkComment = ''; })
            .finally(() => {
                katalkActiveStore = '';
                // 모달 타이틀 설정
                if (els.katalkModalTitle) {
                    if (katalkSetId) {
                        const set = sets.find(s => s.id === katalkSetId);
                        els.katalkModalTitle.textContent = (set ? set.label : '세트') + ' 카톡 양식';
                    } else {
                        els.katalkModalTitle.textContent = '카톡 양식';
                    }
                }
                if (els.katalkModal) els.katalkModal.style.display = '';
                if (els.katalkCommentInput) els.katalkCommentInput.value = katalkComment;
                if (els.katalkTextarea) els.katalkTextarea.value = '';
                renderKatalkStoreButtons();
            });
    }

    function closeKatalkModal() {
        if (els.katalkModal) els.katalkModal.style.display = 'none';
        katalkActiveStore = '';
        katalkSetId = null;
    }

    function saveKatalkComment() {
        const comment = els.katalkCommentInput ? els.katalkCommentInput.value : '';
        katalkComment = comment;
        fetch('http://localhost:19877/katalk-comment', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
        }).catch(() => { });
    }

    function renderKatalkStoreButtons() {
        if (!els.katalkStoreBtns) return;
        // 특정 세트 또는 전체 세트에서 storeName 수집
        const targetSets = katalkSetId ? sets.filter(s => s.id === katalkSetId) : sets;
        const storeSet = new Set();
        targetSets.forEach(s => {
            (s.items || []).forEach(item => {
                if (item.storeName && item.storeName.trim()) {
                    storeSet.add(item.storeName.trim());
                }
            });
        });
        const stores = Array.from(storeSet).sort();

        if (stores.length === 0) {
            els.katalkStoreBtns.innerHTML = '<span style="font-size:12px;color:var(--text-tertiary)">추가된 거래처가 없습니다</span>';
            return;
        }

        els.katalkStoreBtns.innerHTML = stores.map(store =>
            `<button class="katalk-store-btn${store === katalkActiveStore ? ' active' : ''}" data-store="${escapeHTML(store)}">${escapeHTML(store)}</button>`
        ).join('');

        els.katalkStoreBtns.querySelectorAll('.katalk-store-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                katalkActiveStore = btn.dataset.store;
                renderKatalkStoreButtons();
                updateKatalkText();
            });
        });
    }

    function updateKatalkText() {
        if (!els.katalkCommentInput || !els.katalkTextarea) return;

        // 코멘트 저장
        saveKatalkComment();

        const comment = els.katalkCommentInput.value;
        const lines = [];

        // 사용자 코멘트 (앞뒤 빈 줄 보존, 내용이 있을 때만 출력)
        if (comment.trim()) lines.push(comment);

        // 해당 거래처 상품 목록 (상품명만 줄바꿈, 세트 필터)
        if (katalkActiveStore) {
            const targetSets = katalkSetId ? sets.filter(s => s.id === katalkSetId) : sets;
            const items = [];
            targetSets.forEach(s => {
                (s.items || []).forEach(item => {
                    if (item.storeName && item.storeName.trim() === katalkActiveStore) {
                        items.push(item);
                    }
                });
            });

            items.forEach(item => {
                lines.push(item.productName || '이름 없음');
            });
        }

        els.katalkTextarea.value = lines.join('\n');

        // 선택된 거래처 표시
        if (els.katalkSelectedStore) {
            els.katalkSelectedStore.textContent = katalkActiveStore || '';
        }
    }

    // ===== 이벤트 바인딩 =====

    function bindEvents() {
        if (els.btnAddSet) {
            els.btnAddSet.addEventListener('click', addSet);
        }

        if (els.btnBack) {
            els.btnBack.addEventListener('click', async () => {
                await saveToDB();
                if (window.CodisetEdit && typeof window.CodisetEdit.goBack === 'function') {
                    window.CodisetEdit.goBack();
                }
            });
        }

        // 상품 모달 닫기
        if (els.btnProductModalClose) {
            els.btnProductModalClose.addEventListener('click', closeProductModal);
        }
        if (els.productModalBackdrop) {
            els.productModalBackdrop.addEventListener('click', closeProductModal);
        }

        // 상품 추가 버튼
        if (els.btnProductModalAdd) {
            els.btnProductModalAdd.addEventListener('click', addSelectedProducts);
        }

        // 상품 검색
        if (els.productSearch) {
            els.productSearch.addEventListener('input', renderProductList);
        }

        // 상품 모달 시즌 필터
        els.productSeasonBtns = document.querySelectorAll('#codiset-product-season-filter .season-filter-btn');
        els.productSeasonBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                onProductSeasonFilter(btn.dataset.season);
            });
        });

        // ESC
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.katalkModal && els.katalkModal.style.display !== 'none') {
                closeKatalkModal();
                return;
            }
            if (e.key === 'Escape' && els.productModal && els.productModal.style.display !== 'none') {
                closeProductModal();
            }
            if (e.key === 'Escape' && els.optionPopover && els.optionPopover.style.display !== 'none') {
                closeOptionPopover();
            }
        });

        // 옵션 팝오버
        if (els.btnOptionPopoverClose) {
            els.btnOptionPopoverClose.addEventListener('click', closeOptionPopover);
        }
        if (els.btnOptionAdd) {
            els.btnOptionAdd.addEventListener('click', addOptionSelection);
        }
        // 팝오버 내부 클릭이 바깥으로 전파되지 않도록 차단
        if (els.optionPopover) {
            els.optionPopover.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }
        // 외부 클릭 시 팝오버 닫기
        document.addEventListener('click', function (e) {
            if (els.optionPopover && els.optionPopover.style.display !== 'none') {
                closeOptionPopover();
            }
        });

        // 카톡 양식 모달
        if (els.btnKatalkFormat) {
            els.btnKatalkFormat.addEventListener('click', openKatalkModal);
        }
        if (els.btnKatalkModalClose) {
            els.btnKatalkModalClose.addEventListener('click', closeKatalkModal);
        }
        if (els.katalkModalBackdrop) {
            els.katalkModalBackdrop.addEventListener('click', closeKatalkModal);
        }
        if (els.katalkCommentInput) {
            els.katalkCommentInput.addEventListener('input', () => {
                saveKatalkComment();
                updateKatalkText();
            });
        }
        if (els.btnKatalkCopy) {
            els.btnKatalkCopy.addEventListener('click', () => {
                const text = els.katalkTextarea ? els.katalkTextarea.value : '';
                if (text && navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(() => {
                        const btn = els.btnKatalkCopy;
                        const orig = btn.textContent;
                        btn.textContent = '복사됨!';
                        setTimeout(() => { btn.textContent = orig; }, 1500);
                    }).catch(() => { });
                }
            });
        }
    }

    // ===== 초기화 =====

    function init(codiset) {
        els = {
            setList: document.getElementById('codiset-set-list'),
            title: document.getElementById('codiset-edit-title'),
            meta: document.getElementById('codiset-edit-meta'),
            btnAddSet: document.getElementById('btn-add-set'),
            btnBack: document.getElementById('btn-codiset-edit-back'),
            // 상품 모달
            productModal: document.getElementById('codiset-product-modal'),
            productModalBackdrop: document.querySelector('#codiset-product-modal .codiset-product-modal-backdrop'),
            productList: document.getElementById('codiset-product-list'),
            productSearch: document.getElementById('codiset-product-search'),
            productSelectedCount: document.getElementById('codiset-product-selected-count'),
            btnProductModalClose: document.getElementById('btn-product-modal-close'),
            btnProductModalAdd: document.getElementById('btn-product-modal-add'),
            // 옵션 팝오버
            optionPopover: document.getElementById('codiset-option-popover'),
            optionPopoverTitle: document.getElementById('codiset-option-popover-title'),
            optionColors: document.getElementById('codiset-option-colors'),
            optionSizeSection: document.getElementById('codiset-option-size-section'),
            optionSizes: document.getElementById('codiset-option-sizes'),
            optionSelectedList: document.getElementById('codiset-option-selected-list'),
            optionTotal: document.getElementById('codiset-option-total'),
            btnOptionPopoverClose: document.getElementById('btn-option-popover-close'),
            btnOptionAdd: document.getElementById('btn-option-add'),
            // 카톡 양식 모달
            katalkModal: document.getElementById('katalk-modal'),
            katalkModalBackdrop: document.querySelector('#katalk-modal .katalk-modal-backdrop'),
            katalkStoreBtns: document.getElementById('katalk-store-buttons'),
            katalkCommentInput: document.getElementById('katalk-comment-input'),
            katalkTextarea: document.getElementById('katalk-textarea'),
            katalkSelectedStore: document.getElementById('katalk-selected-store'),
            btnKatalkFormat: document.getElementById('btn-katalk-format'),
            btnKatalkModalClose: document.getElementById('btn-katalk-modal-close'),
            btnKatalkCopy: document.getElementById('btn-katalk-copy')
        };

        initCodiset(codiset);
        bindEvents();
        loadProducts().then(() => render());
    }

    // 현재 코디세트 데이터 반환 (저장용)
    function getData() {
        return {
            ...currentCodiset,
            sets: sets
        };
    }

    // 전역 노출
    window.CodisetEdit = { init, getData };
})();
