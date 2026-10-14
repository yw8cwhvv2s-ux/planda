// planda: kayıt, giriş, şifre yenileme ve çıkış
import {
  accountsStore, reply, sha256, makeSecret, checkSecret, DUMMY_SALT, ITER,
  newCode, normCode, USER_RE, SESSION_DAYS, MAX_FAILS, LOCK_MS, bearer,
} from '../shared/accounts.mjs';
import { randomBytes } from 'node:crypto';

async function newSession(st, username, user) {
  const token = randomBytes(32).toString('base64url');
  await st.setJSON('session/' + sha256(token), {
    user: username, sv: user.sv || 0, exp: Date.now() + SESSION_DAYS * 864e5,
  });
  return token;
}

async function register(st, body) {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!USER_RE.test(username)) {
    return reply(400, { error: 'Kullanıcı adı 3-20 karakter olmalı: küçük harf, rakam ya da _' });
  }
  if (password.length < 8 || password.length > 200) {
    return reply(400, { error: 'Şifre en az 8 karakter olmalı' });
  }
  if (await st.get('user/' + username, { type: 'json' })) {
    return reply(409, { error: 'Bu kullanıcı adı alınmış' });
  }
  const code = newCode();
  const user = {
    v: 1,
    ...(await makeSecret(password)),
    recovery: await makeSecret(normCode(code)),
    sv: 0, fails: 0, lockUntil: 0, createdAt: Date.now(),
  };
  await st.setJSON('user/' + username, user);
  const token = await newSession(st, username, user);
  return reply(200, { token, username, recoveryCode: code });
}

async function registerFail(st, username, user) {
  user.fails = (user.fails || 0) + 1;
  if (user.fails >= MAX_FAILS) { user.lockUntil = Date.now() + LOCK_MS; user.fails = 0; }
  await st.setJSON('user/' + username, user);
}

async function login(st, body) {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const user = username ? await st.get('user/' + username, { type: 'json' }) : null;
  if (!user) {
    await checkSecret(password, { salt: DUMMY_SALT, hash: '', iter: ITER });
    return reply(401, { error: 'Kullanıcı adı ya da şifre hatalı' });
  }
  if (user.lockUntil > Date.now()) {
    return reply(429, { error: 'Çok fazla yanlış deneme yapıldı. Birkaç dakika sonra tekrar dene.' });
  }
  if (!(await checkSecret(password, user))) {
    await registerFail(st, username, user);
    return reply(401, { error: 'Kullanıcı adı ya da şifre hatalı' });
  }
  user.fails = 0; user.lockUntil = 0;
  await st.setJSON('user/' + username, user);
  const token = await newSession(st, username, user);
  return reply(200, { token, username });
}

async function reset(st, body) {
  const username = String(body.username || '').trim().toLowerCase();
  const code = normCode(body.recoveryCode);
  const newPassword = String(body.newPassword || '');
  const user = username ? await st.get('user/' + username, { type: 'json' }) : null;
  if (!user) {
    await checkSecret(code, { salt: DUMMY_SALT, hash: '', iter: ITER });
    return reply(401, { error: 'Kullanıcı adı ya da kurtarma kodu hatalı' });
  }
  if (user.lockUntil > Date.now()) {
    return reply(429, { error: 'Çok fazla yanlış deneme yapıldı. Birkaç dakika sonra tekrar dene.' });
  }
  if (newPassword.length < 8 || newPassword.length > 200) {
    return reply(400, { error: 'Yeni şifre en az 8 karakter olmalı' });
  }
  if (!(await checkSecret(code, user.recovery))) {
    await registerFail(st, username, user);
    return reply(401, { error: 'Kullanıcı adı ya da kurtarma kodu hatalı' });
  }
  const nextCode = newCode();
  Object.assign(user, await makeSecret(newPassword));
  user.recovery = await makeSecret(normCode(nextCode));
  user.sv = (user.sv || 0) + 1; // eski oturumların hepsini geçersiz kılar
  user.fails = 0; user.lockUntil = 0;
  await st.setJSON('user/' + username, user);
  const token = await newSession(st, username, user);
  return reply(200, { token, username, recoveryCode: nextCode });
}

async function logout(st, event) {
  const t = bearer(event);
  if (t) await st.delete('session/' + sha256(t));
  return reply(200, { ok: true });
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Yalnızca POST' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'Geçersiz istek' }); }
  const st = accountsStore();
  try {
    if (body.action === 'register') return await register(st, body);
    if (body.action === 'login') return await login(st, body);
    if (body.action === 'reset') return await reset(st, body);
    if (body.action === 'logout') return await logout(st, event);
    return reply(400, { error: 'Bilinmeyen işlem' });
  } catch (e) {
    return reply(500, { error: 'Sunucu hatası, tekrar dene' });
  }
};
