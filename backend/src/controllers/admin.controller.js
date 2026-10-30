import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';
import Media from '../models/media.model.js';
import AgronomistProfile from '../models/agronomistProfile.model.js';
import DiseaseReport from '../models/diseaseReport.model.js';
import { deleteFromCloudinary } from '../services/cloudinary.service.js';

// --- Helper: Delete media file from Cloudinary + DB ---
const removeMediaById = async (mediaId) => {
  if (!mediaId) return;
  const media = await Media.findById(mediaId);
  if (!media) return;
  if (media.publicId) {
    try {
      await deleteFromCloudinary(media.publicId);
    } catch (err) {
      console.error('Failed to delete media from Cloudinary:', err.message);
    }
  }
  await media.deleteOne();
};

// --- List All Farmers ---
export const listFarmers = asyncHandler(async (req, res) => {
  const farmers = await User.find({ role: 'farmer' }).select('-passwordHash').sort({ createdAt: -1 });
  res.json(farmers);
});

// --- Delete Farmer ---
export const deleteFarmer = asyncHandler(async (req, res) => {
  const farmer = await User.findOne({ _id: req.params.id, role: 'farmer' });
  if (!farmer) {
    return res.status(404).json({ message: 'Farmer not found' });
  }
  if (farmer.profilePhoto) {
    await removeMediaById(farmer.profilePhoto);
  }
  await farmer.deleteOne();
  res.json({ message: 'Farmer deleted successfully' });
});

// --- List All Agronomists (with profile + id proof) ---
export const listAgronomists = asyncHandler(async (req, res) => {
  const agronomists = await AgronomistProfile.find()
    .populate('user', 'fullName mobileNumber address profilePhoto')
    .populate('idProof', 'url contentType');
  res.status(200).json(agronomists);
});

// --- Delete Agronomist ---
export const deleteAgronomist = asyncHandler(async (req, res) => {
  const agronomist = await User.findOne({ _id: req.params.id, role: 'agronomist' });
  if (!agronomist) {
    return res.status(404).json({ message: 'Agronomist not found' });
  }
  const profile = await AgronomistProfile.findOne({ user: agronomist._id });
  if (profile) {
    if (profile.idProof) await removeMediaById(profile.idProof);
    await profile.deleteOne();
  }
  if (agronomist.profilePhoto) await removeMediaById(agronomist.profilePhoto);
  await agronomist.deleteOne();
  res.json({ message: 'Agronomist deleted successfully' });
});

// --- Disease Outbreak Alerts (aggregate disease reports by district) ---
export const getOutbreakAlerts = asyncHandler(async (req, res) => {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const alerts = await DiseaseReport.aggregate([
    {
      $match: {
        createdAt: { $gte: fourteenDaysAgo },
        prediction: { $exists: true, $ne: 'Healthy' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'farmer',
        foreignField: '_id',
        as: 'farmerDetails'
      }
    },
    { $unwind: '$farmerDetails' },
    {
      $group: {
        _id: {
          district: { $ifNull: ['$farmerDetails.address.district', 'Unknown'] },
          disease: '$prediction'
        },
        count: { $sum: 1 },
        lastDetected: { $max: '$createdAt' },
        farmers: { $addToSet: '$farmerDetails.fullName' }
      }
    },
    { $match: { count: { $gte: 2 } } },
    { $sort: { count: -1 } }
  ]);

  res.json(alerts);
});
