import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().min(0),
  tipo: z.enum(["sla_midea", "sla_bosch", "operacional"]).default("operacional"),
  excerpt: z.string().max(200000).optional(),
});

const inputSchema = z.object({
  files: z.array(fileSchema).min(1).max(10),
  contexto: z.string().max(2000).optional(),
  metaPadrao: z.number().min(0).max(100).default(95),
});

export type ValidacaoSLA = {
  indicador: string;
  unidade?: string;
  meta: string;
  valorMedio: string;
  melhorMes?: string;
  piorMes?: string;
  status: "ok" | "atencao" | "critico";
  justificativa: string;
};

export type AnalyseResult = {
  resumo: string;
  validacoesSLA?: ValidacaoSLA[];
  pontosCriticos: { titulo: string; descricao: string; severidade: "alta" | "media" }[];
  oportunidades: { titulo: string; descricao: string; acao: string }[];
  embarquesCriticos?: {
    colunas: string[];
    linhas: string[][];
    observacao?: string;
  };
};

const tool = {
  type: "function",
  function: {
    name: "registrar_analise_operacional",
    description: "Registra a análise consolidada de relatórios operacionais e SLA.",
    parameters: {
      type: "object",
      properties: {
        resumo: {
          type: "string",
          description:
            "Resumo executivo (4-8 frases) com números concretos: indicadores médios, % vs meta, melhores e piores períodos, unidades em destaque.",
        },
        validacoesSLA: {
          type: "array",
          description:
            "Validações por indicador de SLA encontrado nos arquivos (OTD, OTCC, SOTD, Start-up, Pinho, Dig.Conf, Desvios, etc.). Preencha SEMPRE que os arquivos contiverem dados tabulares de SLA. Status: ok (>= meta), atencao (até 3pp abaixo da meta), critico (mais de 3pp abaixo).",
          minItems: 0,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              indicador: { type: "string", description: "Nome do indicador. Ex.: OTD, OTCC, SOTD." },
              unidade: { type: "string", description: "Unidade/cliente quando aplicável (Midea SC, Bosch, etc.)." },
              meta: { type: "string", description: "Meta usada (ex.: '95%')." },
              valorMedio: { type: "string", description: "Valor médio do período (ex.: '92,4%')." },
              melhorMes: { type: "string" },
              piorMes: { type: "string" },
              status: { type: "string", enum: ["ok", "atencao", "critico"] },
              justificativa: {
                type: "string",
                description: "Justificativa objetiva (1-3 frases) com tendência, outliers e causas prováveis.",
              },
            },
            required: ["indicador", "meta", "valorMedio", "status", "justificativa"],
            additionalProperties: false,
          },
        },
        pontosCriticos: {
          type: "array",
          minItems: 2,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              descricao: { type: "string" },
              severidade: { type: "string", enum: ["alta", "media"] },
            },
            required: ["titulo", "descricao", "severidade"],
            additionalProperties: false,
          },
        },
        oportunidades: {
          type: "array",
          minItems: 2,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              descricao: { type: "string" },
              acao: { type: "string" },
            },
            required: ["titulo", "descricao", "acao"],
            additionalProperties: false,
          },
        },
        embarquesCriticos: {
          type: "object",
          description:
            "Tabela consolidada dos embarques/pedidos sinalizados como críticos extraídos dos relatórios. Inclua somente registros realmente críticos (atraso, risco de SLA, parado, divergência). Se não houver dados tabulares de embarques nos arquivos, omita este campo.",
          properties: {
            colunas: {
              type: "array",
              minItems: 2,
              maxItems: 8,
              items: { type: "string" },
            },
            linhas: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: { type: "array", items: { type: "string" } },
            },
            observacao: { type: "string" },
          },
          required: ["colunas", "linhas"],
          additionalProperties: false,
        },
      },
      required: ["resumo", "pontosCriticos", "oportunidades"],
      additionalProperties: false,
    },
  },
} as const;

export const analyzePerformanceReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalyseResult> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const meta = data.metaPadrao ?? 95;

    const systemPrompt = `Você é um consultor sênior de operações logísticas e SLA. Analise os relatórios enviados em português do Brasil com rigor analítico.

META PADRÃO DE TODOS OS INDICADORES: ${meta}% (a menos que o arquivo explicite outra).

CHECKLIST OBRIGATÓRIO DE VALIDAÇÕES DE SLA (preencha validacoesSLA quando houver dados):
1. Para CADA indicador encontrado (OTD, OTCC, SOTD, Start-up, Pinho, Dig.Conf, Desvios, produtividade, etc.), calcule média do período, melhor mês, pior mês.
2. Classifique status: "ok" se média >= ${meta}%, "atencao" se entre ${meta - 3}% e ${meta}%, "critico" se < ${meta - 3}%.
3. Identifique TENDÊNCIA (crescente/decrescente/estável) comparando primeiros vs últimos meses.
4. Aponte OUTLIERS (meses muito fora da média) e UNIDADES fora da curva.
5. Verifique CORRELAÇÕES quando aplicável: volume × produtividade × SLA.
6. Sinalize indicadores PRÓXIMOS DO LIMITE (entre meta e meta+2pp) como risco.
7. Liste em pontosCriticos os indicadores em "critico" ou com queda relevante (>3pp mês a mês).
8. Quando houver dados de embarques/pedidos, preencha embarquesCriticos com colunas relevantes (Pedido, Cliente, Unidade, Data Prevista, Status, Motivo, Dias em Atraso).

Seja específico: cite NÚMEROS, MESES, UNIDADES. Nunca generalize sem dado. Sempre responda chamando a função registrar_analise_operacional.`;

    const arquivosResumo = data.files
      .map((f, i) => {
        const tipoLabel =
          f.tipo === "sla_midea" ? "SLA Midea" : f.tipo === "sla_bosch" ? "SLA Bosch" : "Operacional";
        const head = `=== Arquivo ${i + 1}: ${f.name} (${(f.size / 1024).toFixed(0)} KB) | Tipo: ${tipoLabel} ===`;
        return f.excerpt ? `${head}\n${f.excerpt}` : `${head}\n[sem conteúdo extraído]`;
      })
      .join("\n\n");

    const userPrompt = `${data.contexto ? `Contexto adicional do usuário: ${data.contexto}\n\n` : ""}Relatórios recebidos:\n\n${arquivosResumo}\n\nExecute o checklist completo e chame a função registrar_analise_operacional.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "registrar_analise_operacional" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações > Workspace.");
      const txt = await res.text();
      throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`);
    }

    const payload = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("IA não retornou estrutura esperada");

    const parsed = JSON.parse(call.function.arguments) as AnalyseResult;
    return parsed;
  });
