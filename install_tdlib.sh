#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/ubuntu/dracin-backend
npm install tdl tdl-tdlib-addon prebuilt-tdlib

echo "Installation complete"
node -e "console.log('TDL Version:', require('tdl/package.json').version)"
