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

async function startBot(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch({
        allowedUpdates: ['message', 'callback_query'],
        dropPendingUpdates: true,
      });
      console.log('✅ Bot Telegram berhasil dijalankan!');
      console.log(`👤 Admin IDs: ${process.env.ADMIN_IDS}`);
      return;
    } catch (err) {
      if (err.message && err.message.includes('409')) {
        console.log(`⚠️ Conflict 409 terdeteksi (instance lain berjalan). Retry ${i + 1}/${retries} dalam 5 detik...`);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error('❌ Gagal menjalankan bot:', err.message);
        process.exit(1);
      }
    }
  }
  console.error('❌ Gagal menjalankan bot setelah beberapa retry. Keluar...');
  process.exit(1);
}

startBot();

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
