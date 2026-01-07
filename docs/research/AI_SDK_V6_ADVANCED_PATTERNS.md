# AI SDK V6 Advanced Patterns Research

**Research Date:** 2026-01-05
**AI SDK Version:** 6.0
**Target Frameworks:** Next.js 15, NestJS

## Table of Contents

1. [What's New in V6 vs V5](#whats-new-in-v6-vs-v5)
2. [ToolLoopAgent Advanced Patterns](#toolloopagent-advanced-patterns)
3. [Dynamic Tool Injection with prepareCall](#dynamic-tool-injection-with-preparecall)
4. [Runtime Configuration with callOptionsSchema](#runtime-configuration-with-calloptions)
5. [Multi-Agent Coordination Patterns](#multi-agent-coordination-patterns)
6. [Streaming & Real-Time Features](#streaming--real-time-features)
7. [Model Context Protocol (MCP) Integration](#model-context-protocol-mcp-integration)
8. [Human-in-the-Loop (HITL) Tool Approval](#human-in-the-loop-hitl-tool-approval)
9. [Structured Output Generation](#structured-output-generation)
10. [Multimodal Capabilities](#multimodal-capabilities)
11. [Production Patterns](#production-patterns)
12. [Next.js 15 Integration Patterns](#nextjs-15-integration-patterns)
13. [Self-Improving Agent Patterns](#self-improving-agent-patterns)
14. [Code Examples Library](#code-examples-library)

---

## What's New in V6 vs V5

### Breaking Changes Summary

AI SDK v6 is designed with **minimal breaking changes** unlike the v4→v5 transition. Most users can migrate automatically:

```bash
npx @ai-sdk/codemod v6
```

### Major New Features

1. **Agent Abstraction**
   - Introduced `ToolLoopAgent` class (replaces `Experimental_Agent`)
   - Define once, use everywhere pattern
   - Automatic integration with AI SDK ecosystem
   - Type-safe UI streaming and structured outputs

2. **Full MCP Support** (Stable)
   - OAuth authentication
   - Resources and prompts
   - Server-initiated elicitation requests
   - Available in `@ai-sdk/mcp` package

3. **Tool Approval (HITL)**
   - Human-in-the-loop for sensitive operations
   - Omit `execute` function for manual approval
   - Selective approval logic with `needsApproval`

4. **Unified Structured Output**
   - `generateObject` and `streamObject` deprecated
   - Use `generateText`/`streamText` with `output` property
   - Combine tool calling + structured output in single request

5. **DevTools**
   - Web-based debugging UI at `http://localhost:4983`
   - Full visibility into LLM calls, tool executions, multi-step interactions
   - OpenTelemetry integration

6. **Enhanced Type Safety**
   - `callOptionsSchema` enforces type-checking
   - `InferAgentUIMessage<T>` for UI integration
   - End-to-end type safety from agent to frontend

### Key Differences from V5

```typescript
// ❌ V5 Pattern
const agent = new Experimental_Agent({
  system: 'You are helpful',
  stopWhen: stepCountIs(1)
});

const result = await generateObject({
  schema: z.object({ name: z.string() }),
  prompt: '...'
});

// ✅ V6 Pattern
const agent = new ToolLoopAgent({
  instructions: 'You are helpful', // renamed from 'system'
  stopWhen: stepCountIs(20) // new default
});

const result = await generateText({
  output: Output.object({
    schema: z.object({ name: z.string() })
  }),
  prompt: '...'
});
```

---

## ToolLoopAgent Advanced Patterns

### Core Architecture

`ToolLoopAgent` implements a production-ready reasoning-and-acting (ReAct) loop:

```typescript
import { ToolLoopAgent, tool, Output } from 'ai';
import { z } from 'zod';

const researchAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: `You are a research assistant.
    - Start broad, then narrow focus
    - Cross-reference multiple sources
    - Cite all information
    - Flag contradictions`,

  tools: {
    webSearch: tool({
      description: 'Search the web for information',
      inputSchema: z.object({
        query: z.string(),
        numResults: z.number().default(5)
      }),
      execute: async ({ query, numResults }) => {
        // Implementation
        return { results: [] };
      }
    }),

    readDocument: tool({
      description: 'Read content from a URL',
      inputSchema: z.object({
        url: z.string().url()
      }),
      execute: async ({ url }) => {
        // Implementation
        return { content: '' };
      }
    })
  },

  // Loop control
  stopWhen: [
    stepCountIs(30), // max 30 reasoning steps
    customStopCondition()
  ],

  // Structured output
  output: Output.object({
    schema: z.object({
      findings: z.array(z.object({
        claim: z.string(),
        sources: z.array(z.string().url()),
        confidence: z.enum(['high', 'medium', 'low'])
      })),
      summary: z.string(),
      contradictions: z.array(z.string()).optional()
    })
  })
});
```

### Loop Control Strategies

**1. Step Count Limits**
```typescript
stopWhen: stepCountIs(20) // Default in v6
```

**2. Custom Stop Conditions**
```typescript
import { StopCondition } from 'ai';

const customStopCondition = (): StopCondition => ({
  check: ({ steps }) => {
    const toolCalls = steps.filter(s => s.toolCalls?.length > 0);
    return toolCalls.length >= 5; // Stop after 5 tool executions
  }
});
```

**3. Combined Conditions**
```typescript
stopWhen: [
  stepCountIs(50),
  budgetExceeded(100), // Custom cost limit
  timeExceeded(30000), // 30 second timeout
]
```

### Tool Choice Patterns

**Force Tool Usage**
```typescript
const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  toolChoice: 'required', // Must use tools
  tools: { /* ... */ }
});
```

**Specific Tool Selection**
```typescript
toolChoice: { type: 'tool', toolName: 'weatherAPI' }
```

**Disable Tools Temporarily**
```typescript
const result = await agent.generate({
  prompt: 'Summarize this',
  toolChoice: 'none' // Override agent's tools
});
```

### Multi-Step Tool Sequences

Configure agents to execute tool chains before generating final output:

```typescript
const codeAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'You implement features step-by-step',

  tools: {
    analyzeRequirements: tool({
      description: 'Break down feature requirements',
      inputSchema: z.object({ feature: z.string() }),
      execute: async ({ feature }) => ({
        tasks: ['Create component', 'Add tests', 'Update docs']
      })
    }),

    readFile: tool({
      description: 'Read existing file content',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => ({ content: '' })
    }),

    writeCode: tool({
      description: 'Write or modify code',
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
        operation: z.enum(['create', 'modify'])
      }),
      execute: async (input) => ({ success: true })
    }),

    runTests: tool({
      description: 'Execute test suite',
      inputSchema: z.object({ testPath: z.string() }),
      execute: async ({ testPath }) => ({
        passed: true,
        coverage: 95
      })
    })
  },

  stopWhen: stepCountIs(20)
});

// Agent will chain tools:
// 1. analyzeRequirements()
// 2. readFile() for context
// 3. writeCode() to implement
// 4. runTests() to verify
// 5. Generate summary text
```

---

## Dynamic Tool Injection with prepareCall

### Core Pattern

`prepareCall` enables **runtime agent customization** before each execution:

```typescript
const flexibleAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Base instructions',

  prepareCall: ({ options, ...settings }) => {
    // Return modified settings
    return {
      ...settings,
      // Any setting can be modified here
      model: selectModel(options),
      instructions: enhanceInstructions(settings.instructions, options),
      tools: injectTools(options),
      activeTools: filterTools(options.userRole),
      providerOptions: configureProvider(options)
    };
  }
});
```

### Async prepareCall for RAG

**Fetch context before generation:**

```typescript
import { createClient } from '@supabase/supabase-js';

const ragAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    query: z.string(),
    userId: z.string(),
    maxDocuments: z.number().default(5)
  }),

  instructions: 'Answer questions using provided context.',

  prepareCall: async ({ options, ...settings }) => {
    // Vector search
    const { data: documents } = await supabase.rpc('match_documents', {
      query_embedding: await embedQuery(options.query),
      match_count: options.maxDocuments,
      filter: { user_id: options.userId }
    });

    // Inject context
    const contextPrompt = documents
      .map((doc, i) => `[${i + 1}] ${doc.content}`)
      .join('\n\n');

    return {
      ...settings,
      instructions: settings.instructions +
        `\n\nRelevant context:\n${contextPrompt}\n\n` +
        `Cite sources using [1], [2] format.`
    };
  }
});

// Usage
const result = await ragAgent.generate({
  prompt: 'What are the deployment procedures?',
  options: {
    query: 'deployment procedures',
    userId: 'user_123',
    maxDocuments: 3
  }
});
```

### Dynamic Model Selection

**Complexity-based routing:**

```typescript
const routingAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o-mini', // Default

  callOptionsSchema: z.object({
    complexity: z.enum(['simple', 'medium', 'complex']),
    budget: z.enum(['low', 'high'])
  }),

  prepareCall: ({ options, ...settings }) => {
    const modelMap = {
      simple: 'openai/gpt-4o-mini',
      medium: 'anthropic/claude-sonnet-4.5',
      complex: options.budget === 'high'
        ? 'openai/o1-mini'
        : 'anthropic/claude-sonnet-4.5'
    };

    return {
      ...settings,
      model: modelMap[options.complexity]
    };
  }
});
```

### Tool Configuration Per Request

**Location-aware tools:**

```typescript
const searchAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    userCity: z.string(),
    userRegion: z.string(),
    userCountry: z.string()
  }),

  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    tools: {
      webSearch: openai.tools.webSearch({
        userLocation: {
          city: options.userCity,
          region: options.userRegion,
          country: options.userCountry
        }
      }),
      localEvents: tool({
        description: `Find events in ${options.userCity}`,
        inputSchema: z.object({ category: z.string() }),
        execute: async ({ category }) => {
          // Use location from closure
          return fetchEvents(options.userCity, category);
        }
      })
    }
  })
});
```

### Active Tools Filtering

**Role-based tool access:**

```typescript
const adminAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    userRole: z.enum(['viewer', 'editor', 'admin']),
    permissions: z.array(z.string())
  }),

  tools: {
    readDatabase: tool({ /* ... */ }),
    writeDatabase: tool({ /* ... */ }),
    deleteRecords: tool({ /* ... */ }),
    exportData: tool({ /* ... */ })
  },

  prepareCall: ({ options, ...settings }) => {
    const toolPermissions = {
      viewer: ['readDatabase'],
      editor: ['readDatabase', 'writeDatabase'],
      admin: ['readDatabase', 'writeDatabase', 'deleteRecords', 'exportData']
    };

    return {
      ...settings,
      activeTools: toolPermissions[options.userRole].filter(
        tool => options.permissions.includes(tool)
      )
    };
  }
});
```

### Provider-Specific Configuration

**Dynamic reasoning effort:**

```typescript
const reasoningAgent = new ToolLoopAgent({
  model: 'openai/o1-mini',

  callOptionsSchema: z.object({
    taskDifficulty: z.enum(['low', 'medium', 'high'])
  }),

  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    providerOptions: {
      openai: {
        reasoningEffort: {
          low: 'low',
          medium: 'medium',
          high: 'high'
        }[options.taskDifficulty]
      }
    }
  })
});
```

---

## Runtime Configuration with callOptionsSchema

### Type-Safe Options

Define schemas to enforce type checking:

```typescript
const supportAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(['free', 'pro', 'enterprise']),
    subscriptionDate: z.date(),
    supportTier: z.number().min(1).max(3),
    preferredLanguage: z.string().default('en')
  }),

  instructions: 'You are a customer support agent.',

  prepareCall: ({ options, ...settings }) => {
    const tierMapping = {
      1: 'basic',
      2: 'priority',
      3: 'premium'
    };

    return {
      ...settings,
      instructions: settings.instructions +
        `\n\nUser Profile:
        - Account: ${options.accountType}
        - Support Level: ${tierMapping[options.supportTier]}
        - Member Since: ${options.subscriptionDate.toLocaleDateString()}
        - Language: ${options.preferredLanguage}

        ${options.accountType === 'enterprise'
          ? 'Provide detailed technical explanations and escalation options.'
          : 'Keep responses concise and user-friendly.'
        }`
    };
  }
});

// Usage - TypeScript enforces schema
const result = await supportAgent.generate({
  prompt: 'How do I upgrade my plan?',
  options: {
    userId: 'user_456',
    accountType: 'pro',
    subscriptionDate: new Date('2025-01-01'),
    supportTier: 2,
    preferredLanguage: 'en'
  }
});

// ❌ TypeScript error - missing required fields
// await supportAgent.generate({ prompt: 'Help' });

// ❌ TypeScript error - wrong type
// options: { accountType: 'invalid' }
```

### Session Context Injection

**User preferences and history:**

```typescript
interface SessionContext {
  sessionId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  userPreferences: {
    verbosity: 'concise' | 'detailed';
    tone: 'professional' | 'casual';
    codeStyle: 'functional' | 'oop';
  };
  recentActions: string[];
}

const sessionAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    session: z.custom<SessionContext>()
  }),

  prepareCall: async ({ options, ...settings }) => {
    const { session } = options;

    // Analyze recent conversation
    const topicSummary = await summarizeConversation(
      session.conversationHistory
    );

    return {
      ...settings,
      instructions: settings.instructions +
        `\n\nSession Context:
        - Current Topic: ${topicSummary}
        - User Preferences: ${session.userPreferences.verbosity} responses, ${session.userPreferences.tone} tone
        - Coding Style: Prefer ${session.userPreferences.codeStyle}
        - Recent Actions: ${session.recentActions.slice(-3).join(', ')}

        Maintain consistency with the ongoing conversation.`
    };
  }
});
```

### Feature Flags & A/B Testing

**Conditional feature enablement:**

```typescript
const experimentalAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    featureFlags: z.object({
      enableAdvancedReasoning: z.boolean(),
      enableImageGeneration: z.boolean(),
      enableCodeExecution: z.boolean()
    }),
    experimentGroup: z.enum(['control', 'variant_a', 'variant_b'])
  }),

  tools: {
    // Standard tools
    webSearch: tool({ /* ... */ }),

    // Experimental tools
    imageGen: tool({ /* ... */ }),
    codeRunner: tool({ /* ... */ })
  },

  prepareCall: ({ options, ...settings }) => {
    const activeTools = ['webSearch'];

    if (options.featureFlags.enableImageGeneration) {
      activeTools.push('imageGen');
    }

    if (options.featureFlags.enableCodeExecution) {
      activeTools.push('codeRunner');
    }

    // A/B testing instructions
    const experimentInstructions = {
      control: 'Standard behavior',
      variant_a: 'Be more verbose and explanatory',
      variant_b: 'Be concise and action-oriented'
    };

    return {
      ...settings,
      activeTools,
      model: options.featureFlags.enableAdvancedReasoning
        ? 'openai/o1-mini'
        : settings.model,
      instructions: settings.instructions +
        `\n${experimentInstructions[options.experimentGroup]}`
    };
  }
});
```

---

## Multi-Agent Coordination Patterns

### 1. Orchestrator-Worker Pattern

**Primary agent coordinates specialized workers:**

```typescript
import { ToolLoopAgent, generateObject } from 'ai';
import { z } from 'zod';

// Orchestrator: Plans and coordinates
const orchestrator = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: `You are a senior software architect.
    Analyze feature requests and create implementation plans.
    Break down work into specialized tasks.`,

  output: Output.object({
    schema: z.object({
      files: z.array(z.object({
        path: z.string(),
        changeType: z.enum(['create', 'modify', 'delete']),
        complexity: z.enum(['simple', 'medium', 'complex']),
        description: z.string()
      })),
      overallComplexity: z.enum(['low', 'medium', 'high']),
      estimatedTime: z.number()
    })
  })
});

// Specialized Workers
const workers = {
  create: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: 'Expert at creating new files from specifications.',
    tools: {
      createFile: tool({ /* ... */ }),
      validateSyntax: tool({ /* ... */ })
    }
  }),

  modify: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: 'Expert at modifying existing code safely.',
    tools: {
      readFile: tool({ /* ... */ }),
      applyDiff: tool({ /* ... */ }),
      preserveTests: tool({ /* ... */ })
    }
  }),

  delete: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: 'Expert at safely removing code and updating references.',
    tools: {
      findReferences: tool({ /* ... */ }),
      removeCode: tool({ /* ... */ }),
      updateImports: tool({ /* ... */ })
    }
  })
};

// Orchestration Logic
async function implementFeature(featureRequest: string) {
  // 1. Orchestrator creates plan
  const { object: plan } = await orchestrator.generate({
    prompt: featureRequest
  });

  // 2. Workers execute in parallel
  const results = await Promise.all(
    plan.files.map(async (file) => {
      const worker = workers[file.changeType];

      return worker.generate({
        prompt: `${file.changeType} ${file.path}: ${file.description}`,
        options: { complexity: file.complexity }
      });
    })
  );

  // 3. Aggregate results
  return {
    plan,
    implementations: results.map(r => r.text),
    success: results.every(r => !r.error)
  };
}

// Usage
const result = await implementFeature(
  'Add user authentication with OAuth and session management'
);
```

### 2. Parallel Processing Pattern

**Independent specialized agents run concurrently:**

```typescript
const reviewers = {
  security: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: `Expert in code security.
      - Identify vulnerabilities (SQL injection, XSS, CSRF)
      - Check authentication/authorization
      - Review sensitive data handling`,

    output: Output.object({
      schema: z.object({
        vulnerabilities: z.array(z.object({
          severity: z.enum(['critical', 'high', 'medium', 'low']),
          location: z.string(),
          description: z.string(),
          fix: z.string()
        })),
        score: z.number().min(0).max(100)
      })
    })
  }),

  performance: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: `Expert in performance optimization.
      - Identify bottlenecks
      - Analyze algorithmic complexity
      - Review database queries`,

    output: Output.object({
      schema: z.object({
        issues: z.array(z.object({
          type: z.enum(['algorithm', 'database', 'network', 'memory']),
          impact: z.enum(['high', 'medium', 'low']),
          location: z.string(),
          suggestion: z.string()
        })),
        score: z.number().min(0).max(100)
      })
    })
  }),

  maintainability: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: `Expert in code quality.
      - Check code complexity
      - Review naming conventions
      - Assess test coverage`,

    output: Output.object({
      schema: z.object({
        metrics: z.object({
          complexity: z.number(),
          duplication: z.number(),
          testCoverage: z.number()
        }),
        recommendations: z.array(z.string()),
        score: z.number().min(0).max(100)
      })
    })
  })
};

async function comprehensiveCodeReview(code: string) {
  // Run all reviews in parallel
  const [security, performance, maintainability] = await Promise.all([
    reviewers.security.generate({ prompt: code }),
    reviewers.performance.generate({ prompt: code }),
    reviewers.maintainability.generate({ prompt: code })
  ]);

  return {
    security: security.object,
    performance: performance.object,
    maintainability: maintainability.object,
    overallScore: (
      security.object.score +
      performance.object.score +
      maintainability.object.score
    ) / 3
  };
}
```

### 3. Routing Pattern

**Classify first, then route to specialized agent:**

```typescript
const classifier = new ToolLoopAgent({
  model: 'openai/gpt-4o-mini', // Fast, cheap classifier
  instructions: 'Classify customer support requests.',

  output: Output.object({
    schema: z.object({
      category: z.enum(['general', 'billing', 'technical', 'refund']),
      complexity: z.enum(['simple', 'complex']),
      urgency: z.enum(['low', 'medium', 'high']),
      sentiment: z.enum(['positive', 'neutral', 'negative'])
    })
  })
});

const specialists = {
  general: new ToolLoopAgent({
    model: 'openai/gpt-4o-mini',
    instructions: 'Handle general inquiries with friendly tone.'
  }),

  billing: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: 'Billing specialist. Access invoices and payment history.',
    tools: {
      getInvoices: tool({ /* ... */ }),
      processRefund: tool({ /* ... */ })
    }
  }),

  technical: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: 'Technical support. Debug issues and provide solutions.',
    tools: {
      checkLogs: tool({ /* ... */ }),
      runDiagnostics: tool({ /* ... */ })
    }
  }),

  refund: new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: 'Process refunds following company policy.',
    tools: {
      validateRefund: tool({ /* ... */ }),
      issueRefund: tool({ /* ... */ })
    }
  })
};

async function handleSupportRequest(message: string) {
  // 1. Classify
  const { object: classification } = await classifier.generate({
    prompt: message
  });

  // 2. Route to specialist
  const specialist = specialists[classification.category];

  // 3. Select model based on complexity
  const result = await specialist.generate({
    prompt: message,
    // Override model for complex cases
    ...(classification.complexity === 'complex' && {
      model: 'openai/o1-mini'
    })
  });

  return {
    classification,
    response: result.text
  };
}
```

### 4. Evaluator-Optimizer Pattern

**Iterative improvement with dedicated evaluator:**

```typescript
const translator = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Translate text while preserving tone and cultural context.'
});

const evaluator = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: `Expert translation evaluator.
    Rate translations on:
    - Accuracy
    - Cultural appropriateness
    - Tone preservation
    Provide specific improvement suggestions.`,

  output: Output.object({
    schema: z.object({
      qualityScore: z.number().min(0).max(10),
      accuracy: z.boolean(),
      culturallyAccurate: z.boolean(),
      preservesTone: z.boolean(),
      issues: z.array(z.string()),
      improvementSuggestions: z.array(z.string())
    })
  })
});

async function improvedTranslation(
  text: string,
  targetLanguage: string,
  maxIterations = 3
) {
  let currentTranslation = '';
  let iteration = 0;

  while (iteration < maxIterations) {
    // Generate translation
    const { text: translation } = await translator.generate({
      prompt: iteration === 0
        ? `Translate to ${targetLanguage}: ${text}`
        : `Improve this translation based on feedback:\n\n${currentTranslation}\n\nFeedback: ${feedback}`
    });

    currentTranslation = translation;

    // Evaluate
    const { object: evaluation } = await evaluator.generate({
      prompt: `Original: ${text}\nTranslation: ${currentTranslation}\nTarget: ${targetLanguage}`
    });

    // Check quality threshold
    if (
      evaluation.qualityScore >= 8 &&
      evaluation.preservesTone &&
      evaluation.culturallyAccurate
    ) {
      return {
        translation: currentTranslation,
        iterations: iteration + 1,
        finalScore: evaluation.qualityScore
      };
    }

    // Prepare feedback for next iteration
    const feedback = evaluation.improvementSuggestions.join('\n');
    iteration++;
  }

  return {
    translation: currentTranslation,
    iterations: maxIterations,
    warning: 'Max iterations reached without meeting quality threshold'
  };
}
```

### 5. Hierarchical Multi-Agent System

**Nested orchestration for complex workflows:**

```typescript
// Top-level orchestrator
const projectManager = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Senior project manager coordinating development sprints.',

  output: Output.object({
    schema: z.object({
      phases: z.array(z.object({
        name: z.string(),
        assignedTeam: z.enum(['frontend', 'backend', 'qa']),
        tasks: z.array(z.string()),
        dependencies: z.array(z.string())
      }))
    })
  })
});

// Team-level orchestrators
const frontendLead = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Frontend team lead. Coordinate UI implementation.',
  tools: { /* frontend-specific tools */ }
});

const backendLead = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Backend team lead. Coordinate API and database work.',
  tools: { /* backend-specific tools */ }
});

const qaLead = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'QA lead. Plan testing strategy.',
  tools: { /* testing tools */ }
});

const teams = {
  frontend: frontendLead,
  backend: backendLead,
  qa: qaLead
};

async function executeProject(projectDescription: string) {
  // 1. Top-level planning
  const { object: plan } = await projectManager.generate({
    prompt: projectDescription
  });

  // 2. Execute phases respecting dependencies
  const results = [];
  const completed = new Set<string>();

  for (const phase of plan.phases) {
    // Wait for dependencies
    const dependenciesMet = phase.dependencies.every(d => completed.has(d));
    if (!dependenciesMet) {
      throw new Error(`Dependencies not met for phase: ${phase.name}`);
    }

    // Execute phase
    const teamLead = teams[phase.assignedTeam];
    const phaseResult = await teamLead.generate({
      prompt: `Execute phase: ${phase.name}\nTasks:\n${phase.tasks.join('\n')}`
    });

    results.push({
      phase: phase.name,
      team: phase.assignedTeam,
      output: phaseResult.text
    });

    completed.add(phase.name);
  }

  return { plan, results };
}
```

---

## Streaming & Real-Time Features

### streamText with Agents

**Stream agent responses for real-time UX:**

```typescript
import { ToolLoopAgent } from 'ai';

const chatAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Helpful chat assistant',
  tools: { /* ... */ }
});

// Streaming
const stream = chatAgent.stream({
  prompt: 'Tell me about quantum computing'
});

// Consume text stream
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

// Or consume full stream with metadata
for await (const part of stream.fullStream) {
  switch (part.type) {
    case 'text-delta':
      console.log('Text:', part.textDelta);
      break;
    case 'tool-call':
      console.log('Tool:', part.toolName, part.args);
      break;
    case 'tool-result':
      console.log('Result:', part.result);
      break;
  }
}
```

### Structured Output Streaming (V6 Unified API)

**Stream structured data as it's generated:**

```typescript
const analysisAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  output: Output.object({
    schema: z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      entities: z.array(z.object({
        name: z.string(),
        type: z.string()
      }))
    })
  })
});

// V6: Use streamText with output (NOT streamObject)
const stream = analysisAgent.stream({
  prompt: 'Analyze this article: ...'
});

// Stream partial objects
for await (const part of stream.fullStream) {
  if (part.type === 'object') {
    console.log('Partial object:', part.object);
    // { summary: "Partial summary...", keyPoints: [...], ... }
  }
}

// Get final result
const final = await stream.object;
console.log('Complete:', final);
```

### Backpressure & Performance

**AI SDK v6 uses backpressure** - tokens only generated when requested:

```typescript
// Efficient streaming
const stream = agent.stream({ prompt: '...' });

// Only generates tokens as consumed
for await (const chunk of stream.textStream) {
  await processChunk(chunk); // Backpressure applied here
}
```

### Callbacks for Monitoring

**onChunk and onFinish hooks:**

```typescript
const result = await agent.stream({
  prompt: 'Generate report',

  onChunk: ({ chunk }) => {
    // Called for each chunk
    logger.debug('Chunk received', { type: chunk.type });
  },

  onFinish: ({ text, usage, finishReason, steps }) => {
    // Called when complete
    logger.info('Stream finished', {
      length: text.length,
      tokens: usage.totalTokens,
      steps: steps.length,
      reason: finishReason
    });

    // Track metrics
    metrics.track('agent_completion', {
      model: agent.model,
      tokens: usage.totalTokens,
      duration: Date.now() - startTime
    });
  }
});
```

### Next.js 15 Streaming Integration

**Server Actions with streaming:**

```typescript
'use server';

import { createStreamableValue } from 'ai/rsc';

export async function streamAgentResponse(prompt: string) {
  const stream = createStreamableValue();

  (async () => {
    const agentStream = agent.stream({ prompt });

    for await (const chunk of agentStream.textStream) {
      stream.update(chunk);
    }

    stream.done();
  })();

  return stream.value;
}

// Client component
'use client';

import { readStreamableValue } from 'ai/rsc';

export default function Chat() {
  const [response, setResponse] = useState('');

  const handleSubmit = async (prompt: string) => {
    const stream = await streamAgentResponse(prompt);

    for await (const chunk of readStreamableValue(stream)) {
      setResponse(prev => prev + chunk);
    }
  };

  return <div>{response}</div>;
}
```

### Route Handlers with Streaming

**Edge-compatible streaming:**

```typescript
// app/api/agent/route.ts
import { createAgentUIStreamResponse } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createAgentUIStreamResponse({
    agent: myAgent,
    messages,

    onFinish: async ({ text, usage }) => {
      // Save to database
      await db.saveConversation({
        messages,
        response: text,
        tokens: usage.totalTokens
      });
    }
  });
}
```

---

## Model Context Protocol (MCP) Integration

### MCP Overview

MCP enables **standardized integration** with external tools and data sources.

### Production HTTP Transport

```typescript
import { createMCPClient } from '@ai-sdk/mcp';

const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://api.example.com/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.MCP_API_KEY}`,
      'X-Client-ID': process.env.CLIENT_ID
    }
  }
});
```

### OAuth Authentication

```typescript
import { createMCPClient } from '@ai-sdk/mcp';

const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://api.example.com/mcp',
    authProvider: {
      getAccessToken: async () => {
        // OAuth token refresh logic
        const token = await refreshOAuthToken();
        return token.accessToken;
      }
    }
  }
});
```

### Type-Safe Tool Discovery

**Explicit schema definition (recommended):**

```typescript
import { z } from 'zod';

const tools = await mcpClient.tools({
  schemas: {
    'search-database': {
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        filters: z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          category: z.array(z.string()).optional()
        }).optional(),
        limit: z.number().min(1).max(100).default(10)
      })
    },

    'update-record': {
      inputSchema: z.object({
        id: z.string().uuid(),
        data: z.record(z.unknown())
      })
    },

    'no-args-tool': {
      inputSchema: z.object({}) // Explicit empty schema
    }
  }
});

// Full TypeScript type safety
const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  tools // Type-safe MCP tools
});
```

**Auto-discovery (less type safety):**

```typescript
const tools = await mcpClient.tools(); // Infers from MCP server

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  tools
});
```

### Resource Management

**List and read resources:**

```typescript
// List available resources
const resources = await mcpClient.listResources();
// [
//   { uri: 'file:///docs/api.md', name: 'API Documentation' },
//   { uri: 'db://prod/schema', name: 'Database Schema' }
// ]

// Read resource content
const apiDocs = await mcpClient.readResource({
  uri: 'file:///docs/api.md'
});

// Inject into agent context
const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  prepareCall: async ({ ...settings }) => {
    const docs = await mcpClient.readResource({
      uri: 'file:///docs/api.md'
    });

    return {
      ...settings,
      instructions: settings.instructions +
        `\n\nAPI Documentation:\n${docs.content}`
    };
  }
});
```

### Prompt Templates

**Reusable prompts with arguments:**

```typescript
// List available prompts
const prompts = await mcpClient.experimental_listPrompts();
// [
//   { name: 'code_review', arguments: ['code', 'language'] },
//   { name: 'summarize', arguments: ['text', 'maxLength'] }
// ]

// Get prompt with arguments
const prompt = await mcpClient.experimental_getPrompt({
  name: 'code_review',
  arguments: {
    code: 'function add(a, b) { return a + b; }',
    language: 'javascript'
  }
});

// Use with agent
const result = await agent.generate({
  prompt: prompt.messages[0].content
});
```

### Elicitation (Server-Initiated Requests)

**Handle server requests for additional info:**

```typescript
const mcpClient = await createMCPClient({
  transport: { type: 'sse', url: 'https://mcp.example.com' },
  capabilities: {
    elicitation: {} // Enable elicitation
  }
});

// Register handler
mcpClient.onElicitationRequest(ElicitationRequestSchema, async (request) => {
  // Server asks for user input
  console.log('Server requests:', request.params.message);
  console.log('Expected schema:', request.params.requestedSchema);

  // Get user input (e.g., from UI)
  const userInput = await promptUser(request.params.message);

  // Validate against schema
  const isValid = validateSchema(userInput, request.params.requestedSchema);

  if (!isValid) {
    return {
      action: 'decline',
      reason: 'Invalid input format'
    };
  }

  return {
    action: 'accept',
    content: userInput
  };
});
```

### Lifecycle Management

```typescript
async function runAgentWithMCP(prompt: string) {
  let mcpClient;

  try {
    mcpClient = await createMCPClient({
      transport: { type: 'http', url: process.env.MCP_URL }
    });

    const tools = await mcpClient.tools();

    const agent = new ToolLoopAgent({
      model: 'anthropic/claude-sonnet-4.5',
      tools
    });

    const stream = agent.stream({ prompt });

    return await stream.text;

  } finally {
    // Always close connection
    await mcpClient?.close();
  }
}
```

### Integration Pattern with prepareCall

**Dynamic MCP tool injection:**

```typescript
const dynamicAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    mcpServerUrl: z.string().url(),
    enabledTools: z.array(z.string())
  }),

  prepareCall: async ({ options, ...settings }) => {
    const mcpClient = await createMCPClient({
      transport: { type: 'http', url: options.mcpServerUrl }
    });

    const allTools = await mcpClient.tools();

    // Filter tools
    const filteredTools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) =>
        options.enabledTools.includes(name)
      )
    );

    return {
      ...settings,
      tools: {
        ...settings.tools,
        ...filteredTools
      }
    };
  }
});

// Usage
const result = await dynamicAgent.generate({
  prompt: 'Search our database',
  options: {
    mcpServerUrl: 'https://internal-mcp.example.com',
    enabledTools: ['search-database', 'read-document']
  }
});
```

---

## Human-in-the-Loop (HITL) Tool Approval

### Basic Tool Approval

**Omit execute for manual approval:**

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const dangerousAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  tools: {
    // Auto-execute (safe)
    listFiles: tool({
      description: 'List files in directory',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        return { files: await fs.readdir(path) };
      }
    }),

    // Requires approval (no execute)
    deleteFiles: tool({
      description: 'Delete files permanently',
      inputSchema: z.object({
        paths: z.array(z.string()),
        confirm: z.boolean()
      })
      // No execute - frontend must handle
    }),

    runCommand: tool({
      description: 'Execute shell command',
      inputSchema: z.object({ command: z.string() })
      // No execute
    })
  }
});
```

### Frontend Approval UI

```typescript
'use client';

import { useChat } from 'ai/react';

export default function ChatWithApproval() {
  const {
    messages,
    input,
    handleSubmit,
    addToolResult,
    isLoading
  } = useChat({
    api: '/api/agent'
  });

  const pendingToolCalls = messages
    .flatMap(m => m.toolInvocations || [])
    .filter(inv => inv.state === 'call'); // Needs approval

  const handleApprove = async (toolCallId: string, toolName: string, args: any) => {
    // Execute tool on backend
    const result = await fetch('/api/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ toolName, args })
    }).then(r => r.json());

    // Add result to conversation
    addToolResult({
      toolCallId,
      result
    });
  };

  const handleReject = (toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: { error: 'User rejected this action' }
    });
  };

  return (
    <div>
      {/* Messages */}
      {messages.map(m => <Message key={m.id} message={m} />)}

      {/* Approval UI */}
      {pendingToolCalls.map(inv => (
        <ToolApprovalCard
          key={inv.toolCallId}
          toolName={inv.toolName}
          args={inv.args}
          onApprove={() => handleApprove(inv.toolCallId, inv.toolName, inv.args)}
          onReject={() => handleReject(inv.toolCallId)}
        />
      ))}

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={e => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

### Selective Approval Logic

**Auto-approve safe operations:**

```typescript
const smartAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  tools: {
    executeCommand: tool({
      description: 'Run shell command',
      inputSchema: z.object({
        command: z.string(),
        workingDir: z.string().optional()
      }),

      // Conditional execute
      execute: async ({ command, workingDir }, { experimental_context }) => {
        const ctx = experimental_context as AgentContext;

        // Get user preferences
        const userPrefs = await ctx.db.getUserPreferences(ctx.userId);

        // Auto-approve whitelist
        const safeCommands = ['ls', 'pwd', 'git status', 'npm test'];
        const isSafe = safeCommands.some(safe => command.startsWith(safe));

        // Auto-approve if user preference set
        const autoApprove = userPrefs.autoApproveCommands?.includes(command);

        if (isSafe || autoApprove) {
          // Execute immediately
          return await runCommand(command, workingDir);
        }

        // Otherwise, omit execute (requires approval)
        throw new Error('REQUIRES_APPROVAL');
      }
    })
  }
});
```

### Pattern Remembering

**Learn from user approvals:**

```typescript
// Backend approval handler
export async function POST(req: Request) {
  const { toolCallId, toolName, args, approved, rememberPattern } = await req.json();

  if (approved && rememberPattern) {
    // Store approval pattern
    await db.approvalPatterns.create({
      userId: req.userId,
      toolName,
      pattern: extractPattern(args), // e.g., "delete *.log files"
      createdAt: new Date()
    });
  }

  if (!approved) {
    return { error: 'User rejected' };
  }

  // Execute tool
  const result = await executeToolSafely(toolName, args);
  return result;
}

// Agent checks patterns before requesting approval
prepareCall: async ({ options, ...settings }) => {
  const patterns = await db.approvalPatterns.findMany({
    where: { userId: options.userId }
  });

  return {
    ...settings,
    // Inject patterns into tool context
    experimental_context: {
      ...settings.experimental_context,
      approvalPatterns: patterns
    }
  };
}
```

---

## Structured Output Generation

### V6 Unified API

**Deprecated: `generateObject` / `streamObject`**
**Use: `generateText` / `streamText` with `output` property**

```typescript
import { ToolLoopAgent, Output } from 'ai';
import { z } from 'zod';

// ❌ V5 Pattern (deprecated)
// const { object } = await generateObject({
//   model: 'anthropic/claude-sonnet-4.5',
//   schema: z.object({ ... })
// });

// ✅ V6 Pattern
const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  output: Output.object({
    schema: z.object({
      summary: z.string().describe('Brief summary of content'),
      categories: z.array(z.string()).describe('Relevant categories'),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      keyEntities: z.array(z.object({
        name: z.string(),
        type: z.enum(['person', 'organization', 'location', 'product']),
        relevance: z.number().min(0).max(1)
      }))
    })
  })
});

const result = await agent.generate({
  prompt: 'Analyze this article: ...'
});

console.log(result.object);
// {
//   summary: "Article discusses...",
//   categories: ["technology", "AI"],
//   sentiment: "positive",
//   keyEntities: [{ name: "OpenAI", type: "organization", relevance: 0.9 }]
// }
```

### Combining Tools + Structured Output

**V6 enables tool calling AND structured output in same request:**

```typescript
const analysisAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  tools: {
    webSearch: tool({
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ results: [] })
    }),

    readUrl: tool({
      description: 'Fetch content from URL',
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => ({ content: '' })
    })
  },

  // Agent can use tools AND return structured output
  output: Output.object({
    schema: z.object({
      answer: z.string(),
      sources: z.array(z.object({
        url: z.string().url(),
        title: z.string(),
        relevance: z.number()
      })),
      confidence: z.enum(['high', 'medium', 'low'])
    })
  })
});

// Agent will:
// 1. Use webSearch tool
// 2. Use readUrl tool for top results
// 3. Return structured answer with sources
const result = await analysisAgent.generate({
  prompt: 'What are the latest developments in quantum computing?'
});
```

### Schema Descriptions for Better Quality

**Use `.describe()` for model hints:**

```typescript
const schema = z.object({
  title: z.string()
    .describe('Clear, concise title (max 100 chars)'),

  summary: z.string()
    .describe('Executive summary covering key points (200-300 words)'),

  sections: z.array(z.object({
    heading: z.string()
      .describe('Section heading'),
    content: z.string()
      .describe('Section content with supporting details'),
    importance: z.enum(['critical', 'important', 'supplementary'])
      .describe('How critical is this section to overall understanding')
  }))
    .describe('Logical sections organized by topic'),

  actionItems: z.array(z.object({
    task: z.string(),
    priority: z.number().min(1).max(5),
    deadline: z.date().optional()
  }))
    .describe('Concrete action items extracted from content'),

  metadata: z.object({
    readingTime: z.number()
      .describe('Estimated reading time in minutes'),
    targetAudience: z.array(z.string())
      .describe('Who should read this'),
    relatedTopics: z.array(z.string())
  })
});

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  output: Output.object({ schema })
});
```

---

## Multimodal Capabilities

### Image Input (Vision)

```typescript
import { ToolLoopAgent } from 'ai';

const visionAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5', // Supports vision
  instructions: 'Analyze images and provide detailed descriptions.'
});

const result = await visionAgent.generate({
  prompt: [
    { type: 'text', text: 'What is in this image?' },
    {
      type: 'image',
      image: 'https://example.com/image.jpg'
      // or: image: Buffer.from(imageData)
      // or: image: fs.readFileSync('./image.png')
    }
  ]
});

console.log(result.text);
```

### Image Analysis with Structured Output

```typescript
const imageAnalysisAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  output: Output.object({
    schema: z.object({
      description: z.string(),
      objects: z.array(z.object({
        name: z.string(),
        confidence: z.number(),
        boundingBox: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        }).optional()
      })),
      text: z.array(z.string()).describe('Any text found in image'),
      colors: z.array(z.string()).describe('Dominant colors'),
      setting: z.enum(['indoor', 'outdoor', 'unknown'])
    })
  })
});

const analysis = await imageAnalysisAgent.generate({
  prompt: [
    { type: 'text', text: 'Analyze this image in detail' },
    { type: 'image', image: imageUrl }
  ]
});

console.log(analysis.object);
```

### Image Tools (Code to Image)

```typescript
const designAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  tools: {
    generateDiagram: tool({
      description: 'Generate architecture diagram from description',
      inputSchema: z.object({
        description: z.string(),
        format: z.enum(['mermaid', 'plantuml'])
      }),
      execute: async ({ description, format }) => {
        // Generate diagram code
        const diagramCode = await generateDiagramCode(description, format);

        // Render to image
        const imageUrl = await renderDiagram(diagramCode, format);

        return {
          diagramCode,
          imageUrl
        };
      }
    }),

    createScreenshot: tool({
      description: 'Take screenshot of URL',
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        const screenshot = await captureScreenshot(url);
        return { imageUrl: screenshot };
      }
    })
  }
});

// Agent can generate AND analyze images
const result = await designAgent.generate({
  prompt: 'Create a microservices architecture diagram and explain it'
});
```

---

## Production Patterns

### Observability & Telemetry

**OpenTelemetry integration:**

```typescript
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  experimental_telemetry: {
    isEnabled: true,
    functionId: 'customer-support-agent',

    metadata: {
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
      deployment: process.env.DEPLOYMENT_ID
    },

    // Control what's recorded
    recordInputs: true,
    recordOutputs: true
  }
});

// Telemetry automatically collected
const result = await agent.generate({
  prompt: 'Help request...',

  experimental_telemetry: {
    metadata: {
      userId: 'user_123',
      sessionId: 'session_456',
      requestId: uuid()
    }
  }
});
```

**Langfuse integration:**

```typescript
import { Langfuse } from 'langfuse';
import { LangfuseExporter } from '@langfuse/vercel';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY
});

// Configure OpenTelemetry with Langfuse
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  spanProcessor: new LangfuseExporter({ client: langfuse })
});

sdk.start();

// AI SDK telemetry flows to Langfuse automatically
```

### Error Handling

```typescript
const robustAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  tools: {
    riskyOperation: tool({
      description: 'Operation that might fail',
      inputSchema: z.object({ id: z.string() }),

      execute: async ({ id }) => {
        try {
          const result = await performRiskyOperation(id);
          return { success: true, data: result };
        } catch (error) {
          // Log error
          logger.error('Tool execution failed', { error, id });

          // Return structured error
          return {
            success: false,
            error: error.message,
            retryable: error.code === 'TEMPORARY_FAILURE'
          };
        }
      }
    })
  }
});

// Handle agent errors
try {
  const result = await robustAgent.generate({
    prompt: 'Execute risky operation'
  });

} catch (error) {
  if (error.name === 'AI_APICallError') {
    // Model API error
    logger.error('Model API failed', {
      statusCode: error.statusCode,
      responseBody: error.responseBody
    });
  } else if (error.name === 'AI_InvalidToolArgumentsError') {
    // Tool validation error
    logger.error('Invalid tool args', { error });
  } else {
    // Unknown error
    logger.error('Agent error', { error });
  }

  // Fallback
  return { error: 'Agent temporarily unavailable' };
}
```

### Retry Logic with Exponential Backoff

```typescript
async function executeWithRetry<T>(
  agentFn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await agentFn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        throw error;
      }

      // Only retry on transient errors
      if (
        error.name === 'AI_APICallError' &&
        [429, 500, 502, 503, 504].includes(error.statusCode)
      ) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`, { error });
        await sleep(delay);
      } else {
        throw error; // Don't retry non-transient errors
      }
    }
  }
}

// Usage
const result = await executeWithRetry(() =>
  agent.generate({ prompt: 'User query' })
);
```

### Cost Tracking

```typescript
interface CostMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

const costTracking = new Map<string, CostMetrics>();

const costAwareAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5'
});

async function generateWithCostTracking(
  sessionId: string,
  prompt: string
) {
  const result = await costAwareAgent.generate({
    prompt,

    onFinish: ({ usage }) => {
      // Cost per 1M tokens (example rates)
      const costs = {
        'anthropic/claude-sonnet-4.5': { input: 3, output: 15 },
        'openai/gpt-4o-mini': { input: 0.15, output: 0.6 }
      };

      const modelCost = costs[costAwareAgent.model];
      const estimatedCost =
        (usage.promptTokens / 1_000_000) * modelCost.input +
        (usage.completionTokens / 1_000_000) * modelCost.output;

      // Track
      const existing = costTracking.get(sessionId) || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };

      costTracking.set(sessionId, {
        promptTokens: existing.promptTokens + usage.promptTokens,
        completionTokens: existing.completionTokens + usage.completionTokens,
        totalTokens: existing.totalTokens + usage.totalTokens,
        estimatedCost: existing.estimatedCost + estimatedCost
      });

      // Alert on threshold
      if (existing.estimatedCost > 1.0) {
        logger.warn('Session cost exceeded $1', { sessionId });
      }
    }
  });

  return result;
}
```

---

## Next.js 15 Integration Patterns

### Server Actions

```typescript
'use server';

import { ToolLoopAgent } from 'ai';
import { createStreamableValue } from 'ai/rsc';

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  tools: { /* ... */ }
});

export async function streamAgentResponse(prompt: string) {
  const stream = createStreamableValue();

  (async () => {
    try {
      const agentStream = agent.stream({ prompt });

      for await (const chunk of agentStream.textStream) {
        stream.update(chunk);
      }

      stream.done();
    } catch (error) {
      stream.error(error);
    }
  })();

  return stream.value;
}

export async function generateAgentResponse(prompt: string) {
  const result = await agent.generate({ prompt });
  return result.text;
}
```

**Client component:**

```typescript
'use client';

import { useState } from 'react';
import { readStreamableValue } from 'ai/rsc';
import { streamAgentResponse } from './actions';

export default function Chat() {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (prompt: string) => {
    setIsLoading(true);
    setResponse('');

    try {
      const stream = await streamAgentResponse(prompt);

      for await (const chunk of readStreamableValue(stream)) {
        setResponse(prev => prev + chunk);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div>{response}</div>
      <form onSubmit={e => {
        e.preventDefault();
        handleSubmit(new FormData(e.target).get('prompt'));
      }}>
        <input name="prompt" />
        <button disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### Route Handlers

```typescript
// app/api/agent/route.ts
import { createAgentUIStreamResponse } from 'ai';
import { ToolLoopAgent } from 'ai';

export const runtime = 'edge'; // Optional: Deploy to edge

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Helpful assistant',
  tools: { /* ... */ }
});

export async function POST(req: Request) {
  const { messages, options } = await req.json();

  return createAgentUIStreamResponse({
    agent,
    messages,
    options, // Pass runtime options

    onFinish: async ({ text, usage, messages }) => {
      // Save to database
      await db.conversations.create({
        messages,
        response: text,
        tokens: usage.totalTokens,
        userId: req.headers.get('x-user-id')
      });
    }
  });
}
```

**Client with useChat:**

```typescript
'use client';

import { useChat } from 'ai/react';

export default function Chat() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error
  } = useChat({
    api: '/api/agent',
    body: {
      options: {
        userId: 'user_123',
        accountType: 'pro'
      }
    }
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}

          {/* Tool calls */}
          {m.toolInvocations?.map(inv => (
            <div key={inv.toolCallId}>
              Tool: {inv.toolName}
              {inv.state === 'result' && (
                <pre>{JSON.stringify(inv.result, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button disabled={isLoading}>Send</button>
      </form>

      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

### Type-Safe Messages

```typescript
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';

const myAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  tools: {
    searchDocs: tool({ /* ... */ }),
    createTicket: tool({ /* ... */ })
  }
});

// Infer message type
export type MyAgentMessage = InferAgentUIMessage<typeof myAgent>;

// Use in client
'use client';

import { useChat } from 'ai/react';
import type { MyAgentMessage } from './agent';

export default function TypedChat() {
  const { messages } = useChat<MyAgentMessage>({
    api: '/api/agent'
  });

  // Full type safety
  messages.forEach(msg => {
    if (msg.toolInvocations) {
      msg.toolInvocations.forEach(inv => {
        // TypeScript knows available tools
        if (inv.toolName === 'searchDocs') {
          // Type-safe args and result
          console.log(inv.args.query);
        }
      });
    }
  });
}
```

---

## Self-Improving Agent Patterns

### Memory Systems

**Conversation memory with vector embeddings:**

```typescript
import { ToolLoopAgent, tool } from 'ai';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const memoryAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    userId: z.string(),
    sessionId: z.string()
  }),

  tools: {
    rememberContext: tool({
      description: 'Store important context for future reference',
      inputSchema: z.object({
        key: z.string(),
        value: z.string(),
        importance: z.enum(['high', 'medium', 'low'])
      }),
      execute: async ({ key, value, importance }, { experimental_context }) => {
        const ctx = experimental_context as AgentContext;

        // Generate embedding
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: `${key}: ${value}`
        });

        // Store in vector DB
        await ctx.db.memories.create({
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          key,
          value,
          importance,
          embedding,
          createdAt: new Date()
        });

        return { success: true };
      }
    }),

    recallContext: tool({
      description: 'Retrieve relevant past context',
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().default(5)
      }),
      execute: async ({ query, limit }, { experimental_context }) => {
        const ctx = experimental_context as AgentContext;

        // Embed query
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: query
        });

        // Vector similarity search
        const memories = await ctx.db.memories.findSimilar({
          userId: ctx.userId,
          embedding,
          limit
        });

        return {
          memories: memories.map(m => ({
            key: m.key,
            value: m.value,
            similarity: m.similarity
          }))
        };
      }
    })
  },

  prepareCall: async ({ options, ...settings }) => {
    // Auto-inject relevant memories
    const recentContext = await db.memories.findRecent({
      userId: options.userId,
      sessionId: options.sessionId,
      limit: 3
    });

    const contextPrompt = recentContext.length > 0
      ? `\n\nRelevant context from past conversations:\n${
          recentContext.map(m => `- ${m.key}: ${m.value}`).join('\n')
        }`
      : '';

    return {
      ...settings,
      instructions: settings.instructions + contextPrompt
    };
  }
});
```

### Learning from Feedback

**RLHF-inspired pattern:**

```typescript
const learningAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  tools: {
    recordFeedback: tool({
      description: 'Record user feedback on response quality',
      inputSchema: z.object({
        responseId: z.string(),
        rating: z.number().min(1).max(5),
        feedback: z.string().optional()
      }),
      execute: async ({ responseId, rating, feedback }, { experimental_context }) => {
        const ctx = experimental_context as AgentContext;

        // Store feedback
        await ctx.db.feedback.create({
          responseId,
          rating,
          feedback,
          userId: ctx.userId,
          timestamp: new Date()
        });

        // Update response quality score
        await ctx.db.responses.update({
          where: { id: responseId },
          data: { qualityScore: rating }
        });

        // If low rating, trigger analysis
        if (rating <= 2) {
          await analyzeFailure(responseId, feedback);
        }

        return { success: true, message: 'Feedback recorded' };
      }
    })
  },

  prepareCall: async ({ options, ...settings }) => {
    // Learn from past mistakes
    const lowRatedResponses = await db.feedback.findMany({
      where: {
        userId: options.userId,
        rating: { lte: 2 }
      },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    if (lowRatedResponses.length > 0) {
      const learningPrompt = `\n\nLearn from these past issues:\n${
        lowRatedResponses.map(r =>
          `- Issue: ${r.feedback}\n  Avoid: ${r.originalResponse}`
        ).join('\n')
      }`;

      return {
        ...settings,
        instructions: settings.instructions + learningPrompt
      };
    }

    return settings;
  }
});
```

### Adaptive Reasoning

**Adjust complexity based on performance:**

```typescript
const adaptiveAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  callOptionsSchema: z.object({
    taskType: z.string(),
    userId: z.string()
  }),

  prepareCall: async ({ options, ...settings }) => {
    // Analyze past performance for this task type
    const pastAttempts = await db.taskAttempts.findMany({
      where: {
        userId: options.userId,
        taskType: options.taskType
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    const avgSuccess = pastAttempts.length > 0
      ? pastAttempts.filter(a => a.successful).length / pastAttempts.length
      : 0.5;

    // Adapt strategy based on success rate
    let strategy = '';

    if (avgSuccess < 0.3) {
      // Struggling - use more thorough approach
      strategy = `
        This task type has been challenging. Take extra care:
        - Break down into smaller steps
        - Verify each step before proceeding
        - Ask clarifying questions if unsure
      `;
    } else if (avgSuccess > 0.8) {
      // Doing well - can be more efficient
      strategy = `
        You've been successful with this task type.
        Proceed with confidence and efficiency.
      `;
    }

    // Select model based on difficulty
    const model = avgSuccess < 0.5
      ? 'openai/o1-mini' // More capable for difficult tasks
      : settings.model;

    return {
      ...settings,
      model,
      instructions: settings.instructions + strategy
    };
  }
});
```

---

## Code Examples Library

### Complete RAG Agent

```typescript
import { ToolLoopAgent, tool, Output } from 'ai';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const ragAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',

  instructions: `You are a knowledgeable assistant.
    Answer questions using provided context.
    Always cite sources using [1], [2] format.`,

  callOptionsSchema: z.object({
    query: z.string(),
    maxDocuments: z.number().default(5)
  }),

  tools: {
    searchDocuments: tool({
      description: 'Search knowledge base for relevant documents',
      inputSchema: z.object({
        query: z.string(),
        filters: z.object({
          category: z.string().optional(),
          dateRange: z.object({
            from: z.date().optional(),
            to: z.date().optional()
          }).optional()
        }).optional()
      }),
      execute: async ({ query, filters }, { experimental_context }) => {
        const ctx = experimental_context as AgentContext;

        // Generate query embedding
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-large'),
          value: query
        });

        // Vector search
        const documents = await ctx.db.documents.vectorSearch({
          embedding,
          limit: 10,
          filters
        });

        return {
          documents: documents.map(d => ({
            id: d.id,
            title: d.title,
            content: d.content,
            similarity: d.similarity,
            source: d.source
          }))
        };
      }
    })
  },

  prepareCall: async ({ options, ...settings }) => {
    // Pre-fetch relevant context
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-large'),
      value: options.query
    });

    const documents = await db.documents.vectorSearch({
      embedding,
      limit: options.maxDocuments
    });

    const context = documents
      .map((doc, i) => `[${i + 1}] ${doc.title}\n${doc.content}`)
      .join('\n\n---\n\n');

    return {
      ...settings,
      instructions: settings.instructions +
        `\n\nRelevant context:\n\n${context}\n\n` +
        `Answer the question using the above context. ` +
        `Cite sources using [number] format.`
    };
  },

  output: Output.object({
    schema: z.object({
      answer: z.string(),
      sources: z.array(z.object({
        number: z.number(),
        title: z.string(),
        relevance: z.enum(['high', 'medium', 'low'])
      })),
      confidence: z.enum(['high', 'medium', 'low'])
    })
  })
});

// Usage
const result = await ragAgent.generate({
  prompt: 'How do we handle database migrations?',
  options: {
    query: 'database migrations procedures',
    maxDocuments: 3
  }
});
```

### Production-Ready Agent with Full Observability

```typescript
import { ToolLoopAgent } from 'ai';
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY
});

const productionAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Production customer support agent',

  tools: {
    // ... tools
  },

  experimental_telemetry: {
    isEnabled: true,
    functionId: 'customer-support-agent',
    recordInputs: true,
    recordOutputs: true
  }
});

async function handleSupportRequest(
  userId: string,
  message: string,
  sessionId: string
) {
  const trace = langfuse.trace({
    name: 'support-request',
    userId,
    sessionId,
    metadata: {
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION
    }
  });

  try {
    // Rate limiting
    const rateLimitOk = await checkRateLimit(userId);
    if (!rateLimitOk) {
      trace.event({
        name: 'rate-limit-exceeded',
        level: 'warning'
      });
      throw new Error('Rate limit exceeded');
    }

    // Execute with retry
    const result = await executeWithRetry(async () => {
      const span = trace.span({ name: 'agent-execution' });

      try {
        const result = await productionAgent.generate({
          prompt: message,

          experimental_telemetry: {
            metadata: { userId, sessionId }
          },

          onFinish: ({ usage, text }) => {
            span.end({
              output: text,
              usage: {
                input: usage.promptTokens,
                output: usage.completionTokens,
                total: usage.totalTokens
              }
            });

            // Track costs
            trackCost(userId, usage);
          }
        });

        return result;
      } catch (error) {
        span.end({ level: 'error', statusMessage: error.message });
        throw error;
      }
    }, 3);

    // Log success
    trace.event({
      name: 'request-completed',
      level: 'info',
      metadata: { responseLength: result.text.length }
    });

    await trace.update({ output: result.text });

    return result;

  } catch (error) {
    // Log error
    trace.event({
      name: 'request-failed',
      level: 'error',
      metadata: { error: error.message }
    });

    await trace.update({
      level: 'error',
      statusMessage: error.message
    });

    throw error;

  } finally {
    await langfuse.flushAsync();
  }
}

// Helper functions
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries) throw error;
      if (error.statusCode && [429, 500, 502, 503].includes(error.statusCode)) {
        await sleep(Math.pow(2, i) * 1000);
      } else {
        throw error;
      }
    }
  }
}

function trackCost(userId: string, usage: any) {
  const cost = (usage.promptTokens / 1_000_000) * 3 +
               (usage.completionTokens / 1_000_000) * 15;

  metrics.increment('agent.cost', cost, { userId });
  metrics.increment('agent.tokens', usage.totalTokens, { userId });
}
```

---

## Summary: Key Takeaways for v6

### What's New

1. **Agent Abstraction** - `ToolLoopAgent` for reusable agent definitions
2. **Full MCP Support** - OAuth, resources, prompts, elicitation
3. **Tool Approval (HITL)** - Human oversight for sensitive operations
4. **Unified Structured Output** - `generateText`/`streamText` with `output` property
5. **DevTools** - Web-based debugging UI at `localhost:4983`
6. **Enhanced Type Safety** - `callOptionsSchema`, `InferAgentUIMessage`

### Core Patterns

**prepareCall** - Dynamic agent customization for:
- RAG (inject context)
- Model selection (complexity-based routing)
- Tool filtering (role-based access)
- Provider configuration (reasoning effort)

**callOptionsSchema** - Type-safe runtime options for:
- Session context
- User preferences
- Feature flags
- A/B testing

**Multi-Agent Coordination**:
- Orchestrator-Worker (specialized execution)
- Parallel Processing (concurrent reviews)
- Routing (classification → specialist)
- Evaluator-Optimizer (iterative improvement)
- Hierarchical (nested orchestration)

### Production Excellence

- **OpenTelemetry** - Built-in observability
- **Langfuse Integration** - Production tracing
- **Error Handling** - Retry, circuit breakers, fallbacks
- **Cost Tracking** - Token usage and budget monitoring
- **Rate Limiting** - Request throttling
- **Caching** - Response deduplication

---

## Sources

- [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6)
- [Agents: Overview](https://sdk.vercel.ai/docs/foundations/agents)
- [AI SDK Core: ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)
- [Agents: Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Agents: Configuring Call Options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options)
- [AI SDK Core: Model Context Protocol (MCP)](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [Migration Guides: Migrate AI SDK 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
- [AI SDK Core: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK Core: Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
- [Next.js: Human-in-the-Loop Agent with Next.js](https://ai-sdk.dev/cookbook/next/human-in-the-loop)
- [Observability and Tracing for the Vercel AI SDK - Langfuse](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)
- [Getting Started: Next.js App Router](https://ai-sdk.dev/docs/getting-started/nextjs-app-router)
- [Agents: Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)
- [AI SDK Core: DevTools](https://v6.ai-sdk.dev/docs/ai-sdk-core/devtools)
- [Medium: AI SDK 6 - How Agents, Tool Approval, and MCP Change AI App Development](https://medium.com/coding-nexus/ai-sdk-6-how-agents-tool-approval-and-mcp-change-ai-app-development-b3e0231a25ea)
