import React from "react";
import { AlertCircle } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-card/30 border border-white/5 rounded-2xl">
      <div className="mb-4 text-muted-foreground">
        {icon || <AlertCircle className="w-8 h-8 opacity-50" />}
      </div>
      <h3 className="text-sm font-medium tracking-wide uppercase text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {message}
      </p>
    </div>
  );
}
