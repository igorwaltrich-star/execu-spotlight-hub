import { createFileRoute } from "@tanstack/react-router";
import { Construction, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/cadastro-operacional-view";

export const Route = createFileRoute("/_authenticated/margem-contribucao")({
  component: MargemContribuicaoPage,
});

const PREVISOES = [
  {
    titulo: "Receita x Custo por operação",
    texto:
      "Cruzamento automático entre o volume faturado e o custo operacional já lançado, separado por Midea e Bosch.",
  },
  {
    titulo: "Margem de contribuição e ponto de equilíbrio",
    texto:
      "Cálculo da margem em reais e em percentual, com meta configurável e alerta quando a operação ficar abaixo do aceitável.",
  },
  {
    titulo: "Ranking de rentabilidade",
    texto:
      "Comparativo mensal entre operações para orientar preço, escala e decisões de renegociação contratual.",
  },
];

function MargemContribuicaoPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Margem de Contribuição"
        description="Rentabilidade real por operação — receita menos custos variáveis"
      />

      <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-5">
          <Construction className="h-8 w-8 text-primary" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Under construction
        </div>

        <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
          Em desenvolvimento
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Esta aba ainda está em construção. Nenhum dado é exibido por enquanto — a
          equipe já está preparando os cálculos de receita, custo variável e margem
          por operação.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PREVISOES.map((item) => (
          <div
            key={item.titulo}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Em breve
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground">{item.titulo}</h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {item.texto}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
