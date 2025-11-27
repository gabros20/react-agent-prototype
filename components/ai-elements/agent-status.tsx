'use client';

import {
  BrainIcon,
  SearchIcon,
  GlobeIcon,
  PenLineIcon,
  PencilIcon,
  FileSearchIcon,
  DownloadIcon,
  Trash2Icon,
  ImageIcon,
  NavigationIcon,
  LayoutListIcon,
  WrenchIcon,
} from 'lucide-react';
import { useChatStore } from '@/app/assistant/_stores/chat-store';
import { cn } from '@/lib/utils';
import { Shimmer } from './shimmer';
import { AnimatePresence, motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

type StatusConfig = {
  icon: LucideIcon;
  label: string;
};

function getStatusConfig(toolName?: string): StatusConfig {
  if (!toolName) {
    return { icon: BrainIcon, label: 'Thinking...' };
  }

  // Web research tools
  if (toolName.startsWith('web_')) {
    return { icon: GlobeIcon, label: 'Researching the web...' };
  }

  // Search tools
  if (toolName.startsWith('search_') || toolName.includes('find') || toolName.includes('search')) {
    return { icon: SearchIcon, label: 'Searching...' };
  }

  // Image tools
  if (toolName.includes('image') || toolName.includes('Image') || toolName.startsWith('pexels_')) {
    if (toolName.includes('delete')) {
      return { icon: Trash2Icon, label: 'Removing image...' };
    }
    if (toolName.includes('download')) {
      return { icon: DownloadIcon, label: 'Downloading image...' };
    }
    return { icon: ImageIcon, label: 'Working with images...' };
  }

  // Navigation tools
  if (toolName.includes('navigation') || toolName.includes('Navigation')) {
    return { icon: NavigationIcon, label: 'Updating navigation...' };
  }

  // CMS CRUD operations
  if (toolName.startsWith('cms_create') || toolName.includes('create')) {
    return { icon: PenLineIcon, label: 'Creating content...' };
  }
  if (toolName.startsWith('cms_update') || toolName.startsWith('cms_sync') || toolName.includes('update')) {
    return { icon: PencilIcon, label: 'Updating content...' };
  }
  if (toolName.startsWith('cms_delete') || toolName.includes('delete')) {
    return { icon: Trash2Icon, label: 'Preparing to delete...' };
  }
  if (toolName.startsWith('cms_get') || toolName.startsWith('cms_list')) {
    return { icon: FileSearchIcon, label: 'Reading data...' };
  }

  // Section tools
  if (toolName.includes('Section') || toolName.includes('section')) {
    return { icon: LayoutListIcon, label: 'Working with sections...' };
  }

  // Fallback for unknown tools
  return { icon: WrenchIcon, label: 'Processing...' };
}

export interface AgentStatusIndicatorProps {
  className?: string;
}

export function AgentStatusIndicator({ className }: AgentStatusIndicatorProps) {
  const agentStatus = useChatStore((state) => state.agentStatus);
  const isStreaming = useChatStore((state) => state.isStreaming);

  const isVisible = isStreaming && agentStatus;
  const { icon: Icon, label } = getStatusConfig(
    agentStatus?.state === 'tool-call' ? agentStatus.toolName : undefined
  );

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn('flex items-center gap-2 py-4 px-4', className)}
        >
          <div className="flex items-center gap-2 text-primary text-sm">
            <Icon className="size-4" />
            <Shimmer duration={1} className="text-primary">{label}</Shimmer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
