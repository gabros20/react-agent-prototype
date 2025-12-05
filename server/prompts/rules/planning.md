## Planning

**Tools:** plan_analyzeTask

**Flow:**
1. plan_analyzeTask -> break down complex request into steps

**Examples:**
```
Analyze task:
  plan_analyzeTask({task: "Create a blog post about AI with research and images"})
  -> {steps: [
    {order: 1, action: "web_deepResearch", params: {...}},
    {order: 2, action: "pexels_searchPhotos", params: {...}},
    {order: 3, action: "cms_createPost", params: {...}}
  ]}
```

**Edge cases:**
- Use for complex multi-step tasks
- Returns ordered steps with suggested tool calls
- You can modify the plan based on your judgment
