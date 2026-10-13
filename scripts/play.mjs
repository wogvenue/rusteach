#!/usr/bin/env node
// Google Play publishing for the Android (Capacitor) build. No extra packages, Node 18+.
// Access comes from a Google Cloud service account key that never enters the repo.
//
//   node scripts/play.mjs check                  access test, version codes per track
//   node scripts/play.mjs next                   next free version code (max over all tracks + 1)
//   node scripts/play.mjs release [notes]        next code -> signed AAB -> upload to PLAY_TRACK
//   node scripts/play.mjs upload <aab> [notes]   upload an already built AAB to PLAY_TRACK
//   node scripts/play.mjs listing [json]         store texts (default store/listing.tr-TR.json)
//   node scripts/play.mjs images                 icon, feature graphic and phone screenshots from store/
//   node scripts/play.mjs promote <from> <to>    copies the live release of one track to another
//   node scripts/play.mjs info                   prints the current store listing
//
// env: PLAY_PACKAGE (com.rusteach.app), PLAY_TRACK (internal), PLAY_KEY_FILE
//      (C:/dev/keys/play-service.json), RUSTEACH_KEY_PROPS (upload key, read by Gradle only)
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { request } from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = process.env.PLAY_PACKAGE || 'com.rusteach.app';
const TRACK = process.env.PLAY_TRACK || 'internal';
const KEY_FILE = process.env.PLAY_KEY_FILE || 'C:/dev/keys/play-service.json';
const LANG = 'tr-TR';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD_API = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
const AAB = path.join(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab');

const b64url = (v) => Buffer.from(v).toString('base64url');

async function accessToken() {
  const key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google girişi başarısız (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

let token;
async function call(method, url, body, headers = {}) {
  const raw = body instanceof Uint8Array;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(UPLOAD_API, '').replace(API, '')} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// fetch gives up after 5 minutes without a response; https.request has no such limit
function uploadFile(url, data) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': data.length } },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () =>
          res.statusCode >= 200 && res.statusCode < 300
            ? resolve(text ? JSON.parse(text) : {})
            : reject(new Error(`POST ${url.replace(UPLOAD_API, '')} -> ${res.statusCode}: ${text}`)),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(10 * 60 * 1000, () => req.destroy(new Error('Yükleme 10 dakikadır ilerlemiyor, vazgeçildi')));
    const step = 1 << 20;
    let sent = 0;
    let shown = 0;
    const pump = () => {
      while (sent < data.length) {
        const chunk = data.subarray(sent, sent + step);
        sent += chunk.length;
        const pct = Math.floor((sent / data.length) * 10) * 10;
        if (pct > shown) console.log(`  %${(shown = pct)} gönderildi`);
        if (!req.write(chunk)) return req.once('drain', pump);
      }
      console.log('  Dosya gitti, Google işliyor...');
      req.end();
    };
    pump();
  });
}

async function withEdit(fn, commit) {
  const edit = await call('POST', `${API}/edits`, {});
  try {
    const result = await fn(edit.id);
    if (commit) await call('POST', `${API}/edits/${edit.id}:commit`);
    else await call('DELETE', `${API}/edits/${edit.id}`);
    return result;
  } catch (e) {
    await call('DELETE', `${API}/edits/${edit.id}`).catch(() => {});
    throw e;
  }
}

async function trackCodes(editId) {
  const { tracks = [] } = await call('GET', `${API}/edits/${editId}/tracks`);
  return tracks.map((t) => ({ track: t.track, codes: (t.releases || []).flatMap((r) => (r.versionCodes || []).map(Number)) }));
}

const nextCode = async () => Math.max(0, ...(await withEdit(trackCodes, false)).flatMap((t) => t.codes)) + 1;

// Gradle needs the Android Studio JDK and a short temp dir (the user profile path has spaces).
function gradle(...args) {
  const tmp = 'C:\\Android\\tmp';
  fs.mkdirSync(tmp, { recursive: true });
  const env = {
    ...process.env,
    JAVA_HOME: process.env.JAVA_HOME || 'C:/Program Files/Android/Android Studio/jbr',
    TMP: tmp,
    TEMP: tmp,
    JAVA_TOOL_OPTIONS: `-Djdk.net.unixdomain.tmpdir=${tmp} -Djava.io.tmpdir=${tmp}`,
  };
  execFileSync('cmd', ['/c', 'gradlew.bat', ...args], { cwd: path.join(ROOT, 'android'), env, stdio: 'inherit' });
}

async function upload(aab, notes) {
  const text = notes.trim() || 'Güncelleme';
  await withEdit(async (editId) => {
    console.log(`AAB yükleniyor (${(fs.statSync(aab).size / 1e6).toFixed(1)} MB)...`);
    const bundle = await uploadFile(`${UPLOAD_API}/edits/${editId}/bundles?uploadType=media`, fs.readFileSync(aab));
    console.log(`Yüklendi, sürüm kodu ${bundle.versionCode}. "${TRACK}" kanalına gönderiliyor...`);
    await call('PUT', `${API}/edits/${editId}/tracks/${TRACK}`, {
      track: TRACK,
      releases: [
        {
          versionCodes: [String(bundle.versionCode)],
          // a draft app (never reviewed) only accepts draft releases
          status: process.env.PLAY_STATUS || 'completed',
          releaseNotes: [{ language: LANG, text: text.slice(0, 500) }],
        },
      ],
    });
  }, true);
  console.log(`Gönderildi: ${TRACK}.`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  token = await accessToken();

  if (cmd === 'check') {
    const tracks = await withEdit(trackCodes, false);
    for (const t of tracks) console.log(`${t.track}: ${t.codes.join(', ') || '(boş)'}`);
    console.log(`Erişim tamam (${PACKAGE}).`);
  } else if (cmd === 'next') {
    console.log(await nextCode());
  } else if (cmd === 'release') {
    const code = await nextCode();
    console.log(`Sürüm kodu: ${code}`);
    execFileSync('npm', ['run', 'android:sync'], { cwd: ROOT, stdio: 'inherit', shell: true });
    gradle('bundleRelease', `-PversionCode=${code}`, '--console=plain', '-q');
    await upload(AAB, rest.join(' '));
  } else if (cmd === 'upload' && rest[0]) {
    await upload(rest[0], rest.slice(1).join(' '));
  } else if (cmd === 'listing') {
    const listing = JSON.parse(fs.readFileSync(rest[0] || path.join(ROOT, 'store/listing.tr-TR.json'), 'utf8'));
    await withEdit(async (editId) => {
      const { contactEmail, contactWebsite, defaultLanguage, ...texts } = listing;
      await call('PUT', `${API}/edits/${editId}/listings/${texts.language}`, texts);
      if (contactEmail || contactWebsite || defaultLanguage) {
        await call('PATCH', `${API}/edits/${editId}/details`, { contactEmail, contactWebsite, defaultLanguage });
      }
    }, true);
    console.log('Mağaza metni güncellendi.');
  } else if (cmd === 'images') {
    const store = path.join(ROOT, 'store');
    const shots = fs.readdirSync(path.join(store, 'screenshots')).filter((f) => f.endsWith('.png')).sort();
    const sets = {
      icon: [path.join(store, 'icon-512.png')],
      featureGraphic: [path.join(store, 'feature-graphic.png')],
      phoneScreenshots: shots.map((f) => path.join(store, 'screenshots', f)),
    };
    await withEdit(async (editId) => {
      for (const [type, files] of Object.entries(sets)) {
        const base = `${API}/edits/${editId}/listings/${LANG}/${type}`;
        await call('DELETE', base);
        for (const file of files) {
          await call('POST', `${UPLOAD_API}/edits/${editId}/listings/${LANG}/${type}?uploadType=media`, new Uint8Array(fs.readFileSync(file)), {
            'Content-Type': 'image/png',
          });
          console.log(`${type}: ${path.basename(file)}`);
        }
      }
    }, true);
    console.log('Görseller güncellendi.');
  } else if (cmd === 'promote' && rest[0] && rest[1]) {
    const [from, to] = rest;
    await withEdit(async (editId) => {
      const src = await call('GET', `${API}/edits/${editId}/tracks/${from}`);
      const release = (src.releases || []).find((r) => r.status === 'completed');
      if (!release) throw new Error(`"${from}" kanalında yayında sürüm yok.`);
      console.log(`Sürüm kodu ${release.versionCodes.join(', ')}: ${from} -> ${to}`);
      await call('PUT', `${API}/edits/${editId}/tracks/${to}`, {
        track: to,
        releases: [{ versionCodes: release.versionCodes, status: 'completed', ...(release.releaseNotes ? { releaseNotes: release.releaseNotes } : {}) }],
      });
    }, true);
    console.log('Tamam.');
  } else if (cmd === 'info') {
    await withEdit(async (editId) => {
      console.log('Ayrıntılar:', JSON.stringify(await call('GET', `${API}/edits/${editId}/details`)));
      const { listings = [] } = await call('GET', `${API}/edits/${editId}/listings`);
      for (const l of listings) console.log(`${l.language}:`, JSON.stringify(l));
      for (const type of ['icon', 'featureGraphic', 'phoneScreenshots']) {
        const { images = [] } = await call('GET', `${API}/edits/${editId}/listings/${LANG}/${type}`);
        console.log(`${type}: ${images.length} görsel`);
      }
    }, false);
  } else {
    console.log('Kullanım: node scripts/play.mjs check | next | release [notlar] | upload <aab> [notlar] | listing [json] | images | promote <kaynak> <hedef> | info');
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e.message, e.cause ? `(${e.cause.code ?? ''} ${e.cause.message ?? e.cause})` : '');
  process.exit(1);
});
