const crypto = require('crypto');

const TWITTER_CLIENT_ID = "MGszSHQtWGdMZ19Od3RTVkhmYlQ6MTpjaQ";
const TWITTER_CLIENT_SECRET = "L5oL-__4XIGkUTJSrf-N_nArb852V5pcAiBn7Ig8ic-HZEmEeu";

const xorKey = crypto.randomBytes(16).toString('binary');
console.log("XOR Key (binary):", JSON.stringify(xorKey));

function encrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function obfuscate(text, key) {
  const encrypted = encrypt(text, key);
  const b64 = Buffer.from(encrypted, 'binary').toString('base64');
  const chunks = [];
  for (let i = 0; i < b64.length; i += 4) {
    chunks.push(b64.substring(i, i + 4));
  }
  const indices = chunks.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffled = new Array(chunks.length);
  const mapping = [];
  for (let newIdx = 0; newIdx < chunks.length; newIdx++) {
    const origIdx = indices[newIdx];
    shuffled[newIdx] = chunks[origIdx];
    mapping.push(origIdx);
  }
  return { chunks: shuffled, mapping };
}

function deobfuscate(chunks, mapping, key) {
  const ordered = new Array(chunks.length);
  for (let newIdx = 0; newIdx < chunks.length; newIdx++) {
    ordered[mapping[newIdx]] = chunks[newIdx];
  }
  const b64 = ordered.join('');
  const encrypted = Buffer.from(b64, 'base64').toString('binary');
  return encrypt(encrypted, key);
}

const idData = obfuscate(TWITTER_CLIENT_ID, xorKey);
const secretData = obfuscate(TWITTER_CLIENT_SECRET, xorKey);

const verifyId = deobfuscate(idData.chunks, idData.mapping, xorKey);
const verifySecret = deobfuscate(secretData.chunks, secretData.mapping, xorKey);
console.log("Verify ID:", verifyId === TWITTER_CLIENT_ID);
console.log("Verify Secret:", verifySecret === TWITTER_CLIENT_SECRET);

const fs = require('fs');
const keyBase64 = Buffer.from(xorKey, 'binary').toString('base64');
const code = `// 加密的 Twitter API 凭证模块
// 多层混淆：XOR + Base64 + 顺序打乱
// 由 build-secrets.js 自动生成，请勿手动修改

const _xorKey = Buffer.from('${keyBase64}', 'base64').toString('binary');

const _idChunks = ${JSON.stringify(idData.chunks)};
const _idMapping = ${JSON.stringify(idData.mapping)};

const _secretChunks = ${JSON.stringify(secretData.chunks)};
const _secretMapping = ${JSON.stringify(secretData.mapping)};

function _xor(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function _decode(chunks, mapping, key) {
  const ordered = new Array(chunks.length);
  for (let newIdx = 0; newIdx < chunks.length; newIdx++) {
    ordered[mapping[newIdx]] = chunks[newIdx];
  }
  const b64 = ordered.join('');
  const encrypted = Buffer.from(b64, 'base64').toString('binary');
  return _xor(encrypted, key);
}

let _cached = null;
function _getSecrets() {
  if (_cached) return _cached;
  _cached = {
    TWITTER_CLIENT_ID: _decode(_idChunks, _idMapping, _xorKey),
    TWITTER_CLIENT_SECRET: _decode(_secretChunks, _secretMapping, _xorKey)
  };
  return _cached;
}

module.exports = _getSecrets();
`;

fs.writeFileSync('_secrets.js', code);
console.log("\n✅ Generated _secrets.js");
console.log("File size:", fs.statSync('_secrets.js').size, "bytes");
