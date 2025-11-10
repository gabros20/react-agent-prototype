'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AgentMode } from '../_hooks/use-agent';

interface ModeSelectorProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
}

const MODE_DESCRIPTIONS = {
  architect: 'Planning & validation (read-only)',
  'cms-crud': 'Full CMS operations',
  debug: 'Error analysis & fixes',
  ask: 'CMS state inspection'
};

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={(value) => onModeChange(value as AgentMode)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="architect">Architect</TabsTrigger>
          <TabsTrigger value="cms-crud">CMS CRUD</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
          <TabsTrigger value="ask">Ask</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-xs text-muted-foreground text-center">
        {MODE_DESCRIPTIONS[mode]}
      </p>
    </div>
  );
}
