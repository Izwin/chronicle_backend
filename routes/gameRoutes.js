const express = require('express');
const { createGame, joinGame, getGame, getUserGames, checkGameByCode } = require('../controllers/gameController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create', authMiddleware, createGame);
router.get('/user-games', authMiddleware, getUserGames);
router.post('/:gameId/join', authMiddleware, joinGame);
router.get('/:gameId', authMiddleware, getGame);
router.get('/check/:gameCode', authMiddleware, checkGameByCode);

module.exports = router;
