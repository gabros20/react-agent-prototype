# Agent System Architecture Diagram

> Comprehensive Mermaid visualization of how tools, prompts, memory, context, and the agent loop chain together into one working system

**Related Documentation:**

-   [Layer 3: Agent System](./LAYER_3_AGENT.md) - Main agent overview
-   [Core Pattern Connections](./CORE_PATTERN_CONNECTIONS.md) - Pattern relationships

---

## 1. Complete Agent System Flow

**The full picture: from user message to final response**

This diagram shows how all agent components connect. Use it as a map to understand the system before diving into code.

**Source Files:**

-   Agent Orchestrator: `server/agent/orchestrator.ts`
-   Routes: `server/routes/agent.ts`
-   Tools: `server/tools/all-tools.ts`
-   Prompts: `server/prompts/react.xml`
-   Working Memory: `server/services/working-memory/`
-   Client Hook: `app/assistant/_hooks/use-agent.ts`
-   Stores: `app/assistant/_stores/`

**Layers shown:** [Layer 1](./LAYER_1_SERVER_CORE.md) | [Layer 2](./LAYER_2_DATABASE.md) | [Layer 3](./LAYER_3_AGENT.md) | [Layer 4](./LAYER_4_SERVICES.md) | [Layer 6](./LAYER_6_CLIENT.md)

```mermaid
flowchart TB
    subgraph Frontend["Frontend - app/assistant/"]
        subgraph ReactUI["React Components"]
            ChatPane["ChatPane.tsx"]
            MessageInput["Message Input"]
            ApprovalModal["ApprovalModal.tsx"]
        end

        subgraph ZustandStores["Zustand Stores - _stores/"]
            ChatStore["useChatStore<br/>messages, sessionId, isStreaming"]
            SessionStore["useSessionStore<br/>sessions, currentSessionId"]
            ApprovalStore["useApprovalStore<br/>pendingApproval"]
            LogStore["useLogStore<br/>execution logs"]
        end

        subgraph ClientHook["Hook - _hooks/use-agent.ts"]
            UseAgent["useAgent()<br/>sendMessage, messages, isStreaming"]
            SSEParser["SSE Parser<br/>ReadableStream + TextDecoder"]
        end
    end

    subgraph NextProxy["Next.js Proxy - app/api/agent/route.ts"]
        ProxyRoute["POST /api/agent<br/>Proxies to backend"]
    end

    subgraph Backend["Backend - server/"]
        subgraph ExpressRoutes["Routes - routes/agent.ts"]
            StreamRoute["POST /v1/agent/stream"]
            ApprovalRoute["POST /v1/agent/approval/:approvalId"]
            WriteSSE["writeSSE()<br/>event + data format"]
        end

        subgraph Container["ServiceContainer - services/service-container.ts"]
            ContainerSingleton["ServiceContainer.get()<br/>Singleton Pattern"]
            DbInstance["db: DrizzleDB"]
            VectorIndex["vectorIndex: VectorIndexService"]
            Services["services:<br/>PageService, SectionService,<br/>EntryService, SessionService"]
        end

        subgraph ContextBuild["Context Assembly"]
            AgentContext["AgentContext<br/>db, vectorIndex, services,<br/>logger, stream, traceId,<br/>sessionId, cmsTarget"]
        end

        subgraph PromptCompilation["Prompt System - prompts/"]
            ReactXML["react.xml<br/>Handlebars Template"]
            WorkingMemStr["workingMemory variable"]
            ToolsFormatted["toolsFormatted variable"]
            HandlebarsCompile["Handlebars.compile()"]
            SystemPrompt["Compiled System Prompt<br/>~2800 tokens"]
        end

        subgraph WorkingMem["Working Memory - services/working-memory/"]
            WorkingContext["WorkingContext class<br/>MAX_ENTITIES = 10"]
            EntityExtractor["EntityExtractor class<br/>Pattern matching extraction"]
            ToContextString["toContextString()<br/>Groups by entity type"]
        end

        subgraph Orchestrator["Agent Orchestrator - agent/orchestrator.ts"]
            CreateAgent["createAgent()<br/>Instantiates ToolLoopAgent"]
            StreamWithApproval["streamAgentWithApproval()<br/>Main entry point"]

            subgraph ReActLoop["ReAct Loop - AI SDK v6 ToolLoopAgent"]
                PrepareStep["prepareStep<br/>Auto-checkpoint every 3 steps<br/>Trim history if more than 20 msgs"]
                Think["THINK<br/>Analyze user request + context"]
                Act["ACT<br/>Select and call tool"]
                Observe["OBSERVE<br/>Process tool result"]
                OnStepFinish["onStepFinish<br/>Emit SSE events"]
                StopCondition{"Stop Condition<br/>FINAL_ANSWER detected?<br/>maxSteps: 15 reached?"}
            end
        end

        subgraph ToolSystem["Tool Registry - tools/"]
            AllTools["ALL_TOOLS constant<br/>48 tools"]

            subgraph ToolCategories["Tool Categories"]
                CmsTools["cms_* tools<br/>getPage, createPage,<br/>addSectionToPage, etc."]
                SearchTools["search_* tools<br/>searchVector"]
                WebTools["web_* tools<br/>quickSearch, deepResearch"]
                PexelsTools["pexels_* tools<br/>searchPhotos, downloadPhoto"]
                HttpTools["http_* tools<br/>httpGet, httpPost"]
            end

            ToolDef["tool() definition<br/>description, inputSchema,<br/>needsApproval?, execute"]
            ZodSchema["Zod Schema<br/>Input validation"]
            ExperimentalContext["experimental_context<br/>as AgentContext"]
        end

        subgraph HITLSystem["HITL - services/approval-queue.ts"]
            ApprovalQueue["ApprovalQueue singleton<br/>pendingRequests Map<br/>resolvers Map"]
            RequestApproval["requestApproval()<br/>Returns Promise, 5min timeout"]
            RespondApproval["respondToApproval()<br/>Resolves Promise"]
        end

        subgraph ServicesLayer["Services Layer - services/"]
            PageService["PageService"]
            SectionService["SectionService"]
            EntryService["EntryService"]
            ImageService["ImageService"]
            SessionService["SessionService<br/>saveMessages, loadMessages"]
            VectorService["VectorIndexService<br/>search, sync"]
        end

        subgraph Database["Database Layer - db/"]
            DrizzleORM["Drizzle ORM"]
            SQLiteDB[("SQLite<br/>data/sqlite.db")]
            LanceDB[("LanceDB<br/>data/lance-db/")]
        end

        subgraph ErrorRecovery["Error Recovery"]
            ExecuteWithRetry["executeAgentWithRetry()<br/>max 3 retries"]
            ExponentialBackoff["Exponential Backoff<br/>1s, 2s, 4s, max 10s"]
            Checkpoint["Checkpoint<br/>Every 3 steps via prepareStep"]
        end
    end

    %% === FLOW 1: User sends message ===
    MessageInput -->|"user types message"| ChatStore
    ChatStore -->|"setIsStreaming(true)"| UseAgent
    UseAgent -->|"POST /api/agent<br/>sessionId, prompt"| ProxyRoute
    ProxyRoute -->|"forward request"| StreamRoute

    %% === FLOW 2: Context Assembly ===
    StreamRoute -->|"ServiceContainer.get()"| ContainerSingleton
    ContainerSingleton --> DbInstance
    ContainerSingleton --> VectorIndex
    ContainerSingleton --> Services
    DbInstance --> AgentContext
    VectorIndex --> AgentContext
    Services --> AgentContext
    StreamRoute -->|"traceId: crypto.randomUUID()"| AgentContext

    %% === FLOW 3: Working Memory Load ===
    AgentContext -->|"getWorkingContext(sessionId)"| WorkingContext
    WorkingContext --> ToContextString
    ToContextString --> WorkingMemStr

    %% === FLOW 4: Prompt Compilation ===
    ReactXML --> HandlebarsCompile
    WorkingMemStr --> HandlebarsCompile
    ToolsFormatted --> HandlebarsCompile
    AllTools -->|"Object.keys()"| ToolsFormatted
    HandlebarsCompile --> SystemPrompt

    %% === FLOW 5: Agent Creation ===
    SystemPrompt --> CreateAgent
    AgentContext --> CreateAgent
    AllTools --> CreateAgent
    CreateAgent --> StreamWithApproval

    %% === FLOW 6: ReAct Loop Execution ===
    StreamWithApproval --> PrepareStep
    PrepareStep --> Think
    Think -->|"check WorkingContext"| WorkingContext
    Think --> Act
    Act -->|"select tool from ALL_TOOLS"| ToolDef

    %% === FLOW 7: Tool Execution ===
    ToolDef --> ZodSchema
    ZodSchema -->|"validate input"| ExperimentalContext
    ExperimentalContext -->|"ctx.services.pageService"| PageService
    ExperimentalContext --> SectionService
    ExperimentalContext --> EntryService
    ExperimentalContext --> ImageService
    ExperimentalContext -->|"ctx.vectorIndex"| VectorService

    %% === FLOW 8: Service to Database ===
    PageService --> DrizzleORM
    SectionService --> DrizzleORM
    EntryService --> DrizzleORM
    ImageService --> DrizzleORM
    VectorService --> LanceDB
    DrizzleORM --> SQLiteDB

    %% === FLOW 9: HITL Branch (needsApproval tools) ===
    ToolDef -->|"needsApproval: true"| ApprovalQueue
    ApprovalQueue -->|"requestApproval()"| RequestApproval
    RequestApproval -->|"SSE: approval-required"| WriteSSE
    WriteSSE --> SSEParser
    SSEParser -->|"setPendingApproval()"| ApprovalStore
    ApprovalStore --> ApprovalModal
    ApprovalModal -->|"user decision"| ApprovalRoute
    ApprovalRoute -->|"respondToApproval()"| RespondApproval
    RespondApproval -->|"Promise resolves"| ExperimentalContext

    %% === FLOW 10: Observe Phase ===
    ExperimentalContext -->|"tool result"| Observe
    Observe -->|"EntityExtractor.extract()"| EntityExtractor
    EntityExtractor -->|"addMany(entities)"| WorkingContext

    %% === FLOW 11: SSE Events During Loop ===
    OnStepFinish -->|"tool-call, tool-result"| WriteSSE
    Observe --> OnStepFinish
    OnStepFinish --> StopCondition

    %% === FLOW 12: Loop Control ===
    StopCondition -->|"continue"| PrepareStep
    StopCondition -->|"FINAL_ANSWER or step 15"| WriteSSE

    %% === FLOW 13: Error Handling ===
    ExperimentalContext -.->|"on error"| ExecuteWithRetry
    ExecuteWithRetry -.-> ExponentialBackoff
    ExponentialBackoff -.-> ExperimentalContext

    %% === FLOW 14: Checkpointing ===
    PrepareStep -->|"every 3 steps"| Checkpoint
    Checkpoint --> SessionService
    SessionService --> SQLiteDB

    %% === FLOW 15: Response Stream ===
    WriteSSE -->|"SSE format:<br/>event: type<br/>data: JSON"| SSEParser
    SSEParser -->|"text-delta"| ChatStore
    SSEParser -->|"tool-result"| LogStore
    SSEParser -->|"result: sessionId"| SessionStore
    ChatStore --> ChatPane
    LogStore --> ChatPane

    %% === STYLING ===
    classDef frontend fill:#f3e5f5,stroke:#333
    classDef store fill:#e1bee7,stroke:#333
    classDef route fill:#bbdefb,stroke:#333
    classDef context fill:#c8e6c9,stroke:#333
    classDef prompt fill:#fff9c4,stroke:#333
    classDef memory fill:#ffe1f5,stroke:#333
    classDef agent fill:#e1f5ff,stroke:#333
    classDef tool fill:#fff4e1,stroke:#333
    classDef hitl fill:#ffcdd2,stroke:#333
    classDef service fill:#b2dfdb,stroke:#333
    classDef db fill:#d7ccc8,stroke:#333
    classDef error fill:#ffccbc,stroke:#333

    class ChatPane,MessageInput,ApprovalModal frontend
    class ChatStore,SessionStore,ApprovalStore,LogStore store
    class StreamRoute,ApprovalRoute,WriteSSE,ProxyRoute route
    class AgentContext,ContainerSingleton,DbInstance,VectorIndex,Services context
    class ReactXML,WorkingMemStr,ToolsFormatted,HandlebarsCompile,SystemPrompt prompt
    class WorkingContext,EntityExtractor,ToContextString memory
    class CreateAgent,StreamWithApproval,PrepareStep,Think,Act,Observe,OnStepFinish,StopCondition agent
    class AllTools,CmsTools,SearchTools,WebTools,PexelsTools,HttpTools,ToolDef,ZodSchema,ExperimentalContext tool
    class ApprovalQueue,RequestApproval,RespondApproval hitl
    class PageService,SectionService,EntryService,ImageService,SessionService,VectorService service
    class DrizzleORM,SQLiteDB,LanceDB db
    class ExecuteWithRetry,ExponentialBackoff,Checkpoint error
```

### How to Read This Diagram

**Entry Point:** User types in `ChatPane.tsx` → message goes to `useChatStore` → `useAgent()` hook sends POST to `/api/agent`

**Context Assembly:** Backend builds `AgentContext` from `ServiceContainer` singleton - this is the "bag of dependencies" every tool receives

**Prompt Compilation:** `react.xml` template + `workingMemory` + `toolsFormatted` → Handlebars compiles → final system prompt

**ReAct Loop:** `ToolLoopAgent` runs Think→Act→Observe cycle up to 15 steps or until `FINAL_ANSWER` is detected

**Tool Execution:** Tools access services via `experimental_context as AgentContext` - no globals, no closures

**HITL Flow:** Tools with `needsApproval: true` pause execution, send SSE event, wait for user decision

**Working Memory:** `EntityExtractor` pulls entities from tool results → `WorkingContext` tracks last 10 → enables "the page" reference resolution

**Streaming:** All events flow through `writeSSE()` → SSE format → `useAgent()` parser → Zustand stores → React re-render

---

## 2. ReAct Loop Detail

**The Think→Act→Observe cycle that powers autonomous task completion**

📖 **Deep dive:** [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md)

```mermaid
flowchart LR
    subgraph Input["📥 Input"]
        Messages[Message History]
        SystemPrompt[System Prompt]
        Context[Agent Context]
    end

    subgraph Think["🧠 THINK Phase"]
        Analyze[Analyze User Request]
        CheckMemory[Check Working Memory]
        Plan[Plan Next Action]
    end

    subgraph Act["⚡ ACT Phase"]
        SelectTool[Select Tool]
        ValidateParams[Validate Parameters]
        ExecuteTool[Execute Tool]
    end

    subgraph Observe["👁️ OBSERVE Phase"]
        ProcessResult[Process Result]
        ExtractEntities[Extract Entities]
        UpdateMemory[Update Memory]
    end

    subgraph Decision["❓ Decision"]
        Complete{Task Complete?}
        MaxSteps{Max Steps?}
    end

    subgraph Output["📤 Output"]
        FinalAnswer[FINAL_ANSWER]
        StreamEvent[Stream Event]
    end

    Messages --> Analyze
    SystemPrompt --> Analyze
    Context --> Analyze

    Analyze --> CheckMemory
    CheckMemory --> Plan
    Plan --> SelectTool

    SelectTool --> ValidateParams
    ValidateParams --> ExecuteTool
    ExecuteTool --> ProcessResult

    ProcessResult --> ExtractEntities
    ExtractEntities --> UpdateMemory
    UpdateMemory --> Complete

    Complete -->|No| MaxSteps
    MaxSteps -->|No| Analyze
    MaxSteps -->|Yes, max 15| FinalAnswer
    Complete -->|Yes| FinalAnswer

    FinalAnswer --> StreamEvent
    ProcessResult --> StreamEvent

    style Think fill:#e1f5ff
    style Act fill:#fff4e1
    style Observe fill:#e8f5e9
```

---

## 3. Context Injection Pipeline

**How tools receive everything they need without global state**

📖 **Deep dive:** [Layer 3.8: Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) | [Layer 1.2: Service Container](./LAYER_1.2_SERVICE_CONTAINER.md)

```mermaid
flowchart TB
    subgraph Request["📨 Incoming Request"]
        ReqBody[Request Body]
        SessionId[sessionId]
        CmsTargetReq[cmsTarget?]
    end

    subgraph Singleton["🏭 ServiceContainer (Singleton)"]
        DB[(DrizzleDB)]
        VectorIndex[VectorIndexService]
        PageSvc[PageService]
        SectionSvc[SectionService]
        EntrySvc[EntryService]
        ImageSvc[ImageService]
        SessionSvc[SessionService]
    end

    subgraph PerRequest["🔄 Per-Request Context"]
        Logger[Streaming Logger]
        StreamWriter[SSE Stream Writer]
        TraceIdGen[TraceId: UUID]
        CmsResolve[CMS Target Resolver]
    end

    subgraph AssembledContext["📦 AgentContext"]
        CtxDB[db]
        CtxVector[vectorIndex]
        CtxServices[services object]
        CtxLogger[logger]
        CtxStream[stream]
        CtxTrace[traceId]
        CtxSession[sessionId]
        CtxCms[cmsTarget]
    end

    subgraph ToolExecution["🔧 Tool Execution"]
        ExperimentalCtx[experimental_context]
        ToolAccess[Tool Access Pattern]
    end

    ReqBody --> SessionId
    ReqBody --> CmsTargetReq

    DB --> CtxDB
    VectorIndex --> CtxVector
    PageSvc --> CtxServices
    SectionSvc --> CtxServices
    EntrySvc --> CtxServices
    ImageSvc --> CtxServices
    SessionSvc --> CtxServices

    Logger --> CtxLogger
    StreamWriter --> CtxStream
    TraceIdGen --> CtxTrace
    SessionId --> CtxSession
    CmsTargetReq --> CmsResolve
    CmsResolve --> CtxCms

    CtxDB --> ExperimentalCtx
    CtxVector --> ExperimentalCtx
    CtxServices --> ExperimentalCtx
    CtxLogger --> ExperimentalCtx
    CtxStream --> ExperimentalCtx
    CtxTrace --> ExperimentalCtx
    CtxSession --> ExperimentalCtx
    CtxCms --> ExperimentalCtx

    ExperimentalCtx --> ToolAccess

    style Singleton fill:#bbdefb
    style PerRequest fill:#fff4e1
    style AssembledContext fill:#e8f5e9
```

---

## 4. Working Memory Flow

**Entity tracking and reference resolution across conversation turns**

📖 **Deep dive:** [Layer 3.3: Working Memory](./LAYER_3.3_WORKING_MEMORY.md)

```mermaid
flowchart TB
    subgraph ToolResults["🔧 Tool Results"]
        CreatePage["cms_createPage returns page-123"]
        CreateSection["cms_addSection returns sec-456"]
        FindImage["cms_findImage returns img-789"]
    end

    subgraph Extraction["🔍 Entity Extraction"]
        ExtractorClass[EntityExtractor]
        PageEntity["type: page, id: page-123"]
        SectionEntity["type: section, id: sec-456"]
        ImageEntity["type: image, id: img-789"]
    end

    subgraph SlidingWindow["📚 Sliding Window (max 10)"]
        Window[WorkingContext]
        Entities["entities: Map of id to Entity"]
        References["references: Map of phrase to id"]
    end

    subgraph ContextString["📝 Context String Output"]
        ToContext[toContextString]
        MemoryOutput["WORKING MEMORY<br/>pages: About Us page-123<br/>sections: hero sec-456<br/>images: team.jpg img-789"]
    end

    subgraph PromptInjection["💉 Prompt Injection"]
        Template["workingMemory variable"]
        Compiled[Compiled Prompt with Memory]
    end

    subgraph ReferenceResolution["🎯 Reference Resolution"]
        UserSays["User: Add image to the page"]
        Resolves["the page resolves to page-123"]
        ToolCall["cms_updateSection<br/>pageId: page-123"]
    end

    CreatePage --> ExtractorClass
    CreateSection --> ExtractorClass
    FindImage --> ExtractorClass

    ExtractorClass --> PageEntity
    ExtractorClass --> SectionEntity
    ExtractorClass --> ImageEntity

    PageEntity --> Window
    SectionEntity --> Window
    ImageEntity --> Window

    Window --> Entities
    Window --> References

    Entities --> ToContext
    ToContext --> MemoryOutput

    MemoryOutput --> Template
    Template --> Compiled

    Compiled --> UserSays
    UserSays --> References
    References --> Resolves
    Resolves --> ToolCall

    style Extraction fill:#ffe1f5
    style SlidingWindow fill:#e1f5ff
    style ReferenceResolution fill:#e8f5e9
```

---

## 5. Prompt Compilation Pipeline

**How the system prompt is dynamically assembled**

📖 **Deep dive:** [Layer 3.4: Prompts](./LAYER_3.4_PROMPTS.md)

```mermaid
flowchart TB
    subgraph TemplateFiles["📄 Template Files"]
        ReactXML[react.xml<br/>~1200 lines]
        Identity[Identity Section]
        CoreLoop[Core Loop Rules]
        DomainGuides[Domain Guides<br/>CMS, Images, Posts, Nav]
        ErrorHandling[Error Handling]
        Examples[Few-Shot Examples]
    end

    subgraph DynamicData["📊 Dynamic Data"]
        ToolsList[Object.keys ALL_TOOLS]
        ToolCount[48 tools]
        CurrentDate[new Date ISO]
        SessionIdVal[sessionId]
        WorkingMem[WorkingContext.toContextString]
    end

    subgraph Compilation["⚙️ Handlebars Compilation"]
        Compile[Handlebars.compile]
        Variables["Variables:<br/>toolCount<br/>sessionId<br/>currentDate<br/>workingMemory<br/>toolsFormatted"]
    end

    subgraph Output["📤 Compiled Prompt"]
        Final[Final System Prompt<br/>~2800 tokens]
    end

    ReactXML --> Identity
    ReactXML --> CoreLoop
    ReactXML --> DomainGuides
    ReactXML --> ErrorHandling
    ReactXML --> Examples

    Identity --> Compile
    CoreLoop --> Compile
    DomainGuides --> Compile
    ErrorHandling --> Compile
    Examples --> Compile

    ToolsList --> Variables
    ToolCount --> Variables
    CurrentDate --> Variables
    SessionIdVal --> Variables
    WorkingMem --> Variables

    Variables --> Compile
    Compile --> Final

    style TemplateFiles fill:#f3e5f5
    style DynamicData fill:#fff4e1
    style Compilation fill:#e1f5ff
```

---

## 6. HITL Approval Flow

**Human-in-the-loop coordination for destructive operations**

📖 **Deep dive:** [Layer 3.5: HITL](./LAYER_3.5_HITL.md) | [Layer 4.7: Approval Queue](./LAYER_4.7_APPROVAL_QUEUE.md)

```mermaid
sequenceDiagram
    participant Agent as ReAct Agent
    participant Orchestrator as Orchestrator
    participant Queue as ApprovalQueue
    participant SSE as SSE Stream
    participant UI as Frontend UI
    participant User as User

    Note over Agent,User: Destructive Operation Flow (e.g., deletePage)

    Agent->>Orchestrator: tool-call: cms_deletePage
    Orchestrator->>Orchestrator: Check requiresApproval flag

    alt Needs Approval
        Orchestrator->>Queue: addRequest(approvalId, toolName, args)
        Queue->>SSE: Write approval-required event
        SSE->>UI: approval-required event with approvalId
        UI->>User: Show Approval Modal

        User->>UI: Click Approve/Reject
        UI->>Orchestrator: POST /approval/:id with decision
        Orchestrator->>Queue: resolveRequest(approvalId, decision)

        alt Approved
            Queue->>Orchestrator: Promise resolves (true)
            Orchestrator->>Agent: Continue execution
            Agent->>Agent: Execute tool with confirmed: true
        else Rejected
            Queue->>Orchestrator: Promise resolves (false)
            Orchestrator->>Agent: Skip tool, return cancelled
            Agent->>SSE: tool-result cancelled
        end
    else No Approval Needed
        Orchestrator->>Agent: Execute tool immediately
    end
```

---

## 7. Tool Execution Pipeline

**From tool call to database operation**

📖 **Deep dive:** [Layer 3.2: Tools](./LAYER_3.2_TOOLS.md) | [Layer 4: Services](./LAYER_4_SERVICES.md) | [Layer 2: Database](./LAYER_2_DATABASE.md)

```mermaid
flowchart TB
    subgraph AgentDecision["🤖 Agent Decision"]
        LLM[LLM Output]
        ToolCall[Tool Call<br/>name + arguments]
    end

    subgraph Validation["✅ Validation Layer"]
        ZodSchema[Zod Schema Validation]
        TypeCheck{Valid Input?}
    end

    subgraph ExecuteFunction["⚡ Execute Function"]
        ContextExtract[Extract AgentContext]
        ServiceCall[Service Method Call]
        ResultFormat[Format Result]
    end

    subgraph ServiceLayer["⚙️ Service Layer"]
        PageService[PageService]
        SectionService[SectionService]
        ImageService[ImageService]
        VectorService[VectorIndexService]
    end

    subgraph Database["💾 Database Layer"]
        Drizzle[Drizzle ORM]
        SQLite[(SQLite)]
        LanceDB[(LanceDB)]
    end

    subgraph AutoSync["🔄 Auto-Sync"]
        VectorSync[Vector Index Sync<br/>on create/update/delete]
    end

    subgraph Response["📤 Tool Response"]
        Success["success: true, data: result"]
        Error["error: message"]
    end

    LLM --> ToolCall
    ToolCall --> ZodSchema
    ZodSchema --> TypeCheck

    TypeCheck -->|Invalid| Error
    TypeCheck -->|Valid| ContextExtract

    ContextExtract --> ServiceCall
    ServiceCall --> PageService
    ServiceCall --> SectionService
    ServiceCall --> ImageService
    ServiceCall --> VectorService

    PageService --> Drizzle
    SectionService --> Drizzle
    ImageService --> Drizzle
    VectorService --> LanceDB

    Drizzle --> SQLite

    SQLite --> VectorSync
    VectorSync --> LanceDB

    ServiceCall --> ResultFormat
    ResultFormat --> Success

    style Validation fill:#ffebeb
    style ExecuteFunction fill:#e1f5ff
    style ServiceLayer fill:#e8f5e9
    style Database fill:#fff4e1
```

---

## 8. SSE Streaming Architecture

**Real-time event flow from server to client**

📖 **Deep dive:** [Layer 3.7: Streaming](./LAYER_3.7_STREAMING.md) | [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md)

```mermaid
flowchart LR
    subgraph Server["🖥️ Server"]
        Agent[Agent Orchestrator]
        Events[Event Types:<br/>- text-delta<br/>- tool-call<br/>- tool-result<br/>- approval-required<br/>- step-completed<br/>- finish<br/>- error]
        SSEWriter[SSE Writer]
    end

    subgraph Wire["📡 SSE Protocol"]
        Format["event: type<br/>data: JSON payload"]
    end

    subgraph Client["💻 Client"]
        FetchSSE[fetch with<br/>ReadableStream]
        BufferParser[Buffer Parser<br/>split on double newline]
        EventDispatch[Event Dispatch]
    end

    subgraph Stores["🗃️ Zustand Stores"]
        ChatStore[useChatStore<br/>messages, streaming]
        SessionStore[useSessionStore<br/>sessions, activeId]
    end

    subgraph UI["🎨 UI Components"]
        ChatPane[ChatPane]
        MessageBubble[MessageBubble]
        ApprovalModal[ApprovalModal]
    end

    Agent --> Events
    Events --> SSEWriter
    SSEWriter --> Format
    Format --> FetchSSE
    FetchSSE --> BufferParser
    BufferParser --> EventDispatch

    EventDispatch -->|text-delta| ChatStore
    EventDispatch -->|tool-result| ChatStore
    EventDispatch -->|approval-required| SessionStore

    ChatStore --> ChatPane
    ChatPane --> MessageBubble
    SessionStore --> ApprovalModal

    style Server fill:#e1f5ff
    style Client fill:#e8f5e9
    style Stores fill:#fff4e1
```

---

## 9. Error Recovery & Checkpointing

**Reliability mechanisms that ensure data integrity**

📖 **Deep dive:** [Layer 3.6: Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) | [Layer 4.2: Session Management](./LAYER_4.2_SESSION_MANAGEMENT.md)

```mermaid
flowchart TB
    subgraph Execution["⚡ Execution"]
        ToolExec[Tool Execution]
        StepN[Step N]
    end

    subgraph RetryLogic["🔄 Retry Logic"]
        Attempt{Attempt less than 3?}
        Backoff[Exponential Backoff<br/>1s, 2s, 4s]
        MaxRetries[Max Retries Exceeded]
    end

    subgraph Checkpoint["💾 Checkpoint System"]
        StepCheck{Every 3 steps?}
        SaveMessages[sessionService.saveMessages]
        SaveMemory[Serialize WorkingMemory]
    end

    subgraph Recovery["🔧 Recovery"]
        SessionLoad[Load Session]
        RestoreMessages[Restore Messages]
        RestoreMemory[Restore WorkingMemory]
        ResumeAgent[Resume Agent]
    end

    subgraph ErrorTypes["⚠️ Error Classification"]
        Transient[Transient<br/>timeout, rate limit]
        Validation[Validation<br/>missing field]
        NotFound[Not Found<br/>invalid ID]
        Critical[Critical<br/>unrecoverable]
    end

    ToolExec -->|error| Attempt
    Attempt -->|yes| Backoff
    Backoff --> ToolExec
    Attempt -->|no| MaxRetries

    StepN --> StepCheck
    StepCheck -->|yes| SaveMessages
    SaveMessages --> SaveMemory
    StepCheck -->|no| StepN

    SessionLoad --> RestoreMessages
    RestoreMessages --> RestoreMemory
    RestoreMemory --> ResumeAgent

    MaxRetries --> Transient
    MaxRetries --> Validation
    MaxRetries --> NotFound
    MaxRetries --> Critical

    style RetryLogic fill:#ffebeb
    style Checkpoint fill:#e8f5e9
    style Recovery fill:#e1f5ff
```

---

## 10. Complete Data Flow Sequence

**End-to-end message lifecycle**

📖 **All layers:** [Layer 1](./LAYER_1_SERVER_CORE.md) | [Layer 2](./LAYER_2_DATABASE.md) | [Layer 3](./LAYER_3_AGENT.md) | [Layer 4](./LAYER_4_SERVICES.md) | [Layer 6](./LAYER_6_CLIENT.md)

```mermaid
sequenceDiagram
    participant User as User
    participant UI as React UI
    participant Store as Zustand Store
    participant SSE as SSE Client
    participant Route as Express Route
    participant Container as ServiceContainer
    participant Context as Context Assembly
    participant Prompt as Prompt Compiler
    participant Memory as Working Memory
    participant Agent as ToolLoopAgent
    participant Tool as Tool Registry
    participant Service as CMS Services
    participant DB as SQLite + Vector

    Note over User,DB: Complete Request Lifecycle

    User->>UI: Type message, press Enter
    UI->>Store: dispatch addMessage
    Store->>SSE: POST /v1/agent/stream

    SSE->>Route: HTTP Request (SSE)
    Route->>Container: getContainer()
    Container->>Context: Build AgentContext
    Context->>Memory: Load working memory
    Memory-->>Context: Recent entities
    Context->>Prompt: Compile prompt
    Prompt-->>Context: System prompt + memory

    Context->>Agent: Initialize ToolLoopAgent

    loop ReAct Loop (max 15 steps)
        Agent->>Agent: THINK - Analyze context
        Agent->>Memory: Check "the page" reference
        Memory-->>Agent: page-123

        Agent->>Tool: ACT - Call tool
        Tool->>Tool: Validate with Zod
        Tool->>Service: Execute via context
        Service->>DB: Query/Mutate
        DB-->>Service: Result
        Service-->>Tool: Data
        Tool-->>Agent: Tool result

        Route-->>SSE: SSE: tool-result event
        SSE-->>Store: Update messages
        Store-->>UI: Re-render

        Agent->>Memory: OBSERVE - Extract entities
        Memory->>Memory: Add to sliding window

        Agent->>Agent: Check stop condition
    end

    Agent->>Route: FINAL_ANSWER
    Route-->>SSE: SSE: finish event
    SSE-->>Store: Mark complete
    Store-->>UI: Show final message
    UI-->>User: Display response
```

---

## Quick Reference: Component Mapping

| Diagram Component | Source File                            | Layer Doc                                                 |
| ----------------- | -------------------------------------- | --------------------------------------------------------- |
| ToolLoopAgent     | `server/agent/orchestrator.ts`         | [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md)               |
| ALL_TOOLS         | `server/tools/all-tools.ts`            | [3.2 Tools](./LAYER_3.2_TOOLS.md)                         |
| WorkingContext    | `server/services/working-memory/`      | [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md)       |
| react.xml         | `server/prompts/react.xml`             | [3.4 Prompts](./LAYER_3.4_PROMPTS.md)                     |
| ApprovalQueue     | `server/services/approval-queue.ts`    | [3.5 HITL](./LAYER_3.5_HITL.md)                           |
| Retry Logic       | `server/agent/orchestrator.ts`         | [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md)       |
| SSE Writer        | `server/routes/agent.ts`               | [3.7 Streaming](./LAYER_3.7_STREAMING.md)                 |
| AgentContext      | `server/agent/orchestrator.ts`         | [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) |
| ServiceContainer  | `server/services/service-container.ts` | [1.2 Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) |
| useAgent          | `app/assistant/_hooks/use-agent.ts`    | [6.2 SSE Streaming](./LAYER_6.2_SSE_STREAMING.md)         |
| useChatStore      | `app/assistant/_stores/`               | [6.1 State Management](./LAYER_6.1_STATE_MANAGEMENT.md)   |

---

## Key Architectural Insights

### 1. Native AI SDK v6 Pattern

Tools receive context via `experimental_context`, eliminating closures and global state.

### 2. Single Agent, All Tools

No mode switching or tool filtering. The agent always has access to all 21 tools.

### 3. Working Memory = Token Savings

Entity tracking reduces repeated context by 70%, enabling natural reference resolution.

### 4. HITL = Safety Net

Destructive operations pause for user approval before execution.

### 5. Checkpoint = Reliability

State is saved every 3 steps, enabling recovery from crashes.

### 6. SSE = Real-time UX

Events stream to the UI as they happen, not batched at the end.
