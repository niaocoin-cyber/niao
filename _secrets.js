// 加密的 Twitter API 凭证模块
// 多层混淆：XOR + Base64 + 顺序打乱
// 由 build-secrets.js 自动生成，请勿手动修改

const _xorKey = Buffer.from('xtdZwOGwRtfuUYtVzJfx0A==', 'base64').toString('binary');

const _idChunks = ["i5Aq","tz3a","2y66","urL4","gbqn","Y4HD","Fu8Y","C5S3","lqbI","n6Lk","F6O5","hg=="];
const _idMapping = [0,8,7,1,10,9,3,6,4,5,2,11];

const _secretChunks = ["o6I=","gbOH","iuI2","jMzv","GMw+","vhuu","jGm+","Z5qi","3gel","0pyV","mcO7","ph2W","g7Sx","1vkh","dI6+","GeO2","74cy"];
const _secretMapping = [16,10,0,1,3,11,8,9,7,15,4,14,5,12,6,2,13];

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
