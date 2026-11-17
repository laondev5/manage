import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

const INK = '#101D35';
const COBALT = '#2457D6';
const SOFT = '#E9EFFD';
const BORDER = '#C9D8FA';
const LINE = '#E3E8F1';
const WHITE = '#FFFFFF';
const AMBER = '#B54708';
const AMBER_SOFT = '#FEF0C7';
const AMBER_BORDER = '#F7D28A';

function Frame({ children, width }: { children: ReactNode; width: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 320 240" accessibilityRole="image">
      {children}
    </Svg>
  );
}

export function IllustrationSite({ width }: { width: number }) {
  return (
    <Frame width={width}>
      <Circle cx={160} cy={124} r={104} fill={SOFT} />
      <Circle cx={160} cy={124} r={88} fill="none" stroke={COBALT} strokeOpacity={0.32} strokeDasharray="4 7" />
      <Rect x={104} y={76} width={112} height={112} rx={12} fill={INK} />
      {[120, 147, 174].map((x) =>
        [94, 120].map((y) => <Rect key={`${x}-${y}`} x={x} y={y} width={18} height={14} rx={3} fill={BORDER} />),
      )}
      <Rect x={148} y={152} width={24} height={36} rx={6} fill={WHITE} />
      <Path
        d="M240 72c-12.2 0-22 9.6-22 21.5 0 16.1 22 34.5 22 34.5s22-18.4 22-34.5C262 81.6 252.2 72 240 72Z"
        fill={WHITE}
        stroke={COBALT}
        strokeWidth={2.5}
      />
      <Circle cx={240} cy={94} r={7} fill={COBALT} />
      <G>
        <Circle cx={70} cy={150} r={12} fill={WHITE} stroke={BORDER} strokeWidth={2} />
        <Circle cx={70} cy={150} r={4} fill={INK} />
        <Circle cx={92} cy={200} r={12} fill={WHITE} stroke={BORDER} strokeWidth={2} />
        <Circle cx={92} cy={200} r={4} fill={INK} />
      </G>
      <Circle cx={246} cy={176} r={17} fill={COBALT} />
      <Path d="m238.5 176.5 5 5 9.5-10" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function IllustrationClock({ width }: { width: number }) {
  return (
    <Frame width={width}>
      <Circle cx={160} cy={122} r={104} fill={SOFT} />
      <Circle cx={160} cy={132} r={80} fill="none" stroke={COBALT} strokeOpacity={0.4} strokeDasharray="4 7" />
      <Rect x={116} y={36} width={88} height={168} rx={17} fill={WHITE} stroke={INK} strokeWidth={3} />
      <Rect x={124} y={52} width={72} height={132} rx={9} fill="#F5F7FB" />
      <Rect x={146} y={43} width={28} height={4} rx={2} fill={BORDER} />
      <Path d="M128 96h64M164 56v124" stroke={LINE} strokeWidth={7} strokeLinecap="round" />
      <Circle cx={160} cy={116} r={32} fill={SOFT} stroke={COBALT} strokeOpacity={0.55} strokeDasharray="3 5" />
      <Path
        d="M160 96c-7.7 0-14 6.2-14 13.9 0 10.4 14 22.1 14 22.1s14-11.7 14-22.1C174 102.2 167.7 96 160 96Z"
        fill={WHITE}
        stroke={COBALT}
        strokeWidth={2.5}
      />
      <Circle cx={160} cy={110} r={4.5} fill={COBALT} />
      <Rect x={132} y={158} width={56} height={17} rx={8.5} fill={COBALT} />
      <Circle cx={222} cy={64} r={19} fill={WHITE} stroke={BORDER} strokeWidth={2} />
      <Path d="m213.5 64 5.5 5.5 10.5-11" fill="none" stroke={COBALT} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M76 74c-6.1 0-11 4.9-11 11 0 8 11 17.5 11 17.5s11-9.5 11-17.5c0-6.1-4.9-11-11-11Z" fill={COBALT} />
      <Circle cx={76} cy={85} r={3.6} fill={WHITE} />
      <Path d="M84 154a18 18 0 0 1 0 24M92 148a28 28 0 0 1 0 36" fill="none" stroke={COBALT} strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />
    </Frame>
  );
}

export function IllustrationAlert({ width }: { width: number }) {
  return (
    <Frame width={width}>
      <Circle cx={152} cy={118} r={102} fill={SOFT} />
      <Path d="M152 66v6" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={152} cy={60} r={6} fill={INK} />
      <Path
        d="M152 72a38 38 0 0 0-38 38v20l-12 18h100l-12-18v-20a38 38 0 0 0-38-38Z"
        fill={WHITE}
        stroke={COBALT}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Circle cx={152} cy={148} r={8} fill={INK} />
      <Path d="M198 92a42 42 0 0 1 0 56" fill="none" stroke={COBALT} strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" />
      <Path d="M210 80a58 58 0 0 1 0 80" fill="none" stroke={COBALT} strokeOpacity={0.18} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={224} cy={72} r={12} fill={AMBER_SOFT} stroke={AMBER_BORDER} strokeWidth={2} />
      <Circle cx={224} cy={72} r={4} fill={AMBER} />
      <Rect x={168} y={166} width={128} height={58} rx={12} fill={WHITE} stroke={LINE} strokeWidth={2} />
      <Rect x={168} y={166} width={7} height={58} rx={3.5} fill={AMBER} />
      <Rect x={188} y={182} width={84} height={7} rx={3.5} fill={BORDER} />
      <Rect x={188} y={198} width={58} height={6} rx={3} fill={LINE} />
      <Circle cx={188} cy={212} r={6} fill={AMBER_SOFT} stroke={AMBER_BORDER} strokeWidth={1.5} />
      <Path d="M186 212h4" stroke={AMBER} strokeWidth={2} strokeLinecap="round" />
    </Frame>
  );
}

export function IllustrationEvidence({ width }: { width: number }) {
  return (
    <Frame width={width}>
      <Circle cx={166} cy={118} r={102} fill={SOFT} />
      <G transform="rotate(-7 132 128)">
        <Rect x={72} y={58} width={112} height={140} rx={12} fill={WHITE} stroke={LINE} strokeWidth={2} />
      </G>
      <Rect x={104} y={62} width={112} height={140} rx={12} fill={WHITE} stroke={BORDER} strokeWidth={2} />
      <Rect x={120} y={82} width={54} height={7} rx={3.5} fill={INK} />
      <Rect x={120} y={100} width={72} height={6} rx={3} fill={LINE} />
      <Rect x={120} y={116} width={58} height={6} rx={3} fill={LINE} />
      <Rect x={120} y={132} width={66} height={6} rx={3} fill={LINE} />
      <Circle cx={127} cy={162} r={9} fill={SOFT} />
      <Path d="m123 162 3 3 6-6.5" fill="none" stroke={COBALT} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={142} y={158} width={48} height={7} rx={3.5} fill={BORDER} />
      <Path
        d="M208 132 242 144v26c0 22-16 36-34 44-18-8-34-22-34-44v-26Z"
        fill={COBALT}
        stroke={WHITE}
        strokeWidth={3}
      />
      <Path d="m195 172 9 9 17-19" fill="none" stroke={WHITE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={64} y={186} width={29} height={23} rx={5} fill={INK} />
      <Path d="M70 186v-6a8.5 8.5 0 0 1 17 0v6" fill="none" stroke={INK} strokeWidth={4} />
      <Circle cx={78.5} cy={196} r={2.8} fill={WHITE} />
      <Circle cx={74} cy={68} r={4} fill={COBALT} opacity={0.35} />
      <Circle cx={262} cy={196} r={6} fill={COBALT} opacity={0.22} />
    </Frame>
  );
}
