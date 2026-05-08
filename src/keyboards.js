const { Markup } = require('telegraf');

function mainMenuKeyboard() {
  return Markup.keyboard([
    ['📋 Daftar Grup'],
    ['📊 Status WhatsApp'],
    ['🔌 Hubungkan WA', '❌ Putuskan WA'],
  ]).resize();
}

function groupListKeyboard(groups, page = 0) {
  const PAGE_SIZE = 8;
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = groups.slice(start, end);
  const total = groups.length;

  const buttons = slice.map((g, i) =>
    Markup.button.callback(
      `${start + i + 1}. ${g.name.substring(0, 30)}`,
      `select_group:${g.id}`
    )
  );

  // Grid 2 kolom
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  // Navigasi halaman
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️ Sebelumnya', `group_page:${page - 1}`));
  if (end < total) nav.push(Markup.button.callback('Selanjutnya ➡️', `group_page:${page + 1}`));
  if (nav.length) rows.push(nav);

  rows.push([Markup.button.callback('🏠 Kembali ke Menu', 'main_menu')]);

  return {
    keyboard: Markup.inlineKeyboard(rows),
    currentPage: page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

function groupActionKeyboard(groupId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ ACC Semua', `acc_all:${groupId}`),
      Markup.button.callback('☑️ ACC Sebagian', `acc_partial:${groupId}`),
    ],
    [Markup.button.callback('🔄 Refresh', `refresh_group:${groupId}`)],
    [Markup.button.callback('🔙 Daftar Grup', 'show_groups')],
  ]);
}

function partialAccKeyboard(members, groupId, selectedJids = []) {
  const rows = members.map((m) => {
    const isSelected = selectedJids.includes(m.jid);
    const label = `${isSelected ? '✅' : '⬜'} ${m.jid.replace('@s.whatsapp.net', '')}`;
    return [Markup.button.callback(label, `toggle_member:${m.jid}`)];
  });

  const actionRow = [];
  if (selectedJids.length > 0) {
    actionRow.push(
      Markup.button.callback(`✅ ACC Terpilih (${selectedJids.length})`, `confirm_partial:${groupId}`)
    );
  }
  actionRow.push(Markup.button.callback('❌ Batal', `select_group:${groupId}`));

  rows.push(actionRow);

  return Markup.inlineKeyboard(rows);
}

function confirmKeyboard(groupId, action) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ya, Lanjutkan', `do_${action}:${groupId}`),
      Markup.button.callback('❌ Batalkan', `select_group:${groupId}`),
    ],
  ]);
}

module.exports = {
  mainMenuKeyboard,
  groupListKeyboard,
  groupActionKeyboard,
  partialAccKeyboard,
  confirmKeyboard,
};
