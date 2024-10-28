const admin = require('firebase-admin');
const User = require('../models/User');

const login = async (req, res) => {
    const { token } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, name, picture } = decodedToken;

    let user = await User.findOne({ firebaseId: uid }).select('-firebaseId');
    if (!user) {
        user = await User.create({ firebaseId: uid, name: name, photoUrl: picture });
    }

    res.json({
        name: user.name,
        photoUrl: user.photoUrl,
        _id: user.id
    });

    try {
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const userProfile = await User.findById(userId).select('-firebaseId');

        if (!userProfile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.status(200).json(userProfile);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
};

const updateProfile = async (req, res) => {
    const { avatar, name } = req.body;

    try {
        const userId = req.user.id;
        const userProfile = await User.findOneAndUpdate(
            { userId },
            { avatar, name },
            { new: true }
        );

        if (!userProfile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.status(200).json(userProfile);
    } catch (error) {
        res.status(500).json({ error: 'Error updating profile' });
    }
};

module.exports = {
    login,
    getProfile,
    updateProfile
};
