import NDK from '@nostr-dev-kit/ndk';

const ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.primal.net',
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol',
        'wss://relay.nsec.app',
        'wss://nostr.oxtr.dev',
        'wss://purplepag.es',
        'wss://relay.mobile.net'
    ]
});

ndk.connect(5000).catch(e => console.error('[NDK] Connect initial failed', e));
(ndk as any).enableNip44 = true;

export default ndk;
