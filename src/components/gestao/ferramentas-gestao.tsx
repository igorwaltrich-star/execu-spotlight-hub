import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fish, BarChart3, HelpCircle, ClipboardList, LayoutGrid } from "lucide-react";
import { Ishikawa } from "./ferramentas/ishikawa";
import { Pareto } from "./ferramentas/pareto";
import { CincoPorques } from "./ferramentas/cinco-porques";
import { CincoWDoisH } from "./ferramentas/cinco-w-dois-h";
import { Swot } from "./ferramentas/swot";

const TOOLS = [
  { key: "ishikawa", label: "Ishikawa", icon: Fish, Component: Ishikawa },
  { key: "pareto", label: "Pareto", icon: BarChart3, Component: Pareto },
  { key: "5porques", label: "5 Porquês", icon: HelpCircle, Component: CincoPorques },
  { key: "5w2h", label: "5W2H", icon: ClipboardList, Component: CincoWDoisH },
  { key: "swot", label: "SWOT", icon: LayoutGrid, Component: Swot },
] as const;

export function FerramentasGestao() {
  const [active, setActive] = useState<(typeof TOOLS)[number]["key"]>("ishikawa");
  const Current = TOOLS.find((t) => t.key === active)!.Component;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      <Card className="p-2 h-fit">
        <nav className="flex md:flex-col gap-1">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <Button
                key={t.key}
                variant={isActive ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActive(t.key)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {t.label}
              </Button>
            );
          })}
        </nav>
      </Card>
      <div>
        <Current />
      </div>
    </div>
  );
}
