import React from 'react';
import type { GameDefinition } from '../types';

interface GamePreviewProps {
  game: GameDefinition;
}

const rail = '#3f3f46';
const white = '#f4f4f5';
const muted = '#71717a';
const rose = '#fb7185';
const amber = '#fbbf24';
const emerald = '#34d399';
const cyan = '#22d3ee';
const violet = '#a78bfa';

const GridBackdrop = ({ accent }: { accent: string }) => (
  <>
    {Array.from({ length: 9 }, (_, index) => (
      <line key={`v-${index}`} x1={index * 40} y1="0" x2={index * 40} y2="160" stroke={accent} strokeOpacity="0.055" />
    ))}
    {Array.from({ length: 5 }, (_, index) => (
      <line key={`h-${index}`} x1="0" y1={index * 40} x2="320" y2={index * 40} stroke={accent} strokeOpacity="0.055" />
    ))}
  </>
);

const sceneFor = (gameId: string, accent: string): React.ReactNode => {
  switch (gameId) {
    case 'orbit':
      return (
        <>
          <circle cx="160" cy="82" r="25" fill="none" stroke={accent} strokeWidth="3" strokeOpacity="0.85" />
          <circle cx="160" cy="82" r="49" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.3" />
          <circle cx="204" cy="62" r="7" fill={white} />
          <path d="M 208 56 L 232 43" stroke={cyan} strokeWidth="2" strokeDasharray="4 5" />
          <polygon points="115,55 121,62 115,69 109,62" fill={cyan} />
          <path d="M 60 128 C 107 94, 180 110, 263 52" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.45" />
        </>
      );
    case 'stack':
      return (
        <>
          <rect x="104" y="126" width="112" height="13" rx="2" fill={accent} />
          <rect x="113" y="107" width="94" height="13" rx="2" fill={accent} fillOpacity="0.78" />
          <rect x="124" y="88" width="76" height="13" rx="2" fill={accent} fillOpacity="0.6" />
          <rect x="135" y="69" width="58" height="13" rx="2" fill={accent} fillOpacity="0.45" />
          <rect x="151" y="42" width="58" height="13" rx="2" fill={white} fillOpacity="0.9" />
          <line x1="180" y1="27" x2="180" y2="58" stroke={white} strokeOpacity="0.35" strokeDasharray="3 4" />
        </>
      );
    case 'reaction':
      return (
        <>
          <circle cx="160" cy="80" r="36" fill={emerald} fillOpacity="0.16" stroke={emerald} strokeWidth="3" />
          <circle cx="160" cy="80" r="12" fill={emerald} />
          <rect x="57" y="61" width="45" height="38" rx="8" fill={rose} fillOpacity="0.16" stroke={rose} strokeOpacity="0.5" />
          <rect x="218" y="61" width="45" height="38" rx="8" fill={rose} fillOpacity="0.16" stroke={rose} strokeOpacity="0.5" />
          <path d="M 72 80 H 91 M 72 80 L 80 72 M 72 80 L 80 88" stroke={rose} strokeWidth="3" />
          <path d="M 248 80 H 229 M 248 80 L 240 72 M 248 80 L 240 88" stroke={rose} strokeWidth="3" />
        </>
      );
    case 'dodge':
      return (
        <>
          <polygon points="160,109 171,126 160,143 149,126" fill={accent} />
          <line x1="43" y1="42" x2="274" y2="114" stroke={rose} strokeWidth="5" strokeOpacity="0.8" />
          <line x1="65" y1="122" x2="260" y2="55" stroke={rose} strokeWidth="4" strokeOpacity="0.45" />
          <circle cx="105" cy="81" r="7" fill={amber} />
          <circle cx="234" cy="89" r="7" fill={cyan} />
          <path d="M 160 109 L 160 67" stroke={white} strokeWidth="2" strokeDasharray="5 5" strokeOpacity="0.5" />
        </>
      );
    case 'pulse':
      return (
        <>
          <circle cx="160" cy="80" r="18" fill={accent} fillOpacity="0.85" />
          <circle cx="160" cy="80" r="38" fill="none" stroke={accent} strokeWidth="4" strokeOpacity="0.75" />
          <circle cx="160" cy="80" r="61" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.25" />
          <path d="M 61 80 H 94 M 226 80 H 259" stroke={white} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.55" />
        </>
      );
    case 'merge':
      return (
        <>
          {[0, 1, 2, 3].map((col) => (
            <g key={col} transform={`translate(${86 + col * 39} 38)`}>
              {[0, 1, 2].map((row) => (
                <rect key={row} x="0" y={row * 31} width="31" height="25" rx="5" fill={row === 2 - (col % 2) ? accent : rail} fillOpacity={row === 2 - (col % 2) ? 0.82 : 0.48} />
              ))}
            </g>
          ))}
          <text x="101" y="57" fill={white} fontSize="11" textAnchor="middle">2</text>
          <text x="140" y="88" fill={white} fontSize="11" textAnchor="middle">4</text>
          <text x="179" y="57" fill={white} fontSize="11" textAnchor="middle">8</text>
          <text x="218" y="88" fill={white} fontSize="11" textAnchor="middle">16</text>
        </>
      );
    case 'typerush':
      return (
        <>
          {[72, 125, 178, 231].map((x) => <line key={x} x1={x} y1="25" x2={x} y2="139" stroke={rail} strokeWidth="1" />)}
          <rect x="87" y="38" width="57" height="21" rx="6" fill={accent} fillOpacity="0.25" stroke={accent} />
          <text x="115" y="52" fill={white} fontSize="10" textAnchor="middle">NOVA</text>
          <rect x="164" y="72" width="62" height="21" rx="6" fill={violet} fillOpacity="0.2" stroke={violet} />
          <text x="195" y="86" fill={white} fontSize="10" textAnchor="middle">SHIFT</text>
          <rect x="93" y="109" width="70" height="21" rx="6" fill={rose} fillOpacity="0.18" stroke={rose} />
          <text x="128" y="123" fill={white} fontSize="10" textAnchor="middle">DANGER</text>
          <line x1="57" y1="133" x2="263" y2="133" stroke={rose} strokeWidth="2" strokeDasharray="5 4" />
        </>
      );
    case 'oneline':
      return (
        <>
          <circle cx="64" cy="49" r="10" fill={accent} />
          <path d="M 45 119 C 88 97, 102 64, 141 77 S 197 119, 244 91" fill="none" stroke={white} strokeWidth="4" strokeLinecap="round" />
          <circle cx="264" cy="84" r="18" fill="none" stroke={accent} strokeWidth="4" />
          <circle cx="264" cy="84" r="7" fill={accent} fillOpacity="0.4" />
          <polygon points="165,68 170,77 180,78 173,85 175,95 165,90 156,95 158,85 151,78 161,77" fill={amber} />
        </>
      );
    case 'breakout':
      return (
        <>
          {[0, 1, 2, 3].map((row) => [0, 1, 2, 3, 4, 5].map((col) => (
            <rect key={`${row}-${col}`} x={55 + col * 36} y={31 + row * 18} width="30" height="12" rx="2" fill={row % 2 === 0 ? accent : violet} fillOpacity={0.45 + row * 0.1} />
          )))}
          <circle cx="188" cy="105" r="6" fill={white} />
          <line x1="176" y1="101" x2="149" y2="83" stroke={white} strokeOpacity="0.3" />
          <rect x="119" y="132" width="82" height="7" rx="4" fill={accent} />
        </>
      );
    case 'perfectstop':
      return (
        <>
          <rect x="52" y="72" width="216" height="16" rx="8" fill={rail} />
          <rect x="139" y="69" width="43" height="22" rx="7" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="2" />
          <line x1="166" y1="51" x2="166" y2="109" stroke={white} strokeWidth="4" />
          <circle cx="166" cy="80" r="5" fill={white} />
          <text x="160" y="128" fill={accent} fontSize="11" fontWeight="700" textAnchor="middle">PERFECT</text>
        </>
      );
    case 'chain':
      return (
        <>
          <circle cx="77" cy="76" r="10" fill={accent} />
          <circle cx="126" cy="49" r="8" fill={cyan} />
          <circle cx="156" cy="101" r="11" fill={amber} />
          <circle cx="211" cy="64" r="9" fill={violet} />
          <circle cx="249" cy="108" r="8" fill={rose} />
          <path d="M 77 76 L 126 49 L 156 101 L 211 64 L 249 108" fill="none" stroke={white} strokeWidth="2" strokeDasharray="5 5" strokeOpacity="0.7" />
          <circle cx="156" cy="101" r="30" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.4" />
        </>
      );
    case 'gravity':
      return (
        <>
          <circle cx="103" cy="91" r="26" fill={violet} fillOpacity="0.32" stroke={violet} />
          <circle cx="223" cy="62" r="19" fill={accent} fillOpacity="0.28" stroke={accent} />
          <circle cx="263" cy="114" r="8" fill={amber} />
          <path d="M 49 128 C 85 116, 77 70, 120 62 C 173 52, 169 97, 223 90 C 249 87, 255 100, 263 114" fill="none" stroke={white} strokeWidth="2" strokeDasharray="7 5" />
          <polygon points="54,119 66,123 57,132" fill={white} />
        </>
      );
    case 'blade':
      return (
        <>
          <circle cx="94" cy="58" r="15" fill={cyan} fillOpacity="0.5" stroke={cyan} />
          <circle cx="174" cy="95" r="18" fill={accent} fillOpacity="0.45" stroke={accent} />
          <circle cx="246" cy="53" r="13" fill={amber} fillOpacity="0.5" stroke={amber} />
          <line x1="55" y1="122" x2="267" y2="36" stroke={white} strokeWidth="5" strokeLinecap="round" />
          <line x1="61" y1="130" x2="272" y2="44" stroke={accent} strokeWidth="2" strokeOpacity="0.7" />
        </>
      );
    case 'pinball':
      return (
        <>
          <path d="M 104 27 H 216 L 245 132 H 75 Z" fill="#111827" stroke={accent} strokeWidth="2" />
          <circle cx="126" cy="68" r="16" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="3" />
          <circle cx="194" cy="65" r="14" fill={rose} fillOpacity="0.2" stroke={rose} strokeWidth="3" />
          <circle cx="161" cy="98" r="13" fill={amber} fillOpacity="0.2" stroke={amber} strokeWidth="3" />
          <circle cx="203" cy="102" r="5" fill={white} />
          <path d="M 119 122 L 153 133 M 201 122 L 167 133" stroke={white} strokeWidth="7" strokeLinecap="round" />
        </>
      );
    case 'chrono':
      return (
        <>
          {[24, 43, 62].map((r, index) => (
            <polygon key={r} points={`${160},${80-r} ${160+r*0.87},${80-r*0.5} ${160+r*0.87},${80+r*0.5} ${160},${80+r} ${160-r*0.87},${80+r*0.5} ${160-r*0.87},${80-r*0.5}`} fill="none" stroke={accent} strokeWidth={index === 1 ? 4 : 2} strokeOpacity={0.8-index*0.2} />
          ))}
          <rect x="207" y="68" width="36" height="24" fill="#0a0a0b" />
          <circle cx="160" cy="80" r="6" fill={white} />
          <polygon points="220,80 229,74 229,86" fill={amber} />
        </>
      );
    case 'matrix':
      return (
        <>
          {[0, 1, 2].map((row) => [0, 1, 2].map((col) => {
            const lit = (row === 0 && col === 1) || (row === 1 && col === 2) || (row === 2 && col === 0) || (row === 2 && col === 2);
            return <rect key={`${row}-${col}`} x={113 + col * 34} y={31 + row * 34} width="27" height="27" rx="5" fill={lit ? accent : rail} fillOpacity={lit ? 0.9 : 0.45} stroke={lit ? white : rail} strokeOpacity="0.4" />;
          }))}
          <text x="160" y="144" fill={accent} fontSize="10" textAnchor="middle" letterSpacing="2">MEMORIZE</text>
        </>
      );
    case 'drift':
      return (
        <>
          <path d="M 83 151 C 121 111, 105 63, 164 47 C 215 34, 241 62, 246 8" fill="none" stroke={rail} strokeWidth="54" />
          <path d="M 83 151 C 121 111, 105 63, 164 47 C 215 34, 241 62, 246 8" fill="none" stroke={white} strokeWidth="2" strokeDasharray="10 10" strokeOpacity="0.45" />
          <g transform="translate(142 82) rotate(-25)">
            <rect x="-12" y="-20" width="24" height="40" rx="7" fill={accent} />
            <rect x="-7" y="-12" width="14" height="12" rx="3" fill="#0a0a0b" />
          </g>
          <path d="M 123 102 C 108 110, 100 122, 96 134 M 130 107 C 115 116, 109 126, 105 139" fill="none" stroke={rose} strokeWidth="2" strokeOpacity="0.7" />
        </>
      );
    case 'vanguard':
      return (
        <>
          <polygon points="160,124 145,143 160,137 175,143" fill={accent} />
          <polygon points="160,99 145,128 160,120 175,128" fill={white} />
          {[92, 160, 228].map((x, i) => <polygon key={x} points={`${x},${34+i*7} ${x-10},${47+i*7} ${x+10},${47+i*7}`} fill={i === 1 ? rose : violet} />)}
          <line x1="153" y1="95" x2="142" y2="47" stroke={cyan} strokeWidth="2" />
          <line x1="167" y1="95" x2="178" y2="47" stroke={cyan} strokeWidth="2" />
          <circle cx="74" cy="52" r="2" fill={white} /><circle cx="252" cy="82" r="2" fill={white} /><circle cx="205" cy="27" r="2" fill={white} />
        </>
      );
    case 'slingshot':
      return (
        <>
          <circle cx="101" cy="92" r="30" fill={violet} fillOpacity="0.22" stroke={violet} strokeWidth="2" />
          <circle cx="222" cy="66" r="23" fill={accent} fillOpacity="0.22" stroke={accent} strokeWidth="2" />
          <circle cx="114" cy="65" r="6" fill={white} />
          <path d="M 114 65 C 145 35, 182 43, 196 63 C 211 85, 191 111, 162 120" fill="none" stroke={amber} strokeWidth="2" strokeDasharray="7 5" />
          <polygon points="163,120 174,116 169,127" fill={amber} />
        </>
      );
    case 'snake':
      return (
        <>
          {[0, 1, 2, 3, 4, 5, 6].map((index) => <line key={`sv${index}`} x1={74 + index*29} y1="25" x2={74 + index*29} y2="140" stroke={rail} strokeOpacity="0.55" />)}
          {[0, 1, 2, 3, 4].map((index) => <line key={`sh${index}`} x1="74" y1={25 + index*29} x2="248" y2={25 + index*29} stroke={rail} strokeOpacity="0.55" />)}
          <path d="M 88 126 H 146 V 97 H 204 V 68 H 233" fill="none" stroke={accent} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="233" cy="68" r="8" fill={white} />
          <circle cx="219" cy="39" r="8" fill={rose} />
          <rect x="118" y="25" width="8" height="116" fill={rose} fillOpacity="0.25" />
        </>
      );
    case 'rhythm':
      return (
        <>
          {[90, 130, 170, 210, 250].map((x) => <line key={x} x1={x} y1="24" x2={x} y2="138" stroke={rail} />)}
          <line x1="70" y1="122" x2="250" y2="122" stroke={white} strokeWidth="2" />
          <rect x="98" y="45" width="24" height="16" rx="5" fill={accent} />
          <rect x="138" y="72" width="24" height="16" rx="5" fill={violet} />
          <rect x="178" y="54" width="24" height="40" rx="5" fill={cyan} fillOpacity="0.85" />
          <rect x="218" y="94" width="24" height="16" rx="5" fill={rose} />
          <circle cx="110" cy="122" r="5" fill={white} /><circle cx="230" cy="122" r="5" fill={white} />
        </>
      );
    case 'tower':
      return (
        <>
          <rect x="73" y="126" width="86" height="8" rx="4" fill={accent} />
          <rect x="179" y="99" width="70" height="8" rx="4" fill={violet} />
          <rect x="106" y="70" width="67" height="8" rx="4" fill={cyan} />
          <rect x="190" y="42" width="55" height="8" rx="4" fill={rose} />
          <circle cx="139" cy="112" r="10" fill={white} />
          <path d="M 139 102 Q 150 85 143 76" fill="none" stroke={amber} strokeWidth="2" strokeDasharray="4 4" />
        </>
      );
    case 'pacmaze':
      return (
        <>
          <path d="M 61 35 H 259 V 125 H 61 Z M 94 35 V 90 H 132 V 125 M 188 35 V 88 H 226 V 125 M 132 64 H 188" fill="none" stroke={accent} strokeWidth="6" strokeLinejoin="round" />
          {[82, 112, 148, 176, 214, 244].map((x) => <circle key={x} cx={x} cy="106" r="2.5" fill={white} />)}
          <path d="M 112 106 A 13 13 0 1 1 112 80 L 124 93 Z" fill={amber} />
          <path d="M 217 88 Q 228 75 239 88 V 107 L 233 102 L 227 107 L 221 102 L 215 107 Z" fill={rose} />
        </>
      );
    case 'flappyaero':
      return (
        <>
          <rect x="214" y="19" width="18" height="48" rx="3" fill={accent} /><rect x="214" y="103" width="18" height="38" rx="3" fill={accent} />
          <rect x="262" y="18" width="14" height="65" rx="3" fill={violet} /><rect x="262" y="116" width="14" height="25" rx="3" fill={violet} />
          <polygon points="104,79 130,68 124,80 130,92" fill={white} />
          <circle cx="114" cy="80" r="5" fill={accent} />
          <path d="M 72 102 C 106 105, 128 98, 162 88 C 188 81, 204 82, 214 85" fill="none" stroke={amber} strokeWidth="2" strokeDasharray="5 5" />
        </>
      );
    case 'roadcross':
      return (
        <>
          <rect x="48" y="31" width="224" height="98" rx="8" fill="#111827" />
          {[55, 80, 105].map((y) => <line key={y} x1="48" y1={y} x2="272" y2={y} stroke={white} strokeOpacity="0.15" strokeDasharray="11 8" />)}
          <rect x="71" y="43" width="48" height="16" rx="5" fill={rose} /><rect x="181" y="68" width="53" height="16" rx="5" fill={cyan} /><rect x="102" y="93" width="59" height="16" rx="5" fill={violet} />
          <circle cx="225" cy="117" r="9" fill={accent} /><rect x="219" y="108" width="12" height="17" rx="5" fill={accent} />
        </>
      );
    case 'bubblebuster':
      return (
        <>
          {[
            [133, 43, accent], [155, 43, rose], [177, 43, violet], [199, 43, accent],
            [144, 64, cyan], [166, 64, rose], [188, 64, amber], [155, 85, accent], [177, 85, cyan], [199, 85, violet],
          ].map(([cx, cy, fill], index) => <circle key={index} cx={Number(cx)} cy={Number(cy)} r="10" fill={String(fill)} fillOpacity="0.78" stroke={white} strokeOpacity="0.18" />)}
          <circle cx="160" cy="131" r="11" fill={accent} />
          <path d="M 160 120 L 181 87" stroke={white} strokeWidth="2" strokeDasharray="5 4" />
          <path d="M 152 141 H 168" stroke={rail} strokeWidth="7" strokeLinecap="round" />
        </>
      );
    case 'astroblaster':
      return (
        <>
          <polygon points="143,91 170,78 161,106 149,98" fill={white} stroke={accent} strokeWidth="2" />
          <path d="M 145 97 L 127 109" stroke={amber} strokeWidth="4" />
          <polygon points="72,47 84,37 99,43 104,60 92,72 75,65 67,56" fill="none" stroke={muted} strokeWidth="3" />
          <polygon points="233,92 246,80 262,88 265,104 253,117 236,112 227,101" fill="none" stroke={muted} strokeWidth="3" />
          <circle cx="216" cy="44" r="8" fill={rose} fillOpacity="0.6" />
          <line x1="169" y1="79" x2="216" y2="49" stroke={cyan} strokeWidth="2" />
        </>
      );
    case 'laserrope':
      return (
        <>
          <line x1="43" y1="105" x2="277" y2="105" stroke={rail} strokeWidth="3" />
          <circle cx="139" cy="72" r="11" fill={white} />
          <path d="M 139 82 L 139 112 M 139 91 L 121 101 M 139 92 L 155 103 M 139 112 L 124 128 M 139 112 L 154 128" stroke={white} strokeWidth="5" strokeLinecap="round" />
          <line x1="57" y1="116" x2="270" y2="75" stroke={rose} strokeWidth="5" />
          <line x1="57" y1="116" x2="270" y2="75" stroke={white} strokeWidth="1" strokeOpacity="0.65" />
        </>
      );
    case 'blockdrop':
      return (
        <>
          <rect x="116" y="24" width="88" height="116" rx="4" fill="#111827" stroke={rail} strokeWidth="2" />
          {[
            [2, 6, accent], [3, 6, accent], [4, 6, violet], [5, 6, violet], [1, 7, cyan], [2, 7, cyan], [4, 7, rose], [5, 7, rose],
            [0, 8, amber], [1, 8, amber], [2, 8, cyan], [3, 8, emerald], [4, 8, emerald], [5, 8, rose],
          ].map(([x, y, fill], index) => <rect key={index} x={121 + Number(x)*13} y={29 + Number(y)*12} width="11" height="10" rx="1" fill={String(fill)} />)}
          <rect x="147" y="42" width="11" height="10" fill={accent} /><rect x="160" y="42" width="11" height="10" fill={accent} /><rect x="160" y="54" width="11" height="10" fill={accent} /><rect x="173" y="54" width="11" height="10" fill={accent} />
        </>
      );
    case 'knifetarget':
      return (
        <>
          <circle cx="160" cy="80" r="35" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="4" />
          <circle cx="160" cy="80" r="12" fill={amber} fillOpacity="0.8" />
          {[0, 60, 125, 200, 285].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 160 80)`}>
              <rect x="157" y="25" width="6" height="29" rx="3" fill={white} />
              <polygon points="153,54 167,54 160,66" fill={white} />
            </g>
          ))}
          <circle cx="192" cy="62" r="5" fill={amber} stroke={white} strokeWidth="1" />
        </>
      );
    case 'airhockey':
      return (
        <>
          <rect x="62" y="31" width="196" height="98" rx="28" fill="#111827" stroke={accent} strokeWidth="2" />
          <line x1="160" y1="31" x2="160" y2="129" stroke={white} strokeOpacity="0.2" />
          <circle cx="160" cy="80" r="22" fill="none" stroke={white} strokeOpacity="0.18" />
          <circle cx="101" cy="86" r="17" fill={accent} fillOpacity="0.75" stroke={white} strokeOpacity="0.35" />
          <circle cx="220" cy="63" r="17" fill={rose} fillOpacity="0.7" stroke={white} strokeOpacity="0.35" />
          <circle cx="169" cy="83" r="7" fill={white} />
          <path d="M 115 83 Q 145 71 165 81" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="5 4" />
        </>
      );
    case 'neonrail':
      return (
        <>
          {[100, 160, 220].map((x) => <path key={x} d={`M ${x} 20 L ${x} 140`} stroke={rail} strokeWidth="12" strokeLinecap="round" />)}
          <rect x="91" y="43" width="18" height="26" rx="5" fill={rose} /><rect x="211" y="86" width="18" height="26" rx="5" fill={rose} />
          <circle cx="160" cy="56" r="7" fill={amber} /><circle cx="100" cy="104" r="7" fill={amber} />
          <polygon points="160,112 171,127 160,140 149,127" fill={accent} />
          <path d="M 160 112 L 160 76" stroke={accent} strokeWidth="2" strokeDasharray="4 5" />
        </>
      );
    default:
      return (
        <>
          <circle cx="160" cy="80" r="35" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="3" />
          <circle cx="160" cy="80" r="8" fill={white} />
        </>
      );
  }
};

export const GamePreview: React.FC<GamePreviewProps> = ({ game }) => (
  <div
    className="absolute inset-0 overflow-hidden"
    style={{
      background: `radial-gradient(circle at 50% 38%, ${game.accentColor}18, transparent 46%), linear-gradient(180deg, #111113 0%, #09090b 100%)`,
    }}
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 320 160"
      className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.035] group-focus-within:scale-[1.035]"
      preserveAspectRatio="xMidYMid slice"
    >
      <GridBackdrop accent={game.accentColor} />
      {sceneFor(game.id, game.accentColor)}
    </svg>
    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent" />
    <div className="absolute left-2 top-2 rounded border border-white/10 bg-black/45 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/55 backdrop-blur-sm">
      Gameplay preview
    </div>
  </div>
);
