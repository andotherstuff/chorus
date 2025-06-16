/**
 * @jest-environment jsdom
 */
import {
  normalizeRelayUrl,
  parseNip29Identifier,
  createNip29Identifier,
  getRelayHost,
  type ParsedNip29Identifier
} from '../nip29Utils';

describe('normalizeRelayUrl', () => {
  describe('standard cases', () => {
    it('should normalize a standard relay URL', () => {
      expect(normalizeRelayUrl('wss://relay.damus.io')).toBe('wss://relay.damus.io/');
    });

    it('should preserve trailing slash for root paths', () => {
      expect(normalizeRelayUrl('wss://relay.damus.io/')).toBe('wss://relay.damus.io/');
    });

    it('should upgrade ws to wss for non-localhost', () => {
      expect(normalizeRelayUrl('ws://relay.damus.io')).toBe('wss://relay.damus.io/');
    });

    it('should add protocol when missing', () => {
      expect(normalizeRelayUrl('relay.damus.io')).toBe('wss://relay.damus.io/');
    });
  });

  describe('case normalization', () => {
    it('should convert hostname to lowercase', () => {
      expect(normalizeRelayUrl('WSS://RELAY.DAMUS.IO')).toBe('wss://relay.damus.io/');
    });

    it('should handle mixed case protocols', () => {
      expect(normalizeRelayUrl('WsS://relay.damus.io')).toBe('wss://relay.damus.io/');
    });
  });

  describe('port handling', () => {
    it('should remove default wss port (443)', () => {
      expect(normalizeRelayUrl('wss://relay.damus.io:443')).toBe('wss://relay.damus.io/');
    });

    it('should remove default ws port (80)', () => {
      expect(normalizeRelayUrl('ws://relay.damus.io:80')).toBe('wss://relay.damus.io/');
    });

    it('should preserve custom ports', () => {
      expect(normalizeRelayUrl('wss://relay.damus.io:1234')).toBe('wss://relay.damus.io:1234/');
    });
  });

  describe('localhost handling', () => {
    it('should preserve ws protocol for localhost', () => {
      expect(normalizeRelayUrl('ws://localhost:8080')).toBe('ws://localhost:8080/');
    });

    it('should preserve ws protocol for 127.0.0.1', () => {
      expect(normalizeRelayUrl('ws://127.0.0.1:8080')).toBe('ws://127.0.0.1:8080/');
    });

    it('should still use wss for localhost if explicitly provided', () => {
      expect(normalizeRelayUrl('wss://localhost:8081')).toBe('wss://localhost:8081/');
    });
  });

  describe('path handling', () => {
    it('should preserve non-root paths', () => {
      expect(normalizeRelayUrl('wss://example.com/relay')).toBe('wss://example.com/relay');
    });

    it('should preserve non-root paths with trailing slash', () => {
      expect(normalizeRelayUrl('wss://example.com/relay/')).toBe('wss://example.com/relay/');
    });
  });

  describe('credential and parameter removal', () => {
    it('should remove authentication credentials', () => {
      expect(normalizeRelayUrl('wss://user:pass@relay.com')).toBe('wss://relay.com/');
    });

    it('should remove query parameters', () => {
      expect(normalizeRelayUrl('wss://relay.com/?foo=bar')).toBe('wss://relay.com/');
    });

    it('should remove hash fragments', () => {
      expect(normalizeRelayUrl('wss://relay.com/#section')).toBe('wss://relay.com/');
    });

    it('should remove all unwanted parts together', () => {
      expect(normalizeRelayUrl('wss://user:pass@relay.com:443/?foo=bar#baz')).toBe('wss://relay.com/');
    });
  });

  describe('invalid input handling', () => {
    it('should return null for empty string', () => {
      expect(normalizeRelayUrl('')).toBe(null);
    });

    it('should return null for null input', () => {
      expect(normalizeRelayUrl(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(normalizeRelayUrl(undefined)).toBe(null);
    });

    it('should return null for whitespace-only input', () => {
      expect(normalizeRelayUrl('   ')).toBe(null);
    });

    it('should return null for invalid URL', () => {
      expect(normalizeRelayUrl('not a url')).toBe(null);
    });
  });

  describe('protocol upgrade for non-websocket URLs', () => {
    it('should upgrade http to wss', () => {
      expect(normalizeRelayUrl('http://relay.com')).toBe('wss://relay.com/');
    });

    it('should upgrade https to wss', () => {
      expect(normalizeRelayUrl('https://relay.com')).toBe('wss://relay.com/');
    });
  });
});

describe('parseNip29Identifier', () => {
  describe('valid identifiers', () => {
    it('should parse standard identifier', () => {
      const result = parseNip29Identifier('devs@relay.damus.io');
      expect(result).toEqual({
        id: 'devs',
        relayUrl: 'wss://relay.damus.io/'
      });
    });

    it('should normalize relay URL in identifier', () => {
      const result = parseNip29Identifier('devs@WSS://RELAY.DAMUS.IO:443');
      expect(result).toEqual({
        id: 'devs',
        relayUrl: 'wss://relay.damus.io/'
      });
    });

    it('should handle group ID with special characters', () => {
      const result = parseNip29Identifier('devs-and-designers_1@relay.com');
      expect(result).toEqual({
        id: 'devs-and-designers_1',
        relayUrl: 'wss://relay.com/'
      });
    });

    it('should handle group ID containing @ symbol', () => {
      const result = parseNip29Identifier('email@domain.com@relay.com');
      expect(result).toEqual({
        id: 'email@domain.com',
        relayUrl: 'wss://relay.com/'
      });
    });

    it('should handle multiple @ symbols correctly', () => {
      const result = parseNip29Identifier('my@complex@group@relay.example.com');
      expect(result).toEqual({
        id: 'my@complex@group',
        relayUrl: 'wss://relay.example.com/'
      });
    });
  });

  describe('invalid identifiers', () => {
    it('should return null for no ID part', () => {
      expect(parseNip29Identifier('@relay.com')).toBe(null);
    });

    it('should return null for no relay part', () => {
      expect(parseNip29Identifier('mygroup@')).toBe(null);
    });

    it('should return null for no delimiter', () => {
      expect(parseNip29Identifier('mygroup-relay.com')).toBe(null);
    });

    it('should return null for invalid relay URL', () => {
      expect(parseNip29Identifier('mygroup@not a url')).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(parseNip29Identifier('')).toBe(null);
    });

    it('should return null for null input', () => {
      expect(parseNip29Identifier(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(parseNip29Identifier(undefined)).toBe(null);
    });

    it('should return null for whitespace-only ID', () => {
      expect(parseNip29Identifier('   @relay.com')).toBe(null);
    });
  });

  describe('case sensitivity', () => {
    it('should preserve case in group ID', () => {
      const result = parseNip29Identifier('MyGroup@relay.com');
      expect(result?.id).toBe('MyGroup');
    });

    it('should normalize relay URL case', () => {
      const result = parseNip29Identifier('mygroup@RELAY.COM');
      expect(result?.relayUrl).toBe('wss://relay.com/');
    });
  });
});

describe('createNip29Identifier', () => {
  describe('valid inputs', () => {
    it('should create identifier with normalization', () => {
      const result = createNip29Identifier('bitcoin-devs', 'relay.damus.io');
      expect(result).toBe('bitcoin-devs@wss://relay.damus.io/');
    });

    it('should handle complex relay URLs', () => {
      const result = createNip29Identifier('test', 'wss://relay.com:8080/path');
      expect(result).toBe('test@wss://relay.com:8080/path');
    });

    it('should trim whitespace from ID', () => {
      const result = createNip29Identifier('  test  ', 'relay.com');
      expect(result).toBe('test@wss://relay.com/');
    });
  });

  describe('invalid inputs', () => {
    it('should return null for empty ID', () => {
      expect(createNip29Identifier('', 'relay.com')).toBe(null);
    });

    it('should return null for empty relay URL', () => {
      expect(createNip29Identifier('test', '')).toBe(null);
    });

    it('should return null for invalid relay URL', () => {
      expect(createNip29Identifier('test', 'invalid-url')).toBe(null);
    });

    it('should return null for whitespace-only ID', () => {
      expect(createNip29Identifier('   ', 'relay.com')).toBe(null);
    });
  });
});

describe('getRelayHost', () => {
  it('should extract hostname from standard URL', () => {
    expect(getRelayHost('wss://groups.nip29.com/')).toBe('groups.nip29.com');
  });

  it('should include port when present', () => {
    expect(getRelayHost('wss://relay.damus.io:8080/')).toBe('relay.damus.io:8080');
  });

  it('should handle URLs without trailing slash', () => {
    expect(getRelayHost('wss://relay.com')).toBe('relay.com');
  });

  it('should handle malformed URLs gracefully', () => {
    expect(getRelayHost('not-a-url')).toBe('not-a-url');
  });

  it('should handle URLs with paths', () => {
    expect(getRelayHost('wss://example.com/relay')).toBe('example.com');
  });
});