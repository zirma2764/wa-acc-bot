const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateQRImage(qrString) {
  const tmpPath = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true });

  const filePath = path.join(tmpPath, `qr_${Date.now()}.png`);

  await QRCode.toFile(filePath, qrString, {
    width: 400,
    margin: 2,
    color: {
      dark: '#128C7E',
      light: '#FFFFFF',
    },
  });

  return filePath;
}

async function cleanupQR(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

module.exports = { generateQRImage, cleanupQR };
