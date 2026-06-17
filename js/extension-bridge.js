// extension-bridge.js - Electron ↔ 크롬 확장 통신 (HTTP 서버 모듈)
// main.js에서 호출하여 사용

const http = require('http');
const Database = require('better-sqlite3');

let db = null;
let server = null;
let getWindow = null;

/**
 * 렌더러에 상품목록 갱신 알림
 */
function notifyRenderer() {
    if (!getWindow) return;
    const win = getWindow();
    if (win && !win.isDestroyed()) {
        win.webContents.executeJavaScript(`
            if (window.ProductList && typeof window.ProductList.loadProducts === 'function') {
                window.ProductList.loadProducts();
            }
        `).catch(() => { });
    }
}

/**
 * SQLite 데이터베이스 초기화
 * @param {string} dbPath - DB 파일 경로
 */
function initDB(dbPath) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image TEXT DEFAULT '',
      storeName TEXT DEFAULT '',
      storeAddress TEXT DEFAULT '',
      productName TEXT DEFAULT '',
      productCode TEXT DEFAULT '',
      productPrice TEXT DEFAULT '',
      color TEXT DEFAULT '',
      size TEXT DEFAULT '',
      season TEXT DEFAULT '',
      acc TEXT DEFAULT '',
      registeredAt TEXT DEFAULT ''
    )
  `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      address TEXT DEFAULT '',
      category TEXT DEFAULT '',
      kindness INTEGER DEFAULT 1,
      memo TEXT DEFAULT '',
      createdAt TEXT DEFAULT ''
    )
  `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS codisets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      season TEXT DEFAULT '',
      memo TEXT DEFAULT '',
      sets TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT ''
    )
  `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS sample_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      date TEXT DEFAULT '',
      memo TEXT DEFAULT '',
      groups TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT ''
    )
  `);

    // 기존 DB 마이그레이션: 누락된 컬럼 추가
    const existingCols = db.pragma('table_info(products)').map(c => c.name);

    const migrations = [
        { name: 'storeName', sql: 'ALTER TABLE products ADD COLUMN storeName TEXT DEFAULT \'\'' },
        { name: 'storeAddress', sql: 'ALTER TABLE products ADD COLUMN storeAddress TEXT DEFAULT \'\'' },
        { name: 'productName', sql: 'ALTER TABLE products ADD COLUMN productName TEXT DEFAULT \'\'' },
        { name: 'productCode', sql: 'ALTER TABLE products ADD COLUMN productCode TEXT DEFAULT \'\'' },
        { name: 'productPrice', sql: 'ALTER TABLE products ADD COLUMN productPrice TEXT DEFAULT \'\'' },
        { name: 'color', sql: 'ALTER TABLE products ADD COLUMN color TEXT DEFAULT \'\'' },
        { name: 'size', sql: 'ALTER TABLE products ADD COLUMN size TEXT DEFAULT \'\'' },
        { name: 'season', sql: 'ALTER TABLE products ADD COLUMN season TEXT DEFAULT \'\'' },
        { name: 'acc', sql: 'ALTER TABLE products ADD COLUMN acc TEXT DEFAULT \'\'' }
    ];

    for (const m of migrations) {
        if (!existingCols.includes(m.name)) {
            try {
                db.exec(m.sql);
                console.log('[Bridge] 마이그레이션: ' + m.name + ' 컬럼 추가');
            } catch (e) {
                console.error('[Bridge] 마이그레이션 실패 (' + m.name + '):', e.message);
            }
        }
    }

    // stores 테이블 마이그레이션: memo 컬럼
    const existingStoreCols = db.pragma('table_info(stores)').map(c => c.name);
    if (!existingStoreCols.includes('memo')) {
        try {
            db.exec('ALTER TABLE stores ADD COLUMN memo TEXT DEFAULT \'\'');
            console.log('[Bridge] 마이그레이션: stores.memo 컬럼 추가');
        } catch (e) {
            console.error('[Bridge] stores 마이그레이션 실패 (memo):', e.message);
        }
    }

    console.log('[Bridge] SQLite 초기화 완료');
}

/**
 * JSON 요청 파싱
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

/**
 * CORS 헤더 설정 (크롬 확장에서의 요청 허용)
 */
function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * JSON 응답
 */
function sendJSON(res, status, data) {
    setCORS(res);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

/**
 * 라우트 핸들러
 */
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') {
        setCORS(res);
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        // POST /product - 상품 등록
        if (req.method === 'POST' && path === '/product') {
            const data = await parseBody(req);

            if (!data.season && !data.acc) {
                sendJSON(res, 400, { error: '시즌 또는 ACC를 선택해주세요.' });
                return;
            }

            // 다중 시즌 검증 (콤마 구분)
            const validSeasons = ['봄', '여름', '가을', '겨울', '사계절'];
            const seasons = data.season.split(',').map(s => s.trim()).filter(Boolean);
            for (const s of seasons) {
                if (!validSeasons.includes(s)) {
                    sendJSON(res, 400, { error: '올바른 시즌을 선택해주세요. (봄/여름/가을/겨울/사계절)' });
                    return;
                }
            }

            const stmt = db.prepare(`
        INSERT INTO products (image, storeName, storeAddress, productName, productCode, productPrice, color, size, season, acc, registeredAt)
        VALUES (@image, @storeName, @storeAddress, @productName, @productCode, @productPrice, @color, @size, @season, @acc, @registeredAt)
      `);

            const result = stmt.run({
                image: data.image || '',
                storeName: data.storeName || '',
                storeAddress: data.storeAddress || '',
                productName: data.productName || '',
                productCode: data.productCode || '',
                productPrice: data.productPrice || '',
                color: data.color || '',
                size: data.size || '',
                season: data.season || '',
                acc: data.acc || '',
                registeredAt: data.registeredAt || new Date().toISOString()
            });

            console.log('[Bridge] 상품 등록 완료, id:', result.lastInsertRowid);
            sendJSON(res, 201, { ok: true, id: result.lastInsertRowid });
            notifyRenderer();
            return;
        }

        // GET /products - 상품 목록 (페이지네이션, 검색 지원)
        if (req.method === 'GET' && path === '/products') {
            const season = url.searchParams.get('season') || '';
            const acc = url.searchParams.get('acc') || '';
            const search = url.searchParams.get('search') || '';
            const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 100);
            const offset = parseInt(url.searchParams.get('offset')) || 0;

            let where = [];
            let params = {};

            if (season) {
                where.push('season LIKE @season');
                params.season = '%' + season + '%';
            }
            if (acc) {
                where.push('acc LIKE @acc');
                params.acc = '%' + acc + '%';
            }
            if (search) {
                where.push('(productName LIKE @search OR storeName LIKE @search OR productCode LIKE @search OR storeAddress LIKE @search)');
                params.search = '%' + search + '%';
            }

            const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

            const countRow = db.prepare(`SELECT COUNT(*) as total FROM products ${whereClause}`).get(params);
            const total = countRow.total;

            params.limit = limit;
            params.offset = offset;
            const rows = db.prepare(`SELECT * FROM products ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all(params);

            sendJSON(res, 200, { rows, total, hasMore: (offset + limit) < total });
            return;
        }

        // DELETE /product/:id - 상품 삭제
        if (req.method === 'DELETE' && path.startsWith('/product/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }

            const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
            if (result.changes > 0) {
                console.log('[Bridge] 상품 삭제 완료, id:', id);
                sendJSON(res, 200, { ok: true });
                notifyRenderer();
            } else {
                sendJSON(res, 404, { error: 'Product not found' });
            }
            return;
        }

        // GET /codisets - 코디세트 목록
        if (req.method === 'GET' && path === '/codisets') {
            const rows = db.prepare('SELECT * FROM codisets ORDER BY id DESC').all();
            // sets 컬럼 JSON 파싱
            const parsed = rows.map(r => ({
                ...r,
                sets: JSON.parse(r.sets || '[]')
            }));
            sendJSON(res, 200, parsed);
            return;
        }

        // POST /codiset - 코디세트 생성
        if (req.method === 'POST' && path === '/codiset') {
            const data = await parseBody(req);
            const now = new Date().toISOString();
            const stmt = db.prepare(`
                INSERT INTO codisets (name, season, memo, sets, createdAt, updatedAt)
                VALUES (@name, @season, @memo, @sets, @createdAt, @updatedAt)
            `);
            const result = stmt.run({
                name: data.name || '',
                season: data.season || '',
                memo: data.memo || '',
                sets: JSON.stringify(data.sets || []),
                createdAt: now,
                updatedAt: now
            });
            console.log('[Bridge] 코디세트 생성 완료, id:', result.lastInsertRowid);
            sendJSON(res, 201, { ok: true, id: result.lastInsertRowid });
            return;
        }

        // PUT /codiset/:id - 코디세트 업데이트
        if (req.method === 'PUT' && path.startsWith('/codiset/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }
            const data = await parseBody(req);
            const now = new Date().toISOString();
            const stmt = db.prepare(`
                UPDATE codisets SET name=@name, season=@season, memo=@memo, sets=@sets, updatedAt=@updatedAt
                WHERE id=@id
            `);
            const result = stmt.run({
                id: id,
                name: data.name || '',
                season: data.season || '',
                memo: data.memo || '',
                sets: JSON.stringify(data.sets || []),
                updatedAt: now
            });
            if (result.changes > 0) {
                console.log('[Bridge] 코디세트 업데이트 완료, id:', id);
                sendJSON(res, 200, { ok: true });
            } else {
                sendJSON(res, 404, { error: 'Codiset not found' });
            }
            return;
        }

        // DELETE /codiset/:id - 코디세트 삭제
        if (req.method === 'DELETE' && path.startsWith('/codiset/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }
            const result = db.prepare('DELETE FROM codisets WHERE id = ?').run(id);
            if (result.changes > 0) {
                console.log('[Bridge] 코디세트 삭제 완료, id:', id);
                sendJSON(res, 200, { ok: true });
            } else {
                sendJSON(res, 404, { error: 'Codiset not found' });
            }
            return;
        }

        // GET /stores - 매장 목록
        if (req.method === 'GET' && path === '/stores') {
            const rows = db.prepare('SELECT * FROM stores ORDER BY id ASC').all();
            sendJSON(res, 200, rows);
            return;
        }

        // POST /store - 매장 등록
        if (req.method === 'POST' && path === '/store') {
            const data = await parseBody(req);

            if (!data.name || !data.name.trim()) {
                sendJSON(res, 400, { error: '매장명을 입력해주세요.' });
                return;
            }
            if (data.kindness < 1 || data.kindness > 5) {
                sendJSON(res, 400, { error: '친절도는 1~5 사이여야 합니다.' });
                return;
            }

            const stmt = db.prepare(`
                INSERT INTO stores (name, address, category, kindness, memo, createdAt)
                VALUES (@name, @address, @category, @kindness, @memo, @createdAt)
            `);
            const result = stmt.run({
                name: data.name.trim(),
                address: data.address || '',
                category: data.category || '',
                kindness: data.kindness || 1,
                memo: data.memo || '',
                createdAt: new Date().toISOString()
            });
            console.log('[Bridge] 매장 등록 완료, id:', result.lastInsertRowid);
            sendJSON(res, 201, { ok: true, id: result.lastInsertRowid });
            return;
        }

        // PUT /store/:id - 매장 수정
        if (req.method === 'PUT' && path.startsWith('/store/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }
            const data = await parseBody(req);

            if (!data.name || !data.name.trim()) {
                sendJSON(res, 400, { error: '매장명을 입력해주세요.' });
                return;
            }
            if (data.kindness < 1 || data.kindness > 5) {
                sendJSON(res, 400, { error: '친절도는 1~5 사이여야 합니다.' });
                return;
            }

            const stmt = db.prepare(`
                UPDATE stores SET name=@name, address=@address, category=@category, kindness=@kindness, memo=@memo
                WHERE id=@id
            `);
            const result = stmt.run({
                id: id,
                name: data.name.trim(),
                address: data.address || '',
                category: data.category || '',
                kindness: data.kindness || 1,
                memo: data.memo || ''
            });
            if (result.changes > 0) {
                console.log('[Bridge] 매장 수정 완료, id:', id);
                sendJSON(res, 200, { ok: true });
            } else {
                sendJSON(res, 404, { error: 'Store not found' });
            }
            return;
        }

        // DELETE /store/:id - 매장 삭제
        if (req.method === 'DELETE' && path.startsWith('/store/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }
            const result = db.prepare('DELETE FROM stores WHERE id = ?').run(id);
            if (result.changes > 0) {
                console.log('[Bridge] 매장 삭제 완료, id:', id);
                sendJSON(res, 200, { ok: true });
            } else {
                sendJSON(res, 404, { error: 'Store not found' });
            }
            return;
        }

        // GET /sample-lists - 샘플 리스트 목록
        if (req.method === 'GET' && path === '/sample-lists') {
            const rows = db.prepare('SELECT * FROM sample_lists ORDER BY id DESC').all();
            const parsed = rows.map(r => ({
                ...r,
                groups: JSON.parse(r.groups || '[]')
            }));
            sendJSON(res, 200, parsed);
            return;
        }

        // POST /sample-list - 샘플 리스트 생성
        if (req.method === 'POST' && path === '/sample-list') {
            const data = await parseBody(req);
            const now = new Date().toISOString();
            const stmt = db.prepare(`
                INSERT INTO sample_lists (name, date, memo, groups, createdAt, updatedAt)
                VALUES (@name, @date, @memo, @groups, @createdAt, @updatedAt)
            `);
            const result = stmt.run({
                name: data.name || '',
                date: data.date || '',
                memo: data.memo || '',
                groups: JSON.stringify(data.groups || []),
                createdAt: now,
                updatedAt: now
            });
            console.log('[Bridge] 샘플 리스트 생성 완료, id:', result.lastInsertRowid);
            sendJSON(res, 201, { ok: true, id: result.lastInsertRowid });
            return;
        }

        // PUT /sample-list/:id - 샘플 리스트 수정
        if (req.method === 'PUT' && path.startsWith('/sample-list/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }
            const data = await parseBody(req);
            const now = new Date().toISOString();
            const stmt = db.prepare(`
                UPDATE sample_lists SET name=@name, date=@date, memo=@memo, groups=@groups, updatedAt=@updatedAt
                WHERE id=@id
            `);
            const result = stmt.run({
                id: id,
                name: data.name || '',
                date: data.date || '',
                memo: data.memo || '',
                groups: JSON.stringify(data.groups || []),
                updatedAt: now
            });
            if (result.changes > 0) {
                console.log('[Bridge] 샘플 리스트 수정 완료, id:', id);
                sendJSON(res, 200, { ok: true });
            } else {
                sendJSON(res, 404, { error: 'Sample list not found' });
            }
            return;
        }

        // DELETE /sample-list/:id - 샘플 리스트 삭제
        if (req.method === 'DELETE' && path.startsWith('/sample-list/')) {
            const id = parseInt(path.split('/').pop());
            if (isNaN(id)) {
                sendJSON(res, 400, { error: 'Invalid ID' });
                return;
            }
            const result = db.prepare('DELETE FROM sample_lists WHERE id = ?').run(id);
            if (result.changes > 0) {
                console.log('[Bridge] 샘플 리스트 삭제 완료, id:', id);
                sendJSON(res, 200, { ok: true });
            } else {
                sendJSON(res, 404, { error: 'Sample list not found' });
            }
            return;
        }

        // 404
        sendJSON(res, 404, { error: 'Not found' });
    } catch (err) {
        console.error('[Bridge] 요청 처리 오류:', err);
        sendJSON(res, 500, { error: 'Internal server error' });
    }
}

const PORT = 19877;

/**
 * HTTP 서버 시작
 * @param {Function} getWinFn - () => BrowserWindow
 */
function start(getWinFn) {
    if (server) return;
    getWindow = getWinFn || null;

    server = http.createServer(handleRequest);
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`[Bridge] HTTP 서버 시작: http://127.0.0.1:${PORT}`);
    });
}

/**
 * HTTP 서버 중지
 */
function stop() {
    if (server) {
        server.close();
        server = null;
    }
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = { initDB, start, stop, PORT };
