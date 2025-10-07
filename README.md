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

3. **Set up environment variables**

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

## 🧠 Author
**anugrahiyyan (@gbtr.x)**  

---

## 📜 License
MIT License — free for personal and commercial use.