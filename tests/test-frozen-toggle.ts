import { state } from '../src/components/app-state.js';
import { updateUI } from '../src/main.js';

const addFrozenToggle = () => {
	const testBtn = document.createElement('button');
	testBtn.textContent = 'Toggle Frozen';
	testBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:8px 12px;background:rgba(0,0,0,0.85);border:1px solid #00f2ff;color:#00f2ff;border-radius:4px;cursor:pointer;font-size:11px;';
	testBtn.onclick = () => {
		const isFrozen = document.body.classList.contains('phase-frozen');
		state.currentBlock = isFrozen ? state.targetBlock - 5 : state.targetBlock - 1;
		updateUI();
	};
	document.body.appendChild(testBtn);
};

if (typeof window !== 'undefined') addFrozenToggle();
export { addFrozenToggle };
