import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string; what: string; why: string; where: string; who: string;
  when: string | null; how: string; how_much: number;
};

const fmt = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export function CincoWDoisH() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("cinco_w_dois_h", ["cinco_w_dois_h"]);

  const { data: rows = [] } = useQuery({
    queryKey: ["cinco_w_dois_h"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cinco_w_dois_h").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ what: "", why: "", where: "", who: "", when: "", how: "", how_much: 0 });

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !form.what) throw new Error("Preencha o What");
      const { error } = await supabase.from("cinco_w_dois_h").insert({
        user_id: user.id,
        what: form.what, why: form.why, where: form.where, who: form.who,
        when: form.when || null, how: form.how, how_much: Number(form.how_much),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação adicionada");
      qc.invalidateQueries({ queryKey: ["cinco_w_dois_h"] });
      setOpen(false);
      setForm({ what: "", why: "", where: "", who: "", when: "", how: "", how_much: 0 });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cinco_w_dois_h").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cinco_w_dois_h"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>5W2H — Plano de Ação</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova ação</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova ação 5W2H</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>What (o quê)</Label><Input value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} /></div>
              <div><Label>Why (por quê)</Label><Input value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} /></div>
              <div><Label>Where (onde)</Label><Input value={form.where} onChange={(e) => setForm({ ...form, where: e.target.value })} /></div>
              <div><Label>Who (quem)</Label><Input value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} /></div>
              <div><Label>When (quando)</Label><Input type="date" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} /></div>
              <div className="col-span-2"><Label>How (como)</Label><Input value={form.how} onChange={(e) => setForm({ ...form, how: e.target.value })} /></div>
              <div className="col-span-2"><Label>How Much (custo R$)</Label><Input type="number" value={form.how_much} onChange={(e) => setForm({ ...form, how_much: Number(e.target.value) })} /></div>
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">Salvar</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>What</TableHead><TableHead>Why</TableHead><TableHead>Where</TableHead>
            <TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>How</TableHead>
            <TableHead className="text-right">How Much</TableHead><TableHead className="w-12"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem ações cadastradas</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.what}</TableCell>
                <TableCell>{r.why}</TableCell>
                <TableCell>{r.where}</TableCell>
                <TableCell>{fmt(r.when)}</TableCell>
                <TableCell>{r.who}</TableCell>
                <TableCell>{r.how}</TableCell>
                <TableCell className="text-right">R$ {Number(r.how_much).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
