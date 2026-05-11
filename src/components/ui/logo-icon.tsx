export const LogoIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <title>TimeTool Logo</title>
        <path
            d="M21 3 A 18 18 0 0 1 21 39"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
        />
        <path
            d="M21 39 A 18 18 0 0 1 21 3"
            stroke="hsl(var(--accent))"
            strokeWidth="4"
        />
        <path d="M21 7V9" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
        <path d="M35 21H33" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
        <path d="M21 35V33" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round" />
        <path d="M7 21H9" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M21 23H29V21H23V13H21V23Z" fill="hsl(var(--accent))" />
    </svg>
);
