/**
 * Example usage and validation of NIP-29 utilities
 * This file demonstrates the utilities working correctly
 */

import { normalizeRelayUrl, parseNip29Identifier, createNip29Identifier, getRelayHost } from './nip29Utils';

// Test cases to validate our implementation
console.log('=== URL Normalization Tests ===');
console.log('Standard:', normalizeRelayUrl('wss://relay.damus.io')); // Should: wss://relay.damus.io/
console.log('No protocol:', normalizeRelayUrl('relay.damus.io')); // Should: wss://relay.damus.io/
console.log('With port:', normalizeRelayUrl('wss://relay.damus.io:443')); // Should: wss://relay.damus.io/
console.log('Localhost:', normalizeRelayUrl('ws://localhost:8080')); // Should: ws://localhost:8080/
console.log('Invalid:', normalizeRelayUrl('not-a-url')); // Should: null

console.log('\n=== Identifier Parsing Tests ===');
console.log('Standard:', parseNip29Identifier('devs@relay.damus.io'));
console.log('With @ in ID:', parseNip29Identifier('email@domain.com@relay.com'));
console.log('Invalid:', parseNip29Identifier('no-delimiter'));

console.log('\n=== Identifier Creation Tests ===');
console.log('Create:', createNip29Identifier('bitcoin-devs', 'relay.damus.io'));
console.log('Invalid URL:', createNip29Identifier('test', 'not-a-url'));

console.log('\n=== Host Extraction Tests ===');
console.log('Standard:', getRelayHost('wss://groups.nip29.com/'));
console.log('With port:', getRelayHost('wss://relay.damus.io:8080/'));

// Expected outputs validation
const testCases = [
  { input: 'wss://relay.damus.io', expected: 'wss://relay.damus.io/' },
  { input: 'relay.damus.io', expected: 'wss://relay.damus.io/' },
  { input: 'ws://localhost:8080', expected: 'ws://localhost:8080/' },
  { input: 'not-a-url', expected: null }
];

console.log('\n=== Validation ===');
testCases.forEach((test, i) => {
  const result = normalizeRelayUrl(test.input);
  const passed = result === test.expected;
  console.log(`Test ${i + 1}: ${passed ? '✅ PASS' : '❌ FAIL'} - ${test.input} → ${result}`);
});