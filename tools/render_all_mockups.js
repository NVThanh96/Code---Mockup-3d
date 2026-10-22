const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8899;
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'renders_3d');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let savedCount = 0;
const TOTAL_MODELS = 28;

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // POST: Lưu ảnh Render PNG
  if (req.method === 'POST' && req.url === '/save_render') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        const filename = json.filename;
        const base64Data = json.data.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const savePath = path.join(OUTPUT_DIR, filename);

        fs.writeFileSync(savePath, buffer);
        savedCount++;
        console.log(`[${savedCount}/${TOTAL_MODELS}] ✓ Đã lưu ảnh: renders_3d/${filename}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, saved: filename, count: savedCount }));

        if (savedCount >= TOTAL_MODELS) {
          console.log('\n============================================================');
          console.log(`🎉 HOÀN TẤT XUẤT ẢNH! Đã lưu đủ ${savedCount} ảnh 3D mockup vào:`);
          console.log(`📂 ${OUTPUT_DIR}`);
          console.log('============================================================\n');
          setTimeout(() => {
            process.exit(0);
          }, 2000);
        }
      } catch (err) {
        console.error('Lỗi lưu ảnh:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET: Static file server
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/review_3d_gallery.html';

  const filePath = path.join(ROOT_DIR, decodeURIComponent(reqPath));

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File Not Found: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Server render 3D đang chạy tại: http://localhost:${PORT}/review_3d_gallery.html`);
  console.log('Đang khởi chạy Microsoft Edge để tự động render 28 ảnh 3D...\n');

  // Tìm đường dẫn Edge
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env['LOCALAPPDATA'] + '\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  let edgeExe = null;
  for (const p of edgePaths) {
    if (fs.existsSync(p)) {
      edgeExe = p;
      break;
    }
  }

  if (!edgeExe) {
    console.log('Không tìm thấy msedge.exe tự động. Vui lòng mở trình duyệt và truy cập:');
    console.log(`👉 http://localhost:${PORT}/review_3d_gallery.html?autorun=1`);
    return;
  }

  const args = [
    '--headless=new',
    '--disable-gpu-watchdog',
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--window-size=1400,1000',
    `http://localhost:${PORT}/review_3d_gallery.html?autorun=1`
  ];

  const browser = spawn(edgeExe, args, { stdio: 'ignore' });

  browser.on('error', (err) => {
    console.error('Không thể mở Edge tự động:', err.message);
    console.log(`Vui lòng mở trình duyệt và truy cập: http://localhost:${PORT}/review_3d_gallery.html?autorun=1`);
  });
});
