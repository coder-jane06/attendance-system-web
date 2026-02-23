# 🚀 Quick Start Guide - 5 Minutes to Running

Follow these steps to get the attendance system running on your computer:

## Prerequisites Check
Run these commands to verify you have everything installed:

```bash
node --version    # Should show v14 or higher
psql --version    # Should show PostgreSQL 12 or higher
```

If not installed:
- **Node.js**: https://nodejs.org/ (Download LTS version)
- **PostgreSQL**: https://www.postgresql.org/download/

---

## Step 1: Database Setup (2 minutes)

### Windows
1. Open **pgAdmin** (came with PostgreSQL)
2. Connect to your local server (password you set during installation)
3. Right-click **Databases** → **Create** → **Database**
4. Name it: `attendance_db`
5. Right-click `attendance_db` → **Query Tool**
6. Open the file: `database/schema.sql`
7. Click **Execute** button (▶️)
8. You should see "Query returned successfully"

### Mac/Linux
```bash
# Open terminal and run:
psql -U postgres
# Enter your postgres password

# Then run:
CREATE DATABASE attendance_db;
\q

# Import schema:
psql -U postgres -d attendance_db -f database/schema.sql
```

---

## Step 2: Backend Setup (1 minute)

```bash
# Navigate to backend folder
cd backend

# Install packages (this takes ~30 seconds)
npm install

# Copy environment file
cp .env.example .env

# Edit .env file with your PostgreSQL password
# Open .env in any text editor and change:
# DB_PASSWORD=your_password_here
```

### Important: Edit .env file
Open `backend/.env` in a text editor and change:
```env
DB_PASSWORD=postgres        # ← Change to YOUR PostgreSQL password
JWT_SECRET=my_secret_key_123  # ← Change to any random string
```

### Start the server:
```bash
npm start
```

✅ You should see:
```
╔════════════════════════════════════════════════════╗
║   🎓 Attendance Management System API              ║
║   ✅ Server running on port 5000                   ║
╚════════════════════════════════════════════════════╝
```

**Keep this terminal window open!**

---

## Step 3: Frontend Setup (1 minute)

### Open a NEW terminal window

```bash
# Navigate to frontend folder
cd frontend

# Install http-server globally (one-time only)
npm install -g http-server

# Start the frontend
http-server -p 3000
```

✅ You should see:
```
Starting up http-server
Available on:
  http://127.0.0.1:3000
```

---

## Step 4: Test It! (1 minute)

### Open your browser:
```
http://localhost:3000/login.html
```

### Login as Teacher:
- **Email**: teacher1@university.edu
- **Password**: password123

Try generating a QR code!

### Login as Student (open in another tab):
- **Email**: student1@university.edu
- **Password**: password123

Try scanning the teacher's QR code!

---

## 🎉 That's It!

You now have a working attendance system!

---

## Common Issues & Quick Fixes

### ❌ "Database connection failed"
**Fix**: Check your password in `backend/.env` matches your PostgreSQL password

### ❌ "Port 5000 already in use"
**Fix**: Change port in `backend/.env`:
```env
PORT=5001
```
And update `frontend/js/config.js`:
```javascript
const API_BASE_URL = 'http://localhost:5001/api';
```

### ❌ "npm: command not found"
**Fix**: Install Node.js from https://nodejs.org/

### ❌ "psql: command not found"
**Fix**: Install PostgreSQL from https://www.postgresql.org/download/

### ❌ Frontend shows "Failed to load"
**Fix**: Make sure backend is running (check terminal with `npm start`)

### ❌ Camera not working
**Fix**: 
- Make sure you're using Chrome or Safari
- Click "Allow" when browser asks for camera permission
- Try refreshing the page

---

## What's Next?

1. **Read the full README**: `README.md` for complete documentation
2. **Customize**: Change colors, add features
3. **Deploy**: Put it online using Railway or Vercel (free!)
4. **Add Users**: Create more teachers and students
5. **Add Classes**: Set up your actual class schedule

---

## File Structure Overview

```
attendance-system/
├── backend/              # Server code
│   ├── server.js        # Main server file
│   ├── routes/          # API endpoints
│   ├── config/          # Database connection
│   └── .env            # Your settings (passwords, etc.)
│
├── frontend/            # Website files
│   ├── login.html      # Login page
│   ├── teacher.html    # Teacher dashboard
│   ├── student.html    # Student dashboard
│   ├── css/            # Styles
│   └── js/             # JavaScript code
│
├── database/           
│   └── schema.sql      # Database structure
│
└── README.md           # Full documentation
```

---

## Demo Video Tutorial

Want to see it in action first? Watch this 3-minute walkthrough:

1. Teacher logs in
2. Generates QR code
3. Student scans QR
4. Attendance marked instantly
5. Teacher exports to Excel

---

## Need Help?

1. Check error messages in terminal
2. Read the troubleshooting section in README.md
3. Make sure all steps above are completed
4. Verify PostgreSQL is running
5. Test with demo accounts first

---

**Happy learning! 🎓**

You've just built a real-world web application. This is the foundation for building anything you want!

### What You've Learned:
✅ Backend development (Node.js + Express)
✅ Database design (PostgreSQL)
✅ Frontend development (HTML/CSS/JS)
✅ Authentication (JWT)
✅ QR code generation
✅ Camera access
✅ File exports (Excel)
✅ REST APIs

### Next Steps:
🚀 Add your own features
🎨 Customize the design
📱 Make a mobile app version
☁️ Deploy it online
💼 Add it to your resume/portfolio!
