interface EagleIconProps {
  className?: string;
  size?: number;
}

export function EagleIcon({ className = "", size = 120 }: EagleIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="eagleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5c97a" />
          <stop offset="100%" stopColor="#d4a84b" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <g filter="url(#glow)">
        <path
          d="M50 15 C35 15 25 25 20 35 C15 45 18 55 25 60 L35 55 C30 50 28 42 32 35 C36 28 45 22 50 22 C55 22 64 28 68 35 C72 42 70 50 65 55 L75 60 C82 55 85 45 80 35 C75 25 65 15 50 15Z"
          fill="url(#eagleGradient)"
        />
        
        <path
          d="M50 22 L50 35 M45 28 L55 28"
          stroke="url(#eagleGradient)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        <path
          d="M25 60 C20 65 15 75 25 85 L35 78 C28 73 26 67 30 63 L25 60Z"
          fill="url(#eagleGradient)"
        />
        <path
          d="M75 60 C80 65 85 75 75 85 L65 78 C72 73 74 67 70 63 L75 60Z"
          fill="url(#eagleGradient)"
        />
        
        <circle cx="42" cy="42" r="5" fill="#0f1117" stroke="url(#eagleGradient)" strokeWidth="1.5" className="eagle-eye" />
        <circle cx="58" cy="42" r="5" fill="#0f1117" stroke="url(#eagleGradient)" strokeWidth="1.5" className="eagle-eye" />
        <circle cx="42" cy="42" r="2" fill="#f5c97a" className="eagle-eye" />
        <circle cx="58" cy="42" r="2" fill="#f5c97a" className="eagle-eye" />
        
        <path
          d="M50 48 L47 58 L50 55 L53 58 L50 48Z"
          fill="url(#eagleGradient)"
        />
      </g>
    </svg>
  );
}

export function EagleBackground({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={`absolute opacity-5 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bgEagleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5c97a" />
          <stop offset="100%" stopColor="#3dd2ff" />
        </linearGradient>
      </defs>
      
      <path
        d="M200 40 C120 40 60 100 30 160 C0 220 20 300 80 340 L140 300 C100 260 80 200 100 150 C120 100 170 60 200 60 C230 60 280 100 300 150 C320 200 300 260 260 300 L320 340 C380 300 400 220 370 160 C340 100 280 40 200 40Z"
        stroke="url(#bgEagleGradient)"
        strokeWidth="2"
        fill="none"
      />
      
      <path
        d="M80 340 C40 380 20 440 80 500 L140 460 C80 420 60 370 100 340Z"
        stroke="url(#bgEagleGradient)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M320 340 C360 380 380 440 320 500 L260 460 C320 420 340 370 300 340Z"
        stroke="url(#bgEagleGradient)"
        strokeWidth="2"
        fill="none"
      />
      
      <circle cx="160" cy="160" r="20" stroke="url(#bgEagleGradient)" strokeWidth="2" fill="none" />
      <circle cx="240" cy="160" r="20" stroke="url(#bgEagleGradient)" strokeWidth="2" fill="none" />
      
      <path
        d="M200 190 L180 240 L200 220 L220 240 L200 190Z"
        stroke="url(#bgEagleGradient)"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}
