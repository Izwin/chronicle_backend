const Game = require('../models/Game');

const sendGameStateToClients = async (gameId, io) => {
    try {
        const game = await Game.findById(gameId).populate('participants.userId');
        if (!game) {
            return;
        }

        const userMap = new Map(game.participants.map(participant => {
            return [
                participant.userId._id.toString(),
                {
                    id: participant.userId._id.toString(),
                    name: participant.userId.name,
                    photoUrl: participant.userId.photoUrl,
                    text: participant.text,
                    isCreator: participant.isCreator,
                    hasSubmitted: participant.hasSubmitted
                }
            ];
        }));

        const gameData = {
            id: game._id,
            name: game.name,
            gameCode: game.gameCode,
            phase: game.phase,
            currentRound: game.currentRound,
            maxRounds: game.maxRounds,
            roundTime: game.roundTime,
            voteTime: game.voteTime,
            maxPlayers: game.maxPlayers,
            history: game.history.map(fragment => ({
                text: fragment.text,
                author: userMap.get(fragment.author.toString()),
                votes: fragment.votes
            })),
            remainingTime: game.remainingTime,
            participants: Array.from(userMap.values()),
        };

        io.to(gameId).emit('gameStateUpdate', gameData);
    } catch (error) {
        console.error('Error sending game state to clients:', error);
    }
};

const gameTimers = {};

const startPhaseTimer = (gameId, io) => {
    clearExistingTimer(gameId);

    gameTimers[gameId] = setInterval(async () => {
        try {
            const game = await Game.findById(gameId);
            if (!game || game.phase === 'finished') {
                clearExistingTimer(gameId);
                return;
            }

            game.remainingTime -= 1;
            await game.save();

            if (game.remainingTime <= 0) {
                await handlePhaseEnd(gameId, io, game);
            } else {
                sendGameStateToClients(gameId, io);
            }
        } catch (error) {
            clearExistingTimer(gameId);
        }
    }, 1000);
};

const clearExistingTimer = (gameId) => {
    if (gameTimers[gameId]) {
        clearInterval(gameTimers[gameId]);
        delete gameTimers[gameId];
    }
};

const handlePhaseEnd = async (gameId, io, game) => {
    if (game.phase === 'writing') {
        await endWritingPhase(gameId, io);
    } else if (game.phase === 'voting') {
        await endVotingPhase(gameId, io);
    }
};

const endWritingPhase = async (gameId, io) => {
    const game = await Game.findById(gameId);
    if (!game || game.phase !== 'writing') return;

    game.phase = 'voting';
    game.remainingTime = game.voteTime;
    game.participants.forEach(participant => {
        participant.hasSubmitted = false;
    });
    await game.save();

    startPhaseTimer(gameId, io);
    sendGameStateToClients(gameId, io);
};

const endVotingPhase = async (gameId, io) => {
    const game = await Game.findById(gameId);
    if (!game || game.phase !== 'voting') return;

    const winningFragment = calculateWinningFragment(game.participants);
    if (winningFragment) {
        game.history.push(winningFragment);
    }

    if (game.currentRound >= game.maxRounds) {
        game.phase = 'finished';
    } else {
        game.currentRound += 1;
        game.phase = 'writing';
        game.remainingTime = game.roundTime;
        startPhaseTimer(gameId, io);
    }

    game.participants.forEach(participant => {
        participant.hasSubmitted = false;
        participant.votedFor = null;
        participant.text = '';
    });

    await game.save();
    sendGameStateToClients(gameId, io);
};

const handleClientReconnect = async (gameId, io) => {
    try {
        const game = await Game.findById(gameId);
        if (!game) {
            return;
        }

        sendGameStateToClients(gameId, io);

        if (game.phase !== 'finished') {
            startPhaseTimer(gameId, io);
        }
    } catch (error) {}
};

const calculateWinningFragment = (participants) => {
    const voteCounts = {};

    participants.forEach(participant => {
        if (participant.votedFor) {
            voteCounts[participant.votedFor] = (voteCounts[participant.votedFor] || 0) + 1;
        }
    });

    let maxVotes = -1;
    let winner = null;

    participants.forEach(participant => {
        const votes = voteCounts[participant.userId.toString()] || 0;
        if (participant.text && votes > maxVotes) {
            maxVotes = votes;
            winner = {
                text: participant.text,
                author: participant.userId,
                votes: votes
            };
        }
    });

    return winner;
};

module.exports = {
    sendGameStateToClients,
    startPhaseTimer,
    endWritingPhase,
    endVotingPhase,
    calculateWinningFragment,
    handleClientReconnect
};
