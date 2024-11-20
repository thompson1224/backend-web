// index.js
require('dotenv').config(); // .env 파일을 로드

const jwtSecret = process.env.JWT_SECRET; // JWT_SECRET 값을 환경 변수에서 불러옵니다.

console.log("JWT_SECRET:", process.env.JWT_SECRET);


const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
const cors = require('cors');

app.use(cors()); // 모든 요청 허용
app.use(express.json());

// MySQL 연결 설정
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    port: '3307',
    password: 'wkatnry12!',
    database: 'mywebdb'
});

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    port: '3307',
    password: 'wkatnry12!',
    database: 'mywebdb',
    waitForConnections: true,  // 연결 대기 설정
    connectionLimit: 10,      // 연결 풀의 최대 연결 수
    queueLimit: 0             // 대기 큐 제한
});

db.connect((err) => {
    if (err) {
        console.error('DB 연결 오류:', err);
    } else {
        console.log('MySQL 연결 성공');
    }
});



// 회원가입 API
app.post('/signup', async (req, res) => {
    const { username, email, password, recommender_id } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: '모든 필드를 입력하세요.' });
    }

    try {
        // 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(password, 10);

        // 추천인 ID가 없으면 null로 처리
        const finalRecommenderId = recommender_id || null;

        // DB에 사용자 정보 저장
        const query = 'INSERT INTO users (username, email, password, recommender_id) VALUES (?, ?, ?, ?)';
        db.query(query, [username, email, hashedPassword, finalRecommenderId], (err, result) => {
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

        

        // 로그인 시 비밀번호 출력 (디버깅 용도)
        console.log(`입력된 비밀번호: ${password}`);
        console.log(`저장된 암호화된 비밀번호: ${user.password}`);

        // 비밀번호 검증
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('비밀번호 불일치:', password, user.password); // 디버깅 로그
            return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
        }

        // JWT 토큰 생성
        console.log('JWT_SECRET:', process.env.JWT_SECRET); // 비밀 키 확인

        const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });
        console.log('Generated token:', token); // 생성된 토큰 확인


        res.status(200).json({ message: '로그인 성공', token });
    });
});

//포인트
app.get('/user/points', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1]; // 토큰 추출
    if (!token) return res.status(401).json({ error: '인증되지 않은 요청' });

    console.log('JWT_SECRET:', process.env.JWT_SECRET); // 비밀 키 확인
    console.log('Received token:', token); // 받은 토큰 확인

    // JWT를 검증하고 사용자 정보를 추출합니다
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT 검증 오류:', err);
            return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
        }

        const userId = decoded.id;
        
        // DB에서 사용자 포인트 조회
        const query = 'SELECT points FROM users WHERE id = ?';
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
        console.log('디코딩된 토큰 데이터:', decoded); // 전체 디코딩 데이터 출력

        const username = decoded.username; // 토큰에서 username 추출

        console.log('디코딩된 사용자 이름:', username); // 디버깅: 로그인한 사용자 확인

        pool.query(
            `
            SELECT 
                u.username AS user_name,
                r.username AS recommender_name,
                u.created_at AS join_date
            FROM users u
            LEFT JOIN users r ON u.recommender_id = r.username
            WHERE r.username = ?; -- 로그인한 사용자를 추천인으로 등록한 사용자 조회
            `,
            [username],
            (error, results) => {
                if (error) {
                    console.error('쿼리 오류:', error);
                    return res.status(500).json({ error: '조직도 데이터를 가져오지 못했습니다.' });
                }

                console.log('쿼리 결과:', results); // 쿼리 결과 디버깅

                if (results.length === 0) {
                    return res.status(404).json({ message: '추천인 데이터가 없습니다.' });
                }

                // 데이터 트리 구조 변환
                const hierarchy = buildHierarchy(results);
                console.log('계층 데이터:', hierarchy); // 트리 구조 디버깅
                res.status(200).json(hierarchy);
            }
        );
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
});

function buildHierarchy(users) {
    const map = {};
    const roots = [];

    users.forEach((user) => {
        map[user.user_name] = { ...user, children: [] };
    });

    users.forEach((user) => {
        if (user.recommender_name && map[user.recommender_name]) {
            map[user.recommender_name].children.push(map[user.user_name]);
        } else {
            roots.push(map[user.user_name]);
        }
    });

    return roots;
}

// 서버 실행
app.listen(3000, () => {
    console.log('서버 실행 중: http://localhost:3000');
});
