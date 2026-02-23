const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log(`Hash for "password123":`);
    console.log(hash);
    return hash;
}

generateHash();
