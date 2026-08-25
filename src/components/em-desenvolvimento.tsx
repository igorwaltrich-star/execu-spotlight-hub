import { Construction } from "lucide-react";

interface Props {
  titulo: string;
  descricao?: string;
  fase?: string;
}

export function EmDesenvolvimento({ titulo, descricao, fase = "Fase 1" }: Props) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <Construction className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">{titulo}</h1>
        {descricao && (
          <p className="text-muted-foreground mb-6 leading-relaxed">{descricao}</p>
        )}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Em desenvolvimento · {fase}
        </div>
      </div>
    </div>
  );
}
