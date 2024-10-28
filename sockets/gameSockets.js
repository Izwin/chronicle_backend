const { sendGameStateToClients, startPhaseTimer, endWritingPhase, endVotingPhase, handleClientReconnect} = require('../utills/gameUtills');
const Game = require('../models/Game');

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('joinGame', async (gameId) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                const isAlreadyParticipant = game.participants.some(participant => participant.userId.toString() === socket.user.id);

                if (isAlreadyParticipant) {
                    socket.join(gameId);
                } else {
                    if (game.participants.length >= game.maxPlayers) {
                        socket.emit('error', { message: 'Game is full' });
                        return;
                    }

                    game.participants.push({ userId: socket.user.id, hasSubmitted: false });
                    await game.save();
                    socket.join(gameId);
                }

                sendGameStateToClients(gameId, io);
                socket.emit('joined', { message: 'Successfully joined/rejoined the game', gameId });
            } catch (error) {
                socket.emit('error', { message: 'Error joining game' });
            }
        });

        socket.on('joinGameByCode', async (gameCode) => {
            try {
                const game = await Game.findOne({ gameCode });
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                const isAlreadyParticipant = game.participants.some(participant => participant.userId.toString() === socket.user.id);
                if (isAlreadyParticipant) {
                    socket.join(game._id.toString());
                    handleClientReconnect(game._id.toString(), io);
                } else {
                    if (game.participants.length >= game.maxPlayers) {
                        socket.emit('error', { message: 'Game is full' });
                        return;
                    }

                    game.participants.push({ userId: socket.user.id, hasSubmitted: false });
                    await game.save();
                    socket.join(game._id.toString());
                }

                sendGameStateToClients(game._id.toString(), io);
                socket.emit('joined', { message: 'Successfully joined the game', gameId: game._id });
            } catch (error) {
                socket.emit('error', { message: 'Error joining game' });
            }
        });

        socket.on('cancelGame', async (gameId) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                if (game.phase !== 'waiting') {
                    socket.emit('error', { message: 'Game cannot be canceled after it has started' });
                    return;
                }

                const creator = game.participants.find(p => p.isCreator && p.userId.toString() === socket.user.id);
                if (!creator) {
                    socket.emit('error', { message: 'Only the creator can cancel the game' });
                    return;
                }

                game.phase = 'canceled';
                await game.save();
                sendGameStateToClients(gameId, io);
            } catch (error) {
                socket.emit('error', { message: 'Error canceling game' });
            }
        });

        socket.on('leaveGame', async (gameId) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return; 
                }

                const isParticipant = game.participants.some(participant => participant.userId.toString() === socket.user.id);
                if (!isParticipant) {
                    socket.emit('error', { message: 'User is not a participant of this game' });
                    return;
                }

                game.participants = game.participants.filter(participant => participant.userId.toString() !== socket.user.id);
                await game.save();
                socket.leave(gameId);
                sendGameStateToClients(gameId, io);
                socket.emit('leftGame', { message: 'You have successfully left the game', gameId });

                if (game.participants.length === 0) {
                    game.phase = 'finished';
                    await game.save();
                    io.to(gameId).emit('gameEnded', { message: 'Game has ended due to no participants' });
                }
            } catch (error) {
                socket.emit('error', { message: 'Error leaving game' });
            }
        });

        socket.on('kickParticipant', async ({ gameId, participantId }) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                const creator = game.participants.find(p => p.isCreator && p.userId.toString() === socket.user.id);
                if (!creator) {
                    socket.emit('error', { message: 'Only the creator can kick participants' });
                    return;
                }

                const participant = game.participants.find(p => p.userId.toString() === participantId);
                if (!participant) {
                    socket.emit('error', { message: 'Participant not found' });
                    return;
                }

                game.participants = game.participants.filter(p => p.userId.toString() !== participantId);
                await game.save();
                sendGameStateToClients(gameId, io);

                const participantSocket = Array.from(io.sockets.sockets.values()).find(s => s.user?.id === participantId);
                if (participantSocket) {
                    participantSocket.leave(gameId);
                    participantSocket.emit('kicked', { message: 'You have been kicked from the game', gameId });
                }
            } catch (error) {
                socket.emit('error', { message: 'Error kicking participant' });
            }
        });

        socket.on('submitText', async ({ gameId, text }) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                const userId = socket.user?.id;
                if (!userId) {
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }

                const participant = game.participants.find(p => p.userId.toString() === userId);
                if (participant && game.phase === 'writing') {
                    if (participant.hasSubmitted) {
                        socket.emit('error', { message: 'Text has already been submitted for this round' });
                        return;
                    }

                    participant.text = text;
                    participant.hasSubmitted = true;
                    await game.save();

                    const allSubmitted = game.participants.every(p => p.hasSubmitted);
                    if (allSubmitted) {
                        await endWritingPhase(gameId, io);
                    }

                    sendGameStateToClients(gameId, io);
                } else {
                    socket.emit('error', { message: 'Not allowed to submit text at this stage' });
                }
            } catch (error) {
                socket.emit('error', { message: 'Error submitting text' });
            }
        });

        socket.on('submitVote', async ({ gameId, votedFor }) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                const userId = socket.user?.id;
                if (!userId) {
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }

                const participant = game.participants.find(p => p.userId.toString() === userId);
                if (participant && game.phase === 'voting') {
                    if (participant.hasSubmitted) {
                        socket.emit('error', { message: 'You have already submitted your vote' });
                        return;
                    }

                    participant.votedFor = votedFor;
                    participant.hasSubmitted = true;
                    await game.save();

                    const allVoted = game.participants.every(p => p.hasSubmitted);
                    if (allVoted) {
                        await endVotingPhase(gameId, io);
                    }

                    sendGameStateToClients(gameId, io);
                } else {
                    socket.emit('error', { message: 'Not allowed to vote at this stage' });
                }
            } catch (error) {
                socket.emit('error', { message: 'Error submitting vote' });
            }
        });

        socket.on('manualNextPhase', async (gameId) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) return;

                const creator = game.participants.find(p => p.isCreator && p.userId.toString() === socket.user.id);
                if (!creator) return;

                if (game.phase === 'writing') {
                    await endWritingPhase({ params: { gameId } }, io);
                } else if (game.phase === 'voting') {
                    await endVotingPhase({ params: { gameId } }, io);
                }

                await game.save();
                sendGameStateToClients(gameId, io);
            } catch (error) {
            }
        });

        socket.on('startGame', async (gameId) => {
            try {
                const game = await Game.findById(gameId);
                if (!game) return;
        
                const userId = socket.user ? socket.user.id : null;
                if (!userId) {
                    return;
                }
        
                const creator = game.participants.find(p => p.isCreator && p.userId.toString() === userId);
                if (!creator) {
                    return;
                }
        
                game.phase = 'writing';
                game.currentRound = 1;
                game.remainingTime = game.roundTime;
        
                game.participants.forEach(participant => {
                    participant.hasSubmitted = false;
                    participant.text = '';
                });
        
                await game.save();
        
                startPhaseTimer(gameId, io);
                sendGameStateToClients(gameId, io);
            } catch (error) {
            }
        });
        
        // Обрабатываем отключение клиента
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};