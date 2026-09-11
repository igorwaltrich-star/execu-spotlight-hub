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
      alocacoes_periodo: {
        Row: {
          colaborador_id: string
          created_at: string
          created_by: string | null
          dias_na_operacao: number
          dias_uteis_mes: number
          fte: number | null
          id: string
          mes: string
          motivo: string | null
          operacao: string
          tipo: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          dias_na_operacao?: number
          dias_uteis_mes?: number
          fte?: number | null
          id?: string
          mes: string
          motivo?: string | null
          operacao: string
          tipo?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          dias_na_operacao?: number
          dias_uteis_mes?: number
          fte?: number | null
          id?: string
          mes?: string
          motivo?: string | null
          operacao?: string
          tipo?: string
        }
        Relationships: []
      }
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
      atividades: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          due_date: string | null
          equipe_id: string | null
          id: string
          observacoes: string | null
          owner_id: string | null
          prioridade: string
          recorrencia: string | null
          start_date: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          due_date?: string | null
          equipe_id?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string | null
          prioridade?: string
          recorrencia?: string | null
          start_date?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          due_date?: string | null
          equipe_id?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string | null
          prioridade?: string
          recorrencia?: string | null
          start_date?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades_desenvolvimento: {
        Row: {
          created_at: string
          descricao: string | null
          due_date: string | null
          evidencia: string | null
          id: string
          plano_id: string
          progresso: number
          status: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          evidencia?: string | null
          id?: string
          plano_id: string
          progresso?: number
          status?: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          evidencia?: string | null
          id?: string
          plano_id?: string
          progresso?: number
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_desenvolvimento_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_desenvolvimento"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      avaliacoes_pdi: {
        Row: {
          avaliacao: string
          avaliador_id: string | null
          created_at: string
          data: string
          id: string
          plano_id: string
          progresso: number
        }
        Insert: {
          avaliacao: string
          avaliador_id?: string | null
          created_at?: string
          data?: string
          id?: string
          plano_id: string
          progresso?: number
        }
        Update: {
          avaliacao?: string
          avaliador_id?: string | null
          created_at?: string
          data?: string
          id?: string
          plano_id?: string
          progresso?: number
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_pdi_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_desenvolvimento"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          colaborador_id: string
          created_at: string
          horas_debito: number
          horas_extras: number
          id: string
          mes: string
          observacoes: string | null
          saldo_acumulado: number
          user_id: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          horas_debito?: number
          horas_extras?: number
          id?: string
          mes: string
          observacoes?: string | null
          saldo_acumulado?: number
          user_id?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          horas_debito?: number
          horas_extras?: number
          id?: string
          mes?: string
          observacoes?: string | null
          saldo_acumulado?: number
          user_id?: string | null
        }
        Relationships: []
      }
      checkin_gerencial_itens: {
        Row: {
          checkin_id: string
          created_at: string
          decisao: string | null
          discussao: string | null
          id: string
          prazo: string | null
          responsavel_id: string | null
          status_acompanhamento: string
          tipo: string
          titulo: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          decisao?: string | null
          discussao?: string | null
          id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status_acompanhamento?: string
          tipo?: string
          titulo: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          decisao?: string | null
          discussao?: string | null
          id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status_acompanhamento?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_gerencial_itens_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins_gerenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins_gerenciais: {
        Row: {
          created_at: string
          data: string
          frequencia: string
          gestor_id: string
          id: string
          observacoes: string | null
          participantes: string[]
          pauta_previa: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          data: string
          frequencia?: string
          gestor_id: string
          id?: string
          observacoes?: string | null
          participantes?: string[]
          pauta_previa?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          data?: string
          frequencia?: string
          gestor_id?: string
          id?: string
          observacoes?: string | null
          participantes?: string[]
          pauta_previa?: Json | null
          status?: string
        }
        Relationships: []
      }
      checkins_operacionais: {
        Row: {
          ausentes: string[]
          created_at: string
          data: string
          frequencia: string
          id: string
          observacoes: string | null
          operacao: string
          pendencias: string | null
          presentes: string[]
          responsavel_id: string | null
          status_geral: string
          user_id: string | null
          volume_previsto: number | null
          volume_realizado: number | null
        }
        Insert: {
          ausentes?: string[]
          created_at?: string
          data: string
          frequencia?: string
          id?: string
          observacoes?: string | null
          operacao: string
          pendencias?: string | null
          presentes?: string[]
          responsavel_id?: string | null
          status_geral?: string
          user_id?: string | null
          volume_previsto?: number | null
          volume_realizado?: number | null
        }
        Update: {
          ausentes?: string[]
          created_at?: string
          data?: string
          frequencia?: string
          id?: string
          observacoes?: string | null
          operacao?: string
          pendencias?: string | null
          presentes?: string[]
          responsavel_id?: string | null
          status_geral?: string
          user_id?: string | null
          volume_previsto?: number | null
          volume_realizado?: number | null
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
      complexidade_bpmn: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          operacao: string
          participacao: number
          peso: number
          processo: string
          referencia: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          operacao: string
          participacao?: number
          peso?: number
          processo: string
          referencia?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          operacao?: string
          participacao?: number
          peso?: number
          processo?: string
          referencia?: string | null
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
      custo_pessoal_mensal: {
        Row: {
          aviso_previo: number
          beneficios: number
          colaborador_id: string
          created_at: string
          fgts: number
          fonte: string
          id: string
          inss: number
          mes_referencia: string
          operacao: string
          provisao_13: number
          provisao_ferias: number
          salario_bruto: number
          tipo_contrato: string
          total: number | null
          user_id: string | null
        }
        Insert: {
          aviso_previo?: number
          beneficios?: number
          colaborador_id: string
          created_at?: string
          fgts?: number
          fonte?: string
          id?: string
          inss?: number
          mes_referencia: string
          operacao: string
          provisao_13?: number
          provisao_ferias?: number
          salario_bruto?: number
          tipo_contrato?: string
          total?: number | null
          user_id?: string | null
        }
        Update: {
          aviso_previo?: number
          beneficios?: number
          colaborador_id?: string
          created_at?: string
          fgts?: number
          fonte?: string
          id?: string
          inss?: number
          mes_referencia?: string
          operacao?: string
          provisao_13?: number
          provisao_ferias?: number
          salario_bruto?: number
          tipo_contrato?: string
          total?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      equipes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          gestor_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          gestor_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          gestor_id?: string | null
          id?: string
          nome?: string
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
      membros_equipe: {
        Row: {
          ativo: boolean
          created_at: string
          data_entrada: string | null
          equipe_id: string
          id: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_entrada?: string | null
          equipe_id: string
          id?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_entrada?: string | null
          equipe_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          end_date: string | null
          equipe_id: string | null
          id: string
          owner_id: string | null
          recorrencia: string | null
          start_date: string | null
          status: string
          titulo: string
          unidade: string
          valor_esperado: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          end_date?: string | null
          equipe_id?: string | null
          id?: string
          owner_id?: string | null
          recorrencia?: string | null
          start_date?: string | null
          status?: string
          titulo: string
          unidade?: string
          valor_esperado?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          end_date?: string | null
          equipe_id?: string | null
          id?: string
          owner_id?: string | null
          recorrencia?: string | null
          start_date?: string | null
          status?: string
          titulo?: string
          unidade?: string
          valor_esperado?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      nao_conformidades: {
        Row: {
          colaborador_id: string | null
          created_at: string
          custo_gerado: number
          data_ocorrencia: string
          data_resolucao: string | null
          descricao: string
          forma_resolucao: string | null
          id: string
          numero_oc: string | null
          numero_processo: string | null
          operacao: string
          reembolsavel: boolean
          ref_cliente: string | null
          ref_pinho: string | null
          status_financeiro: string
          tipo: string
          user_id: string | null
          valor_recuperado: number | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          custo_gerado?: number
          data_ocorrencia?: string
          data_resolucao?: string | null
          descricao: string
          forma_resolucao?: string | null
          id?: string
          numero_oc?: string | null
          numero_processo?: string | null
          operacao: string
          reembolsavel?: boolean
          ref_cliente?: string | null
          ref_pinho?: string | null
          status_financeiro?: string
          tipo?: string
          user_id?: string | null
          valor_recuperado?: number | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          custo_gerado?: number
          data_ocorrencia?: string
          data_resolucao?: string | null
          descricao?: string
          forma_resolucao?: string | null
          id?: string
          numero_oc?: string | null
          numero_processo?: string | null
          operacao?: string
          reembolsavel?: boolean
          ref_cliente?: string | null
          ref_pinho?: string | null
          status_financeiro?: string
          tipo?: string
          user_id?: string | null
          valor_recuperado?: number | null
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
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      ocorrencias_atividade: {
        Row: {
          atividade_id: string
          created_at: string
          id: string
          justificativa: string | null
          pontuacao: number | null
          resultado: string | null
          status: string | null
          week_end: string | null
          week_start: string
        }
        Insert: {
          atividade_id: string
          created_at?: string
          id?: string
          justificativa?: string | null
          pontuacao?: number | null
          resultado?: string | null
          status?: string | null
          week_end?: string | null
          week_start: string
        }
        Update: {
          atividade_id?: string
          created_at?: string
          id?: string
          justificativa?: string | null
          pontuacao?: number | null
          resultado?: string | null
          status?: string | null
          week_end?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_atividade_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
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
      planos_desenvolvimento: {
        Row: {
          colaborador_id: string
          competencia: string
          created_at: string
          created_by: string | null
          due_date: string | null
          evidencias: string | null
          id: string
          indicador: string | null
          objetivo: string
          progresso: number
          start_date: string | null
          status: string
        }
        Insert: {
          colaborador_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          evidencias?: string | null
          id?: string
          indicador?: string | null
          objetivo: string
          progresso?: number
          start_date?: string | null
          status?: string
        }
        Update: {
          colaborador_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          evidencias?: string | null
          id?: string
          indicador?: string | null
          objetivo?: string
          progresso?: number
          start_date?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          id: string
          nome: string
          role: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          id: string
          nome?: string
          role?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          id?: string
          nome?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      projeto_atividades: {
        Row: {
          atividade_id: string
          created_at: string
          id: string
          projeto_id: string
        }
        Insert: {
          atividade_id: string
          created_at?: string
          id?: string
          projeto_id: string
        }
        Update: {
          atividade_id?: string
          created_at?: string
          id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_atividades_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_atividades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          due_date: string | null
          equipe_id: string | null
          id: string
          nome: string
          objetivo: string | null
          observacoes: string | null
          owner_id: string | null
          prioridade: string
          progresso: number
          responsavel_id: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          due_date?: string | null
          equipe_id?: string | null
          id?: string
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          owner_id?: string | null
          prioridade?: string
          progresso?: number
          responsavel_id?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          due_date?: string | null
          equipe_id?: string | null
          id?: string
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          owner_id?: string | null
          prioridade?: string
          progresso?: number
          responsavel_id?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_produtividade: {
        Row: {
          colaborador_id: string
          created_at: string
          dias_trabalhados: number
          dias_uteis_mes: number
          fte: number | null
          id: string
          mes: string
          observacoes: string | null
          operacao: string
          produtividade: number | null
          user_id: string | null
          volume_processos: number
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          dias_trabalhados?: number
          dias_uteis_mes?: number
          fte?: number | null
          id?: string
          mes: string
          observacoes?: string | null
          operacao: string
          produtividade?: number | null
          user_id?: string | null
          volume_processos?: number
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          dias_trabalhados?: number
          dias_uteis_mes?: number
          fte?: number | null
          id?: string
          mes?: string
          observacoes?: string | null
          operacao?: string
          produtividade?: number | null
          user_id?: string | null
          volume_processos?: number
        }
        Relationships: []
      }
      resultados_meta: {
        Row: {
          created_at: string
          id: string
          justificativa: string | null
          meta_id: string
          pct_atingimento: number | null
          periodo_fim: string | null
          periodo_inicio: string
          resultado: string | null
          valor_esperado: number
          valor_realizado: number
        }
        Insert: {
          created_at?: string
          id?: string
          justificativa?: string | null
          meta_id: string
          pct_atingimento?: number | null
          periodo_fim?: string | null
          periodo_inicio: string
          resultado?: string | null
          valor_esperado?: number
          valor_realizado?: number
        }
        Update: {
          created_at?: string
          id?: string
          justificativa?: string | null
          meta_id?: string
          pct_atingimento?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string
          resultado?: string | null
          valor_esperado?: number
          valor_realizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "resultados_meta_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
        ]
      }
      revisoes_semanais: {
        Row: {
          created_at: string
          id: string
          pontuacao_geral: number | null
          status: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          pontuacao_geral?: number | null
          status?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          pontuacao_geral?: number | null
          status?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      scorecard_avaliacoes: {
        Row: {
          avaliador_id: string | null
          ciclo_id: string
          colaborador_id: string
          created_at: string
          destaque: boolean
          evidencia_iniciativa: string | null
          evidencia_multiplicacao: string | null
          id: string
          justificativa_ajuste: string | null
          motivo_destaque: string | null
          nota_confiabilidade: number | null
          nota_iniciativa: number | null
          nota_multiplicacao: number | null
          nota_produtividade: number | null
          nota_qualidade: number | null
          origem_confiabilidade: string
          origem_produtividade: string
          origem_qualidade: string
          updated_at: string
        }
        Insert: {
          avaliador_id?: string | null
          ciclo_id: string
          colaborador_id: string
          created_at?: string
          destaque?: boolean
          evidencia_iniciativa?: string | null
          evidencia_multiplicacao?: string | null
          id?: string
          justificativa_ajuste?: string | null
          motivo_destaque?: string | null
          nota_confiabilidade?: number | null
          nota_iniciativa?: number | null
          nota_multiplicacao?: number | null
          nota_produtividade?: number | null
          nota_qualidade?: number | null
          origem_confiabilidade?: string
          origem_produtividade?: string
          origem_qualidade?: string
          updated_at?: string
        }
        Update: {
          avaliador_id?: string | null
          ciclo_id?: string
          colaborador_id?: string
          created_at?: string
          destaque?: boolean
          evidencia_iniciativa?: string | null
          evidencia_multiplicacao?: string | null
          id?: string
          justificativa_ajuste?: string | null
          motivo_destaque?: string | null
          nota_confiabilidade?: number | null
          nota_iniciativa?: number | null
          nota_multiplicacao?: number | null
          nota_produtividade?: number | null
          nota_qualidade?: number | null
          origem_confiabilidade?: string
          origem_produtividade?: string
          origem_qualidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_avaliacoes_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "scorecard_ciclos"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_ciclos: {
        Row: {
          created_at: string
          created_by: string | null
          criterio_publicado: string | null
          fechado_em: string | null
          id: string
          nome: string
          periodo_fim: string
          periodo_inicio: string
          peso_confiabilidade: number
          peso_iniciativa: number
          peso_multiplicacao: number
          peso_produtividade: number
          peso_qualidade: number
          publicado_em: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criterio_publicado?: string | null
          fechado_em?: string | null
          id?: string
          nome: string
          periodo_fim: string
          periodo_inicio: string
          peso_confiabilidade?: number
          peso_iniciativa?: number
          peso_multiplicacao?: number
          peso_produtividade?: number
          peso_qualidade?: number
          publicado_em?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criterio_publicado?: string | null
          fechado_em?: string | null
          id?: string
          nome?: string
          periodo_fim?: string
          periodo_inicio?: string
          peso_confiabilidade?: number
          peso_iniciativa?: number
          peso_multiplicacao?: number
          peso_produtividade?: number
          peso_qualidade?: number
          publicado_em?: string | null
          status?: string
        }
        Relationships: []
      }
      scorecard_registros: {
        Row: {
          autor_id: string | null
          colaborador_id: string
          created_at: string
          dimensao: string
          id: string
          mes: string
          nota: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          colaborador_id: string
          created_at?: string
          dimensao?: string
          id?: string
          mes: string
          nota: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          colaborador_id?: string
          created_at?: string
          dimensao?: string
          id?: string
          mes?: string
          nota?: string
          tipo?: string
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
          planta: string
          proc_aereos: number
          proc_canal_verde: number
          proc_canal_vermelho: number
          proc_maritimos: number
          start_up: number
          tm_dig_conf_h: number
          tm_liberacao_dias: number
          tm_registro_dias: number
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
          planta: string
          proc_aereos?: number
          proc_canal_verde?: number
          proc_canal_vermelho?: number
          proc_maritimos?: number
          start_up?: number
          tm_dig_conf_h?: number
          tm_liberacao_dias?: number
          tm_registro_dias?: number
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
          planta?: string
          proc_aereos?: number
          proc_canal_verde?: number
          proc_canal_vermelho?: number
          proc_maritimos?: number
          start_up?: number
          tm_dig_conf_h?: number
          tm_liberacao_dias?: number
          tm_registro_dias?: number
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
          unidade: string | null
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
          unidade?: string | null
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
          unidade?: string | null
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
          insight: string | null
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
          insight?: string | null
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
          insight?: string | null
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
        | "volkswagen"
        | "perkins"
        | "brp"
        | "hyundai"
        | "gwm"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "volkswagen",
        "perkins",
        "brp",
        "hyundai",
        "gwm",
      ],
    },
  },
} as const
