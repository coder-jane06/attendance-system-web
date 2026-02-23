# 🎓 QR-Based Attendance Management System

A complete web-based attendance management system for universities using QR code technology. Teachers can generate time-limited QR codes that students scan to mark their attendance instantly.

## ✨ Features

### For Teachers
- 📱 **Generate QR Codes**: Create time-limited (5-second) QR codes for attendance
- 🔄 **Auto-Refresh**: QR codes automatically regenerate every 5 seconds
- 📊 **View Attendance**: Check attendance records by date
- 📥 **Export to Excel**: Download attendance reports in Excel format
- ✏️ **Manual Override**: Manually mark/edit attendance if needed
- 👥 **Class Management**: View all assigned classes and enrolled students

### For Students
- 📷 **Quick Scan**: Scan QR codes using device camera
- 📈 **Track Progress**: View attendance percentage for each class
- 📅 **History**: See past attendance records
- 📊 **Statistics**: Visual progress bars showing attendance status

### Security Features
- 🔐 **JWT Authentication**: Secure token-based authentication
- 🚫 **Proxy Prevention**: 5-second QR validity prevents sharing
- ⏱️ **Rate Limiting**: Detects suspicious simultaneous scans
- 🎯 **One Scan per Day**: Students can't mark attendance twice
- 👤 **Role-Based Access**: Separate portals for teachers and students

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **JWT** for authentication
- **bcryptjs** for password hashing
- **QRCode.js** for QR generation
- **ExcelJS** for Excel exports

### Frontend
- **Vanilla JavaScript** (no frameworks - easy to learn!)
- **HTML5/CSS3** with modern design
- **html5-qrcode** library for scanning

## 📋 Prerequisites

Before you start, make sure you have installed:

1. **Node.js** (v14 or higher)
   - Download from: https://nodejs.org/
   - Check version: `node --version`

2. **PostgreSQL** (v12 or higher)
   - Download from: https://www.postgresql.org/download/
   - Check version: `psql --version`

3. **Code Editor** (VS Code recommended)
   - Download from: https://code.visualstudio.com/

## 🚀 Installation Guide

### Step 1: Set Up Database

1. Open PostgreSQL (pgAdmin or terminal)

2. Create a new database:
```sql
CREATE DATABASE attendance_db;
```

3. Import the schema:
```bash
psql -U postgres -d attendance_db -f database/schema.sql
```

Or in pgAdmin:
- Right-click on attendance_db → Query Tool
- Open `database/schema.sql`
- Execute the script

### Step 2: Set Up Backend

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=attendance_db
DB_USER=postgres
DB_PASSWORD=your_actual_password
JWT_SECRET=your_random_secret_key_here
```

**Important**: Change `JWT_SECRET` to a random string for security!

5. Start the backend server:
```bash
npm start
```

You should see:
```
╔════════════════════════════════════════════════════╗
║   🎓 Attendance Management System API              ║
║   ✅ Server running on port 5000                   ║
╚════════════════════════════════════════════════════╝
```

### Step 3: Set Up Frontend

1. Navigate to frontend folder:
```bash
cd ../frontend
```

2. Install a simple HTTP server (if you don't have one):
```bash
npm install -g http-server
```

3. Start the frontend:
```bash
http-server -p 3000
```

Or use Python's built-in server:
```bash
python -m http.server 3000
```

4. Open your browser and go to:
```
http://localhost:3000/login.html
```

## 🎮 Demo Accounts

The system comes with pre-configured demo accounts:

### Teachers
- **Email**: `teacher1@university.edu`
- **Password**: `password123`
- **Name**: Dr. Rajesh Kumar

### Students
- **Email**: `student1@university.edu`
- **Password**: `password123`
- **Name**: Amit Patel

- **Email**: `student2@university.edu`
- **Password**: `password123`
- **Name**: Sneha Verma

## 📖 How to Use

### For Teachers

1. **Login**: Use teacher credentials
2. **View Classes**: See all your assigned classes on dashboard
3. **Generate QR**: Click "Generate QR" for any class
4. **Display QR**: Show the QR code to students (projector/screen)
5. **Auto-Refresh**: QR refreshes every 5 seconds automatically
6. **View Attendance**: Click "Attendance" to see who marked present
7. **Export Data**: Click "Export Excel" to download attendance report

### For Students

1. **Login**: Use student credentials
2. **View Classes**: See all enrolled classes with attendance %
3. **Scan QR**: Click "Open Scanner" button
4. **Allow Camera**: Grant camera permission in browser
5. **Scan Code**: Point camera at teacher's QR code
6. **Confirmation**: Get instant success message
7. **Check Stats**: View updated attendance percentage

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token

### Teacher Routes
- `GET /api/teacher/classes` - Get all classes
- `GET /api/teacher/classes/:id` - Get class details
- `POST /api/teacher/generate-qr` - Generate QR code
- `GET /api/teacher/attendance/:classId` - Get attendance
- `GET /api/teacher/export/:classId` - Export to Excel
- `POST /api/teacher/mark-manual` - Manual attendance

### Student Routes
- `GET /api/student/classes` - Get enrolled classes
- `POST /api/student/scan-qr` - Mark attendance via QR
- `GET /api/student/attendance` - Get attendance history
- `GET /api/student/statistics` - Get attendance stats

## 🗄️ Database Schema

### Tables
1. **users** - Stores teachers and students
2. **classes** - Course information
3. **class_enrollments** - Student-class relationships
4. **qr_sessions** - Active QR codes
5. **attendance** - Attendance records

### Key Relationships
- Users (1) → Classes (Many) [Teacher teaches multiple classes]
- Classes (Many) ↔ Students (Many) [Through enrollments]
- Classes (1) → Attendance (Many)
- Students (1) → Attendance (Many)

## 🎨 Customization

### Change QR Validity Time
Edit `.env` file:
```env
QR_VALIDITY_SECONDS=10  # Change from 5 to 10 seconds
```

### Change Colors
Edit `frontend/css/styles.css`:
```css
:root {
    --primary: #2563eb;  /* Change to your color */
    --success: #10b981;
}
```

### Add New Classes
Insert directly into database or create an admin panel:
```sql
INSERT INTO classes (class_code, class_name, subject, teacher_id, schedule, room_number)
VALUES ('CS102', 'Web Development', 'Computer Science', 1, 'Mon/Wed 14:00-16:00', 'Lab-201');
```

### Enroll Students
```sql
INSERT INTO class_enrollments (class_id, student_id)
VALUES (1, 3);
```

## 🐛 Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `pg_isready`
- Verify database credentials in `.env`
- Check port 5000 is available: `lsof -i :5000`

### Database connection failed
- Verify PostgreSQL service is running
- Check password in `.env` matches PostgreSQL user
- Try connecting manually: `psql -U postgres -d attendance_db`

### Frontend can't connect to backend
- Check backend is running on port 5000
- Verify `API_BASE_URL` in `frontend/js/config.js`
- Check browser console for CORS errors

### Camera not working
- Use HTTPS or localhost (required for camera access)
- Check browser permissions for camera
- Try a different browser (Chrome recommended)

### QR code not scanning
- Ensure good lighting
- Hold device steady
- Make sure QR is not expired (5 seconds)
- Try refreshing the page

## 📱 Mobile Support

The system is fully responsive and works on:
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (Chrome Mobile, Safari iOS)
- ✅ Tablets

For best mobile experience:
- Use Chrome on Android
- Use Safari on iOS
- Ensure good camera quality

## 🚀 Deployment

### For Production

1. **Backend Deployment** (Use Railway.app or Render.com):
   - Connect GitHub repository
   - Set environment variables
   - Deploy automatically

2. **Database** (Use ElephantSQL or Neon):
   - Create PostgreSQL instance
   - Update `DB_HOST` and credentials
   - Import schema

3. **Frontend** (Use Vercel or Netlify):
   - Deploy static files
   - Update `API_BASE_URL` in config.js
   - Add custom domain

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
DB_HOST=your-db-host.com
DB_PASSWORD=strong_password
JWT_SECRET=very_long_random_secret
FRONTEND_URL=https://your-domain.com
```

## 🔐 Security Best Practices

1. **Change Default Passwords**: Update all demo account passwords
2. **Strong JWT Secret**: Use a long random string
3. **HTTPS Only**: Never use HTTP in production
4. **Rate Limiting**: Already implemented in backend
5. **Input Validation**: All inputs are validated
6. **SQL Injection**: Using parameterized queries
7. **XSS Protection**: Proper escaping in frontend

## 📚 Learning Resources

### Learn Node.js
- [Node.js Official Docs](https://nodejs.org/docs/)
- [freeCodeCamp Node.js Course](https://www.freecodecamp.org/learn/)

### Learn PostgreSQL
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [SQL for Beginners](https://www.youtube.com/watch?v=HXV3zeQKqGY)

### Learn JavaScript
- [JavaScript.info](https://javascript.info/)
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

### Learn REST APIs
- [REST API Tutorial](https://restfulapi.net/)
- [HTTP Methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)

## 🤝 Contributing

Want to add features? Here are some ideas:

1. **Admin Dashboard**: Manage users and classes
2. **Email Notifications**: Send attendance reports
3. **Mobile App**: React Native or Flutter
4. **Face Recognition**: Add biometric verification
5. **Analytics**: Detailed charts and insights
6. **Bulk Upload**: Import students via CSV
7. **Timetable Integration**: Auto-generate QR based on schedule
8. **Geofencing**: Location-based attendance
9. **Multi-language**: Support regional languages
10. **Dark Mode**: Theme switching

## 📄 License

This project is created for educational purposes. Feel free to use and modify!

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in terminal/console
3. Verify all installation steps
4. Check database connections
5. Test with demo accounts first

## 🎯 Future Enhancements

- [ ] Admin panel for class management
- [ ] Email/SMS notifications
- [ ] Parent portal for viewing student attendance
- [ ] Integration with university ERP systems
- [ ] Attendance reminders
- [ ] Holiday calendar
- [ ] Leave management
- [ ] Biometric integration
- [ ] Mobile native apps

---

**Made with ❤️ for education**

Happy coding! 🚀
