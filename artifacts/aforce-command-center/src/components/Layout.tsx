import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { 
  Activity, 
  BarChart2, 
  Box, 
  Cpu, 
  Filter,
  Mic,
  ShieldCheck, 
  Users,
  LogOut,
  ChevronRight
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  basePath: string;
}

export function Layout({ children, basePath }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const navItems = [
    { label: "Executive", href: "/executive", icon: Activity },
    { label: "Product", href: "/product", icon: Box },
    { label: "Activation", href: "/activation", icon: Filter },
    { label: "Voice Check-In", href: "/voice-checkin", icon: Mic },
    { label: "AI", href: "/ai", icon: Cpu },
    { label: "Marketing", href: "/marketing", icon: BarChart2 },
    { label: "Board", href: "/board", icon: Users },
    { label: "Guardian", href: "/guardian", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-sidebar/50 backdrop-blur-md flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <img src={`${window.location.origin}${basePath}/logo.svg`} alt="AForce" className="w-8 h-8" />
          <span className="font-bold tracking-widest uppercase text-sm">Command Center</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group ${
                  isActive 
                    ? "bg-white/10 text-foreground" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                {user.hasImage ? (
                  <img src={user.imageUrl} alt={user.fullName || "User"} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {user.firstName?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.fullName || "Founder"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-y-auto">
        <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
