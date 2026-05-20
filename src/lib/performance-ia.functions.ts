import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  fileNames: z.array(z.string()).min(1).max(10),
});

export type AnalyseResult = {
  resumo: string;
  pontosCriticos: { titulo: string; descricao: string; severidade: "alta" | "media" }[];
  oportunidades: { titulo: string; descricao: string; acao: string }[];
};

export const analyzePerformanceReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalyseResult> => {
    // MOCK: simula chamada para Edge Function `analyze-performance-report`
    await new Promise((r) => setTimeout(r, 3000));

    const arquivos = data.fileNames.join(", ");

    return {
      resumo: `Análise consolidada de ${data.fileNames.length} arquivo(s) (${arquivos}). A operação apresenta produtividade média compatível com a meta, porém com variações relevantes entre unidades. Indicadores de SLA mostram queda no último trimestre, especialmente no OTCC, enquanto o volume processado cresceu 12% sem aumento proporcional de headcount, sinalizando ganho de eficiência mas também risco de sobrecarga.`,
      pontosCriticos: [
        {
          titulo: "Queda de SLA no OTCC (Midea SC)",
          descricao: "Indicador caiu de 96% para 88% nos últimos 60 dias, principalmente em pedidos acima de R$ 50k.",
          severidade: "alta",
        },
        {
          titulo: "Sobrecarga operacional na unidade RS",
          descricao: "Produtividade por pessoa 35% acima da média, com risco de burnout e turnover.",
          severidade: "alta",
        },
        {
          titulo: "Desvios recorrentes no Start Up (Bosch HC)",
          descricao: "12 ocorrências no período, padrão de falha relacionado à integração com sistema legado.",
          severidade: "media",
        },
      ],
      oportunidades: [
        {
          titulo: "Redistribuição de carteira entre unidades Midea",
          descricao: "Balancear volume entre SC, AM, RS e MG pode normalizar a produtividade e elevar SLA.",
          acao: "Criar comitê semanal de alocação dinâmica de carteira nas próximas 2 semanas.",
        },
        {
          titulo: "Automação de validação no Start Up",
          descricao: "Padronizar checklist de integração reduziria 60% dos desvios recorrentes.",
          acao: "Levantar requisitos com TI e priorizar no próximo sprint operacional.",
        },
        {
          titulo: "Programa de retenção para time RS",
          descricao: "Reconhecimento + revisão de pleitos antes que a sobrecarga gere desligamentos.",
          acao: "RH apresentar plano de retenção em até 30 dias.",
        },
      ],
    };
  });
