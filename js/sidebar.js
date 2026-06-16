// sidebar.js - 사이드바 인터랙션
// 메뉴 클릭 이벤트, 활성 상태 관리

(function () {
    'use strict';

    let activeMenu = 'products';
    const listeners = [];

    /**
     * 사이드바 메뉴 클릭 핸들러
     */
    function handleMenuClick(e) {
        const item = e.currentTarget;
        const menu = item.dataset.menu;
        if (!menu || menu === activeMenu) return;

        // 기존 활성 제거
        const prev = document.querySelector('.sidebar-item.active');
        if (prev) prev.classList.remove('active');

        // 새 활성 추가
        item.classList.add('active');
        activeMenu = menu;

        // 외부 리스너에게 알림
        listeners.forEach(fn => fn(menu));
    }

    /**
     * 테마 토글
     */
    function initTheme() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        // 저장된 테마 불러오기 (기본: 라이트)
        const saved = localStorage.getItem('codiset-theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        toggle.addEventListener('click', function () {
            const html = document.documentElement;
            if (html.hasAttribute('data-theme')) {
                html.removeAttribute('data-theme');
                localStorage.setItem('codiset-theme', 'light');
            } else {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('codiset-theme', 'dark');
            }
        });
    }

    /**
     * 사이드바 초기화 (sidebar.html이 로드된 후 호출)
     */
    function init() {
        const items = document.querySelectorAll('.sidebar-item');
        items.forEach(item => {
            item.addEventListener('click', handleMenuClick);
        });
        initTheme();
    }

    /**
     * 메뉴 변경 이벤트 구독
     * @param {function} fn - (menuName: string) => void
     */
    function onMenuChange(fn) {
        listeners.push(fn);
    }

    /**
     * 현재 활성 메뉴 반환
     * @returns {string}
     */
    function getActiveMenu() {
        return activeMenu;
    }

    // 전역 노출
    window.Sidebar = {
        init,
        onMenuChange,
        getActiveMenu
    };
})();
