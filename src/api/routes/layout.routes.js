const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  getLayout,
  updateLayout,
  addBanner,
  updateBanner,
  deleteBanner,
  addCustomSection,
  updateCustomSection,
  deleteCustomSection
} = require('../controllers/layout.controller');

// Public route
router.get('/', getLayout);

// Admin routes
router.put('/', 
  protect, 
  authorize('admin'), 
  validate('updateLayout'),
  updateLayout
);

// Banner routes
router.post('/banner', 
  protect, 
  authorize('admin'), 
  validate('banner'),
  addBanner
);

router.put('/banner/:bannerId', 
  protect, 
  authorize('admin'), 
  validate('banner'),
  updateBanner
);

router.delete('/banner/:bannerId', 
  protect, 
  authorize('admin'), 
  deleteBanner
);

// Custom section routes
router.post('/sections', 
  protect, 
  authorize('admin'), 
  validate('customSection'),
  addCustomSection
);

router.put('/sections/:sectionId', 
  protect, 
  authorize('admin'), 
  validate('customSection'),
  updateCustomSection
);

router.delete('/sections/:sectionId', 
  protect, 
  authorize('admin'), 
  deleteCustomSection
);

module.exports = router;