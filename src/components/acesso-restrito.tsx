import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { usePerfil, type Papel } from "@/hooks/use-perfil";

const LABEL: Record<Papel, string> = {
  gestor: "Gestor",
  coordenador: "Coordenador",
  supervisor: "Supervisor",
  analista: "Analista",
};

export function AcessoRestrito({ papeis }: { papeis: Papel[] }) {
  const { papel } = usePerfil();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-5">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Esta área está disponível apenas para {papeis.map((p) => LABEL[p]).join(" e ")}. Seu
          perfil atual é <strong>{LABEL[papel]}</strong>.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Se você precisa de acesso, fale com o gestor da área.
        </p>
      </div>
    </div>
  );
}

/** Envolve conteúdo que exige um dos papéis informados. */
export function Restrito({ papeis, children }: { papeis: Papel[]; children: ReactNode }) {
  const { eUmDe, carregando } = usePerfil();
  if (carregando) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!eUmDe(papeis)) return <AcessoRestrito papeis={papeis} />;
  return <>{children}</>;
}
