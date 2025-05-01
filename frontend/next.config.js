/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'Rachel',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_URL ? `${process.env.API_URL}/api/:path*` : 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 