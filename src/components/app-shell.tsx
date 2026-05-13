import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Database, Gauge, AlertTriangle, Lightbulb, ListChecks, LogOut, Activity, DollarSign,
} from "lucide-react";
import type { ReactNode } from "react";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/cadastro", label: "Cadastro Operacional", icon: Database },
  { to: "/cadastro-oportunidades", label: "Oportunidades e Riscos", icon: DollarSign },
  { to: "/sla-midea", label: "SLA Midea", icon: Gauge },
  { to: "/sla-bosch", label: "SLA BOSCH", icon: Gauge },
  { to: "/diagnostico", label: "Diagnóstico", icon: AlertTriangle },
  { to: "/melhorias", label: "Melhorias", icon: Lightbulb },
  { to: "/plano-acao", label: "Plano de Ação", icon: ListChecks },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-sidebar-primary grid place-items-center">
            <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Performance</div>
            <div className="text-xs opacity-70">Operacional & Estratégico</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs opacity-70 px-2 pb-2 truncate">{user?.email}</div>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={async () => { await signOut(); navigate({ to: "/login" as never }); }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
