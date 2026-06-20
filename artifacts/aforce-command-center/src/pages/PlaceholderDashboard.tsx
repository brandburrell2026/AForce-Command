import { EmptyState } from "@/components/EmptyState";
import { Pickaxe } from "lucide-react";

interface PlaceholderDashboardProps {
  title: string;
}

export default function PlaceholderDashboard({ title }: PlaceholderDashboardProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2">
          Subsystem telemetry
        </p>
      </div>
      
      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
          <EmptyState
            title="Instrumentation Pending"
            message={`${title} metrics are not yet instrumented — arriving in a later increment.`}
            icon={<Pickaxe className="w-12 h-12 opacity-40 text-primary" />}
          />
        </div>
      </div>
    </div>
  );
}
