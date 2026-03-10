const IP = require('../../models/IP');

exports.ipFilter = async (req, res, next) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Check if IP is blacklisted
    const blacklisted = await IP.findOne({
      address: clientIp,
      type: 'blacklist',
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (blacklisted) {
      return res.status(403).json({
        success: false,
        message: 'Your IP has been blocked. Please contact administrator.'
      });
    }

    // Check if IP is whitelisted (for protected routes)
    const whitelisted = await IP.findOne({
      address: clientIp,
      type: 'whitelist',
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    // If route requires whitelist (admin routes) and IP not whitelisted
    if (req.baseUrl.includes('/admin') && !whitelisted) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Your IP is not whitelisted.'
      });
    }

    // Attach IP info to request
    req.clientIp = clientIp;
    req.isWhitelisted = !!whitelisted;
    
    next();
  } catch (error) {
    next(error);
  }
};
