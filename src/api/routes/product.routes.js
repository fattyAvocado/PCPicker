const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  getProducts,
  getProductById,
  getProductsByCategoryName,
  getProductsByCategoryId,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  deleteProductImage
} = require('../controllers/product.controller');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Public routes - order matters! More specific routes first
router.get('/category/:categoryName', getProductsByCategoryName);
router.get('/category/id/:categoryId', getProductsByCategoryId);
router.get('/', getProducts);
router.get('/:id', getProductById); // This should come after more specific routes

// Admin only routes
router.post('/', 
  protect, 
  authorize('admin'), 
  upload.array('images', 5),
  validate('createProduct'),
  createProduct
);

router.put('/:id', 
  protect, 
  authorize('admin'), 
  upload.array('images', 5),
  validate('updateProduct'),
  updateProduct
);

router.delete('/:id', 
  protect, 
  authorize('admin'), 
  deleteProduct
);

router.post('/:id/images', 
  protect, 
  authorize('admin'), 
  upload.single('image'),
  uploadProductImage
);

router.delete('/:id/images/:imageId', 
  protect, 
  authorize('admin'), 
  deleteProductImage
);

module.exports = router;