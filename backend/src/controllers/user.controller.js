import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';
import Media from '../models/media.model.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';
import bcrypt from 'bcryptjs';

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const userObj = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete userObj.passwordHash;
  return userObj;
};

// --- Get Profile ---
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).populate('profilePhoto');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json(sanitizeUser(user));
});

// --- Update Personal Info ---
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, district, taluka, language, farmInfo, groqApiKey } = req.body;

  const updateData = {
    fullName,
    address: { district, taluka },
    language,
    groqApiKey,
  };

  if (farmInfo) {
    updateData.farmInfo = farmInfo;
  }

  const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).populate('profilePhoto');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json(sanitizeUser(user));
});

// --- Update Farm Info ---
export const updateFarmInfo = asyncHandler(async (req, res) => {
  const { farmInfo } = req.body;

  if (!farmInfo) {
    return res.status(400).json({ message: 'Farm information is required' });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { farmInfo },
    { new: true }
  ).populate('profilePhoto');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    message: 'Farm information updated successfully',
    user: sanitizeUser(user)
  });
});

// --- Update Location ---
export const updateLocation = asyncHandler(async (req, res) => {
  const { longitude, latitude, district, taluka } = req.body;

  if (!longitude || !latitude) {
    return res.status(400).json({ message: 'Longitude and latitude are required' });
  }

  const locationObject = {
    type: 'Point',
    coordinates: [parseFloat(longitude), parseFloat(latitude)],
  };

  const updateData = {
    location: locationObject,
  };

  // Update address if provided
  if (district || taluka) {
    updateData.address = { district, taluka };
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true }
  ).populate('profilePhoto');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    message: 'Location updated successfully',
    user: sanitizeUser(user)
  });
});

// --- Upload/Update Profile Picture ---
export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // If user already has a photo, delete the old one from Cloudinary
  if (user.profilePhoto) {
    const oldMedia = await Media.findById(user.profilePhoto);
    if (oldMedia && oldMedia.publicId) {
      try {
        await deleteFromCloudinary(oldMedia.publicId);
      } catch (err) {
        console.error('Error deleting old photo from Cloudinary:', err);
      }
      await oldMedia.deleteOne();
    }
  }

  // Upload the new file to Cloudinary
  let result;
  try {
    result = await uploadToCloudinary(req.file, 'profile_photos');
  } catch (uploadError) {
    console.error('Cloudinary upload failed:', uploadError);
    return res.status(500).json({
      message: uploadError.message || 'Failed to upload photo to Cloudinary. Please check your network connection and Cloudinary configuration.'
    });
  }

  if (!result || !result.secure_url) {
    return res.status(500).json({ message: 'Upload succeeded but no URL was returned from Cloudinary' });
  }

  // Create a new media document in MongoDB
  const media = await Media.create({
    url: result.secure_url,
    publicId: result.public_id,
    uploadedBy: req.user.id,
    contentType: req.file.mimetype,
    size: req.file.size,
  });

  // Link the new media to the user and save
  user.profilePhoto = media._id;
  await user.save();
  await user.populate('profilePhoto');

  res.json({ message: 'Profile photo updated successfully', user: sanitizeUser(user) });
});

// --- Delete Profile Photo ---
export const deleteProfilePhoto = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (!user.profilePhoto) {
    return res.status(400).json({ message: 'No profile photo to delete' });
  }

  const media = await Media.findById(user.profilePhoto);

  // Delete from Cloudinary and then from MongoDB
  if (media && media.publicId) {
    try {
      await deleteFromCloudinary(media.publicId);
    } catch (err) {
      console.error('Error deleting photo from Cloudinary:', err);
    }
    await media.deleteOne();
  }

  user.profilePhoto = undefined;
  await user.save();
  await user.populate('profilePhoto');

  res.json({ message: 'Profile photo deleted successfully', user: sanitizeUser(user) });
});


// --- Change Password ---
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) return res.status(400).json({ message: 'Current password incorrect' });

  // Update password (will be hashed by pre-save hook)
  user.passwordHash = newPassword;
  await user.save();
  res.json({ message: 'Password changed successfully' });
});
