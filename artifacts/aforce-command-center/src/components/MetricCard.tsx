import React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  sourceNote: string;
  proxy?: boolean;
  isEmpty?: boolean;
  emptyReason?: string;
  trend?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  subtitle,
  sourceNote,
  proxy,
  isEmpty,
  emptyReason,
  trend,
}: MetricCardProps) {
  return (
    <div className="relative flex flex-col p-6 bg-card border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {title}
          </h3>
          {proxy && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary bg-primary/10 border border-primary/20 rounded uppercase">
              Proxy
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[250px] bg-popover text-popover-foreground border-border text-xs leading-relaxed p-3">
            {sourceNote}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        {isEmpty ? (
          <div className="py-4">
            <span className="text-sm text-muted-foreground">Awaiting data: {emptyReason}</span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {value}
              </span>
              {trend && <div className="text-sm font-medium">{trend}</div>}
            </div>
            {subtitle && (
              <div className="mt-2 text-sm text-muted-foreground">
                {subtitle}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Subtle radial glow effect */}
      <div className="absolute -inset-px bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
    </div>
  );
}
