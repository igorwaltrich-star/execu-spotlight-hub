import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, ArrowDown, Target } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string; problema: string;
  por_que_1: string; por_que_2: string; por_que_3: string; por_que_4: string; por_que_5: string;
  causa_raiz: string;
};

export function CincoPorques() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("cinco_porques", ["cinco_porques"]);

  const { data: rows = [] } = useQuery({
    queryKey: ["cinco_porques"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cinco_porques").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [form, setForm] = useState({ problema: "", por_que_1: "", por_que_2: "", por_que_3: "", por_que_4: "", por_que_5: "", causa_raiz: "" });

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.problema) throw new Error("Informe o problema");
      const { error } = await supabase.from("cinco_porques").insert({ user_id: user.id, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Análise salva");
      qc.invalidateQueries({ queryKey: ["cinco_porques"] });
      setForm({ problema: "", por_que_1: "", por_que_2: "", por_que_3: "", por_que_4: "", por_que_5: "", causa_raiz: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cinco_porques").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cinco_porques"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>5 Porquês</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Problema central</Label><Input value={form.problema} onChange={(e) => setForm({ ...form, problema: e.target.value })} /></div>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-start gap-2">
              <ArrowDown className="h-4 w-4 mt-3 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Label>Por quê {n}?</Label>
                <Input
                  value={form[`por_que_${n}` as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [`por_que_${n}`]: e.target.value })}
                />
              </div>
            </div>
          ))}
          <div>
            <Label className="flex items-center gap-1"><Target className="h-4 w-4 text-success" />Causa raiz</Label>
            <Textarea value={form.causa_raiz} onChange={(e) => setForm({ ...form, causa_raiz: e.target.value })} />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar análise</Button>
        </CardContent>
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{r.problema}</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {[1, 2, 3, 4, 5].map((n) => {
              const v = r[`por_que_${n}` as keyof Row] as string;
              return v ? <div key={n}><span className="text-primary font-medium">{n}. </span>{v}</div> : null;
            })}
            {r.causa_raiz && <div className="mt-2 p-2 rounded-md bg-success/10 text-success-foreground"><span className="font-medium">Causa raiz: </span>{r.causa_raiz}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
