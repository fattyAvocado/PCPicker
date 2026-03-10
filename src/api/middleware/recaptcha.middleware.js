const RecaptchaService = require('../../services/recaptcha.service');

// For reCAPTCHA v3
exports.verifyRecaptcha = async (req, res, next) => {
  try {
    const token = req.body.recaptchaToken || req.headers['x-recaptcha-token'];
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA token is required'
      });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await RecaptchaService.verifyToken(token, clientIp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed',
        error: result.error
      });
    }

    // Attach recaptcha info to request for logging/monitoring
    req.recaptcha = {
      score: result.score,
      action: result.action
    };

    next();
  } catch (error) {
    console.error('reCAPTCHA middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'reCAPTCHA verification error'
    });
  }
};

// For reCAPTCHA v2
exports.verifyRecaptchaV2 = async (req, res, next) => {
  try {
    const token = req.body.recaptchaToken || req.headers['x-recaptcha-token'];
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA token is required'
      });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await RecaptchaService.verifyV2Token(token, clientIp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed',
        error: result.error
      });
    }

    next();
  } catch (error) {
    console.error('reCAPTCHA middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'reCAPTCHA verification error'
    });
  }
};

// Optional: Rate limit based on reCAPTCHA score
exports.recaptchaRateLimit = (req, res, next) => {
  // You can implement custom rate limiting based on reCAPTCHA score
  // For example, lower scores get stricter rate limits
  const score = req.recaptcha?.score || 0;
  
  if (score < 0.3) {
    // Very suspicious - you might want to block or add extra verification
    return res.status(403).json({
      success: false,
      message: 'Suspicious activity detected. Please try again later.'
    });
  }
  
  next();
};