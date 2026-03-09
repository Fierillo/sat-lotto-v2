import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

export function getOrCreateLocalSigner(): NDKPrivateKeySigner {
    let hex = localStorage.getItem('satlotto_local_privkey');
    if (!hex || hex.length !== 64 || hex.includes('[') || hex.includes('undefined')) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('satlotto_local_privkey', hex);
    }

    const signer = new NDKPrivateKeySigner(hex);
    const originalDecrypt = signer.decrypt.bind(signer);
    
    signer.decrypt = async (user, content) => {
        try {
            return await originalDecrypt(user, content);
        } catch (e) {
            const { nip04, nip44 } = await import('nostr-tools');
            const privKeyBytes = (typeof hex === 'string') 
                ? new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
                : hex;
            
            if (content.includes('?iv=')) {
                return await nip04.decrypt(privKeyBytes as Uint8Array, user.pubkey, content);
            } else {
                const conversationKey = nip44.v2.utils.getConversationKey(privKeyBytes as Uint8Array, user.pubkey);
                return nip44.v2.decrypt(content, conversationKey);
            }
        }
    };
    return signer;
}
