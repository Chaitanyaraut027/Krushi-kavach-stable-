import MarketPrice from '../models/marketPrice.model.js';
import { scrapeMarketPrices } from './scraper.service.js';

// ── Daily scrape cycle for mandi market prices ──────────────────────────────
export const runScrapeCycle = async () => {
    console.log('[Market] Starting commodity price scrape cycle...');
    const errors = [];

    try {
        // Run Agmarknet and mandi scraper for key agricultural commodities
        console.log('[Market] Running real-time Agmarknet and mandi scraper...');
        const scrapeResults = await scrapeMarketPrices(['Cotton', 'Soybean', 'Sugar', 'Grapes', 'Onion', 'Turmeric', 'Jaggery']);
        console.log(`[Market] Mandi prices updated for ${scrapeResults?.count || 0} commodities.`);

        return { saved: scrapeResults?.count || 0, scrapeResults, errors };
    } catch (err) {
        console.error('[Market] Scrape cycle failure:', err.message);
        throw err;
    }
};

// ── Query helpers ─────────────────────────────────────────────────────────────
export const searchMarketPrices = async ({
    commodity, state, district, startDate, endDate, page = 1, limit = 48,
} = {}) => {
    const q = {};
    if (commodity) q.commodity = { $regex: commodity, $options: 'i' };
    if (state) q.state = { $regex: state, $options: 'i' };
    if (district) q.district = { $regex: district, $options: 'i' };
    if (startDate || endDate) {
        q.publishDate = {};
        if (startDate) q.publishDate.$gte = new Date(startDate);
        if (endDate) q.publishDate.$lte = new Date(endDate);
    }
    const skip = (page - 1) * limit;
    const [results, total] = await Promise.all([
        MarketPrice.find(q).sort({ publishDate: -1 }).skip(skip).limit(limit).lean(),
        MarketPrice.countDocuments(q),
    ]);
    return { results, total, page, pages: Math.ceil(total / limit) };
};

export const getLatestByDistrict = async (commodity, state) => {
    const q = { commodity: { $regex: commodity, $options: 'i' } };
    if (state) q.state = { $regex: state, $options: 'i' };
    return MarketPrice.aggregate([
        { $match: q },
        { $sort: { publishDate: -1 } },
        { $group: { _id: '$district', district: { $first: '$district' }, state: { $first: '$state' }, pricePerQuintal: { $first: '$pricePerQuintal' }, publishDate: { $first: '$publishDate' }, sourceName: { $first: '$sourceName' }, confidenceScore: { $first: '$confidenceScore' }, marketType: { $first: '$marketType' } } },
        { $sort: { district: 1 } },
    ]);
};

export const getCommodityPriceHistory = async (commodity, { state, district } = {}) => {
    const q = { commodity: { $regex: commodity, $options: 'i' } };
    if (state) q.state = { $regex: state, $options: 'i' };
    if (district) q.district = { $regex: district, $options: 'i' };
    return MarketPrice.find(q).sort({ publishDate: 1 }).limit(365).lean();
};

export const predictPrices = async (commodity, district) => {
    const q = { commodity: { $regex: commodity, $options: 'i' } };
    if (district) q.district = { $regex: district, $options: 'i' };
    const raw = await MarketPrice.aggregate([
        { $match: q },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishDate' } }, avgPrice: { $avg: '$pricePerQuintal' } } },
        { $sort: { _id: 1 } },
        { $limit: 30 },
    ]);
    if (raw.length < 3) return { available: false, message: 'Not enough data for prediction' };
    const prices = raw.map(r => r.avgPrice);
    const windowSize = Math.min(7, prices.length);
    const recentAvg = prices.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
    const older = prices.slice(0, Math.floor(prices.length / 2));
    const newer = prices.slice(Math.floor(prices.length / 2));
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const newerAvg = newer.reduce((a, b) => a + b, 0) / newer.length;
    const trendFactor = newerAvg > 0 ? (newerAvg - olderAvg) / olderAvg : 0;
    const dailyTrend = trendFactor / raw.length;
    const lastDate = new Date(raw[raw.length - 1]._id);
    const predictions = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i + 1);
        return { date: d.toISOString().slice(0, 10), predictedPrice: Math.max(Math.round(recentAvg * (1 + dailyTrend * (i + 1))), 50) };
    });
    return { available: true, commodity, district: district || 'All', basedOnDays: raw.length, movingAverageWindow: windowSize, currentAvg: Math.round(recentAvg), trend: trendFactor > 0.01 ? 'rising' : trendFactor < -0.01 ? 'falling' : 'stable', predictions, history: raw.map(r => ({ date: r._id, avgPrice: Math.round(r.avgPrice) })) };
};

export const getDistinctFilterValues = async () => {
    const [states, commodities, districts] = await Promise.all([
        MarketPrice.distinct('state'),
        MarketPrice.distinct('commodity'),
        MarketPrice.distinct('district'),
    ]);
    return { states: states.sort(), commodities: commodities.sort(), districts: districts.sort() };
};

export const getMarketStats = async () => {
    const [total, latest, sources] = await Promise.all([
        MarketPrice.countDocuments(),
        MarketPrice.findOne().sort({ publishDate: -1 }).lean(),
        MarketPrice.distinct('sourceName'),
    ]);
    return { totalRecords: total, lastUpdated: latest?.publishDate || null, sourceCount: sources.length, sources };
};

export const getLatestPricesForCrops = async (cropNames) => {
    if (!cropNames?.length) return [];
    const results = await Promise.all(
        cropNames.map(async (cropName) => {
            const record = await MarketPrice.findOne({ commodity: { $regex: new RegExp(cropName, 'i') } }).sort({ publishDate: -1 }).lean();
            return record ? { ...record, requestedCrop: cropName } : null;
        })
    );
    return results.filter(Boolean);
};
