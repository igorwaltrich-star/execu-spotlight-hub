import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck, AlertTriangle, Target, CheckCircle2, CalendarCheck, MessageSquare, Inbox } from "lucide-react";

type Notif = { id: string; tipo: string; titulo: string; mensagem?: string; link?: string; lida: boolean; created_at: string };

const ICONS: Record<string, typeof Bell> = {
  atividade_atribuida: CheckCircle2, meta_atribuida: Target, meta_atingida: Target,
  meta_nao_atingida: AlertTriangle, prazo_proximo: CalendarCheck, atrasado: AlertTriangle,
  revisao_pendente: CalendarCheck, encaminhamento: MessageSquare,
};
const CORES: Record<string, string> = {
  meta_atingida: "text-success", meta_nao_atingida: "text-destructive",
  atrasado: "text-destructive", prazo_proximo: "text-warning",
  revisao_pendente: "text-warning", encaminhamento: "text-primary",
};

const tempoRelativo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString("pt-BR");
};

export function NotificacoesBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notificacoes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("notificacoes").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const naoLidas = notifs.filter(n => !n.lida).length;

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const marcarTodas = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("notificacoes").update({ lida: true })
        .eq("user_id", user.id).eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const abrir = (n: Notif) => {
    if (!n.lida) marcarLida.mutate(n.id);
    if (n.link) navigate({ to: n.link as never });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold grid place-items-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notificações</span>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => marcarTodas.mutate()}>
              <CheckCheck className="h-3 w-3 mr-1" />Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifs.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-7 w-7 mx-auto mb-2 opacity-30" />
              Nenhuma notificação
            </div>
          )}
          {notifs.map(n => {
            const Icon = ICONS[n.tipo] ?? Bell;
            const cor = CORES[n.tipo] ?? "text-muted-foreground";
            return (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className={`w-full text-left flex gap-2.5 px-3 py-2.5 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.lida ? "bg-primary/5" : ""}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cor}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm ${!n.lida ? "font-medium" : ""}`}>{n.titulo}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{tempoRelativo(n.created_at)}</span>
                  </div>
                  {n.mensagem && <p className="text-xs text-muted-foreground truncate">{n.mensagem}</p>}
                </div>
                {!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
