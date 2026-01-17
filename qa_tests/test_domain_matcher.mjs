
import { DomainMatcher } from "../src/lib/domainMatcher.js";

console.log("--- Testing DomainMatcher ---");

// Test Case 1: Localhost (Currently fails)
const isLocalhostValid = DomainMatcher.isValidPattern("localhost");
console.log(`isValidPattern('localhost'): ${isLocalhostValid}`);

// Test Case 2: Standard Domain (Should pass)
const isGoogleValid = DomainMatcher.isValidPattern("google.com");
console.log(`isValidPattern('google.com'): ${isGoogleValid}`);

// Test Case 3: Wildcard (Should pass)
const isWildcardValid = DomainMatcher.isValidPattern("*.example.com");
console.log(`isValidPattern('*.example.com'): ${isWildcardValid}`);

if (!isLocalhostValid) {
    console.log("FAIL: localhost should be valid but was rejected.");
    process.exitCode = 1;
} else {
    console.log("PASS: localhost is valid.");
}
