-- Create Database Schema for Attendance Management System

-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS qr_sessions CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table (Teachers and Students)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
    full_name VARCHAR(255) NOT NULL,
    student_id VARCHAR(50) UNIQUE, -- Only for students
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses Table (Subjects)
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(50) UNIQUE NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    subject_description TEXT,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    credits INTEGER DEFAULT 3,
    semester VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes Table (Sections/Instances of Courses)
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    class_code VARCHAR(50) UNIQUE NOT NULL,
    class_name VARCHAR(255) NOT NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    schedule VARCHAR(255), -- e.g., "Mon/Wed/Fri 10:00-11:00"
    room_number VARCHAR(50),
    section VARCHAR(50), -- e.g., "Section A", "Section B"
    max_strength INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Class Enrollments (Students enrolled in classes)
CREATE TABLE class_enrollments (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, student_id)
);

-- QR Sessions (Active QR codes)
CREATE TABLE qr_sessions (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    session_date DATE DEFAULT CURRENT_DATE
);

-- Attendance Records
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_date DATE DEFAULT CURRENT_DATE,
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent')),
    marked_by VARCHAR(20) DEFAULT 'qr' CHECK (marked_by IN ('qr', 'manual')),
    UNIQUE(class_id, student_id, session_date)
);

-- Create Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_classes_course ON classes(course_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_enrollments_class ON class_enrollments(class_id);
CREATE INDEX idx_enrollments_student ON class_enrollments(student_id);
CREATE INDEX idx_qr_sessions_active ON qr_sessions(is_active, expires_at);
CREATE INDEX idx_attendance_class_date ON attendance(class_id, session_date);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- Insert Sample Data

-- Sample Teachers
INSERT INTO users (email, password, role, full_name, department) VALUES
('teacher1@university.edu', '$2a$10$520ZPifVBC/x.ej1yanLF.stbfGIFqNCkHUGv7QDWg6kZ6y5fLh5W', 'teacher', 'Dr. Rajesh Kumar', 'Computer Science'),
('teacher2@university.edu', '$2a$10$520ZPifVBC/x.ej1yanLF.stbfGIFqNCkHUGv7QDWg6kZ6y5fLh5W', 'teacher', 'Prof. Priya Sharma', 'Mathematics');
-- Password for both: password123

-- Sample Students
INSERT INTO users (email, password, role, full_name, student_id, department) VALUES
('student1@university.edu', '$2a$10$520ZPifVBC/x.ej1yanLF.stbfGIFqNCkHUGv7QDWg6kZ6y5fLh5W', 'student', 'Amit Patel', 'CS2021001', 'Computer Science'),
('student2@university.edu', '$2a$10$520ZPifVBC/x.ej1yanLF.stbfGIFqNCkHUGv7QDWg6kZ6y5fLh5W', 'student', 'Sneha Verma', 'CS2021002', 'Computer Science'),
('student3@university.edu', '$2a$10$520ZPifVBC/x.ej1yanLF.stbfGIFqNCkHUGv7QDWg6kZ6y5fLh5W', 'student', 'Rahul Singh', 'CS2021003', 'Computer Science'),
('student4@university.edu', '$2a$10$520ZPifVBC/x.ej1yanLF.stbfGIFqNCkHUGv7QDWg6kZ6y5fLh5W', 'student', 'Ananya Gupta', 'CS2021004', 'Computer Science');
-- Password for all: password123

-- Sample Courses
INSERT INTO courses (course_code, course_name, subject_description, teacher_id, credits, semester) VALUES
('CS101', 'Data Structures', 'Study of various data structures and algorithms', 1, 3, 'Spring 2026'),
('CS201', 'Database Management', 'Learn database design and SQL concepts', 1, 3, 'Spring 2026'),
('MATH101', 'Calculus II', 'Advanced calculus topics and applications', 2, 4, 'Spring 2026');

-- Sample Classes (sections/instances of courses)
INSERT INTO classes (class_code, class_name, course_id, teacher_id, schedule, room_number, section, max_strength) VALUES
('CS101-A', 'Data Structures - Section A', 1, 1, 'Mon/Wed 10:00-12:00', 'Lab-301', 'A', 30),
('CS101-B', 'Data Structures - Section B', 1, 1, 'Tue/Thu 10:00-12:00', 'Lab-302', 'B', 30),
('CS201-A', 'Database Management - Section A', 2, 1, 'Tue/Thu 14:00-16:00', 'Room-205', 'A', 35),
('MATH101-A', 'Calculus II - Section A', 3, 2, 'Mon/Wed/Fri 09:00-10:00', 'Room-101', 'A', 40);

-- Enroll students in classes
INSERT INTO class_enrollments (class_id, student_id) VALUES
(1, 3), (1, 4), (1, 5), (1, 6),  -- All 4 students in CS101-A
(2, 3), (2, 4), (2, 5),          -- 3 students in CS101-B
(3, 4), (3, 6),                  -- 2 students in CS201-A
(4, 5), (4, 6);                  -- 2 students in MATH101-A
