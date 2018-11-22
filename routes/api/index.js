const express = require('express');
const router = express.Router();

router.use('/chat', require('./chat'));

module.exports = router;