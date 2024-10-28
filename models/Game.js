const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const participantSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isCreator: { type: Boolean, default: false },
    text: { type: String },
    votedFor: { type: Schema.Types.ObjectId, ref: 'User' },
    hasSubmitted: { type: Boolean, default: false },
});

const fragmentSchema = new Schema({
    text: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    votes: { type: Number, default: 0 },
});

const gameSchema = new Schema({
    name: { type: String, required: true },
    gameCode: { type: String, required: true, unique: true },
    roundTime: { type: Number, required: true },
    voteTime: { type: Number, required: true },
    maxRounds: { type: Number, default: 5 },
    maxPlayers: { type: Number, default: 10 },
    currentRound: { type: Number, default: 1 },
    phase: { type: String, enum: ['waiting', 'writing', 'voting', 'finished', 'canceled'], default: 'waiting' },
    remainingTime: { type: Number },
    history: [fragmentSchema],
    participants: [participantSchema],
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
