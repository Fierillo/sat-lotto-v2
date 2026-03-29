/** @type {import('next').NextConfig} */
const nextConfig = {
    watchOptions: {
        ignored: ['**/node_modules/**', '**/.git/**', '**/server.log', '**/.next/**'],
    },
    env: {
        NEXT_PUBLIC_TEST: process.env.NEXT_PUBLIC_TEST || 'off',
    },
};

export default nextConfig;
