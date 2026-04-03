import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    ExternalLink,
    ChevronRight,
    Calendar,
    CheckCircle2,
    ArrowLeft,
    BookOpen,
    Clock,
    ShieldCheck,
    Zap,
    Leaf,
    Globe,
    HelpCircle,
    Share2
} from 'lucide-react';
import { schemeAPI, mediaAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const Schemes = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [selectedScheme, setSelectedScheme] = useState(null);

    useEffect(() => {
        fetchSchemes();
    }, [lang]);

    const fetchSchemes = async () => {
        try {
            setLoading(true);
            const res = await schemeAPI.getRecommendations(lang);

            // Enhance with specific Unsplash images using keywords from AI
            // Local high-quality generated assets for primary schemes
            const schemeAssetMap = {
                'pm-kisan': '/images/schemes/pm-kisan.png',
                'pmfby': '/images/schemes/pmfby.png',
                'pm-kusum': '/images/schemes/pm-kusum.png',
                'soil-health-card': '/images/schemes/soil-health.png',
                'soil-health': '/images/schemes/soil-health.png',
                'kcc': '/images/schemes/kcc.png',
                'kisan-credit-card': '/images/schemes/kcc.png',
                'pkvy': '/images/schemes/pkvy.png',
                'paramparagat-krishi-vikas-yojana': '/images/schemes/pkvy.png',
                'aif': '/images/schemes/aif.png',
                'agriculture-infrastructure-fund': '/images/schemes/aif.png'
            };

            const recommendationsWithImages = await Promise.all(
                res.data.recommendations.map(async (s) => {
                    // 1. Try local premium asset first
                    if (schemeAssetMap[s.id.toLowerCase()]) {
                        return { ...s, displayImage: schemeAssetMap[s.id.toLowerCase()] };
                    }

                    // 2. Fallback to Unsplash with AI-curated keywords
                    const searchQuery = s.imageKeywords || `${s.title} agriculture india`;
                    const img = await mediaAPI.searchImages(searchQuery);
                    return { ...s, displayImage: img };
                })
            );

            setData({ ...res.data, recommendations: recommendationsWithImages });
        } catch (error) {
            console.error('Error fetching schemes:', error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-select scheme based on ID parameter
    useEffect(() => {
        if (data?.recommendations && id) {
            const found = data.recommendations.find(s => s.id === id);
            if (found) setSelectedScheme(found);
        }
    }, [id, data]);

    const handleBack = () => {
        setSelectedScheme(null);
        navigate('/farmer/schemes');
    };

    const handleSelectScheme = (scheme) => {
        setSelectedScheme(scheme);
        navigate(`/farmer/schemes/${scheme.id}`);
    };

    if (loading) {
        return (
            <div className="p-12 flex flex-col items-center justify-center min-h-[70vh]">
                <div className="kk-spinner mb-6" />
                <p className="text-[var(--text-secondary)] font-bold animate-pulse text-lg">{t('Synchronizing with Government Portals...')}</p>
            </div>
        );
    }

    const DetailView = ({ scheme }) => (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-6xl mx-auto space-y-8 pb-24"
        >
            <div className="flex items-center justify-between">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-[var(--text-accent)] font-black hover:translate-x-[-4px] transition-transform"
                >
                    <ArrowLeft size={18} /> {t('Back to Recommendations')}
                </button>
                <button className="p-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <Share2 size={18} />
                </button>
            </div>

            <div className="kk-card-solid overflow-hidden shadow-2xl border-[var(--border-card)]">
                <div className="relative h-80 sm:h-[450px]">
                    <img
                        src={scheme.displayImage}
                        alt={scheme.title}
                        className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card-solid)] via-[var(--bg-card-solid)]/20 to-transparent" />
                    <div className="absolute bottom-10 left-6 right-6 sm:left-12 sm:right-12">
                        <div className="flex flex-wrap gap-2 mb-4">
                            {scheme.tags.map((tag, i) => (
                                <span key={i} className="px-4 py-1.5 bg-[var(--accent-primary)]/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight drop-shadow-2xl">
                            {scheme.title}
                        </h1>
                    </div>
                </div>

                <div className="p-6 sm:p-12 space-y-16">
                    {/* Status Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                        <div className="p-8 rounded-[2rem] bg-[var(--bg-page)] border border-[var(--border-card)] group hover:border-[var(--accent-amber)] transition-all">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 shadow-inner">
                                    <Calendar size={32} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{t('Application Deadline')}</p>
                                    <p className="text-2xl font-black text-[var(--text-primary)]">{scheme.lastDate}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 rounded-[2rem] bg-[var(--bg-page)] border border-[var(--border-card)] group hover:border-[var(--accent-emerald)] transition-all">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 shadow-inner">
                                    <ShieldCheck size={32} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{t('Eligibility Status')}</p>
                                    <p className="text-sm font-bold text-[var(--text-secondary)] leading-snug">{scheme.eligibility}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Insights Segment */}
                    <div className="relative p-10 rounded-[3rem] bg-[var(--bg-card)] border border-[var(--border-accent)] shadow-xl overflow-hidden group">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                            <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/30">
                                <Zap size={40} className="fill-white/20" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                    {t('Tailored Recommendation Strategy')}
                                    <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-[10px] font-black uppercase">Verified AI</span>
                                </h3>
                                <p className="text-[var(--text-secondary)] text-lg font-medium italic leading-relaxed">"{scheme.relevanceReason}"</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                        {/* Left Column: Benefits & Documents */}
                        <div className="space-y-14">
                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner"><CheckCircle2 size={24} /></div>
                                    <h3 className="text-2xl font-black text-[var(--text-primary)]">{t('Core Benefits')}</h3>
                                </div>
                                <div className="grid gap-4">
                                    {scheme.benefits.map((b, i) => (
                                        <div key={i} className="flex gap-5 p-6 rounded-3xl bg-[var(--bg-page)] border border-[var(--border-card)] hover:border-[var(--accent-primary)] transition-all group">
                                            <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-xs font-black shrink-0">{i + 1}</div>
                                            <p className="text-[var(--text-secondary)] font-bold leading-relaxed">{b}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner"><FileText size={24} /></div>
                                    <h3 className="text-2xl font-black text-[var(--text-primary)]">{t('Required Documents')}</h3>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {scheme.documentsRequired.map((doc, i) => (
                                        <div key={i} className="px-5 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm font-black text-[var(--text-secondary)] flex items-center gap-3 hover:border-[var(--accent-amber)] transition-colors">
                                            <CheckCircle2 size={16} className="text-emerald-500" /> {doc}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Roadmap & CTA */}
                        <div className="space-y-14">
                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner"><BookOpen size={24} /></div>
                                    <h3 className="text-2xl font-black text-[var(--text-primary)]">{t('Step-by-Step Roadmap')}</h3>
                                </div>
                                <div className="relative pl-10 space-y-10 before:absolute before:left-4.5 before:top-2 before:bottom-2 before:w-[3px] before:bg-gradient-to-b before:from-[var(--accent-primary)]/40 before:to-transparent">
                                    {scheme.applicationSteps.map((step, i) => (
                                        <div key={i} className="relative group">
                                            <div className="absolute -left-[35px] w-8 h-8 rounded-2xl bg-[var(--bg-card-solid)] border-4 border-[var(--accent-primary)] z-10 flex items-center justify-center text-[10px] font-black text-white shadow-xl" />
                                            <div className="p-6 rounded-[2rem] bg-[var(--bg-page)] border border-[var(--border-card)] group-hover:border-[var(--accent-primary)]/30 transition-all shadow-sm">
                                                <p className="text-[var(--text-primary)] font-black leading-relaxed">{step}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="pt-8">
                                <div className="relative p-10 rounded-[3.5rem] bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-2xl shadow-indigo-500/30 text-white overflow-hidden isolate">
                                    <Zap className="absolute -right-12 -top-12 text-white/10 w-64 h-64 rotate-12" />
                                    <div className="relative z-10">
                                        <h4 className="text-3xl font-black mb-4 tracking-tight">{t('Ready to begin?')}</h4>
                                        <p className="text-indigo-100 font-bold mb-10 text-lg leading-relaxed opacity-90">
                                            {t('Access the official verified government portal to submit your application.')}
                                        </p>
                                        <div className="flex flex-col gap-4">
                                            <a
                                                href={scheme.websiteUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-center gap-3 w-full py-5 bg-white text-indigo-700 rounded-[1.8rem] font-black text-lg hover:bg-indigo-50 transition-all shadow-xl active:scale-[0.98]"
                                            >
                                                <ExternalLink size={24} /> {t('Launch Official Portal')}
                                            </a>
                                            <a
                                                href={scheme.officialPortal}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-center gap-2 w-full py-4 text-white/80 font-bold hover:text-white transition-colors"
                                            >
                                                <Globe size={18} /> {t('General Guidelines')}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    return (
        <div className="kk-page min-h-screen p-4 sm:p-10 pb-40">
            <AnimatePresence mode="wait">
                {selectedScheme ? (
                    <DetailView key="detail" scheme={selectedScheme} />
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="max-w-7xl mx-auto space-y-12"
                    >
                        {/* Elegant Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 py-6 border-b border-[var(--border-card)]">
                            <div className="space-y-3">
                                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <Leaf size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('Personalized Benefits')}</span>
                                </div>
                                <h1 className="text-4xl sm:text-6xl font-black text-[var(--text-primary)] tracking-tight">
                                    Government <span className="text-[var(--accent-primary)]">Schemes</span>
                                </h1>
                                <p className="text-[var(--text-secondary)] text-xl font-medium max-w-2xl">
                                    {t('We matched these live opportunities based on your farm profile and regional data.')}
                                </p>
                            </div>
                            <button
                                onClick={fetchSchemes}
                                className="px-8 py-4 rounded-[1.5rem] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--accent-primary)] font-black flex items-center gap-3 hover:bg-[var(--accent-primary)] hover:text-white hover:border-[var(--accent-primary)] transition-all shadow-sm"
                            >
                                <Zap size={20} className="fill-[var(--accent-primary)] group-hover:fill-white" />
                                {t('Scan for New Schemes')}
                            </button>
                        </div>

                        {/* AI Summary Card */}
                        <div className="p-1 rounded-[3rem] bg-gradient-to-r from-emerald-500/40 via-blue-500/40 to-purple-500/40 shadow-2xl">
                            <div className="p-8 sm:p-12 rounded-[2.9rem] bg-[var(--bg-card-solid)] border border-white/5 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700" />
                                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                                    <div className="w-24 h-24 rounded-[3rem] bg-emerald-600 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/20 shrink-0 border-4 border-white/10">
                                        <HelpCircle size={48} />
                                    </div>
                                    <div className="text-center md:text-left space-y-3">
                                        <p className="inline-block px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                            Contextual Insights
                                        </p>
                                        <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
                                            {data?.summary}
                                        </h2>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grid of Opportunity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {data?.recommendations.map((scheme, i) => (
                                <motion.div
                                    key={scheme.id}
                                    layoutId={scheme.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                                    onClick={() => handleSelectScheme(scheme)}
                                    className="kk-card overflow-hidden group hover:translate-y-[-12px] hover:shadow-2xl border-[var(--border-card)] hover:border-[var(--accent-primary)] group"
                                >
                                    <div className="relative h-64 overflow-hidden">
                                        <img
                                            src={scheme.displayImage}
                                            alt={scheme.title}
                                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale-[0.3] group-hover:grayscale-0"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                                        <div className="absolute top-5 left-5">
                                            <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                                                {scheme.tags[0]}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-6 left-6 right-6">
                                            <h3 className="text-2xl font-black text-white leading-tight drop-shadow-lg uppercase tracking-tight">
                                                {scheme.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="p-8 space-y-8 bg-gradient-to-b from-transparent to-[var(--bg-card)]">
                                        <p className="text-[var(--text-secondary)] font-medium leading-relaxed italic opacity-90 line-clamp-3">
                                            "{scheme.shortDescription}"
                                        </p>

                                        <div className="flex items-center justify-between pt-6 border-t border-[var(--border-card)]">
                                            <div className="flex items-center gap-3 text-[var(--accent-amber)]">
                                                <Clock size={16} />
                                                <span className="text-[11px] font-black uppercase tracking-widest">
                                                    {scheme.lastDate}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[var(--accent-primary)] group-hover:gap-3 transition-all font-black text-xs">
                                                {t('Explore Details')}
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Schemes;
