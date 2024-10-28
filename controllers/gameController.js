const Game = require('../models/Game');

const generateGameCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const createGame = async (req, res) => {
    try {
        const { name, maxRounds, roundTime, voteTime, maxPlayers } = req.body;
        const gameCode = generateGameCode();
        const newGame = new Game({
            name,
            gameCode,
            maxRounds,
            roundTime,
            voteTime,
            maxPlayers,
            participants: [{ userId: req.user?.id || null, hasSubmitted: false, isCreator: true }]
        });
        await newGame.save();
        res.status(201).json({ gameId: newGame._id, gameCode: newGame.gameCode });
    } catch (error) {
        res.status(500).json({ error: 'Error creating game' });
    }
};

const joinGame = async (req, res) => {
    const { gameId } = req.params;
    try {
        const game = await Game.findById(gameId);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.participants.length >= game.maxPlayers) {
            return res.status(400).json({ error: 'Game is full' });
        }
        if (game.participants.some(participant => participant.userId.toString() === req.user.id)) {
            return res.status(400).json({ error: 'User already joined the game' });
        }
        game.participants.push({ userId: req.user.id, hasSubmitted: false });
        await game.save();
        res.status(200).json({ message: 'Joined the game' });
    } catch (error) {
        res.status(500).json({ error: 'Error joining game' });
    }
};

const getGame = async (req, res) => {
    const { gameId } = req.params;
    try {
        const game = await Game.findById(gameId).populate('participants.userId', 'firebaseId name photoUrl').lean();
        if (!game) return res.status(404).json({ error: 'Game not found' });
        const participants = game.participants.map(participant => ({
            id: participant.userId._id,
            firebaseId: participant.userId.firebaseId,
            name: participant.userId.name,
            photoUrl: participant.userId.photoUrl,
            isCreator: participant.isCreator,
            hasSubmitted: participant.hasSubmitted,
            _id: participant._id
        }));
        return res.json({ 
            ...game,
            participants
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching game' });
    }
};

const getUserGames = async (req, res) => {
    try {
        const userId = req.user.id;
        const isActive = req.query.isActive;
        let query = {
            participants: { $elemMatch: { userId: userId } }
        };
        if (isActive === 'true') {
            query.phase = { $nin: ['finished', 'canceled'] };
        } else if (isActive === 'false') {
            query.phase = { $in: ['finished',] };
        }
        const games = await Game.find(query)
            .select('name phase currentRound maxRounds history participants gameCode maxPlayers voteTime roundTime')
            .populate('participants.userId')
            .populate('history.author');
        const userGames = games.map(game => {
            const participantMap = new Map(
                game.participants.map(participant => [
                    participant.userId._id.toString(),
                    {
                        id: participant.userId._id,
                        name: participant.userId.name,
                        photoUrl: participant.userId.photoUrl,
                        isCreator: participant.isCreator,
                        hasSubmitted: participant.hasSubmitted
                    }
                ])
            );
            return {
                id: game._id,
                gameCode: game.gameCode,
                name: game.name,
                isFinished: ['finished', 'canceled'].includes(game.phase),
                phase: game.phase,
                currentRound: game.currentRound,
                maxRounds: game.maxRounds,
                maxPlayers: game.maxPlayers,
                voteTime: game.voteTime,
                roundTime: game.roundTime,
                history: game.history.map(fragment => {
                    const authorDetails = participantMap.get(fragment.author._id.toString());
                    return {
                        text: fragment.text,
                        author: {
                            id: fragment.author._id,
                            name: fragment.author.name,
                            photoUrl: fragment.author.photoUrl,
                            isCreator: authorDetails.isCreator,
                            hasSubmitted: authorDetails.hasSubmitted
                        },
                        votes: fragment.votes
                    };
                }),
                participants: game.participants.map(participant => ({
                    id: participant.userId._id,
                    name: participant.userId.name,
                    photoUrl: participant.userId.photoUrl,
                    isCreator: participant.isCreator,
                    hasSubmitted: participant.hasSubmitted
                }))
            };
        });
        res.status(200).json(userGames);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user games' });
    }
};

const checkGameByCode = async (req, res) => {
    const { gameCode } = req.params;
    const userId = req.user._id;
    try {
        const game = await Game.findOne({ gameCode }).populate('participants.userId').lean();
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        if (game.phase !== 'waiting') {
            return res.status(400).json({ error: 'The game has already started or finished. You cannot join now.' });
        }
        if (game.participants.length >= game.maxPlayers) {
            return res.status(400).json({ error: 'The game has reached its maximum number of players.' });
        }
        const participants = game.participants.map(participant => ({
            id: participant.userId._id,
            name: participant.userId.name,
            photoUrl: participant.userId.photoUrl,
            isCreator: participant.isCreator,
            hasSubmitted: participant.hasSubmitted,
        }));
        const gameData = {
            id: game._id,
            name: game.name,
            gameCode: game.gameCode,
            phase: game.phase,
            currentRound: game.currentRound,
            isFinished: game.phase === 'finished',
            maxRounds: game.maxRounds,
            roundTime: game.roundTime,
            voteTime: game.voteTime,
            maxPlayers: game.maxPlayers,
            history: game.history,
            remainingTime: game.remainingTime,
            participants,
        };
        res.status(200).json(gameData);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching game by code' });
    }
};

module.exports = {
    createGame,
    joinGame,
    getGame,
    getUserGames,
    checkGameByCode,
};
