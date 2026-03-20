'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { generateConnectUri, createBunkerSession } from '../lib/nip46';
import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';
import { CopyText } from './CopyText';

interface QRProps {
    onConnect: (bunkerUrl: string, signer: NDKNip46Signer, secret: string) => void;
    onError: (error: string) => void;
}

const QR_EXPIRY_MS = 120000;
const CELL_SIZE = 5;
const MARGIN = 4;

export function QR({ onConnect, onError }: QRProps) {
    const [connectUri, setConnectUri] = useState('');
    const [qrExpired, setQrExpired] = useState(false);
    const [localSigner, setLocalSigner] = useState<NDKPrivateKeySigner | null>(null);
    const [connectSecret, setConnectSecret] = useState('');
    const qrTimerRef = useRef<NodeJS.Timeout | null>(null);
    const connectedRef = useRef(false);

    useEffect(() => {
        const { uri, secret, signer } = generateConnectUri();
        setConnectUri(uri);
        setLocalSigner(signer);
        setConnectSecret(secret);
        qrTimerRef.current = setTimeout(() => setQrExpired(true), QR_EXPIRY_MS);
        return () => clearTimeout(qrTimerRef.current!);
    }, []);

    useEffect(() => {
        if (!localSigner || !connectSecret || connectedRef.current) return;
        connectedRef.current = true;

        console.log('[QR] Iniciando conexion con bunker...');
        createBunkerSession('bunker://', localSigner, connectSecret)
            .then(({ signer: bunkerSigner }) => {
                console.log('[QR] ██ CONEXION EXITOSA');
                onConnect('bunker://', bunkerSigner, connectSecret);
            })
            .catch((e: any) => {
                console.error('[QR] Error:', e.message);
                onError(e.message);
            });
    }, [localSigner, connectSecret]);

    const qrDataUrl = useMemo(() => {
        if (!connectUri) return '';
        const qr = qrcode(0, 'H');
        qr.addData(connectUri);
        qr.make();
        return qr.createDataURL(CELL_SIZE, MARGIN);
    }, [connectUri]);

    const handleRefresh = () => {
        connectedRef.current = false;
        const { uri, secret, signer } = generateConnectUri();
        setConnectUri(uri);
        setLocalSigner(signer);
        setConnectSecret(secret);
        setQrExpired(false);
        clearTimeout(qrTimerRef.current!);
        qrTimerRef.current = setTimeout(() => setQrExpired(true), QR_EXPIRY_MS);
    };

    if (qrExpired) {
        return (
            <div className="qr-box expired">
                <span className="qr-expired-text">QR Venció</span>
                <button className="auth-btn small" onClick={handleRefresh}>Regenerar</button>
            </div>
        );
    }

    return (
        <div className="qr-box">
            <div className="qr-wrapper" onClick={handleRefresh}>
                {connectUri ? (
                    <>
                        <img src={qrDataUrl} alt="QR Code" />
                        <div className="qr-hint">Presioná para regenerar</div>
                    </>
                ) : (
                    <span className="qr-loading">Generando...</span>
                )}
            </div>
            {connectUri && <CopyText text={connectUri} truncate={50} />}
        </div>
    );
}
