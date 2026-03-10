export const BLOCKS: number = 21;

const savedBlock = JSON.parse(localStorage.getItem('satlotto_blocks') || '{}');
const savedBets = JSON.parse(localStorage.getItem('satlotto_last_bets') || '[]');
const savedResult = JSON.parse(localStorage.getItem('satlotto_last_result') || 'null');

export const state = {
    // Game State
    currentBlock: savedBlock.height || 0,
    targetBlock: savedBlock.target || 0,
    lastResultBlock: savedBlock.lastResult || 0,
    selectedNumber: null as number | null,
    poolBalance: parseInt(localStorage.getItem('satlotto_pool') || '0'),
    
    // Persistent UI Data
    bets: savedBets as any[],
    lastResult: savedResult as any,
    
    // Internal UI Trackers (to avoid DOM thrashing)
    lastRenderedBlock: 0,
    lastResolvedResultBlock: 0,
    lastBetsJson: '', 
    lastPoolBalance: -1,
    
    // Victory Persistence
    lastVictoryBlock: parseInt(localStorage.getItem('satlotto_last_victory_block') || '0'),
    pendingVictory: JSON.parse(localStorage.getItem('satlotto_pending_victory') || 'null')
};
