module.exports = {
  apps: [{
    name: 'nihongo-master',
    script: '/home/nihongo-master/start.sh',
    interpreter: '/bin/bash',
    cwd: '/home/nihongo-master',
    env: {
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false,
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
