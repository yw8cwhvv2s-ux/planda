// planda: hesap ve veri depolama yardımcıları (Netlify Blobs)
import { getStore } from '@netlify/blobs';
import { pbkdf2, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

export const ITER = 200000;
export const SESSION_DAYS = 30;
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const USER_RE = /^[a-z0-9_]{3,20}$/;
export const COLS = ['entries', 'courses', 'ideas', 'notebooks', 'notes', 'settings'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pbkdf2P = promisify(pbkdf2);

// Testler için depoları dışarıdan verebilmek amacıyla
let overrides = null;
export function __setStores(o) { overrides = o; }
export function accountsStore() {
  return overrides ? overrides.accounts : getStore({ name: 'planda-accounts', consistency: 'strong' });
}
export function dataStore() {
  return overrides ? overrides.data : getStore({ name: 'planda-data', consistency: 'strong' });
}

export function reply(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export function sha256(s) { return createHash('sha256').update(s).digest('hex'); }

async function hashSecret(secret, saltB64, iter) {
  const key = await pbkdf2P(String(secret), Buffer.from(saltB64, 'base64'), iter, 32, 'sha256');
  return key.toString('base64');
}

export async function makeSecret(secret) {
  const saltB64 = randomBytes(16).toString('base64');
  return { salt: saltB64, hash: await hashSecret(secret, saltB64, ITER), iter: ITER };
}

export async function checkSecret(secret, rec) {
  const h = Buffer.from(await hashSecret(secret, rec.salt, rec.iter));
  const x = Buffer.from(rec.hash);
  return h.length === x.length && timingSafeEqual(h, x);
}

// Sahte hesaplama: kullanıcı yokken de aynı süre harcansın diye
export const DUMMY_SALT = Buffer.alloc(16).toString('base64');

export function newCode() {
  const b = randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s.match(/.{4}/g).join('-');
}

export function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

export function bearer(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

// Geçerli bir oturum varsa kullanıcı adını döndürür, yoksa null
export async function sessionUser(st, event) {
  const t = bearer(event);
  if (!t) return null;
  const s = await st.get('session/' + sha256(t), { type: 'json' });
  if (!s || s.exp < Date.now()) return null;
  const u = await st.get('user/' + s.user, { type: 'json' });
  if (!u || (u.sv || 0) !== (s.sv || 0)) return null;
  return s.user;
}
