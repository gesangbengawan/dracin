🚀 Dracin Video Server - Deployment Guide
Panduan lengkap untuk deploy server video Dracin di AWS EC2 atau VPS lain (Ubuntu).

1. Persiapan Server (AWS EC2)
Launch Instance:

OS: Ubuntu 24.04 LTS (atau 22.04 LTS)
Type: t3.medium (rekomendasi minimal) atau t3.micro (bisa, tapi lambat compress)
Storage: 2TB (sesuai kebutuhan video)
Security Group (Firewall):

Buka port 22 (SSH) -> My IP
Buka port 3001 (Server API) -> 0.0.0.0/0 (Anywhere)
2. Install Dependencies
Login ke server via SSH:

ssh -i "kunci.pem" ubuntu@ip-address-server
Jalankan perintah berikut untuk install Node.js 18+, npm, dan ffmpeg:

# Update server
sudo apt update && sudo apt upgrade -y
# Install Node.js (v18 atau v20)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs ffmpeg
# Cek versi (pastikan terinstall)
node -v
ffmpeg -version
# Install PM2 (Process Manager)
sudo npm install -g pm2
3. Setup Project
Buat folder dan inisialisasi project:

mkdir -p ~/dracin-backend
cd ~/dracin-backend
# Init npm & install packages
npm init -y
npm install express cors dotenv telegram @supabase/supabase-js
4. Konfigurasi Environment Variable
Buat file .env:

nano .env
Paste konfigurasi berikut (sesuaikan value-nya):

PORT=3001
TELEGRAM_API_ID=30559094
TELEGRAM_API_HASH=3024202802c2f2ddfc1cac62a65acc2b
TELEGRAM_SESSION=1BVtsOJYBuy5iAZw2OGL4... (Session string panjang)
SUPABASE_URL=https://mnjkvwemnlkwzitfzzdd.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1Ni... (Service / Secret key)
Simpan: Ctrl+O, Enter, Ctrl+X

5. Upload File Server & Data
Upload file 
server.js
 (script v8) dan dramas.json dari komputer lokal ke server. Gunakan perintah scp dari komputer lokal Anda (bukan di dalam SSH):

# Upload script server
scp -i "kunci.pem" path/to/ec2_server_v8.js ubuntu@ip-address:~/dracin-backend/server.js
# Upload data drama
scp -i "kunci.pem" path/to/final_progress.json ubuntu@ip-address:~/dracin-backend/dramas.json
6. Jalankan Server
Kembali ke terminal SSH server dan jalankan:

cd ~/dracin-backend
# Jalankan dengan PM2
pm2 start server.js --name dracin-video
# Simpan konfigurasi PM2 agar auto-start saat reboot
pm2 save
pm2 startup
7. Operasional & Monitoring
Berikut command-command penting untuk maintenance:

A. Start Download (Background)
Server akan mulai download dari ID drama tertinggi di dramas.json.

curl -X POST http://localhost:3001/api/start-download
B. Sync Database (Sekali Saja / Update)
Untuk memasukkan list drama dari dramas.json ke Supabase agar muncul di website.

curl -X POST http://localhost:3001/api/sync-database
C. Cek Status & Logs
# Cek logs real-time
pm2 logs dracin-video
# Cek status download via API
curl http://localhost:3001/api/download-status
D. Restart Server
Jika ada update code:

pm2 restart dracin-video
8. Verifikasi Website
Server backend sekarang siap melayani:

Streaming: GET /api/stream/:messageId (Support on-demand download jika belum dikompres)
Download: GET /api/download/:dramaId/:episode
List Video: GET /api/videos/:dramaId