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

db.connect((err) => {
    if (err) {
        console.error('DB 연결 오류:', err);
    } else {
        console.log('MySQL 연결 성공');
    }
});

// 회원가입 API
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: '모든 필드를 입력하세요.' });
    }

    try {
        // 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(password, 10);

        // DB에 사용자 정보 저장
        const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        db.query(query, [username, email, hashedPassword], (err, result) => {
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
        const token = jwt.sign({ id: user.id, email: user.email }, 'your_secret_key', {
            expiresIn: '1h',
        });

        res.status(200).json({ message: '로그인 성공', token });
    });
});

app.get('/user/points', (req, res) => {
    const token = req.headers['authorization'].split(' ')[1]; // 토큰 추출
    if (!token) return res.status(401).json({ error: '인증되지 않은 요청' });
  
    // JWT를 검증하고 사용자 정보를 추출합니다
    jwt.verify(token, 'your_secret_key', (err, decoded) => {
      if (err) return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
  
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

// 서버 실행
app.listen(3000, () => {
    console.log('서버 실행 중: http://localhost:3000');
});
