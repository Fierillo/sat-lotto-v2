'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'manual' | 'bunker';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { state, loginWithExtension, loginWithNwc, loginWithBunker, setError } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [nwcUrl, setNwcUrl] = useState('');
  const [bunkerUrl, setBunkerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectUri, setConnectUri] = useState('');

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
    if (tab === 'bunker') {
      handleRefreshConnect();
    }
  };

  const handleExtensionLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithExtension();
      onClose();
    } catch {
      // Error already set in context
    } finally {
      setLoading(false);
    }
  };

  const handleNwcLogin = async () => {
    setError(null);
    if (!nwcUrl.trim()) {
      setError('Ingresá una URL de NWC válida.');
      return;
    }
    setLoading(true);
    try {
      await loginWithNwc(nwcUrl);
      onClose();
      setNwcUrl('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBunkerLogin = async () => {
    setError(null);
    if (!bunkerUrl.trim()) {
      setError('Bunker URL o NIP-05 requerido');
      return;
    }
    setLoading(true);
    try {
      await loginWithBunker(bunkerUrl);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshConnect = () => {
    const secret = Math.random().toString(36).substring(7);
    const pubkey = 'generating...';
    const uri = `nostrconnect://${pubkey}?relay=wss://relay.nsec.app&relay=wss://relay.damus.io&secret=${secret}&name=SatLotto`;
    setConnectUri(uri);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div id="login-main-view">
          <h2>Conectá tu Wallet</h2>

          <div className="auth-tabs">
            <button
              className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => handleTabChange('manual')}
            >
              Directo / NWC
            </button>
            <button
              className={`tab-btn ${activeTab === 'bunker' ? 'active' : ''}`}
              onClick={() => handleTabChange('bunker')}
            >
              Bunker
            </button>
          </div>

          <div id="manual-section" className={`auth-section ${activeTab === 'manual' ? 'active' : ''}`}>
            <button
              className="auth-btn"
              onClick={handleExtensionLogin}
              disabled={loading}
            >
              {loading ? 'Conectando...' : 'Login con extensión'}
            </button>

            <div className="nwc-section">
              <div className="nwc-guide">
                <p><strong>¿Cómo conectar vía NWC?</strong></p>
                <ol>
                  <li>Abrí <strong>Alby</strong>, <strong>Mutiny</strong> o tu wallet NWC.</li>
                  <li>Buscá &quot;Connections&quot; y creá una para <strong>SatLotto</strong>.</li>
                  <li>Copiá el link y pegalo acá abajo:</li>
                </ol>
              </div>
              <input
                type="text"
                id="nwcInput"
                className="nwc-input"
                placeholder="nostr+walletconnect://..."
                value={nwcUrl}
                onChange={(e) => setNwcUrl(e.target.value)}
              />
              <button className="auth-btn" onClick={handleNwcLogin} disabled={loading}>
                Conectar Wallet
              </button>
            </div>
          </div>

          <div id="connect-section" className={`auth-section ${activeTab === 'bunker' ? 'active' : ''}`}>
            <div id="qrContainer" className="qr-container">
              <div className="qr-placeholder">
                <span style={{ color: '#000', fontSize: '0.9rem' }}>
                  {connectUri ? 'Escaneá con tu bunker' : 'Generando...'}
                </span>
              </div>
            </div>
            <code
              id="connectUri"
              className="connect-uri"
              onClick={() => navigator.clipboard.writeText(connectUri)}
            >
              {connectUri.length > 50 ? connectUri.substring(0, 50) + '...' : connectUri}
            </code>
            <button className="auth-btn secondary" onClick={handleRefreshConnect}>
              Generar nuevo QR
            </button>

            <div className="nwc-section bunker-manual">
              <input
                type="text"
                id="bunkerInput"
                className="nwc-input"
                placeholder="bunker://... o handle@domain"
                value={bunkerUrl}
                onChange={(e) => setBunkerUrl(e.target.value)}
              />
              <button className="auth-btn" onClick={handleBunkerLogin} disabled={loading}>
                Conectar Bunker manual
              </button>
            </div>
          </div>
        </div>

        {state.error && <p className="auth-error">{state.error}</p>}

        <button className="close-btn" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
