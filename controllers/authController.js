// controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

exports.signup = async (req, res) => {
    const { username, password, email, referrer_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    User.createUser({ username, password: hashedPassword, email, referrer_id }, (err, result) => {
        if (err) {
            return res.status(500).json({ message: '회원가입 오류' });
        }
        res.status(200).json({ message: '회원가입 성공' });
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    User.findUserByEmail(email, async (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        const token = jwt.sign({ userId: user.user_id }, 'jwtSecret', { expiresIn: '1h' });
        res.status(200).json({ token });
    });
};
