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

    paymentStep.appendChild(testBtn);
}
