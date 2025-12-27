import { Plus } from "lucide-react";

interface SubdomainHeaderProps {
  currentSubdomainCount: number;
  subdomainLimit: number;
  isUnlimited: boolean;
  isAtLimit: boolean;
  onAddClick: () => void;
}

export function SubdomainHeader({
  currentSubdomainCount,
  subdomainLimit,
  isUnlimited,
  isAtLimit,
  onAddClick,
}: SubdomainHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-white">Subdomains</h1>
        <p className="text-gray-400 mt-1">
          Reserve subdomains for your tunnels · {currentSubdomainCount} /{" "}
          {isUnlimited ? "∞" : subdomainLimit} subdomains
        </p>
      </div>
      <button
        onClick={onAddClick}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-white/5 ${
          isAtLimit
            ? "bg-white/10 text-gray-400 cursor-not-allowed"
            : "bg-white hover:bg-gray-200 text-black"
        }`}
      >
        <Plus size={18} />
        Reserve Subdomain
      </button>
    </div>
  );
}
