import { Button } from "@/components/ui/button";
import { FiUser } from "react-icons/fi";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import favicon from "../../favroomie.png";

export function Header() {
  const { user } = useAuth();

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-[#0f0f1f] p-3 ">
      <div className="flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3">
          <img src={favicon} alt="Roomie Logo" className="h-12" />
          <h1 className="text-3xl font-bold text-white">Roomie</h1>
        </Link>

        <Link href="/profile">
          <div className="relative group cursor-pointer">
            <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 ring-2 ring-white/30 group-hover:ring-white/50 transition-all shadow-xl">
              {user?.profilePicture ? (
                <img 
                  src={user.profilePicture} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = user?.name?.charAt(0).toUpperCase() || 'P';
                  }}
                />
              ) : (
                <span className="text-xl font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'P'}
                </span>
              )}
            </div>
            <div className="absolute top-0 left-0 w-full h-full bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </Link>
      </div>
    </div>
  );
}
