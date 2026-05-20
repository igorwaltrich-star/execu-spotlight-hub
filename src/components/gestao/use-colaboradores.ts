import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";

export type Colaborador = { id: string; nome: string; cargo: string; area: string };

export function useColaboradores() {
  useRealtimeTable("colaboradores", ["colaboradores"]);
  return useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome, cargo, area")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });
}
