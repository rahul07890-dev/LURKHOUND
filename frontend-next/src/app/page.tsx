'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Server, Globe, User, Lock, Loader2, Crosshair, AlertTriangle, Zap } from 'lucide-react'
import PantherIcon from '@/components/PantherIcon'
import { login } from '@/lib/api'
import { useSession } from '@/context/SessionContext'
import clsx from 'clsx'

/* ─── Animated Radar Topology SVG ─── */
function RadarTopology() {
    return (
        <svg className="w-full h-full" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="sweepGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
                <filter id="nodeGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="amberGlow">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            <style>{`
                @keyframes radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulseNode { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
                @keyframes pulseNodeSm { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
                @keyframes pulseDC { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
                @keyframes breatheRing { 0%, 100% { opacity: 0.08; } 50% { opacity: 0.18; } }
                @keyframes breatheRing2 { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.22; } }
                @keyframes dataPacket { 0% { offset-distance: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
                @keyframes scanH { 0% { transform: translateY(-220px); opacity: 0; } 10% { opacity: 0.5; } 50% { opacity: 0.5; } 90% { opacity: 0; } 100% { transform: translateY(220px); opacity: 0; } }
                @keyframes blinkText { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
                @keyframes dashFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -12; } }
                @keyframes pulseTiny { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
                @keyframes fadeFloat { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.4; } }
                .sweep { transform-origin: 250px 250px; animation: radarSweep 6s linear infinite; }
                .ring1 { animation: breatheRing 4s ease-in-out infinite; }
                .ring2 { animation: breatheRing2 5s ease-in-out infinite 0.5s; }
                .ring3 { animation: breatheRing 6s ease-in-out infinite 1s; }
                .ring4 { animation: breatheRing2 3.5s ease-in-out infinite 1.5s; }
                .pn1 { animation: pulseNode 3s ease-in-out infinite; }
                .pn2 { animation: pulseNode 3s ease-in-out infinite 0.75s; }
                .pn3 { animation: pulseNode 3s ease-in-out infinite 1.5s; }
                .pn4 { animation: pulseNode 3s ease-in-out infinite 2.25s; }
                .pd1 { animation: pulseNodeSm 2.5s ease-in-out infinite 0.3s; }
                .pd2 { animation: pulseNodeSm 2.5s ease-in-out infinite 0.9s; }
                .pd3 { animation: pulseNodeSm 2.5s ease-in-out infinite 1.5s; }
                .pd4 { animation: pulseNodeSm 2.5s ease-in-out infinite 2.1s; }
                .dc-pulse { animation: pulseDC 2s ease-in-out infinite; }
                .scan-line { animation: scanH 5s ease-in-out infinite; }
                .blink { animation: blinkText 2s ease-in-out infinite; }
                .dash-flow { animation: dashFlow 1.5s linear infinite; }
                .packet { offset-rotate: 0deg; animation: dataPacket 3s ease-in-out infinite; }
                .pkt2 { animation-delay: 1s; }
                .pkt3 { animation-delay: 2s; }
                .pkt4 { animation-delay: 0.5s; }
                .pkt5 { animation-delay: 1.5s; }
                .pkt6 { animation-delay: 2.5s; }
                .tiny-pulse { animation: pulseTiny 4s ease-in-out infinite; }
                .tp2 { animation-delay: 1s; }
                .tp3 { animation-delay: 2s; }
                .tp4 { animation-delay: 3s; }
                .tp5 { animation-delay: 0.5s; }
                .tp6 { animation-delay: 1.5s; }
                .tp7 { animation-delay: 2.5s; }
                .tp8 { animation-delay: 3.5s; }
                .float-data { animation: fadeFloat 6s ease-in-out infinite; }
                .fd2 { animation-delay: 2s; }
                .fd3 { animation-delay: 4s; }
            `}</style>

            {/* Grid dots */}
            <pattern id="dots" x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse">
                <circle cx="12.5" cy="12.5" r="0.5" fill="rgba(239,68,68,0.15)" />
            </pattern>
            <rect width="500" height="500" fill="url(#dots)" />

            {/* ── LURKHOUND branding watermark ── */}
            <g transform="translate(150, 160) scale(2.8)" opacity="0.04">
                <path d="
                    M2 18.5 C2.5 17, 4 15.5, 5.5 15 C6 14.5, 6.5 13, 6 12 L5 10.5
                    C5 10, 5.5 9.5, 6 9.5 L7.5 10 C8 10, 8.5 9.5, 8.5 9 L8 7.5
                    C8 7, 8.5 6.5, 9 7 L10 8.5 C10.5 9, 11 9, 11.5 8.5 L13 7
                    C14 6.5, 15.5 6.5, 17 7.5 C18 8, 19 9, 19.5 10
                    C20.5 10.5, 22 11, 23 11 C24 11, 25.5 11.5, 27 12.5
                    C28 13.2, 29 14, 29.5 15 C30 15.8, 30 16.5, 29.5 17
                    C29 17.5, 28 17.5, 27 17 C26 16.5, 25 16, 24 16
                    C23 16, 22 16.5, 21 17 C20 17.8, 19 18.5, 17.5 19
                    C16 19.5, 14.5 19.5, 13 19 C12 18.5, 11 18, 10 18
                    C9 18, 7.5 19, 6.5 20 C5.5 21, 4.5 22, 3 23
                    C2.5 23.5, 2 23, 2 22.5 C2 21.5, 2.5 20, 3.5 19.5 L2 18.5 Z
                " fill="#ef4444" />
            </g>
            {/* LURKHOUND text watermark */}
            <text x="250" y="480" textAnchor="middle" fill="rgba(239,68,68,0.06)"
                fontSize="48" fontFamily="Space Grotesk, sans-serif" fontWeight="700"
                letterSpacing="12">
                LURKHOUND
            </text>
            {/* Tagline under watermark */}
            <text x="250" y="22" textAnchor="middle" fill="rgba(239,68,68,0.12)"
                fontSize="8" fontFamily="Space Mono, monospace" letterSpacing="6">
                ACTIVE DIRECTORY RECON SYSTEM
            </text>

            {/* ── Topographic contour lines ── */}
            <path d="M30,80 Q80,50 140,70 Q180,85 200,110" stroke="rgba(239,68,68,0.06)" strokeWidth="0.8" />
            <path d="M25,95 Q90,60 160,80 Q195,92 210,120" stroke="rgba(239,68,68,0.04)" strokeWidth="0.8" />
            <path d="M20,110 Q100,75 170,90 Q200,100 220,130" stroke="rgba(239,68,68,0.03)" strokeWidth="0.8" />
            <path d="M360,420 Q400,440 440,415 Q460,400 475,370" stroke="rgba(239,68,68,0.06)" strokeWidth="0.8" />
            <path d="M350,435 Q395,452 445,430 Q468,415 480,385" stroke="rgba(239,68,68,0.04)" strokeWidth="0.8" />
            <path d="M340,448 Q390,465 450,445 Q475,430 485,400" stroke="rgba(239,68,68,0.03)" strokeWidth="0.8" />
            <path d="M350,30 Q400,55 430,100 Q445,130 460,170" stroke="rgba(255,185,95,0.04)" strokeWidth="0.8" />
            <path d="M365,25 Q410,48 440,90 Q455,120 470,160" stroke="rgba(255,185,95,0.03)" strokeWidth="0.8" />
            <path d="M30,400 Q65,430 110,440 Q150,445 190,430" stroke="rgba(255,185,95,0.04)" strokeWidth="0.8" />
            <path d="M25,415 Q60,445 105,455 Q145,460 185,445" stroke="rgba(255,185,95,0.03)" strokeWidth="0.8" />

            {/* ── Concentric rings (breathing) ── */}
            <circle cx="250" cy="250" r="230" stroke="rgba(239,68,68,0.03)" strokeWidth="0.5" strokeDasharray="2 6" />
            <circle cx="250" cy="250" r="200" stroke="rgba(239,68,68,0.08)" strokeWidth="1" strokeDasharray="4 4" className="ring1" />
            <circle cx="250" cy="250" r="150" stroke="rgba(239,68,68,0.1)" strokeWidth="1" strokeDasharray="4 4" className="ring2" />
            <circle cx="250" cy="250" r="100" stroke="rgba(239,68,68,0.12)" strokeWidth="1" className="ring3" />
            <circle cx="250" cy="250" r="50" stroke="rgba(239,68,68,0.15)" strokeWidth="1" className="ring4" />

            {/* Crosshairs */}
            <line x1="250" y1="20" x2="250" y2="480" stroke="rgba(239,68,68,0.05)" strokeWidth="0.5" />
            <line x1="20" y1="250" x2="480" y2="250" stroke="rgba(239,68,68,0.05)" strokeWidth="0.5" />
            <line x1="75" y1="75" x2="425" y2="425" stroke="rgba(239,68,68,0.03)" strokeWidth="0.5" />
            <line x1="425" y1="75" x2="75" y2="425" stroke="rgba(239,68,68,0.03)" strokeWidth="0.5" />

            {/* ── Outer perimeter sensor nodes ── */}
            <circle cx="60" cy="120" r="3" stroke="#ef4444" strokeWidth="0.8" fill="rgba(239,68,68,0.08)" className="tiny-pulse" />
            <circle cx="440" cy="100" r="3" stroke="#ef4444" strokeWidth="0.8" fill="rgba(239,68,68,0.08)" className="tiny-pulse tp2" />
            <circle cx="420" cy="400" r="3" stroke="#ffb95f" strokeWidth="0.8" fill="rgba(255,185,95,0.08)" className="tiny-pulse tp3" />
            <circle cx="80" cy="420" r="3" stroke="#ffb95f" strokeWidth="0.8" fill="rgba(255,185,95,0.08)" className="tiny-pulse tp4" />
            <circle cx="250" cy="30" r="2.5" stroke="#ef4444" strokeWidth="0.8" fill="rgba(239,68,68,0.06)" className="tiny-pulse tp5" />
            <circle cx="30" cy="250" r="2.5" stroke="#ef4444" strokeWidth="0.8" fill="rgba(239,68,68,0.06)" className="tiny-pulse tp6" />
            <circle cx="470" cy="250" r="2.5" stroke="#ffb95f" strokeWidth="0.8" fill="rgba(255,185,95,0.06)" className="tiny-pulse tp7" />
            <circle cx="250" cy="470" r="2.5" stroke="#ffb95f" strokeWidth="0.8" fill="rgba(255,185,95,0.06)" className="tiny-pulse tp8" />

            {/* Connections from perimeter nodes */}
            <line x1="60" y1="120" x2="170" y2="180" stroke="rgba(239,68,68,0.08)" strokeWidth="0.5" strokeDasharray="3 6" className="dash-flow" />
            <line x1="440" y1="100" x2="330" y2="180" stroke="rgba(239,68,68,0.08)" strokeWidth="0.5" strokeDasharray="3 6" className="dash-flow" />
            <line x1="420" y1="400" x2="330" y2="330" stroke="rgba(255,185,95,0.08)" strokeWidth="0.5" strokeDasharray="3 6" className="dash-flow" />
            <line x1="80" y1="420" x2="170" y2="330" stroke="rgba(255,185,95,0.08)" strokeWidth="0.5" strokeDasharray="3 6" className="dash-flow" />
            <line x1="250" y1="30" x2="250" y2="128" stroke="rgba(239,68,68,0.06)" strokeWidth="0.5" strokeDasharray="2 5" className="dash-flow" />
            <line x1="470" y1="250" x2="380" y2="260" stroke="rgba(255,185,95,0.06)" strokeWidth="0.5" strokeDasharray="2 5" className="dash-flow" />

            {/* ── Small secondary cluster (upper-left) ── */}
            <circle cx="95" cy="75" r="3.5" stroke="#ef4444" strokeWidth="1" fill="rgba(239,68,68,0.1)" className="pn1" />
            <circle cx="130" cy="55" r="3" stroke="#ffb95f" strokeWidth="0.8" fill="rgba(255,185,95,0.08)" className="pd2" />
            <circle cx="70" cy="55" r="3" stroke="#ef4444" strokeWidth="0.8" fill="rgba(239,68,68,0.08)" className="pd3" />
            <line x1="95" y1="75" x2="130" y2="55" stroke="rgba(239,68,68,0.15)" strokeWidth="0.5" strokeDasharray="2 3" className="dash-flow" />
            <line x1="95" y1="75" x2="70" y2="55" stroke="rgba(239,68,68,0.15)" strokeWidth="0.5" strokeDasharray="2 3" className="dash-flow" />
            <line x1="95" y1="75" x2="60" y2="120" stroke="rgba(239,68,68,0.1)" strokeWidth="0.5" strokeDasharray="2 3" className="dash-flow" />

            {/* ── Small secondary cluster (lower-right) ── */}
            <circle cx="420" cy="440" r="3.5" stroke="#ffb95f" strokeWidth="1" fill="rgba(255,185,95,0.1)" className="pn3" />
            <circle cx="450" cy="460" r="3" stroke="#ef4444" strokeWidth="0.8" fill="rgba(239,68,68,0.08)" className="pd1" />
            <circle cx="390" cy="460" r="3" stroke="#ffb95f" strokeWidth="0.8" fill="rgba(255,185,95,0.08)" className="pd4" />
            <line x1="420" y1="440" x2="450" y2="460" stroke="rgba(255,185,95,0.15)" strokeWidth="0.5" strokeDasharray="2 3" className="dash-flow" />
            <line x1="420" y1="440" x2="390" y2="460" stroke="rgba(255,185,95,0.15)" strokeWidth="0.5" strokeDasharray="2 3" className="dash-flow" />
            <line x1="420" y1="440" x2="420" y2="400" stroke="rgba(255,185,95,0.1)" strokeWidth="0.5" strokeDasharray="2 3" className="dash-flow" />

            {/* ── Radar sweep beam ── */}
            <g className="sweep">
                <line x1="250" y1="250" x2="250" y2="20" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
                <path d="M250,250 L250,20 A230,230 0 0,1 390,60 Z" fill="url(#sweepGlow)" opacity="0.5" />
            </g>

            {/* Horizontal scan line */}
            <line x1="20" y1="250" x2="480" y2="250" stroke="rgba(239,68,68,0.3)" strokeWidth="0.5" className="scan-line" />

            {/* ── Main Network Edges ── */}
            <line x1="250" y1="240" x2="250" y2="150" stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="4 4" className="dash-flow" />
            <line x1="260" y1="250" x2="362" y2="260" stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="4 4" className="dash-flow" />
            <line x1="240" y1="250" x2="138" y2="260" stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="4 4" className="dash-flow" />
            <line x1="250" y1="260" x2="250" y2="370" stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="4 4" className="dash-flow" />
            <line x1="240" y1="240" x2="176" y2="186" stroke="rgba(239,68,68,0.2)" strokeWidth="1" strokeDasharray="3 3" className="dash-flow" />
            <line x1="260" y1="240" x2="324" y2="186" stroke="rgba(239,68,68,0.2)" strokeWidth="1" strokeDasharray="3 3" className="dash-flow" />
            <line x1="240" y1="260" x2="176" y2="324" stroke="rgba(239,68,68,0.2)" strokeWidth="1" strokeDasharray="3 3" className="dash-flow" />
            <line x1="260" y1="260" x2="324" y2="324" stroke="rgba(239,68,68,0.2)" strokeWidth="1" strokeDasharray="3 3" className="dash-flow" />

            {/* Inter-node dashed connections */}
            <line x1="176" y1="180" x2="244" y2="140" stroke="rgba(255,185,95,0.2)" strokeWidth="0.5" strokeDasharray="3 3" className="dash-flow" />
            <line x1="324" y1="180" x2="258" y2="140" stroke="rgba(255,185,95,0.2)" strokeWidth="0.5" strokeDasharray="3 3" className="dash-flow" />
            <line x1="176" y1="330" x2="244" y2="380" stroke="rgba(255,185,95,0.2)" strokeWidth="0.5" strokeDasharray="3 3" className="dash-flow" />
            <line x1="324" y1="330" x2="258" y2="380" stroke="rgba(255,185,95,0.2)" strokeWidth="0.5" strokeDasharray="3 3" className="dash-flow" />

            {/* ── Data packets ── */}
            <path id="pathUp" d="M250,240 L250,150" fill="none" />
            <path id="pathRight" d="M260,250 L362,260" fill="none" />
            <path id="pathLeft" d="M240,250 L138,260" fill="none" />
            <path id="pathDown" d="M250,260 L250,370" fill="none" />
            <path id="pathTL" d="M240,240 L176,186" fill="none" />
            <path id="pathTR" d="M260,240 L324,186" fill="none" />

            <circle r="2.5" fill="#ef4444" filter="url(#nodeGlow)" className="packet" style={{ offsetPath: "path('M250,240 L250,150')" }} />
            <circle r="2.5" fill="#ef4444" filter="url(#nodeGlow)" className="packet pkt2" style={{ offsetPath: "path('M260,250 L362,260')" }} />
            <circle r="2.5" fill="#ef4444" filter="url(#nodeGlow)" className="packet pkt3" style={{ offsetPath: "path('M240,250 L138,260')" }} />
            <circle r="2" fill="#ffb95f" filter="url(#amberGlow)" className="packet pkt4" style={{ offsetPath: "path('M250,260 L250,370')" }} />
            <circle r="2" fill="#ffb95f" filter="url(#amberGlow)" className="packet pkt5" style={{ offsetPath: "path('M240,240 L176,186')" }} />
            <circle r="2" fill="#ef4444" filter="url(#nodeGlow)" className="packet pkt6" style={{ offsetPath: "path('M260,240 L324,186')" }} />

            {/* ── Central node (DC) ── */}
            <rect x="237" y="237" width="26" height="26" rx="3" fill="rgba(239,68,68,0.06)" stroke="rgba(239,68,68,0.2)" strokeWidth="1" className="dc-pulse" />
            <rect x="240" y="240" width="20" height="20" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.15)" rx="2" className="dc-pulse" filter="url(#nodeGlow)" />

            {/* ── User nodes ── */}
            <circle cx="170" cy="180" r="6" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.12)" className="pn1" filter="url(#nodeGlow)" />
            <circle cx="330" cy="180" r="6" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.12)" className="pn2" filter="url(#nodeGlow)" />
            <circle cx="170" cy="330" r="6" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.12)" className="pn3" filter="url(#nodeGlow)" />
            <circle cx="330" cy="330" r="6" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.12)" className="pn4" filter="url(#nodeGlow)" />

            {/* ── Computer nodes (diamonds) ── */}
            <polygon points="250,128 260,140 250,152 240,140" stroke="#ffb95f" strokeWidth="1.5" fill="rgba(255,185,95,0.12)" className="pd1" filter="url(#amberGlow)" />
            <polygon points="370,248 380,260 370,272 360,260" stroke="#ffb95f" strokeWidth="1.5" fill="rgba(255,185,95,0.12)" className="pd2" filter="url(#amberGlow)" />
            <polygon points="130,248 140,260 130,272 120,260" stroke="#ffb95f" strokeWidth="1.5" fill="rgba(255,185,95,0.12)" className="pd3" filter="url(#amberGlow)" />
            <polygon points="250,368 260,380 250,392 240,380" stroke="#ffb95f" strokeWidth="1.5" fill="rgba(255,185,95,0.12)" className="pd4" filter="url(#amberGlow)" />

            {/* ── Corner HUD data readouts ── */}
            <text x="20" y="22" fill="rgba(134,148,138,0.35)" fontSize="7" fontFamily="Space Mono, monospace" className="float-data">SECTOR_A1 // MAPPED</text>
            <text x="20" y="32" fill="rgba(239,68,68,0.25)" fontSize="7" fontFamily="Space Mono, monospace" className="float-data">VULN_COUNT: 47</text>
            <text x="370" y="22" fill="rgba(134,148,138,0.35)" fontSize="7" fontFamily="Space Mono, monospace" textAnchor="start" className="float-data fd2">LAT: 42.3601°N</text>
            <text x="370" y="32" fill="rgba(134,148,138,0.25)" fontSize="7" fontFamily="Space Mono, monospace" textAnchor="start" className="float-data fd2">LON: 71.0589°W</text>
            <text x="370" y="490" fill="rgba(255,185,95,0.25)" fontSize="7" fontFamily="Space Mono, monospace" className="float-data fd3">KERBEROS_TGT: VALID</text>
            <text x="370" y="480" fill="rgba(134,148,138,0.25)" fontSize="7" fontFamily="Space Mono, monospace" className="float-data fd3">NTLM_HASH: ●●●●●●●●</text>

            {/* ── Hex data stream ── */}
            <text x="160" y="48" fill="rgba(134,148,138,0.12)" fontSize="6.5" fontFamily="Space Mono, monospace" className="float-data">
                4F 70 65 72 61 74 6F 72
            </text>
            <text x="160" y="58" fill="rgba(134,148,138,0.1)" fontSize="6.5" fontFamily="Space Mono, monospace" className="float-data fd2">
                41 44 20 4D 61 70 70 65
            </text>

            {/* ── Main bottom data labels ── */}
            <text x="25" y="455" fill="rgba(134,148,138,0.4)" fontSize="9" fontFamily="Space Mono, monospace">
                PATH_VECTORS: CALCULATING...
            </text>
            <text x="25" y="468" fill="rgba(134,148,138,0.4)" fontSize="9" fontFamily="Space Mono, monospace">
                NODES_DETECTED: 1,462
            </text>
            <text x="25" y="481" fill="rgba(134,148,138,0.4)" fontSize="9" fontFamily="Space Mono, monospace">
                EDGES_MAPPED: 3,847
            </text>
            <text x="25" y="494" fill="rgba(239,68,68,0.6)" fontSize="9" fontFamily="Space Mono, monospace" className="blink">
                STATUS: SCANNING_ACTIVE ■
            </text>
        </svg>
    )
}

/* ─── Floating Particles Component ─── */
const particles = [
    // ── Row 1: y 0–8% ──
    { x: '2%', y: '1%', size: 3, dur: '18s', delay: '0s', opacity: 0.4 },
    { x: '12%', y: '5%', size: 4, dur: '22s', delay: '2s', opacity: 0.5 },
    { x: '22%', y: '3%', size: 3, dur: '16s', delay: '4.5s', opacity: 0.35 },
    { x: '32%', y: '7%', size: 5, dur: '20s', delay: '1s', opacity: 0.4 },
    { x: '42%', y: '2%', size: 3, dur: '24s', delay: '6s', opacity: 0.3 },
    { x: '52%', y: '6%', size: 4, dur: '17s', delay: '3s', opacity: 0.45 },
    { x: '62%', y: '4%', size: 3, dur: '21s', delay: '8s', opacity: 0.35 },
    { x: '72%', y: '1%', size: 5, dur: '19s', delay: '0.5s', opacity: 0.4 },
    { x: '82%', y: '5%', size: 3, dur: '25s', delay: '5s', opacity: 0.3 },
    { x: '90%', y: '3%', size: 4, dur: '15s', delay: '7s', opacity: 0.45 },
    { x: '97%', y: '7%', size: 3, dur: '23s', delay: '3.5s', opacity: 0.25 },
    // ── Row 2: y 9–16% ──
    { x: '5%', y: '10%', size: 4, dur: '17s', delay: '1s', opacity: 0.4 },
    { x: '15%', y: '13%', size: 3, dur: '23s', delay: '5.5s', opacity: 0.35 },
    { x: '25%', y: '11%', size: 5, dur: '20s', delay: '3s', opacity: 0.45 },
    { x: '35%', y: '15%', size: 3, dur: '18s', delay: '7.5s', opacity: 0.3 },
    { x: '45%', y: '9%', size: 4, dur: '25s', delay: '2s', opacity: 0.4 },
    { x: '55%', y: '14%', size: 3, dur: '16s', delay: '8.5s', opacity: 0.5 },
    { x: '65%', y: '12%', size: 6, dur: '22s', delay: '0.5s', opacity: 0.35 },
    { x: '75%', y: '10%', size: 3, dur: '17s', delay: '4s', opacity: 0.4 },
    { x: '84%', y: '15%', size: 4, dur: '26s', delay: '6s', opacity: 0.3 },
    { x: '92%', y: '11%', size: 3, dur: '20s', delay: '9s', opacity: 0.25 },
    { x: '98%', y: '13%', size: 5, dur: '18s', delay: '1.5s', opacity: 0.4 },
    // ── Row 3: y 17–24% ──
    { x: '3%', y: '18%', size: 5, dur: '16s', delay: '1.5s', opacity: 0.45 },
    { x: '13%', y: '21%', size: 3, dur: '21s', delay: '4s', opacity: 0.3 },
    { x: '23%', y: '19%', size: 4, dur: '19s', delay: '6s', opacity: 0.4 },
    { x: '33%', y: '23%', size: 3, dur: '25s', delay: '8s', opacity: 0.35 },
    { x: '43%', y: '17%', size: 5, dur: '17s', delay: '2.5s', opacity: 0.5 },
    { x: '53%', y: '22%', size: 3, dur: '22s', delay: '0s', opacity: 0.3 },
    { x: '63%', y: '20%', size: 4, dur: '20s', delay: '5.5s', opacity: 0.4 },
    { x: '73%', y: '18%', size: 3, dur: '15s', delay: '3s', opacity: 0.45 },
    { x: '83%', y: '23%', size: 5, dur: '24s', delay: '7.5s', opacity: 0.35 },
    { x: '91%', y: '20%', size: 3, dur: '21s', delay: '9s', opacity: 0.25 },
    { x: '97%', y: '17%', size: 4, dur: '17s', delay: '1s', opacity: 0.4 },
    // ── Row 4: y 25–32% ──
    { x: '4%', y: '26%', size: 3, dur: '20s', delay: '3s', opacity: 0.4 },
    { x: '14%', y: '29%', size: 4, dur: '18s', delay: '7s', opacity: 0.35 },
    { x: '24%', y: '27%', size: 5, dur: '24s', delay: '1s', opacity: 0.45 },
    { x: '34%', y: '31%', size: 3, dur: '16s', delay: '5.5s', opacity: 0.3 },
    { x: '44%', y: '25%', size: 4, dur: '22s', delay: '9s', opacity: 0.4 },
    { x: '54%', y: '30%', size: 3, dur: '19s', delay: '2.5s', opacity: 0.5 },
    { x: '64%', y: '28%', size: 5, dur: '25s', delay: '6s', opacity: 0.35 },
    { x: '74%', y: '26%', size: 3, dur: '15s', delay: '0s', opacity: 0.4 },
    { x: '84%', y: '31%', size: 4, dur: '21s', delay: '4.5s', opacity: 0.3 },
    { x: '92%', y: '28%', size: 3, dur: '17s', delay: '8s', opacity: 0.45 },
    { x: '98%', y: '26%', size: 4, dur: '23s', delay: '1.5s', opacity: 0.35 },
    // ── Row 5: y 33–40% ──
    { x: '2%', y: '34%', size: 4, dur: '19s', delay: '5s', opacity: 0.4 },
    { x: '12%', y: '37%', size: 3, dur: '22s', delay: '0.5s', opacity: 0.35 },
    { x: '22%', y: '35%', size: 5, dur: '17s', delay: '4s', opacity: 0.5 },
    { x: '32%', y: '39%', size: 3, dur: '25s', delay: '8.5s', opacity: 0.3 },
    { x: '42%', y: '33%', size: 4, dur: '20s', delay: '2s', opacity: 0.4 },
    { x: '52%', y: '38%', size: 3, dur: '16s', delay: '6.5s', opacity: 0.45 },
    { x: '62%', y: '36%', size: 4, dur: '23s', delay: '1s', opacity: 0.35 },
    { x: '72%', y: '34%', size: 3, dur: '18s', delay: '9s', opacity: 0.4 },
    { x: '82%', y: '40%', size: 5, dur: '21s', delay: '3.5s', opacity: 0.3 },
    { x: '90%', y: '37%', size: 3, dur: '15s', delay: '7s', opacity: 0.5 },
    { x: '96%', y: '35%', size: 4, dur: '24s', delay: '0s', opacity: 0.35 },
    // ── Row 6: y 41–48% ──
    { x: '5%', y: '42%', size: 5, dur: '18s', delay: '3s', opacity: 0.45 },
    { x: '15%', y: '45%', size: 3, dur: '25s', delay: '7.5s', opacity: 0.3 },
    { x: '25%', y: '43%', size: 4, dur: '16s', delay: '0s', opacity: 0.4 },
    { x: '35%', y: '47%', size: 3, dur: '21s', delay: '5s', opacity: 0.35 },
    { x: '45%', y: '41%', size: 5, dur: '19s', delay: '9.5s', opacity: 0.5 },
    { x: '55%', y: '46%', size: 6, dur: '22s', delay: '1s', opacity: 0.35 },
    { x: '65%', y: '44%', size: 3, dur: '17s', delay: '6.5s', opacity: 0.4 },
    { x: '75%', y: '42%', size: 4, dur: '24s', delay: '2.5s', opacity: 0.3 },
    { x: '85%', y: '47%', size: 3, dur: '15s', delay: '8s', opacity: 0.45 },
    { x: '93%', y: '44%', size: 4, dur: '20s', delay: '4.5s', opacity: 0.4 },
    { x: '98%', y: '41%', size: 3, dur: '26s', delay: '0.5s', opacity: 0.25 },
    // ── Row 7: y 49–56% ──
    { x: '3%', y: '50%', size: 4, dur: '21s', delay: '1.5s', opacity: 0.4 },
    { x: '13%', y: '53%', size: 3, dur: '17s', delay: '6s', opacity: 0.35 },
    { x: '23%', y: '51%', size: 5, dur: '24s', delay: '0s', opacity: 0.45 },
    { x: '33%', y: '55%', size: 3, dur: '19s', delay: '4s', opacity: 0.3 },
    { x: '43%', y: '49%', size: 4, dur: '22s', delay: '8.5s', opacity: 0.4 },
    { x: '53%', y: '54%', size: 3, dur: '15s', delay: '2.5s', opacity: 0.5 },
    { x: '63%', y: '52%', size: 4, dur: '25s', delay: '5.5s', opacity: 0.35 },
    { x: '73%', y: '50%', size: 3, dur: '18s', delay: '9s', opacity: 0.4 },
    { x: '83%', y: '56%', size: 5, dur: '20s', delay: '3s', opacity: 0.3 },
    { x: '91%', y: '53%', size: 4, dur: '16s', delay: '7.5s', opacity: 0.45 },
    { x: '97%', y: '50%', size: 3, dur: '23s', delay: '1s', opacity: 0.35 },
    // ── Row 8: y 57–64% ──
    { x: '4%', y: '58%', size: 3, dur: '20s', delay: '2s', opacity: 0.4 },
    { x: '14%', y: '61%', size: 4, dur: '18s', delay: '5s', opacity: 0.35 },
    { x: '24%', y: '59%', size: 5, dur: '24s', delay: '8s', opacity: 0.45 },
    { x: '34%', y: '63%', size: 3, dur: '15s', delay: '0.5s', opacity: 0.3 },
    { x: '44%', y: '57%', size: 4, dur: '22s', delay: '4.5s', opacity: 0.4 },
    { x: '54%', y: '62%', size: 3, dur: '16s', delay: '9s', opacity: 0.5 },
    { x: '64%', y: '60%', size: 5, dur: '25s', delay: '1.5s', opacity: 0.35 },
    { x: '74%', y: '58%', size: 3, dur: '19s', delay: '7s', opacity: 0.4 },
    { x: '84%', y: '64%', size: 4, dur: '17s', delay: '3s', opacity: 0.3 },
    { x: '92%', y: '61%', size: 3, dur: '23s', delay: '6.5s', opacity: 0.45 },
    { x: '98%', y: '59%', size: 4, dur: '21s', delay: '0s', opacity: 0.35 },
    // ── Row 9: y 65–72% ──
    { x: '2%', y: '66%', size: 4, dur: '22s', delay: '4s', opacity: 0.4 },
    { x: '12%', y: '69%', size: 3, dur: '17s', delay: '0s', opacity: 0.35 },
    { x: '22%', y: '67%', size: 5, dur: '19s', delay: '6s', opacity: 0.5 },
    { x: '32%', y: '71%', size: 3, dur: '25s', delay: '2.5s', opacity: 0.3 },
    { x: '42%', y: '65%', size: 4, dur: '16s', delay: '8s', opacity: 0.4 },
    { x: '52%', y: '70%', size: 3, dur: '24s', delay: '1.5s', opacity: 0.45 },
    { x: '62%', y: '68%', size: 4, dur: '18s', delay: '5.5s', opacity: 0.35 },
    { x: '72%', y: '66%', size: 3, dur: '21s', delay: '9.5s', opacity: 0.4 },
    { x: '82%', y: '72%', size: 5, dur: '15s', delay: '3s', opacity: 0.3 },
    { x: '90%', y: '69%', size: 4, dur: '23s', delay: '7.5s', opacity: 0.5 },
    { x: '96%', y: '67%', size: 3, dur: '20s', delay: '0.5s', opacity: 0.35 },
    // ── Row 10: y 73–80% ──
    { x: '5%', y: '74%', size: 5, dur: '18s', delay: '5s', opacity: 0.4 },
    { x: '15%', y: '77%', size: 3, dur: '24s', delay: '0s', opacity: 0.35 },
    { x: '25%', y: '75%', size: 4, dur: '16s', delay: '3.5s', opacity: 0.5 },
    { x: '35%', y: '79%', size: 3, dur: '21s', delay: '7s', opacity: 0.3 },
    { x: '45%', y: '73%', size: 5, dur: '20s', delay: '9s', opacity: 0.4 },
    { x: '55%', y: '78%', size: 3, dur: '15s', delay: '1.5s', opacity: 0.45 },
    { x: '65%', y: '76%', size: 4, dur: '25s', delay: '4.5s', opacity: 0.35 },
    { x: '75%', y: '74%', size: 6, dur: '18s', delay: '8.5s', opacity: 0.4 },
    { x: '85%', y: '80%', size: 3, dur: '22s', delay: '2s', opacity: 0.3 },
    { x: '93%', y: '77%', size: 4, dur: '16s', delay: '6s', opacity: 0.45 },
    { x: '98%', y: '75%', size: 3, dur: '21s', delay: '0.5s', opacity: 0.35 },
    // ── Row 11: y 81–88% ──
    { x: '3%', y: '82%', size: 4, dur: '19s', delay: '7.5s', opacity: 0.4 },
    { x: '13%', y: '85%', size: 3, dur: '22s', delay: '2s', opacity: 0.35 },
    { x: '23%', y: '83%', size: 5, dur: '17s', delay: '0s', opacity: 0.45 },
    { x: '33%', y: '87%', size: 3, dur: '25s', delay: '4s', opacity: 0.3 },
    { x: '43%', y: '81%', size: 4, dur: '20s', delay: '6.5s', opacity: 0.4 },
    { x: '53%', y: '86%', size: 3, dur: '15s', delay: '9s', opacity: 0.5 },
    { x: '63%', y: '84%', size: 4, dur: '24s', delay: '1.5s', opacity: 0.35 },
    { x: '73%', y: '82%', size: 3, dur: '18s', delay: '5.5s', opacity: 0.4 },
    { x: '83%', y: '88%', size: 5, dur: '16s', delay: '3s', opacity: 0.3 },
    { x: '91%', y: '85%', size: 4, dur: '23s', delay: '8s', opacity: 0.45 },
    { x: '97%', y: '83%', size: 3, dur: '21s', delay: '0.5s', opacity: 0.35 },
    // ── Row 12: y 89–97% ──
    { x: '4%', y: '90%', size: 3, dur: '21s', delay: '0s', opacity: 0.4 },
    { x: '14%', y: '93%', size: 4, dur: '18s', delay: '3.5s', opacity: 0.35 },
    { x: '24%', y: '91%', size: 5, dur: '25s', delay: '6s', opacity: 0.45 },
    { x: '34%', y: '95%', size: 3, dur: '16s', delay: '1s', opacity: 0.3 },
    { x: '44%', y: '89%', size: 4, dur: '22s', delay: '5s', opacity: 0.4 },
    { x: '54%', y: '94%', size: 3, dur: '19s', delay: '8.5s', opacity: 0.5 },
    { x: '64%', y: '92%', size: 4, dur: '24s', delay: '2.5s', opacity: 0.35 },
    { x: '74%', y: '90%', size: 3, dur: '15s', delay: '7s', opacity: 0.4 },
    { x: '84%', y: '96%', size: 5, dur: '17s', delay: '0.5s', opacity: 0.3 },
    { x: '92%', y: '93%', size: 4, dur: '23s', delay: '4.5s', opacity: 0.45 },
    { x: '98%', y: '91%', size: 3, dur: '21s', delay: '7.5s', opacity: 0.4 },
]

const ENUM_STAGES = [
    { key: 'auth', label: 'AUTHENTICATING', pct: 5 },
    { key: 'users', label: 'ENUMERATING USERS', pct: 15 },
    { key: 'groups', label: 'ENUMERATING GROUPS', pct: 30 },
    { key: 'computers', label: 'ENUMERATING COMPUTERS', pct: 40 },
    { key: 'acls', label: 'ENUMERATING ACLS', pct: 55 },
    { key: 'graph', label: 'BUILDING GRAPH', pct: 70 },
    { key: 'paths', label: 'DISCOVERING PATHS', pct: 80 },
    { key: 'findings', label: 'DETECTING MISCONFIGS', pct: 90 },
    { key: 'complete', label: 'SCAN COMPLETE', pct: 100 },
]

export default function LoginPage() {
    const { setSession } = useSession()
    const router = useRouter()

    const [isStarted, setIsStarted] = useState(false)
    const [form, setForm] = useState({
        dc_ip: '',
        domain: '',
        username: '',
        password: '',
        use_ldaps: true,
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [enumProgress, setEnumProgress] = useState<{ stage: string; pct: number } | null>(null)

    const set = (k: string, v: string | boolean) =>
        setForm(f => ({ ...f, [k]: v }))

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)
        setEnumProgress({ stage: 'CONNECTING...', pct: 0 })

        // Simulate progress stages during REST call
        const progressInterval = setInterval(() => {
            setEnumProgress(prev => {
                if (!prev || prev.pct >= 90) return prev
                const nextIdx = ENUM_STAGES.findIndex(s => s.pct > (prev?.pct || 0))
                const next = ENUM_STAGES[nextIdx] || prev
                return { stage: next.label, pct: Math.min(90, prev.pct + 8) }
            })
        }, 1200)

        try {
            const data = await login(form)
            clearInterval(progressInterval)
            setEnumProgress({ stage: 'SCAN COMPLETE', pct: 100 })
            setSession(data)
            setTimeout(() => router.push('/dashboard/overview'), 600)
        } catch (err: unknown) {
            clearInterval(progressInterval)
            setError(err instanceof Error ? err.message : 'Connection failed')
            setLoading(false)
            setEnumProgress(null)
        }
    }

    return (
        <main className="landing-root">
            {/* ─── START Button (top-right, only before started) ─── */}
            <button
                id="start-btn"
                onClick={() => setIsStarted(true)}
                className={clsx('start-btn', isStarted && 'start-btn--hidden')}
                aria-label="Start"
            >
                <Zap size={12} />
                START
            </button>

            {/* ─── HERO / LEFT SIDE ─── */}
            <div
                className={clsx(
                    'hero-section tactical-grid',
                    isStarted && 'hero-section--shifted'
                )}
            >
                {/* Scanline */}
                <div className="absolute top-0 left-0 right-0 scanline" />

                {/* Floating red particles */}
                {particles.map((p, i) => (
                    <div
                        key={i}
                        className="particle-dot"
                        style={{
                            left: p.x,
                            top: p.y,
                            width: p.size,
                            height: p.size,
                            opacity: p.opacity,
                            animationDuration: p.dur,
                            animationDelay: p.delay,
                        }}
                    />
                ))}

                {/* LURKHOUND branding */}
                <div className="hero-brand">
                    <PantherIcon size={72} className="text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.6)]" />
                    <h1
                        className="hero-title"
                        style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            textShadow: '0 0 40px rgba(239,68,68,0.25), 0 0 80px rgba(239,68,68,0.1)',
                        }}
                    >
                        LURKHOUND
                    </h1>
                    <div className="hero-divider" />
                    <p className="hero-subtitle">
                        Active Directory Recon System
                    </p>
                </div>

                {/* Radar viewport */}
                <div className="hero-radar-viewport">
                    <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-red-500/40 rounded-tl" />
                    <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-red-500/40 rounded-tr" />
                    <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-red-500/40 rounded-bl" />
                    <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-red-500/40 rounded-br" />
                    <RadarTopology />
                </div>
            </div>

            {/* ─── CONTROL PANEL (Right Side) — only rendered after START ─── */}
            {isStarted && (
                <div className="control-panel">
                    <div className="control-panel-inner">
                        {/* Top: Threat level indicator */}
                        <div className="flex justify-end mb-8">
                            <div className="threat-indicator threat-standby">
                                <span className="pulse-dot pulse-dot-amber" />
                                THREAT LEVEL: STANDBY
                            </div>
                        </div>

                        {/* Brand */}
                        <div className="mb-8">
                            <div className="flex items-center gap-2.5 mb-2">
                                <PantherIcon size={22} className="text-red-500" />
                                <h2 className="text-xl font-bold text-ink tracking-wide uppercase">LurkHound</h2>
                            </div>
                            <p className="text-xs font-mono text-ink-muted uppercase tracking-tactical">
                                Establish Secure Uplink
                            </p>
                        </div>

                        {/* Security notice */}
                        <div className="login-notice">
                            <Lock size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-ink-muted leading-relaxed font-mono">
                                // ALL TRANSMISSIONS ENCRYPTED (LDAPS)
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* DC IP */}
                            <div>
                                <label className="login-label">Domain Controller IP</label>
                                <div className="relative">
                                    <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" />
                                    <input
                                        id="input-dc-ip"
                                        className="login-input pl-9"
                                        type="text"
                                        placeholder="192.168.1.10"
                                        value={form.dc_ip}
                                        onChange={e => set('dc_ip', e.target.value)}
                                        autoComplete="off"
                                        spellCheck={false}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Domain */}
                            <div>
                                <label className="login-label">Target Domain</label>
                                <div className="relative">
                                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" />
                                    <input
                                        id="input-domain"
                                        className="login-input pl-9"
                                        type="text"
                                        placeholder="corp.local"
                                        value={form.domain}
                                        onChange={e => set('domain', e.target.value)}
                                        autoComplete="off"
                                        spellCheck={false}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Username + Password */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="login-label">Username</label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" />
                                        <input
                                            id="input-operator"
                                            className="login-input pl-9"
                                            type="text"
                                            placeholder="Administrator"
                                            value={form.username}
                                            onChange={e => set('username', e.target.value)}
                                            autoComplete="username"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="login-label">Password</label>
                                    <div className="relative">
                                        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" />
                                        <input
                                            id="input-password"
                                            className="login-input pl-9"
                                            type="password"
                                            placeholder="••••••••"
                                            value={form.password}
                                            onChange={e => set('password', e.target.value)}
                                            autoComplete="current-password"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* LDAPS toggle */}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <div
                                    onClick={() => set('use_ldaps', !form.use_ldaps)}
                                    className={clsx(
                                        'w-8 h-[18px] rounded-full relative transition-colors duration-200 cursor-pointer flex-shrink-0',
                                        form.use_ldaps ? 'bg-accent' : 'bg-bg-raised'
                                    )}
                                >
                                    <span
                                        className={clsx(
                                            'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-200',
                                            form.use_ldaps ? 'left-[14px]' : 'left-0.5'
                                        )}
                                    />
                                </div>
                                <span className="text-xs text-ink-muted font-mono uppercase tracking-wider">LDAPS (PORT 636)</span>
                            </label>

                            {/* Error */}
                            {error && (
                                <div className="p-3 rounded-sm bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    {error}
                                </div>
                            )}

                            {/* Progress Bar */}
                            {enumProgress && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="text-accent uppercase tracking-wider">{enumProgress.stage}</span>
                                        <span className="text-ink-muted">{enumProgress.pct}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-bg-raised rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500 ease-out"
                                            style={{
                                                width: `${enumProgress.pct}%`,
                                                background: enumProgress.pct >= 100
                                                    ? '#22c55e'
                                                    : 'linear-gradient(90deg, #ef4444, #f97316)',
                                                boxShadow: enumProgress.pct < 100
                                                    ? '0 0 8px rgba(239,68,68,0.5)'
                                                    : '0 0 8px rgba(34,197,94,0.5)',
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                id="btn-initiate-recon"
                                type="submit"
                                disabled={loading}
                                className="login-submit-btn"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        {enumProgress?.stage || 'SCANNING DOMAIN...'}
                                    </>
                                ) : (
                                    <>
                                        <Crosshair size={14} />
                                        INITIATE RECON
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 pt-4 border-t border-bg-border">
                            <p className="text-[10px] font-mono text-ink-muted/40 uppercase tracking-wider">
                                PROTOCOL V2.1 &middot; AES-256 &middot; AEGIS_LINK
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
