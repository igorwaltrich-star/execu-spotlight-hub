export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      config: {
        Row: {
          created_at: string
          fator_sazonalidade: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fator_sazonalidade?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fator_sazonalidade?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gargalos: {
        Row: {
          created_at: string
          id: string
          impacto: string
          item: string
          risco: Database["public"]["Enums"]["risco_nivel"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impacto?: string
          item: string
          risco?: Database["public"]["Enums"]["risco_nivel"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impacto?: string
          item?: string
          risco?: Database["public"]["Enums"]["risco_nivel"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      melhorias: {
        Row: {
          created_at: string
          descricao: string
          id: string
          tipo: Database["public"]["Enums"]["melhoria_tipo"]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          id?: string
          tipo?: Database["public"]["Enums"]["melhoria_tipo"]
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          tipo?: Database["public"]["Enums"]["melhoria_tipo"]
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operacional_mensal: {
        Row: {
          created_at: string
          id: string
          mes: string
          pessoas: number
          produtividade: number | null
          unidade: Database["public"]["Enums"]["unidade_carteira"]
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes: string
          pessoas?: number
          produtividade?: number | null
          unidade?: Database["public"]["Enums"]["unidade_carteira"]
          updated_at?: string
          user_id: string
          volume?: number
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          pessoas?: number
          produtividade?: number | null
          unidade?: Database["public"]["Enums"]["unidade_carteira"]
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          savings: number
          status: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          savings?: number
          status?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          savings?: number
          status?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plano_acao: {
        Row: {
          created_at: string
          id: string
          iniciativa: string
          prazo: string | null
          responsavel: string
          status: Database["public"]["Enums"]["acao_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          iniciativa: string
          prazo?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["acao_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          iniciativa?: string
          prazo?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["acao_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sla_bosch: {
        Row: {
          created_at: string
          desvios: number
          dig_conf: number
          id: string
          mes: string
          otcc: number
          pinho: number
          start_up: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desvios?: number
          dig_conf?: number
          id?: string
          mes: string
          otcc?: number
          pinho?: number
          start_up?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desvios?: number
          dig_conf?: number
          id?: string
          mes?: string
          otcc?: number
          pinho?: number
          start_up?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sla_midea: {
        Row: {
          created_at: string
          id: string
          mes: string
          otcc: number
          otd: number
          sotd: number
          start_up: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes: string
          otcc?: number
          otd?: number
          sotd?: number
          start_up?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          otcc?: number
          otd?: number
          sotd?: number
          start_up?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      acao_status: "andamento" | "concluido" | "atrasado"
      melhoria_tipo: "atencao" | "oportunidade"
      risco_nivel: "alto" | "medio" | "baixo"
      unidade_carteira:
        | "midea_sc"
        | "midea_am"
        | "midea_rs"
        | "midea_mg"
        | "bosch"
        | "bosch_hc"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acao_status: ["andamento", "concluido", "atrasado"],
      melhoria_tipo: ["atencao", "oportunidade"],
      risco_nivel: ["alto", "medio", "baixo"],
      unidade_carteira: [
        "midea_sc",
        "midea_am",
        "midea_rs",
        "midea_mg",
        "bosch",
        "bosch_hc",
      ],
    },
  },
} as const
