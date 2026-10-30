import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [counts, setCounts] = useState({ farmers: '—', agronomists: '—', pending: '—' });
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [fRes, aRes, alertRes] = await Promise.all([
          adminAPI.listFarmers?.().catch(() => null),
          adminAPI.listAgronomists?.().catch(() => null),
          adminAPI.getOutbreakAlerts?.().catch(() => null),
        ]);
        setCounts({
          farmers: fRes?.data?.length ?? '—',
          agronomists: aRes?.data?.length ?? '—',
          pending: aRes?.data?.filter(a => !a.isVerified)?.length ?? '—',
        });
        setAlerts(alertRes?.data ?? []);
      } catch { /* silent */ } finally {
        setLoadingAlerts(false);
      }
    };
    loadCounts();
  }, []);

  const adminCards = [
    {
      to: '/admin/farmers',
      icon: '👨‍🌾',
      title: 'Farmers',
      description: 'View and manage all registered farmer accounts on the platform.',
      gradient: 'from-emerald-500 to-green-600',
      stat: counts.farmers,
      statLabel: 'Total Farmers',
    },
    {
      to: '/admin/agronomists',
      icon: '🔬',
      title: 'Agronomists',
      description: 'Verify agronomist accounts and manage professional registrations.',
      gradient: 'from-blue-500 to-indigo-600',
      stat: counts.agronomists,
      statLabel: 'Total Agronomists',
    },
  ];

  const quickStats = [
    { icon: '✅', label: 'System Status', value: 'All Operational', color: 'text-emerald-600' },
    { icon: '⏳', label: 'Pending Verifications', value: counts.pending, color: 'text-amber-600' },
    { icon: '📅', label: 'Last Updated', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), color: 'text-blue-600' },
  ];

  return (
    <div className={`min-h-screen ${isDark
      ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800'
      : 'bg-gradient-to-br from-[#f0f4ff] via-[#e8eeff] to-[#f0f4ff]'
      }`}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.45s ease both; }
        .card-lift { transition: all 0.25s cubic-bezier(.4,0,.2,1); }
        .card-lift:hover { transform: translateY(-5px); }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Admin Banner ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-700 via-gray-800 to-slate-700 rounded-3xl border border-white/10 shadow-2xl p-8 fade-up">
          <div className="absolute top-0 right-0 text-[160px] leading-none opacity-5 select-none -mt-4 -mr-4">🛡️</div>
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-3xl border border-white/20">🛡️</div>
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Administrator</p>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Admin Dashboard</h1>
                </div>
              </div>
              <p className="text-gray-400 text-sm max-w-lg">
                Manage farmers, verify agronomists, and monitor platform health from your central control panel.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-2xl text-sm font-bold">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </div>

        {/* ── Quick Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 fade-up">
          {quickStats.map((s, i) => (
            <div key={i} className={`rounded-2xl p-5 flex items-center gap-4 ${isDark ? 'bg-white/5 border border-white/10 backdrop-blur' : 'bg-white border border-gray-200 shadow-sm'
              }`}>
              <div className="text-3xl">{s.icon}</div>
              <div>
                <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s.label}</p>
                <p className={`text-xl font-extrabold ${s.color} mt-0.5`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Management Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-up">
          {adminCards.map((card) => (
            <Link key={card.to} to={card.to}
              className={`group card-lift border rounded-3xl overflow-hidden transition-all ${isDark
                ? 'bg-white/5 border-white/10 backdrop-blur hover:border-white/20 hover:bg-white/8'
                : 'bg-white border-gray-200 shadow-sm hover:shadow-xl hover:border-indigo-200'
                }`}>
              <div className={`h-2 bg-gradient-to-r ${card.gradient}`} />
              <div className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-4xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {card.icon}
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-extrabold text-white">{card.stat}</p>
                    <p className="text-gray-500 text-xs mt-1">{card.statLabel}</p>
                  </div>
                </div>
                <h3 className={`text-2xl font-extrabold mb-2 ${isDark ? 'text-white' : 'text-[#1e1b4b]'}`}>{card.title}</h3>
                <p className={`text-sm mb-5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{card.description}</p>
                <div className="flex items-center gap-2 text-white font-semibold text-sm group-hover:gap-3 transition-all">
                  Manage {card.title}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Disease Outbreak Alerts (Hotspots) ── */}
        <div className={`rounded-3xl p-6 fade-up border-2 ${alerts.length > 0 ? 'border-red-500/50 bg-red-500/5' : isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-extrabold flex items-center gap-3 ${isDark ? 'text-white' : 'text-[#1e1b4b]'}`}>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${alerts.length > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 dark:bg-white/10'}`}>🚨</span>
              Disease Outbreak Alerts
            </h2>
            {alerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">
                Action Required
              </span>
            )}
          </div>

          {loadingAlerts ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-6 h-6 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 font-bold">Scanning for outbreaks...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
              <p className="text-gray-400 font-medium">No outbreaks detected in the last 14 days.</p>
              <p className="text-xs text-gray-500 mt-1">Platform monitor is active and stable.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alerts.map((alert, idx) => (
                <div key={idx} className="relative overflow-hidden bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">High Risk Hotspot</p>
                      <h4 className="text-lg font-extrabold text-white">{alert._id.disease}</h4>
                    </div>
                    <div className="bg-red-500/20 text-red-500 font-black text-xl px-3 py-1 rounded-xl">
                      {alert.count}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">📍</span>
                    <p className="text-sm font-bold text-gray-200">{alert._id.district} District</p>
                  </div>

                  <div className="space-y-2 mb-5">
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full" />
                      Affected Farmers: {alert.farmers.join(', ')}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full" />
                      Last Detected: {new Date(alert.lastDetected).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const message = `URGENT: Disease Outbreak Alert\nDisease: ${alert._id.disease}\nDistrict: ${alert._id.district}\nAffected Farmers: ${alert.count}\nDetected on: ${new Date(alert.lastDetected).toLocaleDateString()}\n\nPlease take immediate control measures.`;
                      window.open(`mailto:officer@agriculture.gov.in?subject=Disease Alert: ${alert._id.disease} in ${alert._id.district}&body=${encodeURIComponent(message)}`);
                    }}
                    className="w-full bg-red-500/10 border border-red-500/30 text-red-500 group-hover:bg-red-500 group-hover:text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    🚀 Notify Government Officer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Platform Overview ── */}
      </div>
    </div>
  );
};

export default AdminDashboard;
