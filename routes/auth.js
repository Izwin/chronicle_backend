const express = require('express');
const { loginWithGoogle } = require('../controllers/authController');
const router = express.Router();

router.post('/login', loginWithGoogle);

module.exports = router;
