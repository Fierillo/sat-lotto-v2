'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateConnectUri } from '../lib/nip46';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { CopyText } from './CopyText';

interface QRProps {
    onConnect: (bunkerUrl: string, signer: NDKPrivateKeySigner, secret: string) => void;
    onError: (error: string) => void;
}

const QR_EXPIRY_MS = 120000;

export function QR({ onConnect, onError }: QRProps) {
    const [connectUri, setConnectUri] = useState('');
    const [qrExpired, setQrExpired] = useState(false);
    const [localSigner, setLocalSigner] = useState<NDKPrivateKeySigner | null>(null);
    const [connectSecret, setConnectSecret] = useState('');
    const qrTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        handleRefresh();
        return () => {
            if (qrTimerRef.current) {
                clearTimeout(qrTimerRef.current);
            }
        };
    }, []);

    const handleRefresh = () => {
        const { uri, secret, signer } = generateConnectUri();
        setConnectUri(uri);
        setLocalSigner(signer);
        setConnectSecret(secret);
        setQrExpired(false);

        if (qrTimerRef.current) {
            clearTimeout(qrTimerRef.current);
        }
        qrTimerRef.current = setTimeout(() => {
            setQrExpired(true);
        }, QR_EXPIRY_MS);
    };

    if (qrExpired) {
        return (
            <div className="qr-box expired">
                <span className="qr-expired-text">QR Venció</span>
                <button className="auth-btn small" onClick={handleRefresh}>
                    Regenerar
                </button>
            </div>
        );
    }

    return (
        <div className="qr-box">
            <div className="qr-wrapper" onClick={handleRefresh}>
                {connectUri ? (
                    <>
                        <QRCodeSVG value={connectUri} size={260} />
                        <div className="qr-hint">Presioná para regenerar</div>
                    </>
                ) : (
                    <span className="qr-loading">Generando...</span>
                )}
            </div>
            {connectUri && (
                <CopyText text={connectUri} truncate={50} />
            )}
        </div>
    );
}
