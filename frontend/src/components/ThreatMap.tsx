import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../lib/api';
import { Globe, MapPin } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface GeoData {
    lat: number;
    lon: number;
    country: string;
    city: string;
    isp: string;
    countryCode: string;
}

interface ThreatPoint {
    x: number;
    y: number;
    lat: number;
    lon: number;
    severity: number;
    srcIp: string;
    threatType: string;
    count: number;
    country: string;
    city: string;
    isp: string;
    countryCode: string;
    abuseScore?: number;
    isTor?: boolean;
    isVpn?: boolean;
    totalReports?: number;
}

/* ------------------------------------------------------------------ */
/* GeoIP cache (localStorage + in-memory)                              */
/* ------------------------------------------------------------------ */
const GEO_CACHE_KEY = 'bw_geo_cache';
const geoMemCache = new Map<string, GeoData>();

function loadGeoCache(): void {
    try {
        const raw = localStorage.getItem(GEO_CACHE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, GeoData>;
        for (const [ip, geo] of Object.entries(parsed)) {
            geoMemCache.set(ip, geo);
        }
    } catch { /* ignore */ }
}

function saveGeoCache(): void {
    try {
        const obj: Record<string, GeoData> = {};
        geoMemCache.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(obj));
    } catch { /* ignore */ }
}

loadGeoCache();

/* ------------------------------------------------------------------ */
/* Equirectangular projection                                          */
/* ------------------------------------------------------------------ */
const MAP_W = 1000;
const MAP_H = 500;

function geoToSvg(lat: number, lon: number): { x: number; y: number } {
    return {
        x: (lon + 180) / 360 * MAP_W,
        y: (90 - lat) / 180 * MAP_H,
    };
}

/**
 * Spread overlapping points so co-located IPs are all visible.
 * Points within OVERLAP_DIST px of each other get arranged in a circle.
 */
const OVERLAP_DIST = 12;
const SPREAD_RADIUS = 14;

function spreadOverlapping(pts: ThreatPoint[]): ThreatPoint[] {
    if (pts.length === 0) return pts;

    const used = new Array(pts.length).fill(false);
    const groups: number[][] = [];

    for (let i = 0; i < pts.length; i++) {
        if (used[i]) continue;
        const group = [i];
        used[i] = true;
        for (let j = i + 1; j < pts.length; j++) {
            if (used[j]) continue;
            const dx = pts[i].x - pts[j].x;
            const dy = pts[i].y - pts[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < OVERLAP_DIST) {
                group.push(j);
                used[j] = true;
            }
        }
        groups.push(group);
    }

    const result = [...pts.map(p => ({ ...p }))];
    for (const group of groups) {
        if (group.length < 2) continue;
        const cx = group.reduce((s, i) => s + pts[i].x, 0) / group.length;
        const cy = group.reduce((s, i) => s + pts[i].y, 0) / group.length;
        const r = SPREAD_RADIUS * Math.min(group.length / 2, 2.5);
        group.forEach((idx, k) => {
            const angle = (2 * Math.PI * k) / group.length - Math.PI / 2;
            result[idx].x = cx + r * Math.cos(angle);
            result[idx].y = cy + r * Math.sin(angle);
        });
    }
    return result;
}

/* Server location (Spain) */
const SERVER_LOC = geoToSvg(40.42, -3.70);

/* ------------------------------------------------------------------ */
/* GeoIP lookup via ipwho.is (HTTPS + CORS)                            */
/* ------------------------------------------------------------------ */
const PRIVATE_RE = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/;

async function geoLocate(ip: string): Promise<GeoData | null> {
    if (geoMemCache.has(ip)) return geoMemCache.get(ip)!;

    if (PRIVATE_RE.test(ip)) {
        const local: GeoData = {
            lat: 40.42, lon: -3.70,
            country: 'Spain', city: 'Local Network',
            isp: 'Private', countryCode: 'ES',
        };
        geoMemCache.set(ip, local);
        return local;
    }

    try {
        const resp = await fetch(`https://ipwho.is/${ip}`);
        const d = await resp.json();
        if (!d.success) return null;
        const geo: GeoData = {
            lat: d.latitude,
            lon: d.longitude,
            country: d.country || 'Unknown',
            city: d.city || '',
            isp: d.connection?.org || d.connection?.isp || '',
            countryCode: d.country_code || '',
        };
        geoMemCache.set(ip, geo);
        return geo;
    } catch {
        return null;
    }
}

async function batchGeoLocate(ips: string[]): Promise<void> {
    const unknown = ips.filter(ip => !geoMemCache.has(ip));
    if (unknown.length === 0) return;

    // Parallel with concurrency limit of 8
    const chunks: string[][] = [];
    for (let i = 0; i < unknown.length; i += 8) {
        chunks.push(unknown.slice(i, i + 8));
    }
    for (const chunk of chunks) {
        await Promise.allSettled(chunk.map(ip => geoLocate(ip)));
    }
    saveGeoCache();
}

/* ------------------------------------------------------------------ */
/* Severity helpers                                                    */
/* ------------------------------------------------------------------ */
function getSeverityColor(severity: number) {
    if (severity >= 8) return { fill: '#ef4444', glow: 'rgba(239,68,68,0.5)', label: 'Critical' };
    if (severity >= 5) return { fill: '#f97316', glow: 'rgba(249,115,22,0.4)', label: 'High' };
    if (severity >= 3) return { fill: '#eab308', glow: 'rgba(234,179,8,0.35)', label: 'Medium' };
    return { fill: '#22c55e', glow: 'rgba(34,197,94,0.35)', label: 'Low' };
}

function getSeverityBg(severity: number) {
    if (severity >= 8) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (severity >= 5) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (severity >= 3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
}

/* ------------------------------------------------------------------ */
/* Simplified world map paths (equirectangular projection)             */
/* ------------------------------------------------------------------ */
const CONTINENT_PATHS = [
    // North America
    "M 80 75 L 100 62 L 140 55 L 170 58 L 200 65 L 240 72 L 270 80 L 285 95 L 295 110 L 300 130 L 290 150 L 285 165 L 275 175 L 260 190 L 248 200 L 242 205 L 230 210 L 222 215 L 215 210 L 200 195 L 190 188 L 175 180 L 160 175 L 145 168 L 130 158 L 118 148 L 108 135 L 100 120 L 90 105 L 82 90 Z",
    // Central America
    "M 215 210 L 222 215 L 235 225 L 240 235 L 242 242 L 238 248 L 232 245 L 225 238 L 220 230 L 215 222 Z",
    // South America
    "M 238 248 L 255 252 L 270 255 L 285 260 L 300 268 L 310 278 L 315 290 L 312 305 L 308 320 L 302 335 L 295 350 L 288 365 L 280 378 L 270 388 L 258 398 L 248 402 L 240 395 L 235 382 L 230 365 L 228 348 L 225 330 L 222 312 L 225 295 L 228 278 L 232 262 Z",
    // Europe
    "M 468 82 L 478 75 L 492 70 L 505 72 L 518 78 L 528 82 L 540 88 L 548 95 L 545 105 L 540 115 L 530 122 L 522 128 L 515 135 L 505 140 L 495 142 L 485 138 L 478 132 L 472 125 L 468 118 L 462 110 L 458 100 L 460 90 Z",
    // UK + Ireland
    "M 475 88 L 480 82 L 486 80 L 490 84 L 488 90 L 484 95 L 478 94 Z",
    // Africa
    "M 462 150 L 478 148 L 495 152 L 510 155 L 525 158 L 540 162 L 555 168 L 565 178 L 568 190 L 570 205 L 568 220 L 565 238 L 560 255 L 555 272 L 548 288 L 540 305 L 530 318 L 518 332 L 508 342 L 498 348 L 488 345 L 478 338 L 470 325 L 465 310 L 458 292 L 455 275 L 452 258 L 450 240 L 448 222 L 450 205 L 452 188 L 455 172 L 458 160 Z",
    // Asia (main)
    "M 548 95 L 570 85 L 600 72 L 635 65 L 668 60 L 700 58 L 735 62 L 768 68 L 800 75 L 830 85 L 855 95 L 870 108 L 878 120 L 880 135 L 875 148 L 865 160 L 852 172 L 838 182 L 822 190 L 805 195 L 788 198 L 772 200 L 755 205 L 740 210 L 725 215 L 710 218 L 695 215 L 680 210 L 665 205 L 648 198 L 635 192 L 620 185 L 608 178 L 598 170 L 588 160 L 578 150 L 568 140 L 558 130 L 550 118 L 548 108 Z",
    // India
    "M 668 175 L 685 168 L 700 172 L 712 180 L 718 192 L 720 205 L 715 218 L 708 228 L 698 235 L 688 238 L 678 232 L 672 222 L 668 210 L 665 195 L 665 182 Z",
    // SE Asia
    "M 748 215 L 765 210 L 780 215 L 790 225 L 795 238 L 790 248 L 778 252 L 765 250 L 755 242 L 748 232 Z",
    // Japan
    "M 868 115 L 875 108 L 882 112 L 885 122 L 882 132 L 878 138 L 872 135 L 868 128 Z",
    // Australia
    "M 805 298 L 830 290 L 858 288 L 882 292 L 902 300 L 912 312 L 915 328 L 910 342 L 900 355 L 885 365 L 868 370 L 850 368 L 832 362 L 818 352 L 808 340 L 802 325 L 800 310 Z",
    // New Zealand
    "M 930 352 L 938 348 L 942 355 L 940 365 L 935 372 L 928 368 L 928 360 Z",
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
interface ThreatMapProps {
    refreshTrigger?: number;
}

const ThreatMap: React.FC<ThreatMapProps> = ({ refreshTrigger = 0 }) => {
    const [points, setPoints] = useState<ThreatPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [hovered, setHovered] = useState<ThreatPoint | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchAndGeolocate = async () => {
            try {
                // Fetch ALL unique IPs pre-aggregated from backend
                const res = await api.get('/threats/map-origins');
                const origins: any[] = res.data || [];

                // Collect unique IPs for geolocation
                const uniqueIps = origins.map((o: any) => o.srcIp).filter(Boolean) as string[];

                // Batch geolocate all IPs
                await batchGeoLocate(uniqueIps);

                // Build threat points from pre-aggregated data
                const result: ThreatPoint[] = [];
                for (const o of origins) {
                    const geo = geoMemCache.get(o.srcIp);
                    if (!geo) continue;

                    const { x, y } = geoToSvg(geo.lat, geo.lon);
                    result.push({
                        x, y,
                        lat: geo.lat,
                        lon: geo.lon,
                        severity: o.maxSeverity || 0,
                        srcIp: o.srcIp,
                        threatType: o.threatType || 'Unknown',
                        count: o.count || 1,
                        country: geo.country,
                        city: geo.city,
                        isp: o.isp || geo.isp,
                        countryCode: o.countryCode || geo.countryCode,
                        abuseScore: o.abuseScore,
                        isTor: o.isTor,
                        isVpn: o.isVpn,
                        totalReports: o.totalReports,
                    });
                }
                setPoints(spreadOverlapping(result));
            } catch (err) {
                console.error('ThreatMap fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAndGeolocate();
    }, [refreshTrigger]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    }, []);

    /* Curved path from point to server */
    const curvedLine = (px: number, py: number) => {
        const mx = (px + SERVER_LOC.x) / 2;
        const my = Math.min(py, SERVER_LOC.y) - 30;
        return `M ${px} ${py} Q ${mx} ${my} ${SERVER_LOC.x} ${SERVER_LOC.y}`;
    };

    return (
        <div
            ref={containerRef}
            className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm relative"
            onMouseMove={handleMouseMove}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary-400" />
                    <h3 className="text-lg font-semibold text-white">Threat Origin Map</h3>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Low</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Server</span>
                </div>
            </div>

            {loading ? (
                <div className="h-[320px] flex items-center justify-center text-slate-500">
                    <Globe className="w-6 h-6 animate-spin mr-2" /> Geolocating threat sources...
                </div>
            ) : (
                <svg viewBox="0 0 1000 500" className="w-full h-[320px]" style={{ background: 'transparent' }}>
                    <defs>
                        <radialGradient id="serverGlow">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* Grid */}
                    {Array.from({ length: 11 }, (_, i) => (
                        <line key={`h${i}`} x1="0" y1={i * 50} x2="1000" y2={i * 50}
                            stroke="#1e293b" strokeWidth="0.3" />
                    ))}
                    {Array.from({ length: 21 }, (_, i) => (
                        <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="500"
                            stroke="#1e293b" strokeWidth="0.3" />
                    ))}

                    {/* Continents */}
                    {CONTINENT_PATHS.map((d, i) => (
                        <path key={`c${i}`} d={d}
                            fill="#1e293b" fillOpacity="0.5"
                            stroke="#334155" strokeWidth="1" opacity="0.7" />
                    ))}

                    {/* Connection lines (curved) */}
                    {points.map((p, i) => {
                        const color = getSeverityColor(p.severity);
                        return (
                            <path key={`line-${i}`}
                                d={curvedLine(p.x, p.y)}
                                fill="none" stroke={color.fill}
                                strokeWidth="0.6" opacity="0.2"
                                strokeDasharray="4 3"
                            >
                                <animate attributeName="stroke-dashoffset"
                                    from="0" to="-14" dur="2s" repeatCount="indefinite" />
                            </path>
                        );
                    })}

                    {/* Server glow */}
                    <circle cx={SERVER_LOC.x} cy={SERVER_LOC.y} r="20"
                        fill="url(#serverGlow)">
                        <animate attributeName="r" values="15;25;15" dur="3s" repeatCount="indefinite" />
                    </circle>

                    {/* Threat points */}
                    {points.map((p, i) => {
                        const color = getSeverityColor(p.severity);
                        const radius = Math.min(3 + p.count * 1.2, 10);
                        const isHovered = hovered?.srcIp === p.srcIp;
                        return (
                            <g key={i}
                                onMouseEnter={() => setHovered(p)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Outer glow */}
                                <circle cx={p.x} cy={p.y} r={radius * 2.5}
                                    fill={color.glow} opacity={isHovered ? 0.5 : 0.2}>
                                    <animate attributeName="r"
                                        values={`${radius * 2};${radius * 3};${radius * 2}`}
                                        dur="3s" repeatCount="indefinite" />
                                    <animate attributeName="opacity"
                                        values={isHovered ? "0.5;0.3;0.5" : "0.2;0.08;0.2"}
                                        dur="3s" repeatCount="indefinite" />
                                </circle>
                                {/* Core dot */}
                                <circle cx={p.x} cy={p.y}
                                    r={isHovered ? radius * 1.5 : radius}
                                    fill={color.fill}
                                    opacity={isHovered ? 1 : 0.85}
                                    stroke={isHovered ? '#fff' : color.fill}
                                    strokeWidth={isHovered ? 1.5 : 0.5}
                                />
                                {/* Hit area (larger invisible circle for easier hover) */}
                                <circle cx={p.x} cy={p.y} r={Math.max(radius * 3, 15)}
                                    fill="transparent" />
                            </g>
                        );
                    })}

                    {/* Server marker */}
                    <circle cx={SERVER_LOC.x} cy={SERVER_LOC.y} r="5"
                        fill="#38bdf8" opacity="0.9" stroke="#fff" strokeWidth="1.5">
                        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x={SERVER_LOC.x + 10} y={SERVER_LOC.y + 4}
                        fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold"
                    >SOC</text>

                    {/* Stats */}
                    <text x="15" y="490" fill="#475569" fontSize="10" fontFamily="monospace">
                        {points.length} unique sources | {points.reduce((s, p) => s + p.count, 0)} total events | {[...new Set(points.map(p => p.country))].length} countries
                    </text>
                </svg>
            )}

            {/* Custom tooltip */}
            {hovered && (
                <div
                    className="absolute z-50 pointer-events-none"
                    style={{
                        left: Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 800) - 280),
                        top: tooltipPos.y - 10,
                    }}
                >
                    <div className="bg-slate-900/95 border border-slate-600/50 rounded-lg shadow-2xl p-3 min-w-[240px] backdrop-blur-md">
                        {/* IP + Country flag */}
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-mono font-bold text-sm">{hovered.srcIp}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border ${getSeverityBg(hovered.severity)}`}>
                                {getSeverityColor(hovered.severity).label}
                            </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
                            <MapPin className="w-3 h-3" />
                            <span>{hovered.city}{hovered.city && hovered.country ? ', ' : ''}{hovered.country}</span>
                        </div>

                        {/* ISP */}
                        {hovered.isp && (
                            <div className="text-slate-500 text-xs mb-2 truncate">
                                ISP: {hovered.isp}
                            </div>
                        )}

                        {/* Tor / VPN badges */}
                        {(hovered.isTor || hovered.isVpn) && (
                            <div className="flex gap-1.5 mb-2">
                                {hovered.isTor && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">TOR</span>
                                )}
                                {hovered.isVpn && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">VPN</span>
                                )}
                            </div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-slate-700/50 my-2" />

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-white font-bold text-sm">{hovered.count}</div>
                                <div className="text-slate-500 text-[10px] uppercase">Attacks</div>
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">{hovered.severity}</div>
                                <div className="text-slate-500 text-[10px] uppercase">Severity</div>
                            </div>
                            <div>
                                <div className="text-white font-bold text-xs">{hovered.threatType}</div>
                                <div className="text-slate-500 text-[10px] uppercase">Type</div>
                            </div>
                        </div>

                        {/* Abuse intelligence */}
                        {hovered.abuseScore != null && (
                            <>
                                <div className="border-t border-slate-700/50 my-2" />
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div>
                                        <div className={`font-bold text-sm ${hovered.abuseScore >= 75 ? 'text-red-400' : hovered.abuseScore >= 40 ? 'text-orange-400' : 'text-green-400'}`}>
                                            {hovered.abuseScore}%
                                        </div>
                                        <div className="text-slate-500 text-[10px] uppercase">Abuse Score</div>
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-sm">{hovered.totalReports ?? 0}</div>
                                        <div className="text-slate-500 text-[10px] uppercase">Reports</div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Coordinates */}
                        <div className="text-slate-600 text-[10px] mt-2 font-mono">
                            {hovered.lat.toFixed(2)}°, {hovered.lon.toFixed(2)}°
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThreatMap;
