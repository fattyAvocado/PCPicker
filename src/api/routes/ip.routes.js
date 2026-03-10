const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  getIPRules,
  addIPRule,
  updateIPRule,
  deleteIPRule,
  checkIP
} = require('../controllers/ip.controller');

// All routes require admin access
router.use(protect, authorize('admin'));

router.get('/', getIPRules);
router.post('/', validate('ipRule'), addIPRule);
router.put('/:id', validate('ipRule'), updateIPRule);
router.delete('/:id', deleteIPRule);
router.get('/check/:address', checkIP);

module.exports = router;