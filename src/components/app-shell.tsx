import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Database, Briefcase, BarChart3,
  AlertTriangle, DollarSign, ClipboardCheck, Clock,
  CalendarWeek, CheckSquare, Target, RefreshCw,
  MessageSquare, Users, UserCheck, LogOut, Anchor, FolderKanban, GraduationCap,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { type ReactNode, useState } from "react";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV_OP: NavItem[] = [
  { to: "/",                          label: "Dashboard Operacional",    icon: LayoutDashboard, exact: true },
  { to: "/cadastro",                  label: "Cadastro Operacional",     icon: Database },
  { to: "/produtividade",             label: "Produtividade",            icon: BarChart3 },
  { to: "/nao-conformidades",         label: "Não Conformidades",        icon: AlertTriangle },
  { to: "/custo-operacional",         label: "Custo Operacional",        icon: DollarSign },
  { to: "/banco-horas",               label: "Banco de Horas",           icon: Clock },
  { to: "/checkin-operacional",       label: "Check IN Operacional",     icon: ClipboardCheck },
  { to: "/gerenciamento-operacional", label: "Gerenciamento",            icon: Briefcase },
];

const NAV_DHO: NavItem[] = [
  { to: "/dashboard-gestao",    label: "Dashboard Gestão",    icon: LayoutDashboard },
  { to: "/minha-semana",        label: "Minha Semana",        icon: CalendarWeek },
  { to: "/atividades",          label: "Atividades",          icon: CheckSquare },
  { to: "/metas",               label: "Metas",               icon: Target },
  { to: "/revisao-semanal",     label: "Revisão Semanal",     icon: RefreshCw },
  { to: "/checkin-gerencial",   label: "Check IN Gerencial",  icon: MessageSquare },
  { to: "/equipes",             label: "Equipes",             icon: Users },
  { to: "/funcionarios",        label: "Funcionários",        icon: UserCheck },
  { to: "/projetos",            label: "Projetos",            icon: FolderKanban },
  { to: "/pdi",                 label: "PDI",                 icon: GraduationCap },
];

function NavGroup({ label, items, defaultOpen = true }: { label: string; items: NavItem[]; defaultOpen?: boolean }) {
  const loc = useLocation();
  const [open, setOpen] = useState(defaultOpen);
  const hasActive = items.some(i => i.exact ? loc.pathname === i.to : loc.pathname.startsWith(i.to));

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && items.map(item => {
        const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to as never}
            className={`flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md text-[12px] transition-colors mb-0.5 ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "GP";

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary grid place-items-center shrink-0">
            <Anchor className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[13px] text-sidebar-foreground leading-tight">Grupo Pinho</div>
            <div className="text-[10px] text-sidebar-foreground/45 leading-tight">Sistema de Gestão</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto space-y-1">
          <NavGroup label="Operacional" items={NAV_OP} defaultOpen={true} />
          <div className="mx-3 my-2 border-t border-sidebar-border" />
          <NavGroup label="DHO" items={NAV_DHO} defaultOpen={true} />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1.5">
            <div className="h-7 w-7 rounded-full bg-sidebar-primary grid place-items-center text-[10px] font-semibold text-sidebar-primary-foreground shrink-0">
              {initials}
            </div>
            <span className="text-[11px] text-sidebar-foreground/60 truncate">{user?.email}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-[11px] h-8"
            onClick={async () => { await signOut(); navigate({ to: "/login" as never }); }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
