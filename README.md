# 🤖 WA ACC Bot

Bot Telegram untuk menyetujui (ACC) permintaan bergabung ke grup WhatsApp secara mudah dan cepat.

## ✨ Fitur

- 📋 **Daftar Grup** — Tampilkan semua grup WA yang kamu ikuti
- 📨 **Cek Pending** — Lihat jumlah anggota yang menunggu persetujuan per grup
- ✅ **ACC Semua** — Setujui semua permintaan bergabung sekaligus
- ☑️ **ACC Sebagian** — Pilih anggota tertentu untuk disetujui
- 🔌 **Scan QR** — Hubungkan WhatsApp via QR Code di Telegram
- 🛡️ **Admin Only** — Hanya admin yang terdaftar yang bisa menggunakan bot

---

## 🚀 Cara Deploy di Railway

### 1. Persiapan

**Buat Bot Telegram:**
1. Chat [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot` dan ikuti instruksinya
3. Simpan **Bot Token** yang diberikan

**Cek Telegram ID kamu:**
1. Chat [@userinfobot](https://t.me/userinfobot)
2. Catat **ID** yang ditampilkan (misal: `123456789`)

### 2. Deploy ke Railway

1. **Fork/Upload** proyek ini ke GitHub
2. Buka [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Pilih repository ini
4. Buka tab **Variables** dan tambahkan:

| Variable | Nilai | Keterangan |
|----------|-------|------------|
| `TELEGRAM_BOT_TOKEN` | `1234567890:ABCdef...` | Token dari BotFather |
| `ADMIN_IDS` | `123456789` | ID Telegram admin (pisah koma jika >1) |

5. Klik **Deploy** — selesai!

### 3. Hubungkan WhatsApp

1. Buka bot kamu di Telegram
2. Kirim `/start`
3. Ketuk **🔌 Hubungkan WA**
4. Scan QR Code yang muncul dengan WhatsApp HP kamu
5. Bot siap digunakan!

---

## 📱 Cara Pakai

```
/start → Tampilkan menu utama

📋 Daftar Grup
   └─ Pilih grup
      ├─ Tampil: jumlah anggota pending
      ├─ ✅ ACC Semua → Konfirmasi → Proses
      └─ ☑️ ACC Sebagian → Pilih anggota → Konfirmasi → Proses
```

---

## ⚙️ Konfigurasi Environment

Salin `.env.example` ke `.env` untuk development lokal:

```bash
cp .env.example .env
```

Isi nilainya:

```env
TELEGRAM_BOT_TOKEN=your_token_here
ADMIN_IDS=123456789,987654321
```

---

## 🛠️ Development Lokal

```bash
# Install dependencies
npm install

# Jalankan (development)
npm run dev

# Jalankan (production)
npm start
```

---

## 📁 Struktur Proyek

```
wa-acc-bot/
├── src/
│   ├── index.js        # Entry point + health server
│   ├── bot.js          # Semua handler Telegram
│   ├── whatsapp.js     # Koneksi & operasi WhatsApp
│   ├── keyboards.js    # Inline keyboard helper
│   ├── session.js      # State per user
│   ├── middleware.js   # Auth admin
│   └── qrHelper.js     # Generate QR image
├── .env.example
├── .gitignore
├── railway.toml
└── package.json
```

---

## ⚠️ Catatan Penting

- **Sesi WA** disimpan di folder `wa_session/`. Di Railway, sesi akan hilang saat redeploy — kamu perlu scan QR ulang. Untuk sesi permanen, gunakan Railway Volume atau database.
- **Grup harus punya fitur "Approval"** aktif di pengaturan grup WhatsApp agar bot bisa ACC anggota.
- Bot ini menggunakan library **Baileys** (unofficial WA API). Gunakan dengan bijak.

---

## 📝 Lisensi

MIT — bebas digunakan dan dimodifikasi.
