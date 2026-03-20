'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { generateConnectUri, createBunkerSession } from '../lib/nip46';
import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';
import { CopyText } from './CopyText';

interface QRProps {
    shouldConnect: boolean;
    onConnect: (bunkerUrl: string, signer: NDKNip46Signer, secret: string) => void;
    onError: (error: string) => void;
}

const QR_EXPIRY_MS = 120000;
const CELL_SIZE = 2;
const MARGIN = 2;

export function QR({ shouldConnect, onConnect, onError }: QRProps) {
    const [connectUri, setConnectUri] = useState('');
    const [qrExpired, setQrExpired] = useState(false);
    const [localSigner, setLocalSigner] = useState<NDKPrivateKeySigner | null>(null);
    const [connectSecret, setConnectSecret] = useState('');
    const qrTimerRef = useRef<NodeJS.Timeout | null>(null);
    const connectedRef = useRef(false);

    useEffect(() => {
        if (!shouldConnect) {
            setConnectUri('');
            setLocalSigner(null);
            setConnectSecret('');
            setQrExpired(false);
            setConnected(false);
            connectedRef.current = false;
            return;
        }

        const { uri, secret, signer } = generateConnectUri();
        setConnectUri(uri);
        setLocalSigner(signer);
        setConnectSecret(secret);
        connectedRef.current = false;
        qrTimerRef.current = setTimeout(() => setQrExpired(true), QR_EXPIRY_MS);

        return () => {
            if (qrTimerRef.current) {
                clearTimeout(qrTimerRef.current);
            }
        };
    }, [shouldConnect]);

    useEffect(() => {
        if (!shouldConnect || !localSigner || !connectSecret || connectedRef.current) return;
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
    }, [shouldConnect, localSigner, connectSecret]);

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

    const setConnected = (value: boolean) => {
        connectedRef.current = value;
    };

    if (qrExpired) {
        return (
            <div className="qr-box expired">
                <span className="qr-expired-text">QR Venció</span>
                <button className="auth-btn small" onClick={handleRefresh}>Regenerar</button>
            </div>
        );
    }

    if (!connectUri) {
        return (
            <div className="qr-box">
                <div className="qr-placeholder">
                    <span className="qr-loading">Esperando bunker...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="qr-box">
            <div className="qr-wrapper" onClick={handleRefresh}>
                <img src={qrDataUrl} alt="QR Code" />
                <div className="qr-hint">Presioná para regenerar</div>
            </div>
            <CopyText text={connectUri} truncate={50} />
        </div>
    );
}
