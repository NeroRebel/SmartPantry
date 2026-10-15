const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function containsSecret(text) {
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(text) || /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(text)) return true;
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role' || payload.role === 'authenticated') return true;
    } catch { /* Not a decodable credential. */ }
  }
  return false;
}

function runAudit() {
  const root = path.resolve(__dirname, '..');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const findings = [];
  const allowedEnv = new Set(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
  for (const file of fs.readdirSync(root).filter((name) => /^\.env(?:\.|$)/.test(name) && name !== '.env.example')) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    const keys = [...content.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=/gm)].map((match) => match[1]);
    if (keys.some((key) => !allowedEnv.has(key)) || containsSecret(content)) findings.push({ file, issue: 'review non-public environment configuration (values withheld)' });
  }
  const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
  for (const file of files) {
    const full = path.join(root, file);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') findings.push({ file, issue: 'environment file is not ignored' });
    if (/\.(jks|keystore|p12|p8)$/i.test(file)) findings.push({ file, issue: 'signing material is not ignored' });
    if (containsSecret(fs.readFileSync(full, 'utf8'))) findings.push({ file, issue: 'possible embedded credential' });
  }
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8').trim().split(/\r?\n/);
  if (example.length !== 2 || !example.includes('EXPO_PUBLIC_SUPABASE_URL=') || !example.includes('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) {
    findings.push({ file: '.env.example', issue: 'expected empty public variable names only' });
  }
  // Inspect reachable text blobs once, not every complete tree. Never print content.
  const revisions = git('rev-list', '--objects', '--all').trim().split('\n').filter(Boolean);
  let blobs = 0;
  for (const revision of revisions) {
    const [oid, ...parts] = revision.split(' '); const file = parts.join(' ');
    if (/\.(jks|keystore|p12)$/i.test(file)) {
      findings.push({ file, blob: oid, issue: 'historical signing material' });
      continue;
    }
    if (!file || !/\.(ts|tsx|js|cjs|json|md|toml|env|yml|yaml|properties|pem|key|p8)$/.test(file) && !/(^|\/)\.env(?:\.|$)/.test(file)) continue;
    const content = git('cat-file', '-p', oid); blobs++;
    if (containsSecret(content)) findings.push({ file, blob: oid, issue: 'possible historical credential' });
    if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') findings.push({ file, blob: oid, issue: 'historical environment file' });
  }
  console.log(JSON.stringify({ filesScanned: files.length, historicalBlobsScanned: blobs, findings }, null, 2));
  if (findings.length) process.exitCode = 1;
}
module.exports = { containsSecret };
if (require.main === module) runAudit();
