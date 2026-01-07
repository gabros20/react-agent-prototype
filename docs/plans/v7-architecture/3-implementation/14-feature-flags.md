# Feature Flags

> **Summary**: V7 introduces feature flags for incremental rollout. The system can run in MVP mode (no orchestration), full production mode, or emergency rollback mode via SystemConfig.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md)

## Overview

Feature flags enable:
- **Incremental rollout**: Ship MVP without orchestration, add later
- **Emergency rollback**: Disable complex features if issues arise
- **A/B testing**: Test new agent behaviors with subset of users

---

## SystemConfig Interface

```typescript
interface SystemConfig {
  features: {
    // Core routing
    routerEnabled: boolean;           // false = bypass router, direct to default specialist
    complexityAssessment: boolean;    // false = skip complexity check, all tasks are "simple"

    // Orchestration
    orchestrationEnabled: boolean;    // false = complex tasks still go to single specialist
    parallelSpawning: boolean;        // false = always sequential
    freshContextMode: boolean;        // false = always inherit context

    // Future
    visualBuilderEnabled: boolean;    // Visual agent builder UI
  };

  defaults: {
    simpleSpecialist: string;         // Fallback specialist for simple tasks
    complexHandler: string;           // 'orchestrator' when enabled, fallback when not
  };
}
```

---

## Configuration Presets

### MVP Configuration (Ship Fast)

```typescript
const mvpConfig: SystemConfig = {
  features: {
    routerEnabled: true,
    complexityAssessment: false,      // All tasks are "simple"
    orchestrationEnabled: false,       // No orchestrator yet
    parallelSpawning: false,
    freshContextMode: false,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'qa_specialist',   // Fallback when orchestration disabled
  },
};
```

**In MVP mode**:
- Router classifies intent only (not complexity)
- All tasks go directly to specialists
- No orchestrator spawning
- Ships faster, less risk

### Full Configuration (Production)

```typescript
const fullConfig: SystemConfig = {
  features: {
    routerEnabled: true,
    complexityAssessment: true,
    orchestrationEnabled: true,
    parallelSpawning: true,
    freshContextMode: true,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'orchestrator',
  },
};
```

**In full mode**:
- Full 3-level architecture active
- Router assesses complexity
- Complex tasks go to orchestrator
- Parallel spawning enabled

### Emergency Rollback Configuration

```typescript
const rollbackConfig: SystemConfig = {
  features: {
    routerEnabled: false,              // Bypass router entirely
    complexityAssessment: false,
    orchestrationEnabled: false,
    parallelSpawning: false,
    freshContextMode: false,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'qa_specialist',
  },
};
```

**In rollback mode**:
- Reduces to single-agent mode
- All requests go to `qa_specialist`
- Useful for debugging production issues

---

## Runtime Feature Checks

```typescript
class SessionOrchestrator {
  async handleMessage(sessionId: string, message: string) {
    const config = this.systemConfig;

    // Feature: Router
    if (!config.features.routerEnabled) {
      return this.runSpecialist(
        sessionId,
        config.defaults.simpleSpecialist,
        message
      );
    }

    const routerResult = await this.routerService.classify(message);

    // Feature: Complexity assessment
    if (!config.features.complexityAssessment) {
      routerResult.complexity = 'simple';
    }

    // Route based on complexity
    if (routerResult.complexity === 'simple') {
      return this.runSpecialist(
        sessionId,
        routerResult.targetAgent,
        message
      );
    }

    // Feature: Orchestration
    if (!config.features.orchestrationEnabled) {
      // Complex task but orchestration disabled - fallback to specialist
      return this.runSpecialist(
        sessionId,
        config.defaults.complexHandler,
        message
      );
    }

    return this.runOrchestrator(sessionId, message, routerResult.intent);
  }
}
```

---

## Feature Check for Spawning

```typescript
async spawnSpecialists(subtasks: Subtask[]): Promise<SpecialistResult[]> {
  const config = this.systemConfig;

  // Feature: Parallel spawning
  if (!config.features.parallelSpawning) {
    // Sequential execution only
    const results = [];
    for (const subtask of subtasks) {
      results.push(await this.spawnSingle(subtask, 'inherited'));
    }
    return results;
  }

  // Feature: Fresh context mode
  const independentMode = config.features.freshContextMode ? 'fresh' : 'inherited';

  const { parallel, sequential } = this.groupByDependency(subtasks);

  // Parallel execution for independent tasks
  const parallelResults = await Promise.all(
    parallel.map(s => this.spawnSingle(s, independentMode))
  );

  // Sequential for dependent tasks
  const sequentialResults = [];
  for (const subtask of sequential) {
    sequentialResults.push(
      await this.spawnSingle(subtask, 'selective', parallelResults)
    );
  }

  return [...parallelResults, ...sequentialResults];
}
```

---

## Configuration Storage

Feature flags are stored in the database and loaded at startup:

```typescript
// Internal CMS Server
const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Load at startup
class ConfigService {
  private config: SystemConfig;

  async load(): Promise<void> {
    const row = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'system_config'),
    });
    this.config = row?.value ?? defaultConfig;
  }

  get(): SystemConfig {
    return this.config;
  }

  async update(config: Partial<SystemConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await db.update(systemSettings)
      .set({ value: this.config, updatedAt: new Date() })
      .where(eq(systemSettings.key, 'system_config'));
  }
}
```

---

## Admin API

```typescript
// api/admin.controller.ts
@Get('/config')
async getConfig() {
  return this.configService.get();
}

@Patch('/config')
async updateConfig(@Body() update: Partial<SystemConfig>) {
  await this.configService.update(update);
  return this.configService.get();
}

@Post('/config/preset/:preset')
async applyPreset(@Param('preset') preset: 'mvp' | 'full' | 'rollback') {
  const presets = {
    mvp: mvpConfig,
    full: fullConfig,
    rollback: rollbackConfig,
  };
  await this.configService.update(presets[preset]);
  return this.configService.get();
}
```

---

## Rollout Strategy

### Phase 1: MVP (Week 1-4)

```typescript
features: {
  routerEnabled: true,
  complexityAssessment: false,
  orchestrationEnabled: false,
}
```

- Ship with single-agent mode
- Router classifies intent only
- All tasks go to appropriate specialist

### Phase 2: Complexity (Week 5-6)

```typescript
features: {
  routerEnabled: true,
  complexityAssessment: true,  // ← Enable
  orchestrationEnabled: false,
}
```

- Router now assesses complexity
- Complex tasks still go to specialist (fallback)
- Monitor complexity classification accuracy

### Phase 3: Orchestration (Week 7-8)

```typescript
features: {
  routerEnabled: true,
  complexityAssessment: true,
  orchestrationEnabled: true,  // ← Enable
  parallelSpawning: false,     // Start sequential
}
```

- Enable orchestrator for complex tasks
- Sequential spawning first (safer)
- Monitor orchestration success rate

### Phase 4: Full Production (Week 9+)

```typescript
features: {
  routerEnabled: true,
  complexityAssessment: true,
  orchestrationEnabled: true,
  parallelSpawning: true,      // ← Enable
  freshContextMode: true,      // ← Enable
}
```

- Enable parallel spawning
- Enable fresh context mode
- Full V7 architecture active

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Feature flags in DB | Persist across restarts, admin-editable |
| Preset configurations | Quick rollback without code deploy |
| Incremental rollout | Reduce risk, validate each feature |
| Runtime checks | No restart needed to change behavior |

---

## Related Documents

- → [../00-overview.md](../00-overview.md) - System architecture
- → [../2-agents/08-agent-model.md](../2-agents/08-agent-model.md) - Agent types affected
- → [15-implementation-stages.md](15-implementation-stages.md) - Rollout timeline
