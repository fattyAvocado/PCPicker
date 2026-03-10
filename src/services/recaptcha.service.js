const axios = require('axios');

class RecaptchaService {
  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY;
    this.verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    this.minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE) || 0.5;
  }

  async verifyToken(token, remoteIp = null) {
    try {
      if (!token) {
        return {
          success: false,
          error: 'No reCAPTCHA token provided'
        };
      }

      const params = new URLSearchParams();
      params.append('secret', this.secretKey);
      params.append('response', token);
      
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await axios.post(this.verifyUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = response.data;

      if (!data.success) {
        return {
          success: false,
          error: data['error-codes'] || 'reCAPTCHA verification failed'
        };
      }

      // Check score for v3
      if (data.score !== undefined && data.score < this.minScore) {
        return {
          success: false,
          error: `reCAPTCHA score too low: ${data.score}`,
          score: data.score
        };
      }

      return {
        success: true,
        score: data.score,
        action: data.action,
        hostname: data.hostname
      };

    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      return {
        success: false,
        error: 'reCAPTCHA verification service error'
      };
    }
  }

  // For reCAPTCHA v2
  async verifyV2Token(token, remoteIp = null) {
    try {
      if (!token) {
        return {
          success: false,
          error: 'No reCAPTCHA token provided'
        };
      }

      const params = new URLSearchParams();
      params.append('secret', this.secretKey);
      params.append('response', token);
      
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await axios.post(this.verifyUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = response.data;

      if (!data.success) {
        return {
          success: false,
          error: data['error-codes'] || 'reCAPTCHA verification failed'
        };
      }

      return {
        success: true,
        hostname: data.hostname
      };

    } catch (error) {
      console.error('reCAPTCHA v2 verification error:', error);
      return {
        success: false,
        error: 'reCAPTCHA verification service error'
      };
    }
  }
}

module.exports = new RecaptchaService();