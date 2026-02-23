const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function setupDatabase() {
    try {
        console.log('🚀 Starting database setup...');
        
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        let schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Remove SQL comments (lines starting with --)
        schema = schema
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');
        
        // Split by semicolon and execute each statement
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        
        for (let i = 0; i < statements.length; i++) {
            console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
            try {
                await db.query(statements[i]);
            } catch (err) {
                // Ignore DROP TABLE errors on first run
                if (err.code !== '42P01') {
                    throw err;
                }
                console.log(`   ℹ️  Table already dropped (expected on first run)`);
            }
        }
        
        console.log('✅ Database setup completed successfully!');
        console.log('📊 Tables created and sample data loaded');
        console.log('\n🎓 Sample Credentials:');
        console.log('  Teacher: teacher1@university.edu / password123');
        console.log('  Student: student1@university.edu / password123');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

setupDatabase();
