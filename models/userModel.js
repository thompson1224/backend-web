// models/userModel.js
const db = require('../config/db');

const User = {
    createUser: (user, callback) => {
        const query = `INSERT INTO users (username, password, email, referrer_id) VALUES (?, ?, ?, ?)`;
        db.query(query, [user.username, user.password, user.email, user.referrer_id], callback);
    },
    findUserByEmail: (email, callback) => {
        const query = `SELECT * FROM users WHERE email = ?`;
        db.query(query, [email], callback);
    }
};

module.exports = User;
