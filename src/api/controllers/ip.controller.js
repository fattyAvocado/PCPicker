const IP = require('../../models/IP');

// @desc    Get all IP rules
// @route   GET /api/ip
// @access  Private/Admin
exports.getIPRules = async (req, res, next) => {
  try {
    const { type } = req.query;
    
    const query = {};
    if (type) query.type = type;

    const ips = await IP.find(query)
      .populate('addedBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: ips.length,
      data: ips
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add IP to whitelist/blacklist
// @route   POST /api/ip
// @access  Private/Admin
exports.addIPRule = async (req, res, next) => {
  try {
    const { address, type, reason, expiresAt } = req.body;

    // Check if IP already exists
    const existingIP = await IP.findOne({ address });
    if (existingIP) {
      return res.status(400).json({
        success: false,
        message: 'IP already has a rule'
      });
    }

    const ip = await IP.create({
      address,
      type,
      reason,
      expiresAt,
      addedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: ip
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update IP rule
// @route   PUT /api/ip/:id
// @access  Private/Admin
exports.updateIPRule = async (req, res, next) => {
  try {
    const ip = await IP.findByIdAndUpdate(
      req.params.id,
      { ...req.body, addedBy: req.user.id },
      { new: true, runValidators: true }
    );

    if (!ip) {
      return res.status(404).json({
        success: false,
        message: 'IP rule not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ip
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete IP rule
// @route   DELETE /api/ip/:id
// @access  Private/Admin
exports.deleteIPRule = async (req, res, next) => {
  try {
    const ip = await IP.findByIdAndDelete(req.params.id);

    if (!ip) {
      return res.status(404).json({
        success: false,
        message: 'IP rule not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'IP rule deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check IP status
// @route   GET /api/ip/check/:address
// @access  Private/Admin
exports.checkIP = async (req, res, next) => {
  try {
    const { address } = req.params;

    const ip = await IP.findOne({
      address,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        address,
        status: ip ? ip.type : 'allowed',
        rule: ip
      }
    });
  } catch (error) {
    next(error);
  }
};