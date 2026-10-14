// planda: görselden plan kaydı çıkaran sunucu fonksiyonu.
// Anahtar (ANTHROPIC_API_KEY) ve erişim kodu (ACCESS_CODE) yalnızca Netlify ortam
// değişkenlerinde durur; tarayıcıya hiçbir zaman gönderilmez.
const crypto = require('crypto');

const MODEL = 'claude-haiku-5-5';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64_CHARS = 4.5 * 1024 * 1024;

function reply(status, obj) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj),
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function promptFor(today) {
  let dn = '';
  try {
    dn = new Date(today + 'T12:00:00Z').toLocaleDateString('tr-TR', { weekday: 'long', timeZone: 'Europe/Istanbul' });
  } catch (e) {}
  return (
    'Bu ekran görüntüsü Türkçe bir ders, ödev, sınav, etkinlik (konser, seminer vb.) ya da başka bir plan hakkında olabilir. ' +
    'Görselde yazanı oku. SADECE görselde açıkça yazan bilgiyi kullan; tahmin etme, uydurma.\n' +
    'Bugünün tarihi: ' + today + (dn ? ' (' + dn + ')' : '') + '. Görselde yıl yoksa bugüne en yakın gelecek tarihi seç. Tarih hiç yoksa null yaz.\n' +
    'Yanıtın yalnızca şu JSON nesnesi olsun, başka metin yazma:\n' +
    '{"baslik": "kısa başlık (ders adı + ödev, etkinlik adı vb.)", "tur": "odev" | "sinav" | "hedef" | "is" | "not", ' +
    '"tarih": "YYYY-MM-DD" veya null, "saat": "HH:MM" veya null, "yer": "salon, adres veya bağlantı" veya null, ' +
    '"detay": "teslim koşulu, bilet veya fiyat gibi kısa not" veya null, "yildizli": true veya false}\n' +
    'Ödev için "odev", sınav için "sinav" kullan; diğer her şey için "not".'
  );
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return reply(405, { code: 'method' });

  const expectedCode = process.env.ACCESS_CODE;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!expectedCode || !apiKey) return reply(500, { code: 'not_configured' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return reply(400, { code: 'bad_request' });
  }

  if (typeof body.code !== 'string' || !safeEqual(body.code, expectedCode)) {
    return reply(401, { code: 'bad_code' });
  }

  const img = body.image || {};
  if (!ALLOWED_TYPES.includes(img.media_type)) return reply(415, { code: 'bad_type' });
  if (typeof img.data !== 'string' || !img.data) return reply(400, { code: 'bad_request' });
  if (img.data.length > MAX_BASE64_CHARS) return reply(413, { code: 'too_large' });

  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today || '')
    ? body.today
    : new Date().toISOString().slice(0, 10);

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
            { type: 'text', text: promptFor(today) },
          ],
        }],
      }),
    });
  } catch (e) {
    return reply(502, { code: 'upstream' });
  }
  if (!res.ok) return reply(502, { code: 'upstream' });

  const data = await res.json().catch(() => null);
  const text = ((data && data.content) || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return reply(502, { code: 'invalid_json' });

  try {
    return reply(200, JSON.parse(text.slice(start, end + 1)));
  } catch (e) {
    return reply(502, { code: 'invalid_json' });
  }
};
