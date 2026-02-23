const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Generate self-signed certificate using OpenSSL
const certDir = path.join(__dirname, 'certs');
const keyFile = path.join(certDir, 'server.key');
const certFile = path.join(certDir, 'server.cert');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
    console.log('📂 Created certs directory');
}

// Check if certificate already exists
if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    console.log('✅ Certificate already exists');
    process.exit(0);
}

// Generate self-signed certificate (valid for 365 days)
console.log('🔐 Generating self-signed SSL certificate...');
console.log('   This may take a moment...');

const command = `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/CN=192.168.29.180"`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error generating certificate:', error.message);
        console.log('\n📝 Alternative: Use ngrok (see instructions below)');
        process.exit(1);
    }
    
    console.log('✅ Certificate generated successfully!');
    console.log(`✅ Key file: ${keyFile}`);
    console.log(`✅ Cert file: ${certFile}`);
    console.log('\n🚀 You can now run: node server-https.js');
});
