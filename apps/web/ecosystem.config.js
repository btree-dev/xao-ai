export default {
  apps: [
    {
      name: 'perf-web',
      script: './server.js',
      cwd: './apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        VITE_CONTRACT_ADDRESS_BASE_SEPOLIA: process.env.VITE_CONTRACT_ADDRESS_BASE_SEPOLIA || '',
        VITE_TARGET_CHAIN_ID: process.env.VITE_TARGET_CHAIN_ID || '84532'
      }
    }
  ]
};