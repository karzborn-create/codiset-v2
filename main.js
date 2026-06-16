// main.js - Electron 메인 프로세스
const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const bridge = require('./js/extension-bridge');

// DevTools 내부 오류 메시지 필터링
const SUPPRESSED_ERRORS = [
    'language-mismatch',
    'Autofill.enable',
    'Autofill.setAddresses',
    'is not valid JSON'
];

app.commandLine.appendSwitch('disable-features', 'Autofill');
app.commandLine.appendSwitch('silent-debugger-extension-api');

// ── autoUpdater 설정 ──
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: '업데이트가 있습니다',
        message: `새로운 버전(v${info.version})이 출시되었습니다.`,
        detail: '지금 다운로드하시겠습니까?',
        buttons: ['다운로드', '나중에']
    }).then(({ response }) => {
        if (response === 0) {
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-not-available', () => {
    console.log('현재 최신 버전입니다.');
});

autoUpdater.on('download-progress', (progressObj) => {
    const pct = Math.floor(progressObj.percent);
    console.log(`업데이트 다운로드 중... ${pct}%`);
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: '업데이트 준비 완료',
        message: '업데이트가 다운로드되었습니다.',
        detail: '지금 재시작하여 새 버전을 적용하시겠습니까?',
        buttons: ['지금 재시작', '나중에']
    }).then(({ response }) => {
        if (response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (error) => {
    console.error('업데이트 오류:', error.message);
});

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Codiset',
        icon: path.join(__dirname, 'icon', 'icon.ico'),
        backgroundColor: '#1c1c1e',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // DevTools 내부 오류 콘솔 출력 억제
    mainWindow.webContents.on('console-message', (event, level, message) => {
        if (level === 3 && SUPPRESSED_ERRORS.some(e => message.includes(e))) {
            event.preventDefault();
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 앱 로드 완료 후 업데이트 체크 (개발 모드가 아닐 때만)
    mainWindow.webContents.on('did-finish-load', () => {
        if (!process.argv.includes('--dev')) {
            autoUpdater.checkForUpdates();
        }
    });
}

// SQLite 초기화 및 HTTP 서버 시작
app.whenReady().then(() => {
    const dbPath = path.join(app.getPath('userData'), 'codiset.db');
    bridge.initDB(dbPath);
    bridge.start(() => mainWindow);
    createWindow();
});

app.on('window-all-closed', () => {
    bridge.stop();
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
