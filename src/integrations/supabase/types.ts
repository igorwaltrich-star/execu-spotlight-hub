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
      analises_performance: {
        Row: {
          arquivos: Json
          created_at: string
          id: string
          oportunidades: Json
          pontos_criticos: Json
          resumo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivos?: Json
          created_at?: string
          id?: string
          oportunidades?: Json
          pontos_criticos?: Json
          resumo?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivos?: Json
          created_at?: string
          id?: string
          oportunidades?: Json
          pontos_criticos?: Json
          resumo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cinco_porques: {
        Row: {
          causa_raiz: string
          created_at: string
          id: string
          por_que_1: string
          por_que_2: string
          por_que_3: string
          por_que_4: string
          por_que_5: string
          problema: string
          updated_at: string
          user_id: string
        }
        Insert: {
          causa_raiz?: string
          created_at?: string
          id?: string
          por_que_1?: string
          por_que_2?: string
          por_que_3?: string
          por_que_4?: string
          por_que_5?: string
          problema?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          causa_raiz?: string
          created_at?: string
          id?: string
          por_que_1?: string
          por_que_2?: string
          por_que_3?: string
          por_que_4?: string
          por_que_5?: string
          problema?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cinco_w_dois_h: {
        Row: {
          created_at: string
          how: string
          how_much: number
          id: string
          updated_at: string
          user_id: string
          what: string
          when: string | null
          where: string
          who: string
          why: string
        }
        Insert: {
          created_at?: string
          how?: string
          how_much?: number
          id?: string
          updated_at?: string
          user_id: string
          what?: string
          when?: string | null
          where?: string
          who?: string
          why?: string
        }
        Update: {
          created_at?: string
          how?: string
          how_much?: number
          id?: string
          updated_at?: string
          user_id?: string
          what?: string
          when?: string | null
          where?: string
          who?: string
          why?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          area: string
          cargo: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          cargo?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          cargo?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      controle_ferias: {
        Row: {
          colaborador_id: string
          created_at: string
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          previsao_saida: string | null
          retorno: string | null
          saldo_dias: number
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          previsao_saida?: string | null
          retorno?: string | null
          saldo_dias?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          previsao_saida?: string | null
          retorno?: string | null
          saldo_dias?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      escala_home_office: {
        Row: {
          colaborador_id: string
          created_at: string
          dias_semana: string[]
          id: string
          status: Database["public"]["Enums"]["home_office_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          dias_semana?: string[]
          id?: string
          status?: Database["public"]["Enums"]["home_office_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          dias_semana?: string[]
          id?: string
          status?: Database["public"]["Enums"]["home_office_status"]
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
      indicadores_performance: {
        Row: {
          colaborador_id: string
          comportamental: number | null
          created_at: string
          id: string
          meta_individual: number | null
          nota_zmm: number | null
          observacoes: string | null
          ppax: number | null
          referencia: string
          sla_otd: number | null
          sla_po: number | null
          sla_pre_alert: number | null
          sla_sotd: number | null
          uep: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id: string
          comportamental?: number | null
          created_at?: string
          id?: string
          meta_individual?: number | null
          nota_zmm?: number | null
          observacoes?: string | null
          ppax?: number | null
          referencia: string
          sla_otd?: number | null
          sla_po?: number | null
          sla_pre_alert?: number | null
          sla_sotd?: number | null
          uep?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string
          comportamental?: number | null
          created_at?: string
          id?: string
          meta_individual?: number | null
          nota_zmm?: number | null
          observacoes?: string | null
          ppax?: number | null
          referencia?: string
          sla_otd?: number | null
          sla_po?: number | null
          sla_pre_alert?: number | null
          sla_sotd?: number | null
          uep?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ishikawa: {
        Row: {
          created_at: string
          efeito: string
          id: string
          mao_obra: string[]
          maquina: string[]
          materiais: string[]
          medida: string[]
          meio_ambiente: string[]
          metodo: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          efeito?: string
          id?: string
          mao_obra?: string[]
          maquina?: string[]
          materiais?: string[]
          medida?: string[]
          meio_ambiente?: string[]
          metodo?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          efeito?: string
          id?: string
          mao_obra?: string[]
          maquina?: string[]
          materiais?: string[]
          medida?: string[]
          meio_ambiente?: string[]
          metodo?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matriz_lideranca: {
        Row: {
          colaborador_id: string
          created_at: string
          id: string
          observacoes: string
          tag: Database["public"]["Enums"]["matriz_lideranca_tag"]
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          id?: string
          observacoes?: string
          tag?: Database["public"]["Enums"]["matriz_lideranca_tag"]
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          id?: string
          observacoes?: string
          tag?: Database["public"]["Enums"]["matriz_lideranca_tag"]
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
      navy_seal: {
        Row: {
          colaborador_id: string
          created_at: string
          id: string
          observacoes: string
          tag: Database["public"]["Enums"]["navy_seal_tag"]
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          id?: string
          observacoes?: string
          tag?: Database["public"]["Enums"]["navy_seal_tag"]
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          id?: string
          observacoes?: string
          tag?: Database["public"]["Enums"]["navy_seal_tag"]
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
          custo_extra: number
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
          custo_extra?: number
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
          custo_extra?: number
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
      pareto: {
        Row: {
          causa: string
          created_at: string
          frequencia: number
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          causa: string
          created_at?: string
          frequencia?: number
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          causa?: string
          created_at?: string
          frequencia?: number
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdi: {
        Row: {
          colaborador_id: string
          created_at: string
          id: string
          meta: string
          prazo: string | null
          status: Database["public"]["Enums"]["pdi_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          id?: string
          meta: string
          prazo?: string | null
          status?: Database["public"]["Enums"]["pdi_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          id?: string
          meta?: string
          prazo?: string | null
          status?: Database["public"]["Enums"]["pdi_status"]
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
          meta: string | null
          objetivo: string | null
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
          meta?: string | null
          objetivo?: string | null
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
          meta?: string | null
          objetivo?: string | null
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
      swot: {
        Row: {
          ameacas: string[]
          created_at: string
          forcas: string[]
          fraquezas: string[]
          id: string
          oportunidades: string[]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ameacas?: string[]
          created_at?: string
          forcas?: string[]
          fraquezas?: string[]
          id?: string
          oportunidades?: string[]
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ameacas?: string[]
          created_at?: string
          forcas?: string[]
          fraquezas?: string[]
          id?: string
          oportunidades?: string[]
          titulo?: string
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
      home_office_status: "ativo" | "pausado"
      matriz_lideranca_tag:
        | "alta_performance"
        | "zona_desenvolvimento"
        | "zona_risco"
        | "zona_desalinhamento"
      melhoria_tipo: "atencao" | "oportunidade"
      navy_seal_tag: "a_player" | "b_player" | "c_player"
      pdi_status: "nao_iniciado" | "em_andamento" | "concluido" | "atrasado"
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
      home_office_status: ["ativo", "pausado"],
      matriz_lideranca_tag: [
        "alta_performance",
        "zona_desenvolvimento",
        "zona_risco",
        "zona_desalinhamento",
      ],
      melhoria_tipo: ["atencao", "oportunidade"],
      navy_seal_tag: ["a_player", "b_player", "c_player"],
      pdi_status: ["nao_iniciado", "em_andamento", "concluido", "atrasado"],
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
