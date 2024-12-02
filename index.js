// index.js
require('dotenv').config();

const express = require('express');
const app = express();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

app.use(express.json());


// CORS 설정
const corsOptions = {
    origin: 'https://benevolent-96a945.netlify.app', // 허용할 도메인
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Preflight 요청 허용

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

pool.connect((err) => {
    if (err) {
        console.error('DB 연결 오류:', err.stack);
    } else {
        console.log('PostgreSQL 연결 성공');
    }
});

// 사용자 인증 미들웨어
function authenticateUser(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '인증되지 않은 요청입니다.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId; // 사용자 ID를 요청 객체에 추가
        next();
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
}

app.post('/signup', async (req, res) => {
    const { userid, username, email, password, referrerid } = req.body;

    if (!userid || !username||  !email || !password) {
        return res.status(400).json({ error: '모든 필드를 입력하세요.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const finalRecommenderId = referrerid || null;

        const query = 'INSERT INTO users (userid, username, email, password, referrerid) VALUES ($1, $2, $3, $4, $5)';
        await pool.query(query, [userid, username, email, hashedPassword, finalRecommenderId]);

        res.status(201).json({ message: '회원가입 성공!' });
    } catch (err) {
        console.error('회원가입 처리 중 오류:', err);
        res.status(500).json({ error: '회원가입 중 문제가 발생했습니다.' });
    }
});

app.post('/login', (req, res) => {
    const { userid, password } = req.body;

    if (!userid || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
    }

    const query = 'SELECT * FROM users WHERE userid = $1';
    pool.query(query, [userid], async (err, results) => {
        if (err) {
            console.error('DB 쿼리 오류:', err);
            return res.status(500).json({ error: '서버 오류' });
        }

        if (results.rows.length === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const user = results.rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
        }

        const token = jwt.sign({ userId: user.userid, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(200).json({ message: '로그인 성공', token });
    });
});

//포인트
app.get('/user/points', authenticateUser, async (req, res) => {
    const userId = req.userId;

    try {
        const query = 'SELECT points FROM users WHERE userid = $1';
        const { rows } = await pool.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.status(200).json({ points: rows[0].points });
    } catch (err) {
        console.error('포인트 조회 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

app.get('/api/users/hierarchy', authenticateUser, async (req, res) => {
    const userId = req.userId;

    try {
        const query = `
            WITH RECURSIVE UserHierarchy AS (
                SELECT userid, referrerid, createdat AS join_date
                FROM users
                WHERE userid = $1

                UNION ALL

                SELECT u.userid, u.referrerid, u.createdat
                FROM users u
                INNER JOIN UserHierarchy uh ON u.referrerid = uh.userid
            )
            SELECT userid, referrerid, join_date
            FROM UserHierarchy;
        `;
        const { rows } = await pool.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: '추천인 데이터가 없습니다.' });
        }

        const hierarchyData = buildHierarchy(rows);
        res.status(200).json(hierarchyData);
    } catch (err) {
        console.error('계층 조회 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

function buildHierarchy(users) {
    const map = {}; // 각 사용자의 정보를 저장할 맵
    const roots = []; // 최상위 사용자들을 저장할 배열

    // 각 사용자 정보를 map에 추가하고 기본적으로 children 배열을 빈 배열로 설정
    users.forEach(user => {
        map[user.userid] = { ...user, children: [] }; 
    });

    // 계층 관계를 설정
    users.forEach(user => {
        if (user.referrerid) {
            // 추천인이 있는 경우 추천인의 children에 현재 사용자 추가
            if (map[user.referrerid]) {
                map[user.referrerid].children.push(map[user.userid]);
            }
        } else {
            // 추천인이 없으면 최상위 사용자로 추가
            roots.push(map[user.userid]);
        }
    });

    console.log('계층 구조:', roots); // 생성된 계층 구조 확인
    return roots; // 최상위 사용자부터 시작하는 계층 구조 반환
}


// 상품 추가 API
app.post('/add-product', async (req, res) => {
    const { name, description, price, pointprice, bonuspoint, stock } = req.body;

    if (!name || !description || price === undefined || stock === undefined) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    try {
        const query = `
            INSERT INTO products (name, description, price, pointprice, bonuspoint, stock) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await pool.query(query, [name, description, price, pointprice, bonuspoint, stock]);

        res.status(201).json({ message: '상품이 성공적으로 추가되었습니다.' });
    } catch (err) {
        console.error('상품 추가 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 상품 목록 조회 API
app.get('/products', async (req, res) => {
    try {
        const query = 'SELECT * FROM products ORDER BY created_at DESC';
        const { rows } = await pool.query(query);

        res.status(200).json(rows);
    } catch (err) {
        console.error('상품 조회 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 상품 상세 조회 API
app.get('/products/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = 'SELECT * FROM products WHERE id = $1';
        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('상품 상세 조회 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

  //상품 구매 API
  app.post('/purchase', authenticateUser, async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.userId;

    try {
        // 1. 상품 정보 가져오기
        const productQuery = 'SELECT * FROM products WHERE id = $1';
        const productResult = await pool.query(productQuery, [productId]);

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
        }

        const productData = productResult.rows[0];
        const totalPrice = productData.price * quantity;
        const totalBonusPoints = productData.bonuspoint * quantity;

        // 2. 구매 내역 저장
        const purchaseQuery = `
            INSERT INTO purchase_history (userid, product_id, quantity, total_price)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(purchaseQuery, [userId, productId, quantity, totalPrice]);

        // 5. 응답 반환
        res.json({
            message: '구매가 완료되었습니다.',
            pointsEarned: totalBonusPoints,
            totalPrice,
        });
    } catch (err) {
        console.error('구매 처리 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

app.get('/purchase-history', authenticateAdmin, async (req, res) => {
    const { userId, startDate, endDate } = req.query;

    try {
        // 기본 쿼리
        let query = `
            SELECT ph.id, ph.userid, p.name AS product_name, ph.status, ph.points_used, ph.points_earned, ph.purchase_date
            FROM purchase_history ph
            JOIN products p ON ph.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        // 필터 조건 추가
        if (userId) {
            query += ` AND ph.userid = $${params.length + 1}`;
            params.push(userId);
        }
        if (startDate) {
            query += ` AND ph.purchase_date >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND ph.purchase_date <= $${params.length + 1}`;
            params.push(endDate);
        }

        query += ' ORDER BY ph.purchase_date DESC';

        // 데이터베이스 조회
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('구매 내역 조회 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 서버 실행
app.listen(3000, () => {
    console.log('서버 실행 중:');
});
