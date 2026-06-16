// content.js - Content Script
// URL 패턴 감지 후 해당 로직으로 상품 데이터 수집

/**
 * 요소의 텍스트 추출
 */
function getText(el) {
    return el ? (el.textContent || '').trim() : '';
}

/**
 * null-safe querySelector
 */
function safeQuery(parent, selector) {
    return parent ? parent.querySelector(selector) : null;
}

/**
 * Tailwind 클래스명으로 요소 찾기 (대괄호 [] 안전 처리)
 * CSS 선택자에서 [ ]는 특수문자이므로 className 포함 여부로 순회 검색
 */
function findByClass(cls) {
    const all = document.querySelectorAll('*');
    for (const el of all) {
        if (el.className && typeof el.className === 'string' && el.className.includes(cls)) {
            return el;
        }
    }
    return null;
}

/**
 * 부모 클래스 내에서 자식 클래스 찾기
 */
function findInParent(parentCls, childCls) {
    const parent = findByClass(parentCls);
    if (!parent) return null;
    // 자식도 Tailwind 클래스로 찾기
    const children = parent.querySelectorAll('*');
    for (const el of children) {
        if (el.className && typeof el.className === 'string' && el.className.includes(childCls)) {
            return el;
        }
    }
    return null;
}

/**
 * Tailwind 클래스명으로 모든 요소 찾기 (배열 반환)
 */
function findByClassAll(cls) {
    const results = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
        if (el.className && typeof el.className === 'string' && el.className.includes(cls)) {
            results.push(el);
        }
    }
    return results;
}

/**
 * 특정 요소 내에서 자식 클래스 찾기
 */
function findInEl(parentEl, childCls) {
    if (!parentEl) return null;
    const children = parentEl.querySelectorAll('*');
    for (const el of children) {
        if (el.className && typeof el.className === 'string' && el.className.includes(childCls)) {
            return el;
        }
    }
    return null;
}

/**
 * [modalGid] URL 전용 수집 로직
 */
function collectModalGid() {
    const data = {};

    // 1. 상점명: group flex items-center gap-[12px] hover:cursor-pointer 내부의
    //    underline-offset-2 group-hover:underline font-semibold text-[18px] leading-[26px]
    const storeNameEl = findInParent(
        'group flex items-center gap-[12px] hover:cursor-pointer',
        'underline-offset-2 group-hover:underline font-semibold text-[18px] leading-[26px]'
    );
    data.storeName = getText(storeNameEl);

    // 2. 상점주소: 같은 부모 내부의 font-normal text-[14px] leading-[20px]
    const storeAddrEl = findInParent(
        'group flex items-center gap-[12px] hover:cursor-pointer',
        'font-normal text-[14px] leading-[20px]'
    );
    data.storeAddress = getText(storeAddrEl);

    // 3. 상품명: mb-[8px]가 여러 개면 2번째 것에서 찾음
    const mb8List = findByClassAll('mb-[8px]');
    const nameParent = mb8List.length >= 2 ? mb8List[1] : mb8List[0];
    const productNameEl = nameParent ? findInEl(nameParent, 'font-normal text-[24px] leading-[32px]') : null;
    data.productName = getText(productNameEl);

    // 4. 상품코드: 상품명에 사용된 mb-[8px]의 다음 형제 mb-[16px] 안의 font-semibold text-[14px] leading-[20px]
    let codeSibling = null;
    if (nameParent) {
        codeSibling = nameParent.nextElementSibling;
        while (codeSibling && !codeSibling.className.includes('mb-[16px]')) {
            codeSibling = codeSibling.nextElementSibling;
        }
    }
    const codeEl = findInSibling(codeSibling, 'font-semibold text-[14px] leading-[20px]');
    data.productCode = getText(codeEl);

    // 5. 상품가격: font-semibold text-[28px] leading-[36px]
    const priceEl = findByClass('font-semibold text-[28px] leading-[36px]');
    data.productPrice = getText(priceEl);

    // 6. 색상: flex flex-col gap-[12px] pb-[32px] → 2번째 자식 div → align-bottom text-[14px]
    const optionParent = findByClass('flex flex-col gap-[12px] pb-[32px]');
    const colorDiv = optionParent ? optionParent.children[1] : null;
    const colorEl = safeQuery(colorDiv, '[class*="align-bottom"][class*="text-\\[14px\\]"]');
    data.color = getText(colorEl);

    // 7. 사이즈: 같은 부모 → 3번째 자식 div → align-bottom text-[14px]
    const sizeDiv = optionParent ? optionParent.children[2] : null;
    const sizeEl = safeQuery(sizeDiv, '[class*="align-bottom"][class*="text-\\[14px\\]"]');
    data.size = getText(sizeEl);

    // 8. 이미지: relative flex size-full items-center justify-center overflow-hidden bg-primary-04 rounded-[12px] 내부 img
    const imgParent = findByClass('relative flex size-full items-center justify-center overflow-hidden bg-primary-04 rounded-[12px]');
    const imgEl = imgParent ? imgParent.querySelector('img') : null;
    data.image = imgEl ? (imgEl.src || imgEl.getAttribute('src') || '') : '';

    return data;
}

/**
 * [zzimList] URL 전용 수집 로직
 * 상품명, 상품코드만 modalGid와 다르게 탐색하고 나머지는 동일
 */
function collectZzimList() {
    const data = {};

    // 1. 상점명: group flex items-center gap-[12px] hover:cursor-pointer 내부의
    //    underline-offset-2 group-hover:underline font-semibold text-[18px] leading-[26px]
    const storeNameEl = findInParent(
        'group flex items-center gap-[12px] hover:cursor-pointer',
        'underline-offset-2 group-hover:underline font-semibold text-[18px] leading-[26px]'
    );
    data.storeName = getText(storeNameEl);

    // 2. 상점주소: 같은 부모 내부의 font-normal text-[14px] leading-[20px]
    const storeAddrEl = findInParent(
        'group flex items-center gap-[12px] hover:cursor-pointer',
        'font-normal text-[14px] leading-[20px]'
    );
    data.storeAddress = getText(storeAddrEl);

    // 3. 상품명: 바로 font-normal text-[24px] leading-[32px] 요소 직접 탐색
    const productNameEl = findByClass('font-normal text-[24px] leading-[32px]');
    console.log('[zzimList] 상품명 요소:', productNameEl);
    console.log('[zzimList] 상품명 텍스트:', getText(productNameEl));
    data.productName = getText(productNameEl);

    // 4. 상품코드: tooltip-bubble 내부의 font-semibold text-[14px] leading-[20px]
    const tooltipBubble = findByClass('tooltip-bubble');
    console.log('[zzimList] tooltip-bubble 요소:', tooltipBubble);
    const codeEl = findInParent('tooltip-bubble', 'font-semibold text-[14px] leading-[20px]');
    console.log('[zzimList] 상품코드 요소:', codeEl);
    console.log('[zzimList] 상품코드 텍스트:', getText(codeEl));
    data.productCode = getText(codeEl);

    // 5. 상품가격: font-semibold text-[28px] leading-[36px]
    const priceEl = findByClass('font-semibold text-[28px] leading-[36px]');
    data.productPrice = getText(priceEl);

    // 6. 색상: flex flex-col gap-[12px] pb-[32px] → 2번째 자식 div → align-bottom text-[14px]
    const optionParent = findByClass('flex flex-col gap-[12px] pb-[32px]');
    const colorDiv = optionParent ? optionParent.children[1] : null;
    const colorEl = safeQuery(colorDiv, '[class*="align-bottom"][class*="text-\\[14px\\]"]');
    data.color = getText(colorEl);

    // 7. 사이즈: 같은 부모 → 3번째 자식 div → align-bottom text-[14px]
    const sizeDiv = optionParent ? optionParent.children[2] : null;
    const sizeEl = safeQuery(sizeDiv, '[class*="align-bottom"][class*="text-\\[14px\\]"]');
    data.size = getText(sizeEl);

    // 8. 이미지: relative flex size-full items-center justify-center overflow-hidden bg-primary-04 rounded-[12px] 내부 img
    const imgParent = findByClass('relative flex size-full items-center justify-center overflow-hidden bg-primary-04 rounded-[12px]');
    const imgEl = imgParent ? imgParent.querySelector('img') : null;
    data.image = imgEl ? (imgEl.src || imgEl.getAttribute('src') || '') : '';

    return data;
}

/**
 * 형제 요소 내에서 클래스 찾기
 */
function findInSibling(sibling, cls) {
    if (!sibling) return null;
    const children = sibling.querySelectorAll('*');
    for (const el of children) {
        if (el.className && typeof el.className === 'string' && el.className.includes(cls)) {
            return el;
        }
    }
    // sibling 자신도 확인
    if (sibling.className && typeof sibling.className === 'string' && sibling.className.includes(cls)) {
        return sibling;
    }
    return null;
}

/**
 * URL 패턴 감지 후 적절한 수집 함수 호출
 */
function collect() {
    const url = window.location.href;

    // zzimList를 먼저 체크 (URL에 modalGid도 함께 포함될 수 있음)
    if (url.includes('zzimList')) {
        return collectZzimList();
    }

    if (url.includes('modalGid')) {
        return collectModalGid();
    }

    // 추후 goods URL 등 추가
    return {};
}

// sidepanel에서 수집 요청 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Codiset] 메시지 수신:', message);
    if (message.action === 'collect') {
        console.log('[Codiset] collect 시작. URL:', window.location.href);
        const data = collect();
        console.log('[Codiset] collect 결과:', JSON.stringify(data));
        sendResponse({ ok: true, data });
    }
    return true;
});
