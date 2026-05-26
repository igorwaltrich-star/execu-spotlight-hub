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

export type DesempenhoAnalista = {
  analista: string;
  totalProcessos: string;
  slaAtendidos: string;
  slaVencidos: string;
  percentualSLA: string;
  camposEmBranco: string;
  backlogs: string;
  scorePerformance: string;
  status: "ok" | "atencao" | "critico";
  observacao: string;
};

export type AnalyseResult = {
  resumo: string;
  validacoesSLA?: ValidacaoSLA[];
  pontosCriticos: { titulo: string; descricao: string; severidade: "alta" | "media" }[];
  oportunidades: { titulo: string; descricao: string; acao: string }[];
  desempenhoAnalistas?: DesempenhoAnalista[];
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
        desempenhoAnalistas: {
          type: "array",
          description:
            "Análise comparativa de desempenho por analista/responsável. UMA linha por analista identificado no relatório, comparando atendimento de SLA, qualidade de preenchimento (campos em branco) e performance geral. Ordenar do pior para o melhor scorePerformance.",
          maxItems: 50,
          items: {
            type: "object",
            properties: {
              analista: { type: "string", description: "Nome do analista/responsável." },
              totalProcessos: { type: "string", description: "Quantidade total de processos sob responsabilidade." },
              slaAtendidos: { type: "string", description: "Quantidade e % de processos dentro do SLA. Ex.: '42 (84%)'." },
              slaVencidos: { type: "string", description: "Quantidade e % de processos com SLA vencido." },
              percentualSLA: { type: "string", description: "% geral de atendimento ao SLA. Ex.: '84%'." },
              camposEmBranco: { type: "string", description: "Quantidade total de campos obrigatórios em branco nos processos do analista (datas de confirmação, ETD, recebimento de docs, pré-alerta, etc.). Ex.: '17 campos'." },
              backlogs: { type: "string", description: "Contagem de backlogs por tipo. Ex.: 'Produção: 3 | Embarque: 5 | Docs: 2 | Pré-Alerta: 1'." },
              scorePerformance: { type: "string", description: "Score 0-100 ponderando: 60% atendimento SLA + 25% qualidade de preenchimento + 15% ausência de backlogs. Ex.: '72/100'." },
              status: { type: "string", enum: ["ok", "atencao", "critico"], description: "ok se score>=85, atencao 70-84, critico <70." },
              observacao: { type: "string", description: "1-2 frases destacando pontos fortes, fragilidades e principais gargalos do analista." },
            },
            required: ["analista", "totalProcessos", "slaAtendidos", "slaVencidos", "percentualSLA", "camposEmBranco", "backlogs", "scorePerformance", "status", "observacao"],
            additionalProperties: false,
          },
        },
        embarquesCriticos: {
          type: "object",
          description:
            "Tabela EXAUSTIVA com TODOS os processos/pedidos/embarques que venceram ou excederam qualquer prazo de SLA (mesmo que por 1 dia), incluindo backlogs. Liste linha a linha, ordenado pelos maiores atrasos primeiro.",
          properties: {
            colunas: {
              type: "array",
              items: { type: "string" },
              description:
                "Colunas sugeridas: Processo/Pedido, Cliente/Unidade, Etapa/Indicador, SLA/Prazo, Realizado, Dias em Atraso, Tipo de Backlog, Status.",
            },
            linhas: {
              type: "array",
              items: { type: "array", items: { type: "string" } },
              description: "Uma linha por ocorrência crítica. Inclua até 150 linhas (as piores) e registre o total real em observacao se houver mais.",
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
    const temMidea = data.files.some((f) => f.tipo === "sla_midea");

    const slaMideaRef = `
==== REFERÊNCIA OFICIAL — SLA MIDEA (PO MANAGEMENT) ====
Use estes prazos contratuais como base de validação para qualquer arquivo do tipo SLA Midea. Compare os dados do relatório com estes SLAs e aponte descumprimentos com o nome da atividade EXATAMENTE como abaixo.

- COLOCAÇÃO PEDIDOS: 1 dia útil do recebimento da RC aprovada (críticos: mesmo dia).
- CONFIRMAÇÃO DE PEDIDOS: 72h corridas a partir da colocação.
- FOLLOW UP FORNECEDORES: diário durante o processo.
- FOLLOW UP SAP/PWCE (ZMM066/ZMM067): diário.
- DEFINIÇÃO AGENTE DE CARGAS / INSTRUÇÃO DE EMBARQUE: sob demanda.
- OTIMIZAÇÃO E COMUNICAÇÃO DE EMBARQUES/CONTAINERIZAÇÃO: constante, a cada embarque.
- RECEBIMENTO DOCUMENTOS EMBARQUE: até 15 dias após ETD Feeder.
- ANÁLISE DOS DOCUMENTOS (Invoice, Packing, BL etc.): 7 dias corridos após recebimento.
- ABERTURA DE EMBARQUE NO SAP/PWCE: 7 dias corridos após recebimento dos docs.
- LICENÇA DE IMPORTAÇÃO: LI deferida até chegada no porto; emissão ≥ 20 dias corridos antes da chegada.
- DOCUMENTOS FINAIS/ORIGINAIS: disponíveis para desembaraço em até 48h da chegada da carga.
- CE MERCANTE: conferência até 48h da atracação; correções antes de 48h; liberação solicitada na presença de carga.
- MAPA: solicitação até 48h antes da chegada ou 1 dia após chegada do BL Original.
- TAXAS LIBERAÇÃO BL/FRETE: até 24h após presença de carga.
- REMOÇÃO DTC/DTA: conforme necessidade, com aprovação Midea.
- CONFECÇÃO DTC/DTA: até 24h úteis após aprovação Midea.
- ESTIMATIVA DE IMPOSTOS / PROVISÃO: inclusão em 24h da presença de carga; envio até 13h do dia do registro; liberação financeira até 16h.
- REGISTRO E LIBERAÇÃO DA DI: mesmo dia da liberação de recursos até 22:50h; postagem RFB em 1 dia útil.
- CI: até 24h úteis após desembaraço.
- LIBERAÇÃO COMEX PORTOS/TERMINAIS: até 24h úteis após CI.
- DEFINIÇÃO DATAS CARREGAMENTO: e-mail até 24h úteis após liberação; coleta dentro do 1º período de armazenagem (senão D+1).
- AGENDAMENTO, CARREGAMENTO E ENTREGA: coleta dentro do 1º período; entrega até 1 dia útil após coleta.
- ATENDIMENTO/ACOMPANHAMENTO OTD: conforme remessa solicitada pelo requisitante.
- CONFERÊNCIA DE FATURAMENTOS/DESPESAS: antes do pagamento.
- APROVAÇÃO DE CUSTOS ANORMAIS LOG INTERNACIONAL: antes do pagamento, assim que identificado.
- PAGAMENTOS DE DESPESAS: conforme SLAs anteriores ou prazo da fatura.
- FATURAMENTO E LANÇAMENTO DANFE: emissão antes do carregamento; lançamento SAP/PWCE até 24h úteis após emissão.
- CONFERÊNCIA E LANÇAMENTO PRESTAÇÃO DE CONTAS SAP/PWCE: 2 a 5 dias úteis após faturamento; fechamento conforme cronograma Midea.
- REEMBOLSO POR TERCEIROS: cobrar fornecedor em até 7 dias corridos.
- REPORTE COM PREVISÕES DE ENTREGA: mensal até dia 05.
- REVISÃO DO REPORTE: dias 11, 21 e 2 do mês seguinte (ou 1º dia útil seguinte).
- REUNIÕES DE ALINHAMENTO: semanal ou conforme demanda.
- AÇÕES FECHAMENTO DE MÊS: conforme cronograma.
- INVENTÁRIO ANUAL: anual, conforme cronograma.
- DEVOLUÇÃO DO VAZIO (ARMAZÉM e SOBRE RODAS): 4 dias corridos entre disponibilidade e devolução; nunca após free time; acompanhamento diário.
- PAGAMENTO DEMURRAGE / FRETE CHEIO E VAZIO: conforme prazo da fatura.
- PAGAMENTO LAVAÇÃO/REPAROS CONTÊINER: sempre que ocorrer, antes do free time e risco de bloqueio CNPJ.
- ENCERRAMENTO DO PROCESSO: 1 dia útil após aprovação da prestação de contas; todos faturados encerrados no mês.
- REPORTE DE CONTAS EM ANDAMENTO: último dia do mês.
- ARQUIVAMENTO DE DOCUMENTOS: mensal até dia 05.
- SEGURO DE CARGA: constante / conforme datas do financeiro.
- APRESENTAÇÃO MENSAL DE KPI: mensal até dia 20.
- RELATÓRIOS DE OPERAÇÃO, SUPORTE A SISTEMAS E PROJETOS: conforme necessidade/projeto.

REGRAS ADICIONAIS DE BACKLOG (aplicar linha a linha quando o relatório tiver colunas de datas previstas/confirmadas/solicitadas):
- BACKLOG PRODUÇÃO: se "Prev. EX Factory" > "EX Factory Solicitado" → alerta "Backlog Produção".
- BACKLOG EMBARQUE: se "Prev. ETD" > "ETD Solicitado" → alerta "Backlog Embarque".
- BACKLOG SEM CONFIRMAÇÃO: qualquer data de previsão de etapa no passado (< hoje) sem a respectiva data de confirmação preenchida → alerta "Backlog Sem Confirmação" (citar a etapa).
- BACKLOG DOCUMENTOS: se houve confirmação de embarque há ≥ 15 dias e "Recebimento de Docs" está vazio → alerta "Atraso Docs Fornecedor / Backlog Documentos".
- BACKLOG PRÉ-ALERTA: se passaram ≥ 22 dias da confirmação de embarque (ETD) e "Pré-Alerta KN" não está preenchido → alerta "Backlog Pré-Alerta".

Cada ocorrência destes backlogs deve virar uma linha em embarquesCriticos (colunas sugeridas: Processo, Tipo de Backlog, Data Referência, Dias em Atraso, Etapa Pendente) e ser somarizada em pontosCriticos por tipo de backlog com severidade "alta" quando houver 3+ ocorrências ou risco de free time/SLA contratual.

REGRAS DE VALIDAÇÃO MIDEA:
a) Para CADA atividade acima encontrada no relatório, gere uma linha em validacoesSLA: "indicador" = nome da atividade, "meta" = prazo contratual (ex.: "72h", "7 dias corridos", "24h úteis"), "valorMedio" = tempo médio real cumprido pelos dados.
b) Status: "ok" se cumprimento ≥ ${meta}% dos casos dentro do prazo, "atencao" entre ${meta - 3}% e ${meta}%, "critico" abaixo de ${meta - 3}% OU sempre que houver descumprimento de prazo bloqueante (free time, registro DI, LI antes da chegada, danfe pós-carregamento).
c) Sinalize em pontosCriticos qualquer atividade Midea com risco regulatório/financeiro.
d) Em embarquesCriticos liste processos individuais violando estes SLAs (colunas sugeridas: Processo, Etapa, SLA Midea, Tempo Real, Atraso, Status).
==== FIM REFERÊNCIA MIDEA ====
`;

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
8. EMBARQUES CRÍTICOS — REGRA OBRIGATÓRIA: percorra TODAS as linhas dos relatórios e inclua em embarquesCriticos **TODO E QUALQUER processo/pedido/embarque que tenha vencido ou excedido um prazo** (mesmo que por 1 dia), além de qualquer backlog detectado. NÃO resumir, NÃO agrupar, NÃO limitar por amostragem. Calcule "Dias em Atraso" = data_realizada (ou hoje se ainda em aberto) − data_prazo. Ordene primeiro por Analista (A→Z) e depois pelos maiores atrasos. Se houver mais de 150 ocorrências, liste as 150 piores e registre o total real em "observacao".
9. COLUNA "ANALISTA" OBRIGATÓRIA: em embarquesCriticos.colunas inclua SEMPRE uma coluna chamada exatamente "Analista" (ou "Responsável"/"Usuário" se for o termo literal do relatório) com o nome do analista/usuário responsável pelo processo. Procure no relatório colunas como: Analista, Responsável, Owner, Usuário, User, Operador, Comprador, Buyer, PIC, Resp. Se a coluna não existir no arquivo, preencha com "Não atribuído". NUNCA omita esta coluna.
10. Em pontosCriticos, além de sumarizar por TIPO de atraso, inclua pelo menos um item "Pendências por Analista" listando os analistas com mais ocorrências críticas (ex.: "João Silva - 23 pendências, Maria Souza - 17 pendências").
11. DESEMPENHO POR ANALISTA — OBRIGATÓRIO: preencha SEMPRE desempenhoAnalistas com UMA linha por analista/responsável identificado no relatório (coluna Analista, Responsável, Owner, Usuário, Operador, Comprador, Buyer, PIC). Para CADA analista calcule: totalProcessos, slaAtendidos (qtd e %), slaVencidos (qtd e %), percentualSLA geral, camposEmBranco (some todos os campos obrigatórios vazios: datas de confirmação, ETD, recebimento de docs, pré-alerta KN, etc.), backlogs por tipo (Produção/Embarque/Docs/Pré-Alerta/Sem Confirmação), scorePerformance 0-100 (60% SLA + 25% preenchimento + 15% ausência de backlogs) e status (ok≥85, atencao 70-84, critico<70). Ordene do PIOR para o MELHOR scorePerformance. Na observacao, destaque pontos fortes, fragilidades e principais gargalos com NÚMEROS específicos. Se não houver coluna de analista, retorne uma única linha "Não atribuído" agregando tudo.
${temMidea ? slaMideaRef : ""}
Seja específico: cite NÚMEROS, MESES, UNIDADES, PROCESSOS. Nunca generalize sem dado. Sempre responda chamando a função registrar_analise_operacional.`;

    const arquivosResumo = data.files
      .map((f, i) => {
        const tipoLabel =
          f.tipo === "sla_midea" ? "SLA Midea" : f.tipo === "sla_bosch" ? "SLA Bosch" : "Operacional";
        const head = `=== Arquivo ${i + 1}: ${f.name} (${(f.size / 1024).toFixed(0)} KB) | Tipo: ${tipoLabel} ===`;
        return f.excerpt ? `${head}\n${f.excerpt}` : `${head}\n[sem conteúdo extraído]`;
      })
      .join("\n\n");

    const userPrompt = `${data.contexto ? `Contexto adicional do usuário: ${data.contexto}\n\n` : ""}Relatórios recebidos:\n\n${arquivosResumo}\n\nExecute o checklist completo${temMidea ? ", aplicando a REFERÊNCIA OFICIAL SLA MIDEA acima a cada arquivo classificado como SLA Midea" : ""}, e chame a função registrar_analise_operacional.`;

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
