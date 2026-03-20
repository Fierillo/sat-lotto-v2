'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { QR } from '../QR';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
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

  const handleBunkerConnect = async (url: string, signer: NDKPrivateKeySigner, secret: string) => {
    setLoading(true);
    setError(null);
    try {
      await loginWithBunker(url, signer, secret);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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
            <QR onConnect={handleBunkerConnect} onError={setError} />

            <div className="divider">
              <span>ó</span>
            </div>

            <div className="nwc-section bunker-manual">
              <input
                type="text"
                id="bunkerInput"
                className="nwc-input"
                placeholder="bunker://..."
                value={bunkerUrl}
                onChange={(e) => setBunkerUrl(e.target.value)}
              />
              <button 
                className="auth-btn" 
                onClick={() => handleBunkerConnect('bunker://', null as any, '')}
                disabled={loading}
              >
                Conectar Bunker
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
