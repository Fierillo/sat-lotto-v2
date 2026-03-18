/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{tsx,ts}',
    ],
    theme: {
        extend: {
            colors: {
                'neon-orange': '#f7931a',
                'neon-green': '#00ff9d',
                'neon-blue': '#00f2ff',
                'neon-yellow': '#ffd900',
            },
            animation: {
                'victory-pulse': 'victoryPulse 1s ease-in-out infinite',
                'winner-pop': 'winnerTextPop 4.2s forwards',
                'flash-green': 'flashGreen 0.5s ease',
                'glow': 'glow 1s ease-out',
            },
            keyframes: {
                victoryPulse: {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.1)' },
                },
                winnerTextPop: {
                    '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.6)', filter: 'blur(10px)' },
                    '15%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1.05)', filter: 'blur(0)' },
                    '85%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
                    '100%': { opacity: '0', transform: 'translate(-50%, -50%) scale(1.3)', filter: 'blur(20px)' },
                },
                flashGreen: {
                    '0%, 100%': { background: 'transparent' },
                    '50%': { background: 'rgba(0, 255, 157, 0.3)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 20px #f7931a' },
                    '100%': { boxShadow: 'none' },
                },
            },
        },
    },
    plugins: [],
}
