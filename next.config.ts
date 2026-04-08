/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_TEST: process.env.NEXT_PUBLIC_TEST || 'off',
    },
};

export default nextConfig;
