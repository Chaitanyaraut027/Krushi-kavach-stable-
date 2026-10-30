import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home,
    Sprout,
    ClipboardList,
    CloudSun,
    BarChart3,
    Users,
    Microscope,
    UserCircle,
    X,
    LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const { t } = useLanguage();
    const { isDark } = useTheme();

    const getNavLinks = () => {
        if (!user) return [];

        // Farmer navigation — core features only
        if (user.role === 'farmer') return [
            { path: '/farmer', label: 'Dashboard', icon: Home },
            { path: '/farmer/crops', label: 'My Crops', icon: Sprout },
            { path: '/farmer/disease-reports', label: 'Disease Reports', icon: ClipboardList },
            { path: '/farmer/weather', label: 'Weather Updates', icon: CloudSun },
            { path: '/farmer/market', label: 'Market Trends', icon: BarChart3 },
        ];

        // Admin navigation — manage farmers & agronomist approvals
        if (user.role === 'admin') return [
            { path: '/admin', label: 'Dashboard', icon: Home },
            { path: '/admin/farmers', label: 'Farmers', icon: Users },
            { path: '/admin/agronomists', label: 'Agronomists', icon: Microscope },
        ];

        // Agronomist navigation
        if (user.role === 'agronomist') return [
            { path: '/agronomist', label: 'Dashboard', icon: Home },
            { path: '/agronomist/profile', label: 'Profile Settings', icon: UserCircle },
        ];

        return [];
    };

    const navLinks = getNavLinks();

    const isActive = (path) =>
        location.pathname === path ||
        (path !== '/' && path !== '/farmer' && path !== '/admin' && path !== '/agronomist' && location.pathname.startsWith(path));

    const variants = {
        open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        closed: { x: '-100%', transition: { type: 'spring', stiffness: 300, damping: 30 } }
    };

    const overlayVariants = {
        open: { opacity: 1 },
        closed: { opacity: 0 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={overlayVariants}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={variants}
                        className={`fixed top-0 left-0 h-full w-72 z-[70] shadow-2xl overflow-y-auto border-r bg-[var(--bg-page)] border-[var(--border-card)] text-[var(--text-primary)]`}
                    >
                        <div className="p-6 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all bg-[var(--bg-card)] border-[var(--border-accent)]">
                                        <Sprout className="text-emerald-500 w-6 h-6" />
                                    </div>
                                    <span className="font-extrabold text-xl tracking-tight text-[var(--text-primary)]">Krishi Kavach</span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)]"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-2 flex-1">
                                {navLinks.map((link) => {
                                    const active = isActive(link.path);
                                    const Icon = link.icon;
                                    return (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            onClick={onClose}
                                            className={`group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-bold ${active
                                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-emerald-600'
                                                }`}
                                        >
                                            <Icon size={20} className={`${active ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-emerald-600'} transition-colors`} />
                                            <span>{t(link.label)}</span>
                                            {active && (
                                                <motion.div
                                                    layoutId="activePill"
                                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                                                />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="pt-6 mt-6 border-t border-[var(--border-card)] space-y-4">
                                {user && (
                                    <div className="px-4 py-3 rounded-2xl border transition-colors bg-[var(--bg-card)] border-[var(--border-card)]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white shadow-inner">
                                                {user.fullName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-black truncate text-[var(--text-primary)]">{user.fullName}</p>
                                                <p className="text-xs font-medium capitalize truncate text-[var(--text-secondary)]">{user.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={async () => {
                                        onClose();
                                        await logout();
                                    }}
                                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl transition-all font-bold active:scale-95 text-red-600 hover:bg-red-500/10"
                                >
                                    <LogOut size={22} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default Sidebar;
