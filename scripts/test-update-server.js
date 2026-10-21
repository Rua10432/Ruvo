/**
 * Ruam 本地更新测试服务
 * 
 * 启动后将在 http://127.0.0.1:8080 提供模拟的最新版本信息 (v0.2.0)
 * 运行方式：node scripts/test-update-server.js
 */

const http = require('http');

const PORT = 8080;

const mockManifest = {
  version: "0.2.0",
  notes: "### Ruam v0.2.0 测试更新版本\n- ✨ 新增自动更新与断点续传支持\n- 🎨 优化 VS Code 风格分割条抓手与卡片边框\n- ⚡ 提升本地大文件 Markdown 解析性能\n- 🐞 修复多窗口置顶状态同步问题",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: "",
      url: `http://127.0.0.1:${PORT}/ruam_update_mock.zip`
    }
  }
};

const server = http.createServer((req, res) => {
  // 设置 CORS 跨域请求头，允许 Tauri/浏览器访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[UpdateServer] ${req.method} ${req.url}`);

  if (req.url === '/latest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(mockManifest, null, 2));
    return;
  }

  if (req.url.startsWith('/ruam_update_mock.zip')) {
    // 模拟返回一个测试更新数据流
    const dummyData = Buffer.alloc(1024 * 512, 0x42); // 512KB mock payload
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': dummyData.length,
      'Content-Disposition': 'attachment; filename="ruam_update_mock.zip"'
    });
    res.end(dummyData);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`====================================================`);
  console.log(`🚀 Ruam 本地更新测试服务器已启动: http://127.0.0.1:${PORT}`);
  console.log(`📡 更新清单端点: http://127.0.0.1:${PORT}/latest.json`);
  console.log(`💡 提示：在 Ruam 客户端的“关于”标签页点击【检查更新】即可收到 v0.2.0 推送`);
  console.log(`====================================================`);
});
