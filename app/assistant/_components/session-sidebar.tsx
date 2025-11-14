'use client';

import { useEffect, useState } from 'react';
import { Plus, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useSessionStore } from '../_stores/session-store';
import { useChatStore } from '../_stores/chat-store';
import { SessionItem } from './session-item';

export function SessionSidebar() {
  const { sessions, currentSessionId, isLoading, loadSessions, createSession } = useSessionStore();
  const { setSessionId, setMessages } = useChatStore();
  const [open, setOpen] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleNewSession = async () => {
    try {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
      setMessages([]); // Clear messages in chat store
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Trigger Button */}
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="transition-all duration-200 hover:scale-105">
          <div className="transition-transform duration-200">
            {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </div>
          <span className="sr-only">Toggle session sidebar</span>
        </Button>
      </SheetTrigger>

      {/* Sheet Content - Slides from left */}
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle>Chat Sessions</SheetTitle>
            <SheetDescription>Manage your conversation history</SheetDescription>
          </SheetHeader>

          {/* New Session Button */}
          <div className="border-b p-4">
            <Button onClick={handleNewSession} className="w-full" disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </div>

          {/* Session List */}
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {sessions.length === 0 && !isLoading && (
                <div className="animate-in fade-in-50 duration-300 py-8 text-center text-sm text-muted-foreground">
                  No sessions yet.
                  <br />
                  Click "New Session" to start.
                </div>
              )}

              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="animate-in fade-in-50 slide-in-from-left-5 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <SessionItem
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSessionLoad={() => setOpen(false)} // Close sheet when session is loaded
                  />
                </div>
              ))}

              {isLoading && (
                <div className="animate-pulse py-4 text-center text-sm text-muted-foreground">
                  Loading sessions...
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
