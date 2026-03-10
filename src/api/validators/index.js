const { body, param, query, validationResult } = require('express-validator');

const validate = (method) => {
  switch (method) {
    case 'signup':
  return [
    body('name').notEmpty().withMessage('Name is required'),
    body('surname').notEmpty().withMessage('Surname is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('recaptchaToken').notEmpty().withMessage('reCAPTCHA token is required'),
    
    // Make address fields optional - only validate if provided
    body('addresses').optional().isArray().withMessage('Addresses must be an array'),
    body('addresses.*.addressLine1').optional().notEmpty().withMessage('Address line 1 is required if address is provided'),
    body('addresses.*.city').optional().notEmpty().withMessage('City is required if address is provided'),
    body('addresses.*.state').optional().notEmpty().withMessage('State is required if address is provided'),
    body('addresses.*.pincode').optional().notEmpty().withMessage('Pincode is required if address is provided'),
    body('addresses.*.name').optional().notEmpty(),
    body('addresses.*.phone').optional().notEmpty(),
    body('addresses.*.type').optional().isIn(['primary', 'secondary'])
  ];

case 'login':
  return [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('recaptchaToken').notEmpty().withMessage('reCAPTCHA token is required')
  ];
    
    case 'resendVerification':
      return [
        body('email').isEmail().withMessage('Please provide a valid email')
      ];
    
    case 'forgotPassword':
      return [
        body('email').isEmail().withMessage('Please provide a valid email')
      ];
    
    case 'resetPassword':
      return [
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      ];
    
    case 'updateProfile':
      return [
        body('name').optional().notEmpty(),
        body('surname').optional().notEmpty(),
        body('phone').optional().notEmpty()
      ];
    
    case 'changePassword':
      return [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
      ];
    
    case 'address':
      return [
        body('name').notEmpty().withMessage('Name is required'),
        body('phone').notEmpty().withMessage('Phone is required'),
        body('addressLine1').notEmpty().withMessage('Address line 1 is required'),
        body('city').notEmpty().withMessage('City is required'),
        body('state').notEmpty().withMessage('State is required'),
        body('pincode').notEmpty().withMessage('Pincode is required')
      ];
    
    case 'createProduct':
  return [
    body('name').notEmpty().withMessage('Product name is required'),
    body('heading').notEmpty().withMessage('Heading is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('brand').notEmpty().withMessage('Brand is required'),
    body('model').optional().isString(),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('cost').isNumeric().withMessage('Cost must be a number'),
    body('warranty').notEmpty().withMessage('Warranty is required'),
    body('units').isNumeric().withMessage('Units must be a number'),
    body('shippingTime').notEmpty().withMessage('Shipping time is required'),
    body('shippingCost').isNumeric().withMessage('Shipping cost must be a number')
  ];

case 'updateProduct':
  return [
    body('name').optional().notEmpty(),
    body('heading').optional().notEmpty(),
    body('description').optional().notEmpty(),
    body('category').optional().notEmpty(),
    body('brand').optional().isString(),
    body('model').optional().isString(),
    body('price').optional().isNumeric(),
    body('cost').optional().isNumeric(),
    body('units').optional().isNumeric(),
    body('shippingCost').optional().isNumeric()
  ];
    case 'createOrder':
      return [
        body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
        body('shippingAddress.name').notEmpty(),
        body('shippingAddress.phone').notEmpty(),
        body('shippingAddress.addressLine1').notEmpty(),
        body('shippingAddress.city').notEmpty(),
        body('shippingAddress.state').notEmpty(),
        body('shippingAddress.pincode').notEmpty()
      ];
    
    case 'verifyPayment':
      return [
        body('razorpayPaymentId').notEmpty(),
        body('razorpaySignature').notEmpty()
      ];
    
    case 'updateOrderStatus':
  return [
    body('status').isIn([
      'pending', 'accepted', 'ready_to_ship', 'picked_up', 
      'in_transit', 'delivered', 'cancelled', 'refunded'
    ]).withMessage('Invalid status'),
    body('note').optional().isString(),
    body('trackingNumber').optional().isString().custom((value, { req }) => {
      // Require tracking number for shipping-related statuses
      const shippingStatuses = ['ready_to_ship', 'picked_up', 'in_transit'];
      if (shippingStatuses.includes(req.body.status) && !value) {
        throw new Error('Tracking number is required for shipping statuses');
      }
      return true;
    })
  ];
    
    case 'addToCart':
      return [
        body('productId').notEmpty().withMessage('Product ID is required'),
        body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
      ];
    
    case 'updateCartItem':
      return [
        body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
      ];
    
    case 'createCategory':
      return [
        body('name').notEmpty().withMessage('Category name is required')
      ];
    
    case 'updateCategory':
      return [
        body('name').optional().notEmpty()
      ];
    
    case 'ipRule':
      return [
        body('address').isIP().withMessage('Valid IP address is required'),
        body('type').isIn(['whitelist', 'blacklist']).withMessage('Type must be whitelist or blacklist'),
        body('expiresAt').optional().isISO8601().toDate()
      ];
    
    case 'banner':
      return [
        body('imageUrl').notEmpty().withMessage('Image URL is required'),
        body('link').optional().isURL(),
        body('title').optional().notEmpty()
      ];
    
    case 'updateLayout':
      return [
        body('name').optional().notEmpty(),
        body('banner').optional().isArray(),
        body('topItems').optional().isArray(),
        body('customSections').optional().isArray()
      ];

      case 'customSection':
  return [
    body('title').notEmpty().withMessage('Section title is required'),
    body('type').isIn(['products', 'categories', 'custom']).withMessage('Type must be products, categories, or custom'),
    body('displayOrder').optional().isNumeric(),
    body('items').optional().isArray().custom((value, { req }) => {
      if (req.body.type === 'products' && (!value || value.length === 0)) {
        throw new Error('Items array is required for product sections');
      }
      return true;
    }),
    body('categories').optional().isArray().custom((value, { req }) => {
      if (req.body.type === 'categories' && (!value || value.length === 0)) {
        throw new Error('Categories array is required for category sections');
      }
      return true;
    })
  ];

case 'updateLayout':
  return [
    body('name').optional().notEmpty(),
    body('banner').optional().isArray(),
    body('topItems').optional().isArray(),
    body('customSections').optional().isArray().custom((sections) => {
      for (const section of sections) {
        if (section.type === 'categories' && !section.categories) {
          throw new Error('Category sections must have categories array');
        }
        if (section.type === 'products' && !section.items) {
          throw new Error('Product sections must have items array');
        }
      }
      return true;
    })
  ];
  }
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

module.exports = { validate, handleValidation };