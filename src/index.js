require('dotenv').config();
const http = require('http');
const bot = require('./bot');

const PORT = process.env.PORT || 3000;

// ─── Health check server (Railway butuh port terbuka) ──────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', bot: 'running', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WA ACC Bot is running 🤖');
  }
});

server.listen(PORT, () => {
  console.log(`✅ Health check server berjalan di port ${PORT}`);
});

// ─── Validasi env ──────────────────────────────────────────────────────────
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN belum di-set di environment variables!');
  process.exit(1);
}

if (!process.env.ADMIN_IDS) {
  console.error('❌ ADMIN_IDS belum di-set di environment variables!');
  process.exit(1);
}

// ─── Launch bot ────────────────────────────────────────────────────────────
console.log('🤖 Memulai WA ACC Bot...');

bot.launch({
  allowedUpdates: ['message', 'callback_query'],
}).then(() => {
  console.log('✅ Bot Telegram berhasil dijalankan!');
  console.log(`👤 Admin IDs: ${process.env.ADMIN_IDS}`);
}).catch((err) => {
  console.error('❌ Gagal menjalankan bot:', err.message);
  process.exit(1);
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────
process.once('SIGINT', () => {
  console.log('🛑 Menerima SIGINT, menghentikan bot...');
  bot.stop('SIGINT');
  server.close();
});

process.once('SIGTERM', () => {
  console.log('🛑 Menerima SIGTERM, menghentikan bot...');
  bot.stop('SIGTERM');
  server.close();
});
