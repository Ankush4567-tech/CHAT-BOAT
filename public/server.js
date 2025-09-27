require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Fetch last 50 messages
app.get('/api/messages', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, message, created_at FROM messages ORDER BY id DESC LIMIT 50'
    );
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected', socket.id);

  socket.on('sendMessage', async (data) => {
    try {
      const { username, message } = data;
      if (!username || !message) return;

      const [result] = await pool.query(
        'INSERT INTO messages (username, message) VALUES (?, ?)',
        [username, message]
      );

      const saved = {
        id: result.insertId,
        username,
        message,
        created_at: new Date()
      };

      io.emit('message', saved);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
});
