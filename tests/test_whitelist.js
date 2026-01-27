import "./mocks.js";
import { DomainMatcher } from "../src/lib/domainMatcher.js";

// Simple test runner
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log("Running Whitelist Tests...");
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      t.fn();
      console.log(`✅ PASS: ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`❌ FAIL: ${t.name}`);
      console.error(e.message);
      failed++;
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message || ""} Expected ${expected}, got ${actual}`);
}

// --- Test Cases ---

test("TC-01: Positive Match (Exact Domain)", () => {
  const whitelist = ["example.com"];
  assert(DomainMatcher.isAllowed("https://example.com", whitelist), "example.com should match example.com");
  assert(DomainMatcher.isAllowed("http://example.com/foo", whitelist), "http://example.com/foo should match example.com");
});

test("TC-02: Negative Match (Attacker)", () => {
  const whitelist = ["example.com"];
  assert(!DomainMatcher.isAllowed("https://attacker.com", whitelist), "attacker.com should NOT match example.com");
});

test("TC-03: Subdomain Match (*.test.com)", () => {
  const whitelist = ["*.test.com"];
  assert(DomainMatcher.isAllowed("https://sub.test.com", whitelist), "sub.test.com should match *.test.com");
  assert(DomainMatcher.isAllowed("https://nested.sub.test.com", whitelist), "nested.sub.test.com should match *.test.com");

  // Improved Behavior: *.test.com SHOULD match test.com
  const rootMatch = DomainMatcher.isAllowed("https://test.com", whitelist);
  assert(rootMatch, "test.com should match *.test.com");
});

test("TC-04: Empty Whitelist", () => {
  const whitelist = [];
  assert(!DomainMatcher.isAllowed("https://example.com", whitelist), "Should not allow anything if whitelist is empty");
});

test("TC-05: IP Address", () => {
  const whitelist = ["127.0.0.1"];
  assert(DomainMatcher.isAllowed("http://127.0.0.1", whitelist), "IP address should match");
  assert(DomainMatcher.isAllowed("http://127.0.0.1:8080", whitelist), "IP with port should match (extractDomain handles hostname)");
});

test("TC-06: Case Insensitivity", () => {
  const whitelist = ["Example.com"];
  assert(DomainMatcher.isAllowed("https://example.com", whitelist), "example.com should match Example.com");
  assert(DomainMatcher.isAllowed("https://EXAMPLE.COM", whitelist), "EXAMPLE.COM should match Example.com");
});

test("Destructive: Regex Injection Check", () => {
  // If user somehow saved a malicious pattern...
  // But isValidPattern blocks it?

  // Test isValidPattern first
  assert(DomainMatcher.isValidPattern("*.google.com"), "*.google.com valid");
  assert(DomainMatcher.isValidPattern("google.com"), "google.com valid");
  assert(!DomainMatcher.isValidPattern("google.*"), "google.* invalid");
  assert(!DomainMatcher.isValidPattern("*google.com"), "*google.com invalid");
  assert(!DomainMatcher.isValidPattern("foo(bar).com"), "foo(bar).com invalid");

  // If we force a bad pattern (bypassing isValidPattern in storage manually)
  const badPatterns = ["(.*)"];
  // patternToRegex("(.*)") -> replaces special chars -> "\(\.\*\)" -> regex /^\(\.\*\)$/i
  // It effectively neutralizes regex injection by escaping.
  assert(!DomainMatcher.isAllowed("https://google.com", badPatterns), "Escaped regex chars should not act as regex");
});

test("Destructive: Weird URLs", () => {
  const whitelist = ["example.com"];
  // about:blank
  try {
    const res = DomainMatcher.isAllowed("about:blank", whitelist);
    assert(!res, "about:blank should not match");
  } catch(e) {
    // Should not crash
  }

  // data:
  assert(!DomainMatcher.isAllowed("data:text/plain,hello", whitelist), "data: URI should not match");
});

test("Edge Case: Suffix Match (Should Fail)", () => {
  // example.com should NOT match myexample.com
  const whitelist = ["example.com"];
  assert(!DomainMatcher.isAllowed("https://myexample.com", whitelist), "myexample.com should NOT match example.com");
});

test("Edge Case: Prefix Match (Should Fail)", () => {
  // example.com should NOT match example.com.evil.com
  // But extractDomain("example.com.evil.com") is "example.com.evil.com".
  // Pattern "example.com" -> "^example\.com$". Match? No.
  const whitelist = ["example.com"];
  assert(!DomainMatcher.isAllowed("https://example.com.evil.com", whitelist), "example.com.evil.com should NOT match example.com");
});

runTests();
