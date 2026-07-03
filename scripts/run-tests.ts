import { verifyDiscordSignature, isTimestampFresh } from '../src/lib/discord/verify';
import { evaluateRules } from '../src/services/ruleEngine';
import { encrypt, decrypt } from '../src/lib/security/encryption';
import { ICommandConfig } from '../src/models/CommandConfig';
import nacl from 'tweetnacl';

// Setup Mock Environment for Encryption
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '4e2c9f8a3d6b1e5f0c8d7b3a9e2f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(` ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(` ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

// ----------------------------------------------------
// TEST SUITE 1: Security & Signature Verification
// ----------------------------------------------------
async function testSignatureVerification() {
  console.log('\n--- Test Suite 1: Ed25519 Signature Verification ---');

  // Generate a mock keypair
  const keypair = nacl.sign.keyPair();
  const publicKeyHex = Buffer.from(keypair.publicKey).toString('hex');
  const privateKey = keypair.secretKey;

  const rawBody = JSON.stringify({ type: 1, id: '12345' });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = Buffer.from(timestamp + rawBody);
  
  // Sign message
  const signature = nacl.sign.detached(message, privateKey);
  const signatureHex = Buffer.from(signature).toString('hex');

  // 1. Valid Signature should pass
  const validResult = verifyDiscordSignature(rawBody, signatureHex, timestamp, publicKeyHex);
  assert(validResult === true, 'Valid Ed25519 signature verified successfully');

  // 2. Forged Body should fail
  const forgedBody = rawBody + 'extra_injected_data';
  const forgedResult = verifyDiscordSignature(forgedBody, signatureHex, timestamp, publicKeyHex);
  assert(forgedResult === false, 'Forged request body successfully rejected');

  // 3. Forged Signature should fail
  const forgedSig = signatureHex.replace('a', 'b');
  const forgedSigResult = verifyDiscordSignature(rawBody, forgedSig, timestamp, publicKeyHex);
  assert(forgedSigResult === false, 'Forged signature rejected successfully');

  // 4. Fresh timestamp check
  assert(isTimestampFresh(timestamp, 300) === true, 'Fresh timestamp accepted');
  const staleTimestamp = (Math.floor(Date.now() / 1000) - 360).toString(); // 6 mins ago
  assert(isTimestampFresh(staleTimestamp, 300) === false, 'Stale timestamp rejected (Replay protection)');
}

// ----------------------------------------------------
// TEST SUITE 2: Encryption at Rest (AES-256-GCM)
// ----------------------------------------------------
async function testEncryption() {
  console.log('\n--- Test Suite 2: Webhook Encryption at Rest ---');

  const secretUrl = 'https://discord.com/api/webhooks/12345/abcde-secret-token';
  
  // 1. Encrypt and verify format
  const encrypted = encrypt(secretUrl);
  assert(typeof encrypted === 'string' && encrypted.includes(':'), 'Webhook encrypted and formatted successfully');

  // 2. Decrypt and compare values
  const decrypted = decrypt(encrypted);
  assert(decrypted === secretUrl, 'Webhook decrypted matches original value');

  // 3. Modifying tag or payload should crash decryption (Auth tag verification)
  try {
    const parts = encrypted.split(':');
    const firstChar = parts[1][0];
    parts[1] = (firstChar === 'X' ? 'Y' : 'X') + parts[1].slice(1); // Securely tamper first char
    const tampered = parts.join(':');
    decrypt(tampered);
    assert(false, 'Decryption of tampered ciphertext should have thrown an error');
  } catch {
    assert(true, 'Tampered ciphertext successfully rejected (Integrity check)');
  }
}

// ----------------------------------------------------
// TEST SUITE 3: Rule Engine Behavior
// ----------------------------------------------------
async function testRuleEngine() {
  console.log('\n--- Test Suite 3: Configurable Rule Engine ---');

  const mockConfig = {
    enabled: true,
    rules: [
      { field: 'text', operator: 'contains', value: 'critical' },
      { field: 'text', operator: 'regex', value: 'error\\s*[0-9]+' },
    ],
    actions: [
      { type: 'tag', params: { tag: 'urgent' } },
      { type: 'priority', params: { level: 'critical' } },
      { type: 'autoReply', params: { message: 'Alert received!' } },
    ],
  } as unknown as ICommandConfig;

  // 1. No rule matches
  const resultNoMatch = evaluateRules('This is a normal message.', mockConfig);
  assert(resultNoMatch.matched === false, 'Normal message does not match rules');

  // 2. Contains rule match
  const resultContainsMatch = evaluateRules('This is a critical bug!', mockConfig);
  assert(resultContainsMatch.matched === true, 'Contains rule matches successfully');
  assert(resultContainsMatch.priority === 'critical', 'Priority action applied correctly');
  assert(resultContainsMatch.tags.includes('urgent'), 'Tag action applied correctly');
  assert(resultContainsMatch.autoReply === 'Alert received!', 'Auto-reply action applied correctly');

  // 3. Regex rule match
  const resultRegexMatch = evaluateRules('System crash with error 502', mockConfig);
  assert(resultRegexMatch.matched === true, 'Regex rule matches successfully');
  assert(resultRegexMatch.priority === 'critical', 'Regex action applied correctly');
}

// ----------------------------------------------------
// RUN TEST RUNNER
// ----------------------------------------------------
async function runAllTests() {
  console.log('=== STARTING AUTOMATED TEST SUITES ===');
  const start = Date.now();

  try {
    await testSignatureVerification();
    await testEncryption();
    await testRuleEngine();
  } catch (err) {
    console.error('Fatal test runner error:', err);
  }

  const duration = Date.now() - start;
  console.log(`\n=== TEST RUNNER SUMMARY ===`);
  console.log(`Total Passed: ${passedTests}`);
  console.log(`Total Failed: ${failedTests}`);
  console.log(`Time taken: ${duration}ms`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
