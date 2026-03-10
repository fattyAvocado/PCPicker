const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  getCategoryHierarchy,
  deleteCategory
} = require('../controllers/category.controller');

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategory);

// Admin routes
router.post('/', 
  protect, 
  authorize('admin'), 
  validate('createCategory'),
  createCategory
);

router.put('/:id', 
  protect, 
  authorize('admin'), 
  validate('updateCategory'),
  updateCategory
);

router.get('/:id/hierarchy',getCategoryHierarchy);

router.delete('/:id', 
  protect, 
  authorize('admin'), 
  deleteCategory
);

module.exports = router;