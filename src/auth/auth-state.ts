export const authState = {
    pubkey: localStorage.getItem('satlotto_pubkey'),
    signer: null as any | null,
    nwcUrl: localStorage.getItem('satlotto_nwc'),
    bunkerTarget: localStorage.getItem('satlotto_bunker'),
    localPrivkey: localStorage.getItem('satlotto_local_privkey'),
    nip05: localStorage.getItem('satlotto_alias')
};

export const logRemote = (data: any) => {
    let devLog = document.getElementById('devLog');
    if (!devLog && document.body) {
        devLog = document.createElement('div');
        devLog.id = 'devLog';
        devLog.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);color:#0f0;font-size:10px;z-index:9999;max-height:150px;overflow:auto;padding:10px;pointer-events:none;font-family:monospace;border-bottom:1px solid rgba(0,255,0,0.5);text-shadow:0 0 5px #0f0;display:none;';
        document.body.appendChild(devLog);
    }
    if (devLog) {
        const time = new Date().toLocaleTimeString();
        devLog.innerHTML += `<div style="margin-bottom:2px; border-left:2px solid #0f0; padding-left:4px">[${time}] ${JSON.stringify(data)}</div>`;
        devLog.scrollTop = devLog.scrollHeight;
    }

    fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(() => { });
};
