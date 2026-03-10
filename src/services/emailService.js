const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(user, token) {
    try {
      // Correct API endpoint - points to your backend API
      const verificationUrl = `${process.env.BACKEND_URL}/api/auth/verify/${token}`;
      
      // Also provide frontend link for better UX (optional)
      const frontendRedirectUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
      
      const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: 'Email Verification',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f9f9f9;
                border-radius: 8px;
                padding: 30px;
                border: 1px solid #e0e0e0;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #4CAF50;
              }
              .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #4CAF50;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
                font-weight: bold;
              }
              .button:hover {
                background-color: #45a049;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
                text-align: center;
              }
              .api-link {
                word-break: break-all;
                background-color: #f0f0f0;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 14px;
                margin: 10px 0;
              }
              .note {
                background-color: #fff3cd;
                border: 1px solid #ffeeba;
                color: #856404;
                padding: 10px;
                border-radius: 4px;
                margin: 20px 0;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🛍️ MyStore</div>
                <h1>Verify Your Email Address</h1>
              </div>
              
              <p>Hello <strong>${user.name} ${user.surname}</strong>,</p>
              
              <p>Thank you for registering with MyStore! Please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <div class="note">
                <strong>Note:</strong> This link will expire in 24 hours.
              </div>
              
              <p>If the button doesn't work, you can also copy and paste this API link into your browser:</p>
              <div class="api-link">${verificationUrl}</div>
              
              <p>After verification, you will be redirected to:</p>
              <div class="api-link">${frontendRedirectUrl}</div>
              
              <p>If you didn't create an account with us, please ignore this email.</p>
              
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} MyStore. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${user.email}:`, info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Email service error:', error);
      
      // Provide more specific error messages
      if (error.code === 'EAUTH') {
        console.error('Authentication failed. Check your email credentials.');
        console.error('If using Gmail, make sure you are using an App Password, not your regular password.');
        console.error('Generate an app password at: https://myaccount.google.com/apppasswords');
      } else if (error.code === 'ESOCKET') {
        console.error('Connection error. Check your SMTP host and port.');
      }
      
      // Don't throw the error - log it but continue
      // This prevents the API from failing just because email fails
      return null;
    }
  }

  async sendPasswordResetEmail(user, token) {
    try {
      // Correct API endpoint - points to your backend API
      const resetUrl = `${process.env.BACKEND_URL}/api/auth/reset-password/${token}`;
      
      // Frontend redirect URL (optional)
      const frontendRedirectUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      
      const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f9f9f9;
                border-radius: 8px;
                padding: 30px;
                border: 1px solid #e0e0e0;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #dc3545;
              }
              .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #dc3545;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
                font-weight: bold;
              }
              .button:hover {
                background-color: #c82333;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
                text-align: center;
              }
              .api-link {
                word-break: break-all;
                background-color: #f0f0f0;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 14px;
                margin: 10px 0;
              }
              .warning {
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
                padding: 10px;
                border-radius: 4px;
                margin: 20px 0;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🔐 MyStore</div>
                <h1>Password Reset Request</h1>
              </div>
              
              <p>Hello <strong>${user.name} ${user.surname}</strong>,</p>
              
              <p>We received a request to reset your password. Click the button below to proceed:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.
              </div>
              
              <p>If the button doesn't work, copy and paste this API link:</p>
              <div class="api-link">${resetUrl}</div>
              
              <p>After resetting, you'll be redirected to:</p>
              <div class="api-link">${frontendRedirectUrl}</div>
              
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} MyStore. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${user.email}:`, info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Email service error:', error);
      return null;
    }
  }

  async sendOrderConfirmation(user, order) {
    try {
      // Order confirmation doesn't need a verification link
      const orderUrl = `${process.env.FRONTEND_URL}/orders/${order.orderId}`;
      
      const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: `Order Confirmation - ${order.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f9f9f9;
                border-radius: 8px;
                padding: 30px;
                border: 1px solid #e0e0e0;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #28a745;
              }
              .order-details {
                background-color: white;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border: 1px solid #e0e0e0;
              }
              .order-id {
                font-size: 18px;
                font-weight: bold;
                color: #28a745;
              }
              .item {
                border-bottom: 1px solid #e0e0e0;
                padding: 10px 0;
              }
              .total {
                font-size: 18px;
                font-weight: bold;
                text-align: right;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 2px solid #e0e0e0;
              }
              .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #28a745;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
                font-weight: bold;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🛒 MyStore</div>
                <h1>Thank You for Your Order!</h1>
              </div>
              
              <p>Hello <strong>${user.name} ${user.surname}</strong>,</p>
              
              <p>Your order has been confirmed and is being processed.</p>
              
              <div class="order-details">
                <p class="order-id">Order ID: ${order.orderId}</p>
                <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
                
                <h3>Items:</h3>
                ${order.items.map(item => `
                  <div class="item">
                    <p><strong>${item.name}</strong> x ${item.quantity}</p>
                    <p>Price: ₹${item.price} | Total: ₹${item.total}</p>
                  </div>
                `).join('')}
                
                <div class="total">
                  <p>Subtotal: ₹${order.subtotal}</p>
                  <p>Shipping: ₹${order.shippingCost}</p>
                  <p>Tax: ₹${order.tax}</p>
                  <p style="font-size: 20px;">Total: ₹${order.total}</p>
                </div>
              </div>
              
              <h3>Shipping Address:</h3>
              <p>
                ${order.shippingAddress.name}<br>
                ${order.shippingAddress.addressLine1}<br>
                ${order.shippingAddress.addressLine2 ? order.shippingAddress.addressLine2 + '<br>' : ''}
                ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}<br>
                Phone: ${order.shippingAddress.phone}
              </p>
              
              <div style="text-align: center;">
                <a href="${orderUrl}" class="button">Track Your Order</a>
              </div>
              
              <p>We'll notify you when your order ships.</p>
              
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} MyStore. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </body>
         
      `
    };

    await this.transporter.sendMail(mailOptions);
  }
  catch (error) {
      console.error('❌ Email service error:', error);
      return null;
}
  }
}

module.exports = new EmailService();