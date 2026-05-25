import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().min(0),
  excerpt: z.string().max(20000).optional(),
});

const inputSchema = z.object({
  files: z.array(fileSchema).min(1).max(10),
  contexto: z.string().max(2000).optional(),
});

export type AnalyseResult = {
  resumo: string;
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
    description: "Registra a análise consolidada de relatórios operacionais.",
    parameters: {
      type: "object",
      properties: {
        resumo: {
          type: "string",
          description:
            "Resumo executivo (3-6 frases) sobre o cenário operacional, com números concretos quando possível.",
        },
        pontosCriticos: {
          type: "array",
          minItems: 2,
          maxItems: 6,
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
          maxItems: 6,
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
              description:
                "Cabeçalhos das colunas. Sugestões: Pedido, Cliente, Unidade, Data Prevista, Status, Motivo, Dias em Atraso.",
            },
            linhas: {
              type: "array",
              minItems: 1,
              maxItems: 30,
              items: { type: "array", items: { type: "string" } },
              description: "Cada linha deve ter o mesmo número de elementos que 'colunas'.",
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

    const systemPrompt = `Você é um consultor sênior de operações e performance. Analise os relatórios operacionais enviados (planilhas, CSVs ou PDFs) e gere insights acionáveis em português do Brasil. Seja específico: cite números, unidades, indicadores (SLA, OTCC, produtividade, headcount, turnover) sempre que possível a partir dos dados. Quando os arquivos contiverem dados de embarques/pedidos, identifique aqueles em situação crítica (atrasados, em risco de SLA, parados, com divergência) e preencha o campo embarquesCriticos com uma tabela consolidada — escolha as colunas mais relevantes presentes nos dados (ex.: Pedido, Cliente, Unidade, Data Prevista, Status, Motivo, Dias em Atraso). Caso o conteúdo seja parcial, faça inferências razoáveis e sinalize claramente. Sempre responda chamando a função registrar_analise_operacional.`;

    const arquivosResumo = data.files
      .map((f, i) => {
        const head = `Arquivo ${i + 1}: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`;
        return f.excerpt ? `${head}\nConteúdo (parcial):\n${f.excerpt}` : head;
      })
      .join("\n\n---\n\n");

    const userPrompt = `${data.contexto ? `Contexto adicional: ${data.contexto}\n\n` : ""}Relatórios recebidos:\n\n${arquivosResumo}\n\nGere a análise estruturada chamando a função.`;

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
