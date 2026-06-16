// background.js - Service Worker
// 사이드 패널 제어 및 확장프로그램 아이콘 클릭 처리

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

// 탭 변경 시 사이드 패널 유지 (기본 동작)
// 메시지 중계: sidepanel <-> content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // content.js -> sidepanel 로 데이터 전달은
    // sidepanel이 직접 chrome.tabs.sendMessage로 요청하므로
    // background는 단순 중계만 필요시 사용
    sendResponse({ ok: true });
});
