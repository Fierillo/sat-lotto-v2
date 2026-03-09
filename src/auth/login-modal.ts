import { copyToClipboard } from '../utils/clipboard-utils';
import { logout } from './auth-manager';

export function createLoginModal(handlers: any): HTMLElement {
    const container = document.createElement('div');
    container.id = 'loginModal';
    container.className = 'modal-bg';
    container.innerHTML = `
        <div class="modal auth-modal">
            <h2>Conectá tu Wallet</h2>
            <div class="auth-tabs">
                <button class="tab-btn active" data-target="manual-section">Directo / NWC</button>
                <button class="tab-btn" data-target="connect-section">Bunker</button>
            </div>
            <div id="manual-section" class="auth-section active">
                <button class="auth-btn" id="extLogin">Login con extensión</button>
                <div class="nwc-section">
                    <div class="nwc-guide">
                        <p><strong>¿Cómo conectar vía NWC?</strong></p>
                        <ol>
                            <li>Abrí <strong>Alby</strong>, <strong>Mutiny</strong> o tu wallet NWC.</li>
                            <li>Buscá "Connections" y creá una para <strong>SatLotto</strong>.</li>
                            <li>Copiá el link y pegalo acá abajo:</li>
                        </ol>
                    </div>
                    <input type="password" id="nwcInput" placeholder="nostr+walletconnect://..." />
                    <button class="auth-btn" id="nwcBtn">Conectar Wallet</button>
                </div>
            </div>
            <div id="connect-section" class="auth-section">
                <div id="qrContainer" class="qr-container"><div class="qr-placeholder">Generando URI...</div></div>
                <code id="connectUri" style="cursor:pointer; font-size:0.7rem; word-break:break-all;">Generando...</code>
                <div id="copyUriStatus" style="opacity:0">¡Copiado! ⚡</div>
                <button class="auth-btn secondary" id="refreshConnect">Generar nuevo QR</button>
                <div class="nwc-section" style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                    <input type="text" id="bunkerInput" placeholder="bunker://... o handle@domain" />
                    <button class="auth-btn" id="bunkerLogin">Conectar Bunker manual</button>
                </div>
            </div>
            <p id="authError" class="auth-error"></p>
            <button class="close-btn" id="closeModal">Cerrar</button>
        </div>
    `;

    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.tab-btn, .auth-section').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const target = (btn as HTMLElement).dataset.target;
            if (target) container.querySelector(`#${target}`)?.classList.add('active');
            
            // Clear error when switching tabs
            const errorEl = container.querySelector('#authError') as HTMLElement;
            if (errorEl) errorEl.textContent = '';
        });
    });

    container.querySelector('#extLogin')?.addEventListener('click', handlers.onExtLogin);
    container.querySelector('#nwcBtn')?.addEventListener('click', handlers.onNwcLogin);
    container.querySelector('#bunkerLogin')?.addEventListener('click', handlers.onBunkerLogin);
    container.querySelector('#refreshConnect')?.addEventListener('click', handlers.onRefreshConnect);
    container.querySelector('#closeModal')?.addEventListener('click', handlers.onClose);
    
    container.querySelector('#connectUri')?.addEventListener('click', async () => {
        const uri = (container.querySelector('#connectUri') as HTMLElement).dataset.full || '';
        if (await copyToClipboard(uri)) {
            const status = container.querySelector('#copyUriStatus') as HTMLElement;
            status.style.opacity = '1';
            setTimeout(() => status.style.opacity = '0', 2000);
        }
    });

    return container;
}

export function createUserProfile(username: string): HTMLElement {
    const container = document.createElement('div');
    container.id = 'userProfile';
    container.className = 'top-user-profile';
    container.innerHTML = `
        <div id="userAlias" class="profile-info"></div>
        <div id="logoutMenu" class="logout-menu"><button id="logoutBtn">Cerrar Sesión</button></div>
    `;
    
    const aliasDisplay = container.querySelector('#userAlias') as HTMLElement;
    aliasDisplay.textContent = username;

    container.addEventListener('click', () => container.querySelector('#logoutMenu')?.classList.toggle('active'));
    container.querySelector('#logoutBtn')?.addEventListener('click', logout);
    return container;
}
