// node --no-warnings lib/supportAuth.test.mjs
import assert from "node:assert/strict";
process.env.ADMIN_JWT_SECRET = "test-secret-for-unit-test-only";
const A = await import("./supportAuth.js");

for (const bad of ["1234", "4321", "0000", "7777", "12", "12345", "abcd", "", null, 1234, "2345", "9876"]) assert.equal(A.validatePin(bad).ok, false, `rejects ${bad}`);
for (const good of ["2580", "1357", "4821", "0719", "1212"]) assert.equal(A.validatePin(good).ok, true, `accepts ${good}`);

const now = 1_000_000_000_000;
const min = 60_000;
assert.equal(A.lockState([], [], now).locked, false);
assert.equal(A.lockState([now - min, now - 2 * min, now - 3 * min, now - 4 * min], [], now).locked, false, "4 wrong codes: not locked yet");
const five = [now - 1 * min, now - 2 * min, now - 3 * min, now - 4 * min, now - 5 * min];
const l5 = A.lockState(five, five, now);
assert.equal(l5.locked, true, "5 wrong codes lock this device");
assert.equal(l5.retryAfterSeconds, 10 * 60, "until the 5th most recent one is 15 min old");
assert.equal(A.lockState([now - 16 * min, now - 17 * min, now - 18 * min, now - 19 * min, now - 20 * min], [], now).locked, false, "old failures do not count");
const twenty = Array.from({ length: 20 }, (_, i) => now - (i + 1) * min);
assert.equal(A.lockState([], twenty, now).locked, true, "20 wrong codes from anywhere lock everyone");

const token = await A.signSupportToken("tenant-a");
assert.ok(await A.verifySupportToken(token, "tenant-a"), "pass works for its own restaurant");
assert.equal(await A.verifySupportToken(token, "tenant-b"), null, "pass does not work for another restaurant");
assert.equal(await A.verifySupportToken(token + "x", "tenant-a"), null, "tampered pass is refused");
assert.equal(await A.verifySupportToken(null, "tenant-a"), null);
console.log("support auth checks passed");
