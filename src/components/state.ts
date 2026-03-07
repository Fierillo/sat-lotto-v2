export const BLOCKS: number = 21;

const savedBlock = JSON.parse(localStorage.getItem('satlotto_blocks') || '{}');

export const state = {
    currentBlock: savedBlock.height || 890000,
    targetBlock: savedBlock.target || (890000 + BLOCKS),
    selectedNumber: null as number | null
};
