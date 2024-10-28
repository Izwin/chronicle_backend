const admin = require('firebase-admin');
const serviceAccount = require('../chronicle-14043-firebase-adminsdk-1u115-73c5d9457d.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;