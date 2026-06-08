#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/nihongo-master
export PORT=3000
export NODE_ENV=production
exec node dist/server.cjs
