/**
 * ecosystem.config.js — PM2 process management configuration for sentinel-bot.
 * Optimised for Oracle Cloud Free Tier (1 OCPU, 1 GB RAM).
 */
module.exports = {
  apps: [
    {
      name: 'sentinel-bot',
      script: 'apps/bot/dist/index.js',
      instances: 1,
      node_args: '--max-old-space-size=400',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '300M',
      watch: false,
      // Restart policy
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      // Logs
      out_file: './logs/bot-out.log',
      error_file: './logs/bot-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
