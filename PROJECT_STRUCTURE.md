# 📁 Project Structure Explained

This document explains every file and folder in the project.

```
attendance-system/
│
├── backend/                          # Server-side code (Node.js)
│   ├── config/
│   │   └── database.js              # PostgreSQL connection setup
│   │
│   ├── middleware/
│   │   └── auth.js                  # JWT authentication middleware
│   │
│   ├── routes/
│   │   ├── auth.js                  # Login/Register endpoints
│   │   ├── teacher.js               # Teacher-specific endpoints
│   │   └── student.js               # Student-specific endpoints
│   │
│   ├── .env.example                 # Template for environment variables
│   ├── .env                         # YOUR secret configuration (not in git)
│   ├── package.json                 # Node.js dependencies
│   └── server.js                    # Main server file (entry point)
│
├── frontend/                         # Client-side code (HTML/CSS/JS)
│   ├── css/
│   │   └── styles.css               # All styling for the app
│   │
│   ├── js/
│   │   ├── config.js                # API URL and helper functions
│   │   ├── auth.js                  # Login page logic
│   │   ├── teacher.js               # Teacher dashboard logic
│   │   └── student.js               # Student dashboard logic
│   │
│   ├── login.html                   # Login page
│   ├── teacher.html                 # Teacher dashboard page
│   └── student.html                 # Student dashboard page
│
├── database/
│   └── schema.sql                   # Database structure + sample data
│
├── docs/                            # Extra documentation
│
├── .gitignore                       # Files to ignore in Git
├── README.md                        # Main project documentation
├── QUICKSTART.md                    # 5-minute setup guide
├── LEARNING_ROADMAP.md              # How to learn everything
├── DEPLOYMENT.md                    # How to deploy online
└── PROJECT_STRUCTURE.md             # This file!
```

---

## 📂 Detailed File Breakdown

### Backend Files

#### `server.js` (Main Entry Point)
```javascript
// What it does:
- Creates Express server
- Sets up middleware (CORS, JSON parsing)
- Connects routes
- Starts listening on port 5000
- Handles errors

// Key code:
app.use('/api/auth', authRoutes);      // Login/Register
app.use('/api/teacher', teacherRoutes); // Teacher features
app.use('/api/student', studentRoutes); // Student features
```

#### `config/database.js` (Database Connection)
```javascript
// What it does:
- Creates connection pool to PostgreSQL
- Handles database queries
- Manages connection lifecycle

// Usage:
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

#### `middleware/auth.js` (Security)
```javascript
// What it does:
- Checks if user is logged in (has valid token)
- Verifies JWT tokens
- Checks user roles (teacher/student)

// Used in routes:
router.get('/classes', authenticateToken, isTeacher, async (req, res) => {
    // Only logged-in teachers can access this
});
```

#### `routes/auth.js` (Authentication)
```javascript
// Endpoints:
POST /api/auth/register    // Create new account
POST /api/auth/login       // Login and get token
GET  /api/auth/verify      // Check if token is valid
```

#### `routes/teacher.js` (Teacher Features)
```javascript
// Endpoints:
GET  /api/teacher/classes              // Get all teacher's classes
GET  /api/teacher/classes/:id          // Get specific class details
POST /api/teacher/generate-qr          // Generate new QR code
GET  /api/teacher/attendance/:classId  // View attendance
GET  /api/teacher/export/:classId      // Download Excel
POST /api/teacher/mark-manual          // Manually mark attendance
```

#### `routes/student.js` (Student Features)
```javascript
// Endpoints:
GET  /api/student/classes      // Get enrolled classes
POST /api/student/scan-qr      // Mark attendance by scanning
GET  /api/student/attendance   // View attendance history
GET  /api/student/statistics   // Get attendance percentages
```

---

### Frontend Files

#### `login.html` (Login Page)
```html
<!-- What it contains: -->
- Email input field
- Password input field
- Login button
- Demo credentials display
- Links to CSS and JS files
```

#### `teacher.html` (Teacher Dashboard)
```html
<!-- What it contains: -->
- Navigation bar with logout
- Classes grid (all teacher's classes)
- QR generation modal (popup)
- Attendance view modal (popup)
```

#### `student.html` (Student Dashboard)
```html
<!-- What it contains: -->
- Navigation bar with logout
- Scan QR button (big, prominent)
- QR scanner modal (camera interface)
- Statistics cards (attendance percentages)
- Recent attendance list
```

#### `css/styles.css` (All Styling)
```css
/* What it defines: */
- Color scheme (blue primary color)
- Layout (grid, flexbox)
- Components (buttons, cards, modals)
- Responsive design (mobile-friendly)
- Animations (smooth transitions)
```

#### `js/config.js` (Configuration & Helpers)
```javascript
// What it contains:
const API_BASE_URL = 'http://localhost:5000/api';

function getAuthToken() { /* Get stored token */ }
function getUserData() { /* Get user info */ }
function apiCall(endpoint, method, data) { /* Make API request */ }
function logout() { /* Clear session and redirect */ }
```

#### `js/auth.js` (Login Logic)
```javascript
// What it does:
- Handles login form submission
- Sends email/password to backend
- Stores token in localStorage
- Redirects to appropriate dashboard
```

#### `js/teacher.js` (Teacher Dashboard Logic)
```javascript
// What it does:
loadClasses()           // Fetch and display classes
generateQR(classId)     // Show QR modal and generate code
viewAttendance(classId) // Show attendance modal
exportAttendance()      // Download Excel file

// Auto-refresh:
- Regenerates QR every 5 seconds
- Updates countdown timer
- Animates progress bar
```

#### `js/student.js` (Student Dashboard Logic)
```javascript
// What it does:
loadStatistics()        // Show attendance percentages
loadRecentAttendance()  // Show recent records
openScanner()          // Start camera
onScanSuccess()        // Send QR data to backend
```

---

### Database Files

#### `schema.sql` (Database Structure)
```sql
-- Tables created:
1. users              (teachers and students)
2. classes            (courses/subjects)
3. class_enrollments  (which students in which classes)
4. qr_sessions        (active QR codes)
5. attendance         (attendance records)

-- Sample data:
- 2 teachers
- 4 students
- 3 classes
- Enrollment records
```

---

## 🔄 How Data Flows

### Teacher Generates QR Code

```
1. Teacher clicks "Generate QR" button
   ↓
2. teacher.js → generateQR(classId)
   ↓
3. Frontend sends: POST /api/teacher/generate-qr
   {
     classId: 1
   }
   ↓
4. Backend (routes/teacher.js):
   - Verifies teacher owns this class
   - Creates unique token (UUID)
   - Sets expiry (5 seconds from now)
   - Stores in qr_sessions table
   - Generates QR image
   ↓
5. Returns QR code as base64 image
   ↓
6. Frontend displays QR in modal
   ↓
7. Auto-regenerates every 5 seconds
```

### Student Scans QR Code

```
1. Student clicks "Open Scanner"
   ↓
2. student.js → openScanner()
   ↓
3. Camera starts (html5-qrcode library)
   ↓
4. Student points camera at QR
   ↓
5. Library decodes QR → gets token and classId
   ↓
6. Frontend sends: POST /api/student/scan-qr
   {
     token: "uuid-here",
     classId: 1
   }
   ↓
7. Backend (routes/student.js):
   - Checks if student is enrolled
   - Verifies token is valid and not expired
   - Checks if already marked today
   - Checks rate limiting (not too many scans)
   - Inserts attendance record
   ↓
8. Returns success message
   ↓
9. Frontend shows "Attendance marked!" ✅
   ↓
10. Refreshes statistics
```

### Teacher Views Attendance

```
1. Teacher clicks "Attendance"
   ↓
2. teacher.js → viewAttendance(classId)
   ↓
3. Frontend sends: GET /api/teacher/attendance/:classId?date=2024-01-15
   ↓
4. Backend:
   - Gets all enrolled students
   - Checks attendance for selected date
   - Merges data (present/absent)
   ↓
5. Returns list with status for each student
   ↓
6. Frontend displays in table:
   - Student ID, Name
   - Status badge (present/absent)
   - Time marked
```

### Export to Excel

```
1. Teacher clicks "Export Excel"
   ↓
2. teacher.js → exportAttendance()
   ↓
3. Frontend sends: GET /api/teacher/export/:classId
   ↓
4. Backend:
   - Fetches attendance records
   - Creates Excel workbook (ExcelJS)
   - Formats with headers, colors
   - Sends as file download
   ↓
5. Browser downloads file: attendance_CS101_1234567890.xlsx
```

---

## 🔐 Security Measures

### Password Security
```javascript
// In auth.js:
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// Passwords are NEVER stored in plain text
// Database stores: $2a$10$rQ8K5O.5YLKGzFKYKLv9Ve...
```

### JWT Tokens
```javascript
// Creating token (in login):
const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);

// Verifying token (in middleware):
jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
});
```

### SQL Injection Prevention
```javascript
// ❌ NEVER do this:
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ ALWAYS use parameterized queries:
db.query('SELECT * FROM users WHERE email = $1', [email]);
```

### Rate Limiting
```javascript
// In server.js:
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                    // 100 requests per IP
});
```

---

## 📊 Database Relationships

```
users (teachers)
  |
  | (1 to Many)
  |
  ↓
classes
  |
  | (Many to Many through enrollments)
  |
  ↓
class_enrollments
  |
  | (connects to)
  |
  ↓
users (students)

---

classes
  |
  | (1 to Many)
  |
  ↓
qr_sessions

---

classes + students
  |
  | (create)
  |
  ↓
attendance records
```

---

## 🎨 Frontend Architecture

### Component Structure
```
Login Page
└── Login Form
    ├── Email Input
    ├── Password Input
    └── Submit Button

Teacher Dashboard
├── Navbar
├── Classes Grid
│   └── Class Cards
│       ├── Class Info
│       ├── Generate QR Button
│       └── View Attendance Button
├── QR Modal
│   ├── QR Image
│   ├── Timer
│   └── Regenerate Button
└── Attendance Modal
    ├── Date Picker
    ├── Statistics
    ├── Attendance Table
    └── Export Button

Student Dashboard
├── Navbar
├── Scan Button
├── Scanner Modal
│   ├── Camera View
│   └── Scan Result
├── Statistics Cards
└── Recent Attendance List
```

---

## 💡 Key Technologies Explained

### Express.js
```javascript
// Why we use it:
- Simplifies creating web servers
- Easy routing
- Middleware support
- Large ecosystem

// Example:
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello World!' });
});
```

### PostgreSQL
```sql
-- Why we use it:
- Reliable and mature
- ACID compliant (data integrity)
- Great for relational data
- Open source

-- Example:
SELECT u.full_name, c.class_name, a.status
FROM users u
JOIN attendance a ON u.id = a.student_id
JOIN classes c ON a.class_id = c.id
WHERE a.session_date = CURRENT_DATE;
```

### JWT (JSON Web Tokens)
```
Why we use it:
- Stateless authentication
- Contains user data (no DB lookup needed)
- Secure (signed with secret)
- Industry standard

Structure:
header.payload.signature
eyJhbGc.eyJ1c2Vy.SflKxwRJ
```

---

## 🚀 Performance Considerations

### Database Indexes
```sql
-- Added for fast lookups:
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_attendance_class_date ON attendance(class_id, session_date);

-- Why:
- Makes queries 10-100x faster
- Essential for large datasets
```

### Connection Pooling
```javascript
// In database.js:
const pool = new Pool({
    max: 20  // Reuse connections instead of creating new ones
});

// Why:
- Faster than creating new connections
- Reduces database load
- Handles concurrent requests
```

### Frontend Optimization
```javascript
// Load data once, cache in memory:
let cachedClasses = null;

async function loadClasses() {
    if (cachedClasses) {
        displayClasses(cachedClasses);
        return;
    }
    const response = await apiCall('/teacher/classes');
    cachedClasses = response.classes;
    displayClasses(cachedClasses);
}
```

---

## 📝 Code Comments Legend

In the code, you'll see comments like:

```javascript
// TODO: Add feature here
// FIXME: Bug in this function
// NOTE: Important information
// HACK: Temporary solution
// XXX: Warning, be careful
```

---

## 🎓 Learning Path Through Code

### Beginner Path
1. Start with `login.html` - See basic HTML structure
2. Read `css/styles.css` - Learn styling
3. Check `js/auth.js` - Simple form handling
4. Look at `config/database.js` - Database basics

### Intermediate Path
1. Study `routes/auth.js` - API endpoints
2. Analyze `middleware/auth.js` - Security
3. Read `routes/teacher.js` - Complex logic
4. Explore `js/teacher.js` - Frontend integration

### Advanced Path
1. Understand `server.js` - Full architecture
2. Master `routes/student.js` - Real-time features
3. Optimize `database/schema.sql` - Database design
4. Deploy using `DEPLOYMENT.md` - DevOps

---

## 🔍 Debugging Tips

### Backend Issues
```bash
# Check server logs:
npm start
# Look for errors in terminal

# Test endpoints directly:
# Use Postman or curl
curl http://localhost:5000/api/health
```

### Frontend Issues
```javascript
// Add console.logs everywhere:
console.log('Button clicked');
console.log('API response:', response);

// Check browser console:
// Right-click page → Inspect → Console tab
```

### Database Issues
```bash
# Connect to database:
psql -U postgres -d attendance_db

# Check data:
SELECT * FROM users;
SELECT * FROM attendance ORDER BY marked_at DESC LIMIT 10;
```

---

## 📚 Further Reading

- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [JavaScript Modern Syntax](https://javascript.info/)
- [REST API Design](https://restfulapi.net/)

---

**This completes the project structure documentation!**

Understanding this structure will help you:
- Navigate the codebase confidently
- Add new features
- Debug issues
- Learn web development concepts

Keep this as a reference! 📖
