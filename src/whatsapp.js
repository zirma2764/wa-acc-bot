const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

class WhatsAppClient {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.qrCode = null;
    this.onQR = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.pendingMembers = new Map(); // groupId -> [jid list]
    this.sessionPath = path.join(process.cwd(), 'wa_session');
  }

  async connect() {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: ['WA ACC Bot', 'Chrome', '120.0.0'],
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        if (this.onQR) this.onQR(qr);
      }

      if (connection === 'close') {
        this.isConnected = false;
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom
            ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
            : true;

        console.log('Koneksi WA terputus, alasan:', lastDisconnect?.error?.message);

        if (shouldReconnect) {
          console.log('Mencoba reconnect...');
          setTimeout(() => this.connect(), 5000);
        } else {
          console.log('Logged out dari WhatsApp');
          // Hapus sesi jika logout
          if (fs.existsSync(this.sessionPath)) {
            fs.rmSync(this.sessionPath, { recursive: true, force: true });
          }
          if (this.onDisconnected) this.onDisconnected('logged_out');
        }
      }

      if (connection === 'open') {
        this.isConnected = true;
        this.qrCode = null;
        console.log('WhatsApp terhubung!');
        if (this.onConnected) this.onConnected();
      }
    });

    // Pantau anggota grup yang pending (join request)
    this.sock.ev.on('group-participants.update', async (update) => {
      const { id: groupId, participants, action } = update;
      if (action === 'add') {
        console.log(`[WA] Anggota baru ditambahkan ke grup ${groupId}:`, participants);
      }
    });
  }

  async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.isConnected = false;
    }
  }

  async getGroups() {
    if (!this.isConnected || !this.sock) throw new Error('WhatsApp belum terhubung');
    
    const groups = await this.sock.groupFetchAllParticipating();
    return Object.values(groups).map((g) => ({
      id: g.id,
      name: g.subject,
      participantCount: g.participants?.length || 0,
      desc: g.desc || '',
    }));
  }

  async getGroupPendingMembers(groupId) {
    if (!this.isConnected || !this.sock) throw new Error('WhatsApp belum terhubung');

    try {
      const result = await this.sock.groupRequestParticipantsList(groupId);
      return result || [];
    } catch (err) {
      console.error('Error getGroupPendingMembers:', err.message);
      return [];
    }
  }

  async approveAll(groupId) {
    if (!this.isConnected || !this.sock) throw new Error('WhatsApp belum terhubung');

    const pending = await this.getGroupPendingMembers(groupId);
    if (!pending.length) return { approved: 0, failed: 0 };

    const jids = pending.map((p) => p.jid);
    return await this._approveMembers(groupId, jids);
  }

  async approveSelected(groupId, jids) {
    if (!this.isConnected || !this.sock) throw new Error('WhatsApp belum terhubung');
    return await this._approveMembers(groupId, jids);
  }

  async _approveMembers(groupId, jids) {
    let approved = 0;
    let failed = 0;

    // Proses dalam batch kecil agar tidak di-ban
    const batchSize = 5;
    for (let i = 0; i < jids.length; i += batchSize) {
      const batch = jids.slice(i, i + batchSize);
      try {
        await this.sock.groupRequestParticipantsUpdate(groupId, batch, 'approve');
        approved += batch.length;
        // Delay antar batch
        if (i + batchSize < jids.length) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (err) {
        console.error('Error approving batch:', err.message);
        failed += batch.length;
      }
    }

    return { approved, failed, total: jids.length };
  }

  formatPhone(jid) {
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  }
}

module.exports = new WhatsAppClient();
