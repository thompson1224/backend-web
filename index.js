// index.js
require('dotenv').config(); // .env 파일을 로드

const jwtSecret = process.env.JWT_SECRET; // JWT_SECRET 값을 환경 변수에서 불러옵니다.


const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
const cors = require('cors');

app.use(cors()); // 모든 요청 허용
app.use(express.json());

// MySQL 연결 설정
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     port: '3307',
//     password: 'wkatnry12!',
//     database: 'mywebdb'
// });

const db = mysql.createConnection({
    host: 'sql107.infinityfree.com',
    user: 'if0_37825660',
    port: '3306',
    password: '84PRFHvqBFHeQZz',
    database: 'if0_37825660_testdb'
});

// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     port: '3307',
//     password: 'wkatnry12!',
//     database: 'mywebdb',
//     waitForConnections: true,  // 연결 대기 설정
//     connectionLimit: 10,      // 연결 풀의 최대 연결 수
//     queueLimit: 0             // 대기 큐 제한
// });

db.connect((err) => {
    if (err) {
        console.error('DB 연결 오류:', err);
    } else {
        console.log('MySQL 연결 성공');
    }
});

// 인증 미들웨어
const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer 토큰 추출
    if (!token) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // 토큰 검증
        console.log('인증 미들웨어 정보', decoded);
        req.userId = decoded.userId; // 토큰에서 사용자 ID 추출
        console.log('인증 미들웨어 정보', req.userId);

        next(); // 다음 미들웨어로 이동
    } catch (err) {
        console.error('JWT 검증 오류:', err);
        res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
};




// 회원가입 API
app.post('/signup', async (req, res) => {
    const { userid, email, password, recommender_id } = req.body;

    if (!userid || !email || !password) {
        return res.status(400).json({ error: '모든 필드를 입력하세요.' });
    }

    try {
        // 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(password, 10);

        // 추천인 ID가 없으면 null로 처리
        const finalRecommenderId = recommender_id || null;

        // DB에 사용자 정보 저장
        const query = 'INSERT INTO users (userid, email, password, recommender_id) VALUES (?, ?, ?, ?)';
        db.query(query, [userid, email, hashedPassword, finalRecommenderId], (err, result) => {
            if (err) {
                console.error('회원가입 오류:', err);
                return res.status(500).json({ error: '서버 오류' });
            }
            res.status(201).json({ message: '회원가입 성공!' });
        });
    } catch (err) {
        console.error('회원가입 처리 중 오류:', err);
        res.status(500).json({ error: '회원가입 중 문제가 발생했습니다.' });
    }
});

// 로그인 API
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
    }

    // 데이터베이스에서 사용자 검색
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('DB 쿼리 오류:', err);
            return res.status(500).json({ error: '서버 오류' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const user = results[0]; // DB에서 찾은 사용자 정보        

        // 비밀번호 검증
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('비밀번호 불일치:', password, user.password); // 디버깅 로그
            return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
        }

        // JWT 토큰 생성
        console.log('JWT_SECRET:', process.env.JWT_SECRET); // 비밀 키 확인

        const token = jwt.sign({ userId: user.userid, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });
        
        console.log('Generated token:', token); // 생성된 토큰 확인
        console.log('DB에서 찾은 사용자 정보:', user);


        res.status(200).json({ message: '로그인 성공', token });
    });
});

//포인트
app.get('/user/points', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1]; // 토큰 추출
    if (!token) return res.status(401).json({ error: '인증되지 않은 요청' });

    // JWT를 검증하고 사용자 정보를 추출합니다
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT 검증 오류:', err);
            return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
        }

        const userId = decoded.userId;
        
        // DB에서 사용자 포인트 조회
        const query = 'SELECT points FROM users WHERE userid = ?';
        db.query(query, [userId], (err, results) => {
            if (err) {
                console.error('포인트 조회 오류:', err);
                return res.status(500).json({ error: '서버 오류' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
            }

            const user = results[0];
            res.status(200).json({ points: user.points });
        });
    });
});

// 기본 테스트 라우트
app.get('/', (req, res) => {
    res.send('서버 동작 중');
});

// 서버 종료 시 DB 연결 종료
process.on('SIGINT', () => {
    db.end((err) => {
        if (err) {
            console.error('DB 연결 종료 오류:', err);
        } else {
            console.log('DB 연결 종료');
        }
        process.exit();
    });
});

app.get('/api/users/hierarchy', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '인증되지 않은 요청입니다.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.userId; // userId로 데이터 추출
        if (!username) {
            return res.status(400).json({ error: '토큰에 사용자 이름이 없습니다.' });
        }

        console.log('디코딩된 사용자 이름:', username);

        pool.query(
            `
            WITH RECURSIVE UserHierarchy AS (
                SELECT 
                    userid AS userid,
                    recommender_id,
                    created_at AS join_date
                FROM users
                WHERE userid = ?

                UNION ALL

                SELECT 
                    u.userid AS userid,
                    u.recommender_id,
                    u.created_at AS join_date
                FROM users u
                INNER JOIN UserHierarchy uh ON u.recommender_id = uh.userid
            )
            SELECT 
                userid,
                recommender_id,
                join_date
            FROM UserHierarchy;
            `,
            [username], // 로그인 사용자 이름
            (error, results) => {
                if (error) {
                    console.error('쿼리 오류:', error);
                    return res.status(500).json({ error: '쿼리 실행 실패' });
                }

                console.log('쿼리 결과:', results);

                if (results.length === 0) {
                    return res.status(404).json({ message: '추천인 데이터가 없습니다.' });
                }

                // 계층 구조로 변환
                const hierarchyData = buildHierarchy(results);

                // 변환된 계층 구조 반환
                res.status(200).json(hierarchyData);
            }
        );
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        res.status(401).json({ error: '토큰 검증 실패' });
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
        if (user.recommender_id) {
            // 추천인이 있는 경우 추천인의 children에 현재 사용자 추가
            if (map[user.recommender_id]) {
                map[user.recommender_id].children.push(map[user.userid]);
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

    // 필수 필드 체크
    if (!name || !description || price === undefined || stock === undefined) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    try {
        // 상품을 데이터베이스에 추가
        const insertQuery = 'INSERT INTO products (name, description, price, pointprice, bonuspoint , stock) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(insertQuery, [name, description, price, pointprice, bonuspoint, stock], (err, result) => {
            if (err) {
                console.error('상품 추가 오류:', err);
                return res.status(500).json({ error: '상품 추가 중 오류가 발생했습니다.' });
            }

            res.status(201).json({ message: '상품이 성공적으로 추가되었습니다.' });
        });
    } catch (err) {
        console.error('서버 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 상품 목록 조회 API
app.get('/products', (req, res) => {
    const selectQuery = 'SELECT * FROM products ORDER BY created_at DESC';

    db.query(selectQuery, (err, results) => {
        if (err) {
            console.error('상품 조회 오류:', err);
            return res.status(500).json({ error: '상품 조회 중 오류가 발생했습니다.' });
        }

        res.status(200).json(results); // 상품 목록 반환
    });
});

// 상품 상세 조회 API
app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
  
    const query = 'SELECT * FROM products WHERE id = ?';
    db.query(query, [id], (err, results) => {
      if (err) {
        console.error('상품 정보 불러오기 오류:', err);
        return res.status(500).json({ error: '상품 정보를 가져오는 데 실패했습니다.' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      }
  
      res.json(results[0]);
    });
  });

  //상품 구매 API
  app.post('/purchase', authenticateUser, async (req, res) => {
    console.log('인증된 사용자 ID:', req.userId); // 디버깅용 로그
    const { productId, quantity } = req.body;
    const userId = req.userId; // 인증된 사용자 ID

    try {
        // 1. 상품 정보 가져오기 (bonuspoint 포함)
        const query = 'SELECT * FROM products WHERE id = ?';
        const [product] = await db.promise().query(query, [productId]);

        if (product.length === 0) {
            return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
        }

        const productData = product[0];
        const totalPrice = productData.price * quantity;
        const totalBonusPoints = productData.bonuspoint * quantity; // 총 적립 포인트 계산

        // 2. 구매 내역 저장
        await db.promise().query(
            'INSERT INTO purchase_history (user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)',
            [userId, productId, quantity, totalPrice]
        );

        // 3. 포인트 적립 내역 저장
        await db.promise().query(
            'INSERT INTO point_history (user_id, type, points, description) VALUES (?, ?, ?, ?)',
            [userId, 'earn', totalBonusPoints, `${productData.name} 구매 적립`]
        );

        // 4. 사용자 포인트 업데이트
        await db.promise().query(
            'UPDATE users SET points = points + ? WHERE userid = ?',
            [totalBonusPoints, userId]
        );

        // 5. 응답 반환
        res.json({
            message: '구매가 완료되었습니다.',
            pointsEarned: totalBonusPoints,
            totalPrice,
        });
    } catch (error) {
        console.error('구매 처리 중 오류 발생:', error);
        res.status(500).json({ error: '구매 처리 중 오류가 발생했습니다.' });
    }
});

  


// 서버 실행
app.listen(3000, () => {
    console.log('서버 실행 중: http://localhost:3000');
});
