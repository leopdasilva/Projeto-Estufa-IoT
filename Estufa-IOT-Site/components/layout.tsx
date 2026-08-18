import { Link, useLocation } from "wouter";
import { Leaf, LayoutDashboard, History, AlertTriangle } from "lucide-react";
import { cn } from "../src/lib/utils";
import { useMqttStatus } from "../src/lib/api-client";

const navItems = [
  { href: "/",          label: "Painel Principal", icon: LayoutDashboard },
  { href: "/historico", label: "Histórico",          icon: History },
  { href: "/alertas",   label: "Alertas",            icon: AlertTriangle },
];

const statusLabel: Record<string, { text: string; color: string; pulse: boolean }> = {
  connected:    { text: "SISTEMA ONLINE",     color: "bg-success",   pulse: true  },
  connecting:   { text: "CONECTANDO...",       color: "bg-amber-500", pulse: true  },
  reconnecting: { text: "RECONECTANDO...",     color: "bg-amber-500", pulse: true  },
  disconnected: { text: "SISTEMA OFFLINE",     color: "bg-destructive", pulse: false },
  error:        { text: "ERRO DE CONEXÃO",     color: "bg-destructive", pulse: false },
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const mqttStatus  = useMqttStatus();
  const status      = statusLabel[mqttStatus] ?? statusLabel.disconnected;

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Barra lateral (desktop) */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex-col justify-between hidden md:flex shrink-0 shadow-xl z-10">
        <div>
          <div className="p-6 flex items-center gap-3 text-sidebar-primary">
            <Leaf className="w-8 h-8 drop-shadow-sm" />
            <h1 className="font-serif font-black text-2xl tracking-tight">Estufa IoT</h1>
          </div>
          <nav className="px-4 py-2 flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md scale-[1.02]"
                      : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Indicador de status MQTT (dinâmico) */}
        <div className="p-6">
          <div className="bg-background rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner border border-sidebar-border">
            <div
              className={cn(
                "w-3 h-3 rounded-full mb-2 shadow-[0_0_8px_hsl(var(--success))]",
                status.color,
                status.pulse && "animate-pulse"
              )}
            />
            <span className="text-xs font-mono font-bold text-foreground/70 tracking-widest">
              {status.text}
            </span>
            <span className="text-[10px] font-mono text-foreground/40 mt-1 tracking-wider">
              MQTT · HiveMQ
            </span>
          </div>
        </div>
      </aside>

      {/* Menu inferior (celular) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-sidebar flex justify-around p-2 z-50 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] pb-safe">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg text-xs font-bold transition-colors",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
              )}
            >
              <Icon className="w-6 h-6 mb-1" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 h-full overflow-y-auto relative pb-20 md:pb-0">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}