import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Papel = "gestor" | "coordenador" | "supervisor" | "analista";

export type Perfil = {
  id: string;
  nome: string;
  cargo: string | null;
  role: Papel;
  ativo: boolean;
};

/** Hierarquia: quanto maior, mais permissões. */
const NIVEL: Record<Papel, number> = {
  analista: 1,
  supervisor: 2,
  coordenador: 3,
  gestor: 4,
};

export function usePerfil() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["meu_perfil", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,cargo,role,ativo")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Perfil | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const papel: Papel = query.data?.role ?? "analista";

  return {
    perfil: query.data ?? null,
    papel,
    carregando: query.isLoading,
    /** true se o papel do usuário for igual ou superior ao mínimo exigido */
    peloMenos: (minimo: Papel) => NIVEL[papel] >= NIVEL[minimo],
    /** true se o papel estiver na lista */
    eUmDe: (papeis: Papel[]) => papeis.includes(papel),
    eGestor: papel === "gestor",
    eLideranca: NIVEL[papel] >= NIVEL.supervisor,
  };
}
