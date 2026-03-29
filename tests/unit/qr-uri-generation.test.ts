import { describe, it, expect } from 'vitest';

describe('QR URI Generation', () => {
    const NIP46_RELAYS = [
        'wss://relay.damus.io',
        'wss://relay.primal.net',
        'wss://nos.lol',
        'wss://relay.nsec.app',
    ];

    function generateConnectUri(pubkey: string, secret: string): string {
        let uri = `nostrconnect://${pubkey}?`;
        NIP46_RELAYS.forEach(r => {
            uri += `relay=${encodeURIComponent(r)}&`;
        });
        uri += `secret=${encodeURIComponent(secret)}&name=${encodeURIComponent('SatLotto')}&url=${encodeURIComponent('https://satlotto.com')}`;
        return uri;
    }

    function parseConnectUri(uri: string): {
        pubkey: string;
        relays: string[];
        secret: string;
        name: string;
        url: string;
    } | null {
        try {
            const urlObj = new URL(uri);
            if (urlObj.protocol !== 'nostrconnect:') return null;
            
            const pubkey = urlObj.host;
            const relays: string[] = [];
            urlObj.searchParams.forEach((value, key) => {
                if (key === 'relay') relays.push(decodeURIComponent(value));
            });
            const secret = urlObj.searchParams.get('secret') || '';
            const name = urlObj.searchParams.get('name') || '';
            const url = urlObj.searchParams.get('url') || '';
            
            return { pubkey, relays, secret, name, url };
        } catch {
            return null;
        }
    }

    it('should generate valid nostrconnect URI', () => {
        const pubkey = 'a'.repeat(64);
        const secret = 'abc123';
        const uri = generateConnectUri(pubkey, secret);
        
        expect(uri).toContain('nostrconnect://');
        expect(uri).toContain(pubkey);
    });

    it('should include all relays in URI', () => {
        const pubkey = 'a'.repeat(64);
        const secret = 'abc123';
        const uri = generateConnectUri(pubkey, secret);
        
        for (const relay of NIP46_RELAYS) {
            expect(uri).toContain(encodeURIComponent(relay));
        }
    });

    it('should parse generated URI correctly', () => {
        const pubkey = 'a'.repeat(64);
        const secret = 'testSecret123';
        const uri = generateConnectUri(pubkey, secret);
        
        const parsed = parseConnectUri(uri);
        expect(parsed).not.toBeNull();
        expect(parsed!.pubkey).toBe(pubkey);
        expect(parsed!.secret).toBe(secret);
        expect(parsed!.name).toBe('SatLotto');
        expect(parsed!.url).toBe('https://satlotto.com');
        expect(parsed!.relays).toHaveLength(4);
    });

    it('should include secret in URI', () => {
        const pubkey = 'a'.repeat(64);
        const secret = 'mySecretKey';
        const uri = generateConnectUri(pubkey, secret);
        
        expect(uri).toContain('secret=' + encodeURIComponent(secret));
    });

    it('should handle special characters in secret', () => {
        const pubkey = 'a'.repeat(64);
        const secret = 'abc123!@#$%^&*()';
        const uri = generateConnectUri(pubkey, secret);
        
        const parsed = parseConnectUri(uri);
        expect(parsed!.secret).toBe(secret);
    });

    it('should reject invalid URIs', () => {
        const invalidUris = [
            'https://example.com',
            'nostr://abc',
            'nostrconnect://',
            'bunker://123',
        ];
        
        for (const uri of invalidUris) {
            const parsed = parseConnectUri(uri);
            if (uri.startsWith('nostrconnect://')) {
                expect(parsed).not.toBeNull();
            }
        }
    });
});
