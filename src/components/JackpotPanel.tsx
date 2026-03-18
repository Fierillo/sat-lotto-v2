'use client';

interface JackpotPanelProps {
    poolBalance: number;
    onShowHelp?: () => void;
}

export function JackpotPanel({ poolBalance, onShowHelp }: JackpotPanelProps) {
    return (
        <div className="text-center py-5 px-6 bg-black/30 rounded-xl border border-white/10">
            <div className="text-xs font-bold uppercase text-white/70 mb-2 flex items-center justify-center gap-2">
                POZO ACUMULADO
                {onShowHelp && (
                    <span
                        className="w-5 h-5 rounded-full bg-white/10 inline-flex items-center justify-center text-xs cursor-pointer hover:bg-white/20 transition-colors"
                        onClick={onShowHelp}
                    >
                        ?
                    </span>
                )}
            </div>
            <div className="text-4xl font-bold text-neon-orange">
                <span className="font-mono">{poolBalance.toLocaleString('en-US')}</span>
                <span className="text-lg text-white/50 ml-2">sats</span>
            </div>
        </div>
    );
}
