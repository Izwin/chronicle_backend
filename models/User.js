const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firebaseId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        default: 'Anonymous'
    },
    photoUrl: {
        type: String,
        default: ''
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
