export const BLOCKS: number = 21;

const savedBlock = JSON.parse(localStorage.getItem('satlotto_blocks') || '{}');
const savedBets = JSON.parse(localStorage.getItem('satlotto_last_bets') || '[]');
const savedResult = JSON.parse(localStorage.getItem('satlotto_last_result') || 'null');

export const state = {
    currentBlock: savedBlock.height || 890000,
    targetBlock: savedBlock.target || (890000 + BLOCKS),
    lastResultBlock: savedBlock.lastResult || 890000,
    selectedNumber: null as number | null,
    poolBalance: parseInt(localStorage.getItem('satlotto_pool') || '0'),
    
    // UI Data Persistence
    bets: savedBets as any[],
    lastResult: savedResult as any,
    
    // UI tracking to avoid double work
    lastRenderedBlock: 0,
    lastResolvedResultBlock: 0,
    lastBetsJson: localStorage.getItem('satlotto_last_bets') || '',
    lastPoolBalance: -1,
    
    lastVictoryBlock: parseInt(localStorage.getItem('satlotto_last_victory_block') || '0'),
    pendingVictory: JSON.parse(localStorage.getItem('satlotto_pending_victory') || 'null')
};
