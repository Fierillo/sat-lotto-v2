export const BLOCKS: number = 21;

const savedBlock = JSON.parse(localStorage.getItem('satlotto_blocks') || '{}');

export const state = {
    currentBlock: savedBlock.height || 890000,
    targetBlock: savedBlock.target || (890000 + BLOCKS),
    lastResultBlock: savedBlock.lastResult || 890000,
    selectedNumber: null as number | null,
    
    // UI tracking to avoid double work
    lastRenderedBlock: 0,
    lastResolvedResultBlock: 0,
    lastBetsJson: '',
    lastPoolBalance: -1
};
