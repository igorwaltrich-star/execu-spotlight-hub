import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";

export type OpMensal = {
  mes: string;
  unidade: string;
  volume: number;
  pessoas: number;
  produtividade: number | null;
};

export type CustoMes = { mes_referencia: string; operacao: string; total: number | null };

export type NC = {
  id: string;
  data_ocorrencia: string;
  operacao: string;
  tipo: string;
  custo_gerado: number;
  valor_recuperado: number | null;
  colaborador_id: string | null;
};

export type RegProd = {
  id: string;
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  fte: number | null;
  produtividade: number | null;
};

/** Normaliza qualquer data (ISO ou date) para "YYYY-MM" */
export const mesKey = (d: string) => String(d).slice(0, 7);

export function useOperacionalMensal() {
  useRealtimeTable("operacional_mensal", ["op_mensal_paineis"]);
  return useQuery({
    queryKey: ["op_mensal_paineis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacional_mensal")
        .select("mes, unidade, volume, pessoas, produtividade")
        .order("mes");
      if (error) throw error;
      return (data ?? []) as OpMensal[];
    },
  });
}

export function useCustoPessoal() {
  return useQuery({
    queryKey: ["custo_pessoal_paineis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custo_pessoal_mensal")
        .select("mes_referencia, operacao, total");
      if (error) throw error;
      return (data ?? []) as CustoMes[];
    },
  });
}

export function useNaoConformidades() {
  return useQuery({
    queryKey: ["ncs_paineis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("id, data_ocorrencia, operacao, tipo, custo_gerado, valor_recuperado, colaborador_id");
      if (error) throw error;
      return (data ?? []) as NC[];
    },
  });
}

export function useRegistrosProdutividade() {
  return useQuery({
    queryKey: ["reg_prod_paineis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_produtividade")
        .select("id, colaborador_id, operacao, mes, volume_processos, fte, produtividade")
        .order("mes");
      if (error) throw error;
      return (data ?? []) as RegProd[];
    },
  });
}

export function useNavySealTags() {
  useRealtimeTable("navy_seal", ["navy_seal_tags"]);
  return useQuery({
    queryKey: ["navy_seal_tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("navy_seal").select("colaborador_id, tag, observacoes");
      if (error) throw error;
      return (data ?? []) as { colaborador_id: string; tag: string; observacoes: string }[];
    },
  });
}

export const NAVY_LABEL: Record<string, string> = {
  a_player: "A-Player",
  b_player: "B-Player",
  c_player: "C-Player",
};

export const NAVY_CLASS: Record<string, string> = {
  a_player: "bg-success text-success-foreground",
  b_player: "bg-secondary text-secondary-foreground",
  c_player: "bg-destructive text-destructive-foreground",
};

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const num = (n: number, d = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
