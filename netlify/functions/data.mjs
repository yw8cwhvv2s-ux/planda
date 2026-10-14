// planda: kullanıcının plan verisini okur ve kaydeder
import { dataStore, accountsStore, sessionUser, reply, COLS } from '../shared/accounts.mjs';

const MAX_CHARS = 2000000;

export const handler = async (event) => {
  const username = await sessionUser(accountsStore(), event);
  if (!username) return reply(401, { error: 'Oturum yok ya da sona erdi' });
  const st = dataStore();
  const key = 'data/' + username;

  if (event.httpMethod === 'GET') {
    const rec = (await st.get(key, { type: 'json' })) || { rev: 0, data: {} };
    return reply(200, { rev: rec.rev, data: rec.data });
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'Geçersiz istek' }); }
    const clean = {};
    COLS.forEach((c) => {
      const v = body.data && body.data[c];
      clean[c] = v && typeof v === 'object' ? v : {};
    });
    if (JSON.stringify(clean).length > MAX_CHARS) return reply(413, { error: 'Plan çok büyük' });
    const cur = (await st.get(key, { type: 'json' })) || { rev: 0, data: {} };
    if (Number(body.baseRev) !== cur.rev) {
      return reply(409, { error: 'Başka bir cihazdan değişiklik geldi', rev: cur.rev });
    }
    const next = { rev: cur.rev + 1, data: clean };
    await st.setJSON(key, next);
    return reply(200, { rev: next.rev });
  }

  return reply(405, { error: 'Yalnızca GET ya da PUT' });
};
