const admin = require('../config/firebase');
const User = require('../models/User');

exports.loginWithGoogle = async (req, res) => {
    const idToken = req.headers.authorization.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, displayName, photoURL } = decodedToken;

        let user = await User.findOne({ firebaseId: uid });
        if (!user) {
            user = await User.create({ firebaseId: uid, name: displayName, photoURL });
        }

        res.json({ user });
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};
