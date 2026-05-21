/**
 * 本地代理服务 — 解决富文本图片跨域 + Cookie 权限问题
 *
 * 启动方式:  node proxy.js
 * 访问页面:  http://localhost:8128/orderview.html
 * 代理接口:  http://localhost:8128/?url=<encodedImageUrl>
 *
 * 原理：
 *   浏览器无法在跨域 <img> 请求中携带自定义 Cookie，
 *   因此由本服务在 Node.js 后端代为请求目标图片，
 *   并附加所需 Cookie / 请求头，再把响应转发给浏览器。
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');


// ============ 配置区 ============

/** 代理服务端口（须与 orderview.html 中 PROXY_BASE 端口一致） */
const PORT = 8128;

/**
 * Cookie 配置项（与 orderview.html 中 COOKIE_CONFIG 保持一致）
 * 格式：{ "cookie": "key1=value1; key2=value2" }
 * 代理服务会将 cookie 字段的值直接作为 Cookie 请求头发送
 */
const COOKIE_CONFIG = [
  {
    "cookie": "token=abc1231233333"
  }
];

/** 静态文件根目录（默认当前目录） */
const STATIC_DIR = __dirname;

// ============ 工具函数 ============

/**
 * 根据 COOKIE_CONFIG 构建 Cookie 请求头字符串
 * 取每项中 cookie 字段的值直接拼接
 */
function buildCookieHeader() {
  if (!Array.isArray(COOKIE_CONFIG) || COOKIE_CONFIG.length === 0) return '';

  const parts = [];
  for (const item of COOKIE_CONFIG) {
    if (item.cookie) {
      parts.push(item.cookie);
    }
  }
  return parts.join('; ');
}

const COOKIE_HEADER = buildCookieHeader();

/**
 * 发起 HTTP/HTTPS 请求并返回响应
 */
function fetchRemote(targetUrl, res) {
  const parsed = new URL(targetUrl);

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    // 不验证证书（内网环境可能有自签名证书）
    rejectUnauthorized: false,
  };

  // 附加 Cookie 请求头
  if (COOKIE_HEADER) {
    options.headers['Cookie'] = COOKIE_HEADER;
  }

  const requester = parsed.protocol === 'https:' ? https : http;

  const req = requester.request(options, (remoteRes) => {
    // 处理重定向
    if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
      let redirectUrl = remoteRes.headers.location;
      // 处理相对路径重定向
      if (!redirectUrl.startsWith('http')) {
        redirectUrl = parsed.protocol + '//' + parsed.host + redirectUrl;
      }
      fetchRemote(redirectUrl, res);
      return;
    }

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 透传 Content-Type
    const contentType = remoteRes.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // 缓存控制：图片缓存 1 小时
    res.setHeader('Cache-Control', 'public, max-age=3600');

    res.writeHead(remoteRes.statusCode);
    remoteRes.pipe(res);
  });

  req.on('error', (err) => {
    console.error('[Proxy Error]', targetUrl, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    }
    res.end(JSON.stringify({ error: 'Proxy request failed', detail: err.message }));
  });

  req.end();
}

/**
 * MIME 类型映射
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.eot':  'application/vnd.ms-fontobject',
  '.map':  'application/json',
};

/**
 * 提供静态文件服务
 */
function serveStatic(filePath, res) {
  // 安全检查：防止路径穿越
  const resolved = path.resolve(STATIC_DIR, filePath);
  if (!resolved.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + filePath);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ============ 启动服务 ============

const server = http.createServer((req, res) => {
  // 使用 WHATWG URL API 解析请求（替代已弃用的 url.parse）
  const baseUrl = `http://localhost:${PORT}`;
  const parsed = new URL(req.url, baseUrl);

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // 代理接口：/?url=<encodedUrl>
  const targetUrl = parsed.searchParams.get('url');
  if (targetUrl) {
    // 安全校验：只允许 http/https 协议
    if (!/^https?:\/\//i.test(targetUrl)) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Only http/https URLs are allowed' }));
      return;
    }

    console.log('[Proxy]', targetUrl);
    fetchRemote(targetUrl, res);
    return;
  }

  // 静态文件服务（根路径默认 orderview.html）
  let filePath = parsed.pathname === '/' ? '/orderview.html' : parsed.pathname;
  // 去掉开头的 /
  filePath = filePath.slice(1);
  serveStatic(filePath, res);
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Orderview 图片代理服务已启动               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   页面地址: http://localhost:${PORT}/orderview.html`);
  console.log(`║   代理端口: ${PORT}`);
  console.log(`║   Cookie 配置: ${COOKIE_HEADER || '(无)'}`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
