# ⚓ Harbour System — Manager & Staff Web App

This is a lightweight Node.js + Express web application for managing ship arrivals, approvals, and one-time access codes at the harbour.  
Includes:
- **Manager Dashboard** for approving ships & generating access codes.  
- **Staff Portal** for recording incoming ships using OTP codes.  
- Real-time updates using **Server-Sent Events (SSE)**.

---

## 🚀 Features
- Secure manager login (session-based authentication)
- One-time access code generation (OTP)
- Ship request approvals/rejections
- Daily history view by date
- Real-time dashboard auto-refresh (SSE)
- Data persisted in local JSON files

---

## 🛠️ Prerequisites

Before running, make sure you have:
- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node)
- Git (for version control)

---

## ⚙️ Installation

1. **Clone this repository**

   ```bash
   git clone https://github.com/anugrahiyyan/harbour-system.git
   cd harbour-system
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Generate `SESSION_SECRET` with this command**  
   Option 1: Generate via Node.js (recommended):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Example Output:
   ```bash
   e5c73a8b1bafc51d0d2a5fa6a8d64b56de4b293de004319ed98c58d48a92b1eeff4567e6ce84cf16d8b4d2f0b0b59d9f
   ```
   Then copy that value into your .env file:
   ```bash
   SESSION_SECRET=e5c73a8b1bafc51d0d2a5fa6a8d64b56de4b293de004319ed98c58d48a92b1eeff4567e6ce84cf16d8b4d2f0b0b59d9f
   ```

   Option 2: Linux or macOS terminal
   ```bash
   openssl rand -hex 64
   ```

   Option 3: Windows Powershell
   ```bash
   $bytes = New-Object byte[] 64; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [BitConverter]::ToString($bytes) -replace '-', ''
   ```

4. **Set up environment variables**

   You can copy `.env` from `.env.example` in the project root:
   ```bash
   MANAGER_PASSWORD=your_password_here
   SESSION_SECRET=your_random_secret_here
   PORT=3000
   NODE_ENV=development
   ```

---

## ▶️ Run the App

### Development Mode
```bash
node server.js
```

Then open your browser:
```
http://localhost:3000
```

### Manager Dashboard
```
http://localhost:3000/manager.html
```

Login using the password set in your `.env` file.

---

## 🧩 Common Issues

| Problem | Cause / Fix |
|----------|-------------|
| **401 Unauthorized** when logging in | Ensure `MANAGER_PASSWORD` is set and declared **above** `/api/login` in `server.js`. |
| **EPERM: operation not permitted** | Happens on Windows file locks — harmless; can reduce retries in FileStore config. |
| **Unexpected end of JSON input** | Means an empty or broken JSON file — delete it or use the improved `readJson()` function. |

---
---

# 🧠 Running with PM2 (Auto-Restart & Boot Persistence)

## ⚙️ Step 1. Install PM2 globally

```bash
npm install -g pm2
```

Verify installation:

```bash
pm2 -v
```

---

## 🚀 Step 2. Start the app with PM2

From your project directory:

```bash
pm2 start server.js --name harbour-system
```

✅ Explanation:

- `server.js` → your main entry file
- `--name harbour-system` → gives your process a clear name

---

## 💾 Step 3. Save your PM2 process list

This ensures PM2 remembers your running apps:

```bash
pm2 save
```

---

## 🔄 Step 4. Enable auto-start on system boot

### 🐧 For Linux

```bash
pm2 startup systemd
```

PM2 will print a command like this:

```
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourusername --hp /home/yourusername
```

✅ Copy & paste that full command (with `sudo`).

Then save again:

```bash
pm2 save
```

### 🪟 For Windows

Run this once in PowerShell **as Administrator**:

```powershell
pm2-startup install
```

Then start your app again:

```powershell
pm2 start server.js --name harbour-system
pm2 save
```

Now PM2 automatically launches your app whenever Windows starts.

---

## 🧩 Step 5. Useful PM2 Commands

| Command                      | Description                |
| ---------------------------- | -------------------------- |
| `pm2 list`                   | Show all running apps      |
| `pm2 status`                 | View app status summary    |
| `pm2 logs harbour-system`    | View live logs             |
| `pm2 restart harbour-system` | Restart the app            |
| `pm2 stop harbour-system`    | Stop the app               |
| `pm2 delete harbour-system`  | Remove from PM2            |
| `pm2 save`                   | Save current PM2 processes |
| `pm2 resurrect`              | Reload saved processes     |
| `pm2 monit`                  | Live monitoring dashboard  |

---

## 🧠 Step 6. Enable auto-restart on code changes (optional)

For development:

```bash
pm2 start server.js --name harbour-system --watch
```

PM2 will automatically restart the app whenever a file changes.

---

## 🔍 Step 7. Verify after reboot

After rebooting your system, check:

```bash
pm2 list
```

You should see your app running:

```
┌─────┬──────────────────┬──────┬────────┬───┬────────┬────────┐
│ id  │ name             │ mode │ status │ … │ cpu    │ mem    │
├─────┼──────────────────┼──────┼────────┼───┼────────┼────────┤
│ 0   │ harbour-system   │ fork │ online │ … │ 0.3%   │ 35.2mb │
└─────┴──────────────────┴──────┴────────┴───┴────────┴────────┘
```

---

## ✅ Summary

| Step                   | Command                                          |
| ---------------------- | ------------------------------------------------ |
| Install PM2            | `npm install -g pm2`                             |
| Start app              | `pm2 start server.js --name harbour-system`      |
| Save state             | `pm2 save`                                       |
| Enable startup on boot | `pm2 startup` (then follow printed instructions) |
| Check logs             | `pm2 logs harbour-system`                        |

---

## 🧩 Optional Helper Script (run.sh)

Create a `run.sh` file for Linux:

```bash
#!/bin/bash
pm2 start server.js --name harbour-system
pm2 save
pm2 startup
```

Or create a PowerShell script for Windows named `run.ps1`:

```powershell
pm2 start server.js --name harbour-system
pm2 save
pm2-startup install
```

Make it executable (Linux only):

```bash
chmod +x run.sh
```

Then run:

```bash
./run.sh
```

✅ Now your **Harbour System** will auto-start on reboot — on both Windows and Linux.



## 🧠 Author
**anugrahiyyan (@gbtr.x)**  

---

## 📜 License
MIT License — free for personal and commercial use.