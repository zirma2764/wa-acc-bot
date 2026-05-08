require('dotenv').config();
const { Telegraf } = require('telegraf');
const wa = require('./whatsapp');
const { getState, setState, clearState, STATE } = require('./session');
const {
  mainMenuKeyboard,
  groupListKeyboard,
  groupActionKeyboard,
  partialAccKeyboard,
  confirmKeyboard,
} = require('./keyboards');
const { adminOnly } = require('./middleware');
const { generateQRImage, cleanupQR } = require('./qrHelper');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ─── Cache grup per sesi ───────────────────────────────────────────────────
let groupsCache = [];
let groupsCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 menit

async function fetchGroups(force = false) {
  const now = Date.now();
  if (!force && groupsCache.length && now - groupsCacheTime < CACHE_TTL) {
    return groupsCache;
  }
  groupsCache = await wa.getGroups();
  groupsCache.sort((a, b) => a.name.localeCompare(b.name));
  groupsCacheTime = now;
  return groupsCache;
}

function findGroup(groupId) {
  return groupsCache.find((g) => g.id === groupId);
}

// ─── Guard: WA harus terhubung ─────────────────────────────────────────────
async function requireWA(ctx) {
  if (!wa.isConnected) {
    await ctx.reply(
      '⚠️ WhatsApp belum terhubung!\n\nGunakan tombol *🔌 Hubungkan WA* terlebih dahulu.',
      { parse_mode: 'Markdown', ...mainMenuKeyboard() }
    );
    return false;
  }
  return true;
}

// ─── /start ────────────────────────────────────────────────────────────────
bot.start(adminOnly, async (ctx) => {
  const name = ctx.from.first_name || 'Admin';
  await ctx.reply(
    `👋 Halo, *${name}*!\n\n` +
      `🤖 Selamat datang di *WA ACC Bot*\n` +
      `Bot ini membantu kamu untuk menyetujui (ACC) permintaan bergabung ke grup WhatsApp dengan mudah.\n\n` +
      `📌 *Cara Pakai:*\n` +
      `1️⃣ Hubungkan WhatsApp kamu\n` +
      `2️⃣ Buka Daftar Grup\n` +
      `3️⃣ Pilih grup & ACC anggota\n\n` +
      `Pilih menu di bawah untuk memulai 👇`,
    { parse_mode: 'Markdown', ...mainMenuKeyboard() }
  );
});

// ─── Hubungkan WA ──────────────────────────────────────────────────────────
bot.hears('🔌 Hubungkan WA', adminOnly, async (ctx) => {
  if (wa.isConnected) {
    return ctx.reply(
      '✅ WhatsApp sudah terhubung!\n\nGunakan menu *Daftar Grup* untuk mulai.',
      { parse_mode: 'Markdown', ...mainMenuKeyboard() }
    );
  }

  const msgLoading = await ctx.reply('⏳ Memulai koneksi WhatsApp...');

  let qrSent = false;
  let qrMsgId = null;
  let qrFilePath = null;

  wa.onQR = async (qr) => {
    try {
      if (qrFilePath) cleanupQR(qrFilePath);
      qrFilePath = await generateQRImage(qr);

      if (!qrSent) {
        qrSent = true;
        await ctx.telegram.deleteMessage(ctx.chat.id, msgLoading.message_id).catch(() => {});
        const sent = await ctx.replyWithPhoto(
          { source: qrFilePath },
          {
            caption:
              '📱 *Scan QR Code ini dengan WhatsApp kamu*\n\n' +
              '1. Buka WhatsApp di HP\n' +
              '2. Ketuk ⋮ > Perangkat tertaut\n' +
              '3. Ketuk *Tautkan perangkat*\n' +
              '4. Scan QR di atas\n\n' +
              '⏳ QR berlaku 60 detik',
            parse_mode: 'Markdown',
          }
        );
        qrMsgId = sent.message_id;
      } else if (qrMsgId) {
        // Update QR baru
        await ctx.telegram
          .editMessageMedia(ctx.chat.id, qrMsgId, null, {
            type: 'photo',
            media: { source: qrFilePath },
            caption:
              '🔄 *QR Code diperbarui*\n\nScan QR terbaru ini dengan WhatsApp kamu.\n\n⏳ QR berlaku 60 detik',
            parse_mode: 'Markdown',
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('QR error:', err.message);
    }
  };

  wa.onConnected = async () => {
    if (qrFilePath) cleanupQR(qrFilePath);
    if (qrMsgId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, qrMsgId).catch(() => {});
    }
    await ctx.reply(
      '✅ *WhatsApp berhasil terhubung!*\n\nSekarang kamu bisa mengelola ACC anggota grup.',
      { parse_mode: 'Markdown', ...mainMenuKeyboard() }
    );
  };

  wa.onDisconnected = async (reason) => {
    if (reason === 'logged_out') {
      await ctx.reply(
        '🔴 WhatsApp telah logout.\nHubungkan ulang menggunakan tombol *🔌 Hubungkan WA*.',
        { parse_mode: 'Markdown', ...mainMenuKeyboard() }
      );
    }
  };

  try {
    await wa.connect();
  } catch (err) {
    await ctx.reply(`❌ Gagal memulai koneksi: ${err.message}`);
  }
});

// ─── Putuskan WA ───────────────────────────────────────────────────────────
bot.hears('❌ Putuskan WA', adminOnly, async (ctx) => {
  if (!wa.isConnected) {
    return ctx.reply('ℹ️ WhatsApp tidak sedang terhubung.', mainMenuKeyboard());
  }

  await wa.disconnect();
  groupsCache = [];
  await ctx.reply('🔌 WhatsApp berhasil diputuskan.', mainMenuKeyboard());
});

// ─── Status WA ─────────────────────────────────────────────────────────────
bot.hears('📊 Status WhatsApp', adminOnly, async (ctx) => {
  const status = wa.isConnected
    ? '🟢 *Terhubung*\nWhatsApp aktif dan siap digunakan.'
    : '🔴 *Tidak Terhubung*\nGunakan tombol *🔌 Hubungkan WA* untuk memulai.';

  await ctx.reply(`📊 *Status WhatsApp*\n\n${status}`, {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
  });
});

// ─── Daftar Grup ───────────────────────────────────────────────────────────
bot.hears('📋 Daftar Grup', adminOnly, async (ctx) => {
  if (!(await requireWA(ctx))) return;

  const loadMsg = await ctx.reply('⏳ Memuat daftar grup...');

  try {
    const groups = await fetchGroups(true);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});

    if (!groups.length) {
      return ctx.reply('ℹ️ Tidak ada grup yang ditemukan.', mainMenuKeyboard());
    }

    const { keyboard, totalPages } = groupListKeyboard(groups, 0);
    await ctx.reply(
      `📋 *Daftar Grup WhatsApp*\n\n` +
        `Total: ${groups.length} grup\n` +
        `Pilih grup untuk melihat permintaan ACC:`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  } catch (err) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
    await ctx.reply(`❌ Gagal memuat grup: ${err.message}`);
  }
});

// ─── Callback: show_groups ─────────────────────────────────────────────────
bot.action('show_groups', adminOnly, async (ctx) => {
  await ctx.answerCbQuery();
  if (!(await requireWA(ctx))) return;

  try {
    const groups = await fetchGroups();
    if (!groups.length) return ctx.editMessageText('ℹ️ Tidak ada grup ditemukan.');

    const state = getState(ctx.from.id);
    const page = state.groupPage || 0;
    const { keyboard } = groupListKeyboard(groups, page);

    await ctx.editMessageText(
      `📋 *Daftar Grup WhatsApp*\n\nTotal: ${groups.length} grup\nPilih grup untuk melihat permintaan ACC:`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  } catch (err) {
    await ctx.editMessageText(`❌ Error: ${err.message}`);
  }
});

// ─── Callback: group_page ──────────────────────────────────────────────────
bot.action(/^group_page:(\d+)$/, adminOnly, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  try {
    const groups = await fetchGroups();
    setState(ctx.from.id, { groupPage: page });
    const { keyboard } = groupListKeyboard(groups, page);

    await ctx.editMessageText(
      `📋 *Daftar Grup WhatsApp*\n\nTotal: ${groups.length} grup\nPilih grup:`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  } catch (err) {
    await ctx.answerCbQuery('❌ Gagal memuat halaman');
  }
});

// ─── Callback: select_group ────────────────────────────────────────────────
bot.action(/^select_group:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery('⏳ Memuat info grup...');

  try {
    const [groups, pending] = await Promise.all([
      fetchGroups(),
      wa.getGroupPendingMembers(groupId),
    ]);

    const group = findGroup(groupId) || { name: groupId, participantCount: '?' };

    setState(ctx.from.id, {
      state: STATE.GROUP_SELECTED,
      selectedGroupId: groupId,
      selectedGroupName: group.name,
      pendingCount: pending.length,
      selectedJids: [],
    });

    const pendingText =
      pending.length > 0
        ? `📨 *${pending.length} anggota* menunggu persetujuan`
        : `✅ Tidak ada anggota yang menunggu persetujuan`;

    const text =
      `📌 *${group.name}*\n\n` +
      `👥 Total anggota: ${group.participantCount}\n` +
      `${pendingText}\n\n` +
      (pending.length > 0
        ? `Pilih aksi di bawah:`
        : `Semua anggota sudah disetujui.`);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...(pending.length > 0 ? groupActionKeyboard(groupId) : {
        reply_markup: { inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: `refresh_group:${groupId}` }],
          [{ text: '🔙 Daftar Grup', callback_data: 'show_groups' }],
        ]},
      }),
    });
  } catch (err) {
    await ctx.editMessageText(`❌ Gagal memuat grup: ${err.message}`);
  }
});

// ─── Callback: refresh_group ──────────────────────────────────────────────
bot.action(/^refresh_group:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery('🔄 Memperbarui...');
  ctx.match[1] = groupId;

  // Reuse select_group logic
  try {
    const [groups, pending] = await Promise.all([
      fetchGroups(true),
      wa.getGroupPendingMembers(groupId),
    ]);
    const group = findGroup(groupId) || { name: groupId, participantCount: '?' };

    const pendingText =
      pending.length > 0
        ? `📨 *${pending.length} anggota* menunggu persetujuan`
        : `✅ Tidak ada anggota yang menunggu persetujuan`;

    const text =
      `📌 *${group.name}*\n\n` +
      `👥 Total anggota: ${group.participantCount}\n` +
      `${pendingText}\n\n` +
      (pending.length > 0 ? `Pilih aksi di bawah:` : `Semua anggota sudah disetujui.`);

    setState(ctx.from.id, {
      selectedGroupId: groupId,
      selectedGroupName: group.name,
      pendingCount: pending.length,
    });

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...(pending.length > 0 ? groupActionKeyboard(groupId) : {
        reply_markup: { inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: `refresh_group:${groupId}` }],
          [{ text: '🔙 Daftar Grup', callback_data: 'show_groups' }],
        ]},
      }),
    });
  } catch (err) {
    await ctx.answerCbQuery('❌ Gagal refresh');
  }
});

// ─── Callback: acc_all ─────────────────────────────────────────────────────
bot.action(/^acc_all:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery();

  const state = getState(ctx.from.id);
  const groupName = state.selectedGroupName || groupId;
  const pendingCount = state.pendingCount || '?';

  await ctx.editMessageText(
    `⚠️ *Konfirmasi ACC Semua*\n\n` +
      `Grup: *${groupName}*\n` +
      `Jumlah: *${pendingCount} anggota*\n\n` +
      `Apakah kamu yakin ingin menyetujui semua permintaan bergabung?`,
    { parse_mode: 'Markdown', ...confirmKeyboard(groupId, 'acc_all') }
  );
});

// ─── Callback: do_acc_all ─────────────────────────────────────────────────
bot.action(/^do_acc_all:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery('⏳ Memproses...');

  const state = getState(ctx.from.id);

  await ctx.editMessageText('⏳ Sedang memproses ACC semua anggota...\nMohon tunggu.');

  try {
    const result = await wa.approveAll(groupId);

    await ctx.editMessageText(
      `✅ *ACC Selesai!*\n\n` +
        `Grup: *${state.selectedGroupName || groupId}*\n` +
        `✔️ Berhasil disetujui: *${result.approved}*\n` +
        (result.failed ? `❌ Gagal: *${result.failed}*\n` : '') +
        `\nTotal diproses: ${result.total}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Cek Lagi', callback_data: `select_group:${groupId}` }],
            [{ text: '🔙 Daftar Grup', callback_data: 'show_groups' }],
          ],
        },
      }
    );
  } catch (err) {
    await ctx.editMessageText(
      `❌ Gagal melakukan ACC: ${err.message}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `select_group:${groupId}` }]],
        },
      }
    );
  }
});

// ─── Callback: acc_partial ────────────────────────────────────────────────
bot.action(/^acc_partial:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery('⏳ Memuat daftar anggota...');

  try {
    const pending = await wa.getGroupPendingMembers(groupId);

    if (!pending.length) {
      return ctx.editMessageText('✅ Tidak ada anggota yang menunggu persetujuan.', {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `select_group:${groupId}` }]],
        },
      });
    }

    setState(ctx.from.id, {
      state: STATE.PARTIAL_ACC,
      selectedGroupId: groupId,
      partialPending: pending,
      selectedJids: [],
    });

    await ctx.editMessageText(
      `☑️ *Pilih Anggota untuk di-ACC*\n\n` +
        `Grup: *${getState(ctx.from.id).selectedGroupName || groupId}*\n` +
        `Total menunggu: ${pending.length} anggota\n\n` +
        `Ketuk nama untuk memilih/membatalkan pilihan:`,
      {
        parse_mode: 'Markdown',
        ...partialAccKeyboard(pending, groupId, []),
      }
    );
  } catch (err) {
    await ctx.editMessageText(`❌ Error: ${err.message}`);
  }
});

// ─── Callback: toggle_member ──────────────────────────────────────────────
bot.action(/^toggle_member:(.+)$/, adminOnly, async (ctx) => {
  const jid = ctx.match[1];
  await ctx.answerCbQuery();

  const state = getState(ctx.from.id);
  if (state.state !== STATE.PARTIAL_ACC) return;

  let selected = [...(state.selectedJids || [])];
  const idx = selected.indexOf(jid);

  if (idx === -1) {
    selected.push(jid);
  } else {
    selected.splice(idx, 1);
  }

  setState(ctx.from.id, { selectedJids: selected });

  const groupId = state.selectedGroupId;
  const pending = state.partialPending || [];

  await ctx.editMessageText(
    `☑️ *Pilih Anggota untuk di-ACC*\n\n` +
      `Grup: *${state.selectedGroupName || groupId}*\n` +
      `Terpilih: *${selected.length}* dari ${pending.length} anggota\n\n` +
      `Ketuk nama untuk memilih/membatalkan:`,
    {
      parse_mode: 'Markdown',
      ...partialAccKeyboard(pending, groupId, selected),
    }
  ).catch(() => {}); // ignore "message not modified"
});

// ─── Callback: confirm_partial ────────────────────────────────────────────
bot.action(/^confirm_partial:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery();

  const state = getState(ctx.from.id);
  const selected = state.selectedJids || [];

  if (!selected.length) {
    return ctx.answerCbQuery('⚠️ Belum ada anggota yang dipilih!', { show_alert: true });
  }

  await ctx.editMessageText(
    `⚠️ *Konfirmasi ACC Sebagian*\n\n` +
      `Grup: *${state.selectedGroupName || groupId}*\n` +
      `Akan di-ACC: *${selected.length} anggota*\n\n` +
      `Lanjutkan?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `✅ Ya, ACC ${selected.length} Anggota`, callback_data: `do_acc_partial:${groupId}` },
          ],
          [{ text: '❌ Batal', callback_data: `acc_partial:${groupId}` }],
        ],
      },
    }
  );
});

// ─── Callback: do_acc_partial ─────────────────────────────────────────────
bot.action(/^do_acc_partial:(.+)$/, adminOnly, async (ctx) => {
  const groupId = ctx.match[1];
  await ctx.answerCbQuery('⏳ Memproses...');

  const state = getState(ctx.from.id);
  const jids = state.selectedJids || [];

  if (!jids.length) return ctx.answerCbQuery('⚠️ Tidak ada yang dipilih', { show_alert: true });

  await ctx.editMessageText('⏳ Sedang memproses ACC anggota terpilih...');

  try {
    const result = await wa.approveSelected(groupId, jids);

    setState(ctx.from.id, { selectedJids: [], state: STATE.GROUP_SELECTED });

    await ctx.editMessageText(
      `✅ *ACC Sebagian Selesai!*\n\n` +
        `Grup: *${state.selectedGroupName || groupId}*\n` +
        `✔️ Berhasil disetujui: *${result.approved}*\n` +
        (result.failed ? `❌ Gagal: *${result.failed}*\n` : ''),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Cek Lagi', callback_data: `select_group:${groupId}` }],
            [{ text: '🔙 Daftar Grup', callback_data: 'show_groups' }],
          ],
        },
      }
    );
  } catch (err) {
    await ctx.editMessageText(`❌ Gagal: ${err.message}`, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `select_group:${groupId}` }]],
      },
    });
  }
});

// ─── Callback: main_menu ──────────────────────────────────────────────────
bot.action('main_menu', adminOnly, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🏠 Kembali ke menu utama', mainMenuKeyboard());
});

// ─── Error handler ─────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(`[Bot Error] ${ctx.updateType}:`, err);
  ctx.reply('❌ Terjadi kesalahan. Coba lagi atau hubungi developer.').catch(() => {});
});

module.exports = bot;
