const bcrypt = require('bcryptjs');

// The hash stored in the database (copy from Supabase)
const hashFromDB = '\\\.uMGJ7KZjYmQl4vN5pWxLmHqZoQxKvYqi';

// Password to test
const password = 'admin123';

// Test comparison
const isValid = bcrypt.compareSync(password, hashFromDB);

console.log('Hash from DB:', hashFromDB);
console.log('Tested password:', password);
console.log('Result:', isValid ? 'MATCH ✅' : 'NO MATCH ❌');

// Generate new hash
const newHash = bcrypt.hashSync(password, 10);
console.log('\nNew hash generated:', newHash);
