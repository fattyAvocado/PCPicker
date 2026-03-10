const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyRecaptcha } = require('../middleware/recaptcha.middleware');
const { validate, handleValidation } = require('../validators');
const { 
  signup, 
  login, 
  verifyEmail, 
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe 
} = require('../controllers/auth.controller');

// Apply reCAPTCHA to signup and login
router.post('/signup', verifyRecaptcha, validate('signup'), handleValidation, signup);
router.post('/login', verifyRecaptcha, validate('login'), handleValidation, login);

// Other routes (no reCAPTCHA needed)
router.get('/verify/:token', verifyEmail);
router.post('/resend-verification', validate('resendVerification'), handleValidation, resendVerification);
router.post('/forgot-password', validate('forgotPassword'), handleValidation, forgotPassword);
router.post('/reset-password/:token', validate('resetPassword'), handleValidation, resetPassword);
router.get('/me', protect, getMe);


// Test route to verify reCAPTCHA is working
router.post('/test-recaptcha', verifyRecaptcha, (req, res) => {
  res.json({
    success: true,
    message: 'reCAPTCHA verification successful',
    recaptcha: req.recaptcha
  });
});

module.exports = router;