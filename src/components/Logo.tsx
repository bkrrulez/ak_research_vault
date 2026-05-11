import { ShieldCheck } from "lucide-react";

export const Logo = ({ size = "md", showText = true }: { size?: "sm" | "md" | "lg", showText?: boolean }) => {
  const iconSizes = {
    sm: 18,
    md: 32,
    lg: 40
  };
  
  const containerSizes = {
    sm: "w-8 h-8",
    md: "w-14 h-14",
    lg: "w-20 h-20"
  };

  const textSizes = {
    sm: "text-base",
    md: "text-2xl",
    lg: "text-5xl"
  };

  return (
    <div className={`flex items-center gap-3 ${size === 'lg' ? 'flex-col gap-6' : ''}`}>
      <div className={`${containerSizes[size]} bg-[#3b4b7a] rounded-full flex items-center justify-center text-white shadow-lg`}>
        <ShieldCheck size={iconSizes[size]} />
      </div>
      {showText && (
        <h1 className={`${textSizes[size]} font-bold tracking-tight text-[#0f172a]`}>
          AK Research Vault
        </h1>
      )}
    </div>
  );
};
