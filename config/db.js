// config/db.js
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    port: '3307',
    password: 'wkatnry12!',
    database: 'mywebdb'
});

db.connect((err) => {
    if (err) {
        console.error('DB 연결 오류:', err);
    } else {
        console.log('MySQL 연결 성공');
    }
});

module.exports = db;
