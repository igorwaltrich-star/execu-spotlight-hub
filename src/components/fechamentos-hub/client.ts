import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { LinhaColaborador, LinhaOnboarding } from "@/lib/hub-adesao";

type ImportacaoRow = {
  id: string;
  arquivo_nome: string;
  data_referencia: string | null;
  importado_por: string | null;
  created_at: string;
};

type ImportacaoInsert = {
  id?: string;
  arquivo_nome: string;
  data_referencia?: string | null;
  importado_por?: string | null;
  created_at?: string;
};

type SnapshotTable<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

type HubDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      hub_frequencia_importacoes: SnapshotTable<ImportacaoRow, ImportacaoInsert>;
      hub_onboarding_importacoes: SnapshotTable<ImportacaoRow, ImportacaoInsert>;
      hub_frequencia_colaboradores: SnapshotTable<
        LinhaColaborador & { id: string; importacao_id: string },
        LinhaColaborador & { id?: string; importacao_id: string }
      >;
      hub_onboarding_itens: SnapshotTable<
        LinhaOnboarding & { id: string; importacao_id: string },
        LinhaOnboarding & { id?: string; importacao_id: string }
      >;
    };
  };
};

// Describes the checked-in Hub migration until it is applied and generated types include it.
// Reuses the authenticated client; this does not create tables or bypass database policies.
export const hubClient = supabase as unknown as SupabaseClient<HubDatabase>;