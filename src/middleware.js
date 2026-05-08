require('dotenv').config();

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

function adminOnly(ctx, next) {
  if (!isAdmin(ctx.from?.id)) {
    return ctx.reply('⛔ Akses ditolak. Bot ini hanya untuk admin yang berwenang.');
  }
  return next();
}

module.exports = { isAdmin, adminOnly, ADMIN_IDS };
