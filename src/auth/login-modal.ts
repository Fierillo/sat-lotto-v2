import { copyToClipboard } from '../utils/clipboard-utils';
import { logout } from './auth-manager';

export function createLoginModal(handlers: any): HTMLElement {
    const container = document.createElement('div');
    container.id = 'loginModal';
    container.className = 'modal-bg';
    container.innerHTML = `
        <div class="modal auth-modal">
            <div id="login-main-view">
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
                        <input type="text" id="nwcInput" placeholder="nostr+walletconnect://..." />
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
            </div>

            <div id="pin-view" class="auth-section" style="display:none; text-align:center;">
                <h2 id="pinTitle">Seguridad de la Wallet</h2>
                <p id="pinDesc" style="font-size:0.9rem; opacity:0.8; margin-bottom:20px;"></p>
                <div class="pin-input-container" style="display:flex; justify-content:center; gap:10px; margin-bottom:20px;">
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                </div>
                <p id="pinError" class="auth-error"></p>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="auth-btn secondary" id="backToLogin">Volver</button>
                    <button class="auth-btn" id="confirmPinInModal">Continuar</button>
                </div>
            </div>

            <p id="authError" class="auth-error"></p>
            <button class="close-btn" id="closeModal">Cerrar</button>
        </div>
    `;

    // Logic for PIN digits focus movement
    const digits = container.querySelectorAll('.pin-digit') as NodeListOf<HTMLInputElement>;
    digits.forEach((d, idx) => {
        d.addEventListener('input', () => {
            if (d.value && idx < digits.length - 1) digits[idx + 1].focus();
        });
        d.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !d.value && idx > 0) {
                digits[idx - 1].focus();
                digits[idx - 1].value = '';
            }
        });
        d.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData?.getData('text') || '';
            const numbers = pastedData.replace(/\D/g, '').substring(0, 4);
            for (let i = 0; i < numbers.length; i++) {
                if (idx + i < digits.length) {
                    digits[idx + i].value = numbers[i];
                    digits[idx + i].focus();
                }
            }
            if (idx + numbers.length < digits.length) {
                digits[idx + numbers.length].focus();
            } else {
                digits[digits.length - 1].focus();
            }
        });
    });

    container.querySelector('#backToLogin')?.addEventListener('click', () => {
        (container.querySelector('#pin-view') as HTMLElement).style.display = 'none';
        (container.querySelector('#login-main-view') as HTMLElement).style.display = 'block';
        (container.querySelector('#authError') as HTMLElement).textContent = '';
    });

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
        <div id="loginMethodBadge" class="method-badge"></div>
        <div id="logoutMenu" class="logout-menu"><button id="logoutBtn">Cerrar Sesión</button></div>
    `;
    
    const aliasDisplay = container.querySelector('#userAlias') as HTMLElement;
    aliasDisplay.textContent = username;

    container.addEventListener('click', () => container.querySelector('#logoutMenu')?.classList.toggle('active'));
    container.querySelector('#logoutBtn')?.addEventListener('click', logout);
    return container;
}
