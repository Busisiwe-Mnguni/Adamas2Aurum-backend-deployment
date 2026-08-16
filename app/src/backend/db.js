const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),  // was a string, needs to be a number
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      { rejectUnauthorized: false },  // required by Aiven
});

db.connect((err) => {
  if (err) {
    console.error('DB connection failed:', err);
    return;
  }
  console.log('Connected to MySQL');
});

module.exports = db;