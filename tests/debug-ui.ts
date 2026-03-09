export function injectDebugButtons(): void {
    const paymentStep = document.getElementById('paymentStep');
    if (!paymentStep) return;

    if (document.getElementById('testFlashBtn')) return;

    const testBtn = document.createElement('button');
    testBtn.id = 'testFlashBtn';
    testBtn.style.cssText = 'position:absolute;bottom:-45px;left:50%;transform:translateX(-50%);font-size:0.65rem;padding:2px 8px;background:rgba(0,255,157,0.1);border:1px solid #00ff9d;color:#00ff9d;border-radius:4px;opacity:0.6;cursor:pointer;z-index:100;';
    testBtn.textContent = 'TEST FLASH';
    
    testBtn.onclick = (e) => {
        e.stopPropagation();
        document.body.classList.add('flash-green');
        setTimeout(() => {
            document.body.classList.remove('flash-green');
        }, 5000);
    };

    const vicBtn = document.createElement('button');
    vicBtn.id = 'testVicBtn';
    vicBtn.style.cssText = 'position:absolute;bottom:-70px;left:50%;transform:translateX(-50%);font-size:0.65rem;padding:2px 8px;background:rgba(247,147,26,0.1);border:1px solid #f7931a;color:#f7931a;border-radius:4px;opacity:0.6;cursor:pointer;z-index:100;';
    vicBtn.textContent = 'TEST VICTORY';
    
    vicBtn.onclick = (e) => {
        e.stopPropagation();
        const clock = document.getElementById('clock');
        if (clock) {
            clock.classList.add('victory-mode');
            const overlay = document.createElement('div');
            overlay.className = 'winner-overlay';
            document.body.appendChild(overlay);
            
            const msg = document.createElement('div');
            msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:3rem;font-weight:900;text-shadow:0 0 40px #f7931a,0 0 80px #f7931a;z-index:1001;letter-spacing:10px;text-transform:uppercase;animation:winnerTextPop 4.2s forwards;white-space:nowrap;pointer-events:none;';
            msg.innerHTML = '¡GANASTE CON EL 21!';
            document.body.appendChild(msg);

            const style = document.createElement('style');
            style.innerHTML = '@keyframes winnerTextPop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); filter: blur(10px); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); filter: blur(0); } 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(2); filter: blur(20px); } }';
            document.head.appendChild(style);

            setTimeout(() => {
                clock.classList.remove('victory-mode');
                overlay.remove();
                msg.remove();
                style.remove();
            }, 4500);
        }
    };

    paymentStep.appendChild(testBtn);
    paymentStep.appendChild(vicBtn);
}
