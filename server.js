const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const gameRoutes = require('./routes/gameRoutes');
const userRoutes = require('./routes/userRoutes');
const gameSockets = require('./sockets/gameSockets');
const { authenticateFirebaseToken } = require('./middleware/authMiddleware');

require('dotenv').config();

// Инициализация приложения Express
const app = express();

// Настройка CORS
app.use(cors());

// Middleware для обработки JSON
app.use(express.json());

// Подключение к базе данных MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Настройка HTTP-сервера и WebSocket
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Указывайте реальный домен или используйте '*' для тестирования
        methods: ['GET', 'POST']
    }
});

// Аутентификация всех WebSocket-соединений через Firebase токены
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.headers.authorization;
        console.log(socket.handshake.headers);

        const user = await authenticateFirebaseToken(token); 
        if (!user) throw new Error('Invalid token'); 
        socket.user = user; // Добавляем пользователя к сокету
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Запуск WebSocket логики
gameSockets(io);

// Подключение маршрутов
app.use('/api/games', gameRoutes); 
app.use('/api/users', userRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
