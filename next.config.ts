/** @type {import('next').NextConfig} */
const nextConfig = {
    watchOptions: {
        ignored: ['**/node_modules/**', '**/.git/**', '**/server.log', '**/.next/**'],
    },
};

export default nextConfig;
