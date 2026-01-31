#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/ubuntu/dracin-backend
npm uninstall tdl
npm install tdl@6 tdl-tdlib-addon prebuilt-tdlib

echo "Downgrade to TDL v6 complete"
