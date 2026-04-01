import { describe, it, expect } from 'vitest';

describe('Victory Flow Conditions', () => {
    type VictoryState = 'none' | 'potential' | 'champion';

    function determineVictoryState(
        winnerBlock: number,
        can_claim: boolean,
        currentBlock: number
    ): VictoryState {
        if (winnerBlock === 0) return 'none';
        
        if (winnerBlock + 2 < currentBlock && can_claim) {
            return 'champion';
        }
        
        if (winnerBlock <= currentBlock && currentBlock <= winnerBlock + 2) {
            return 'potential';
        }
        
        return 'none';
    }

    it('should return none when winnerBlock is 0', () => {
        expect(determineVictoryState(0, false, 840000)).toBe('none');
        expect(determineVictoryState(0, true, 840010)).toBe('none');
    });

    it('should return potential when currentBlock is within confirmation window', () => {
        const winnerBlock = 840000;
        const currentBlock = winnerBlock;
        expect(determineVictoryState(winnerBlock, false, currentBlock)).toBe('potential');
        
        const currentBlock2 = winnerBlock + 1;
        expect(determineVictoryState(winnerBlock, false, currentBlock2)).toBe('potential');
        
        const currentBlock3 = winnerBlock + 2;
        expect(determineVictoryState(winnerBlock, false, currentBlock3)).toBe('potential');
    });

    it('should return champion when 2+ blocks confirmed and can_claim is true', () => {
        const winnerBlock = 840000;
        const currentBlock = winnerBlock + 3;
        expect(determineVictoryState(winnerBlock, true, currentBlock)).toBe('champion');
    });

    it('should return none when 2+ blocks confirmed but can_claim is false', () => {
        const winnerBlock = 840000;
        const currentBlock = winnerBlock + 3;
        expect(determineVictoryState(winnerBlock, false, currentBlock)).toBe('none');
    });

    it('should return none when currentBlock is before winnerBlock', () => {
        const winnerBlock = 840000;
        const currentBlock = winnerBlock - 1;
        expect(determineVictoryState(winnerBlock, true, currentBlock)).toBe('none');
    });

    it('should handle edge case at exactly winnerBlock + 2', () => {
        const winnerBlock = 840000;
        const currentBlock = winnerBlock + 2;
        expect(determineVictoryState(winnerBlock, false, currentBlock)).toBe('potential');
        expect(determineVictoryState(winnerBlock, true, currentBlock)).toBe('potential');
    });

    it('should handle transition from potential to champion', () => {
        const winnerBlock = 840000;
        const states: VictoryState[] = [];
        
        for (let i = 0; i <= 5; i++) {
            const currentBlock = winnerBlock + i;
            states.push(determineVictoryState(winnerBlock, i >= 3, currentBlock));
        }
        
        expect(states).toEqual(['potential', 'potential', 'potential', 'champion', 'champion', 'champion']);
    });
});
