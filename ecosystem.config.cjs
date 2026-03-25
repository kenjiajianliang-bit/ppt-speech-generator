# PM2 配置文件
# 使用方式：pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'ppt-speech-generator',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'uploads', 'logs'],
      max_restarts: 5,
      min_uptime: '10s'
    }
  ]
};
