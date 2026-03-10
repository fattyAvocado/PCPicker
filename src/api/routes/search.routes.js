const express = require('express');
const router = express.Router();
const {
  search,
  getSuggestions
} = require('../controllers/search.controller');

// Public routes
router.get('/', search);
router.get('/suggestions', getSuggestions);

module.exports = router;