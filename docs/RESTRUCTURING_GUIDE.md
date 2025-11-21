# Knowledge Base Document Restructuring Guide

**Purpose**: Standardize and normalize the format of knowledge base documents using `DOCUMENTATION_TEMPLATE.md` as the structure guide.

**Version**: 1.0 (Created 2025-11-21)
**Reference Example**: [0.1.4 Sampling Parameters](./kb/0-foundations/0.1.4-sampling-parameters.md) (restructured 2025-11-21)

---

## Quick Reference: Restructuring Process

### Phase 1: Research & Planning (2-3 hours)

1. **Read the template** (`DOCUMENTATION_TEMPLATE.md` line 1-1088)
   - Understand required vs optional sections
   - Review code usage philosophy (sparse, not tutorial)
   - Study ASCII diagram guidelines

2. **Research latest 2024-2025 sources**
   - Use `mcp__perplexity__search` for shallow, broad search
   - Use `mcp__perplexity__reason` for deep, comparative analysis
   - Use web search tool for up-to-date resource links
   - Aim for 5-10 sources (academic papers + production systems)

3. **Audit existing document**
   - Read entire existing document to extract valuable content
   - Identify outdated information vs timeless principles
   - Note any missing sections compared to template

### Phase 2: Restructuring (2-4 hours)

4. **Draft TL;DR** (3-5 minutes)
   - One sentence capturing essence + key benefit
   - Include 2024-2025 research findings
   - Add Status, Last Updated, Versions, Prerequisites, Grounded In

5. **Organize content into template sections**

   **Always Include**:
   - Overview (why this topic matters)
   - The Problem (clear problem statement)
   - Core Concept (explanation + ASCII diagrams)
   - Implementation Patterns (3-4 patterns with pros/cons)
   - When to Use (✅/❌ decision matrix)
   - Key Takeaways (3-5 bullets)
   - References (numbered citations)

   **Include When Relevant**:
   - Framework Integration (for implementation-heavy topics)
   - Research & Benchmarks (academic findings + production data)
   - Production Best Practices (real-world guidance)
   - Observability & Debugging (for agent/complex patterns)
   - Token Efficiency (for context-heavy topics)
   - Trade-offs & Considerations (advantages/disadvantages)
   - Integration with Your Codebase (codebase-specific examples)

6. **Restructure section by section**
   - Use existing content as foundation
   - Add 2024-2025 research findings
   - Add ASCII diagrams (NOT Mermaid)
   - Minimize code (only non-obvious patterns)
   - Update all links to point to related topics

7. **Create Table of Contents**
   - Include for documents >500 lines
   - Match exact section headers
   - Add anchor links

### Phase 3: Validation & Publishing (1-2 hours)

8. **Quality Checklist** (before marking ✅ Complete)
   - [ ] TL;DR captures essence (one sentence)
   - [ ] Problem clearly stated with concrete example
   - [ ] 3-4 implementation patterns with pros/cons
   - [ ] "When to Use" with ✅/❌ scenarios
   - [ ] 5+ citations from 2024-2025 sources
   - [ ] Key Takeaways summarize in 3-5 bullets
   - [ ] ASCII diagrams used (no Mermaid)
   - [ ] Code included only for non-obvious patterns
   - [ ] All code examples use TypeScript
   - [ ] Metrics/percentages included where applicable
   - [ ] Related topics linked
   - [ ] Table of Contents accurate

9. **Update AI_KNOWLEDGE_BASE_TOC.md**
   - Update section header with new title
   - Update Status to ✅ Complete - [description]
   - Update Length (approximate line count)
   - Update Includes (key concepts covered)
   - Add Updated date (YYYY-MM-DD)

10. **Commit changes**
    - Commit with clear message
    - Reference template and research used
    - Example: "docs: restructure 0.1.4 sampling parameters per DOCUMENTATION_TEMPLATE, add Min-P sampling (ICLR 2025) and multi-temperature research"

---

## Template Structure Overview

### Required Sections

```markdown
# [Layer].[Section].[Topic] - [Title]

## TL;DR
[1-3 sentences] **Status**: ✅ Complete | 🚧 In Progress | ⏳ Pending
**Last Updated**: YYYY-MM-DD
**Versions**: [Framework versions if applicable]
**Prerequisites**: [Link to prerequisite docs]
**Grounded In**: [Key research papers, 2024-2025]

---

## Overview
[2-3 paragraphs] + Key Research Findings (2024-2025)

---

## The Problem: [Clear problem statement]
### The Classic Challenge
[Concrete scenario showing the problem]
**Problems**: ❌ [Issues with impact]
### Why This Matters
[Business/technical impact]

---

## Core Concept: [Topic Name]
### What is [Concept]?
[Definition in plain English]
### Visual Representation
[ASCII diagrams only - no Mermaid]
### Key Principles
1. **[Principle 1]**: [Explanation]
2. **[Principle 2]**: [Explanation]

---

## Implementation Patterns

### Pattern 1: [Name]
**Use Case**: [When to use]
**Pros**: ✅ [Benefits]
**Cons**: ❌ [Limitations]
**When to Use**: [Specific scenarios]

### Pattern 2: [Name]
[Repeat above]

### Pattern 3: [Name]
[Repeat above]

---

## [Optional Sections as Needed]
- Framework Integration
- Research & Benchmarks (2024-2025)
- When to Use This Pattern
- Production Best Practices
- Observability & Debugging
- Token Efficiency
- Trade-offs & Considerations
- Integration with Your Codebase

---

## Key Takeaways
1. **[Core Insight 1]** - [One sentence]
2. **[Core Insight 2]** - [One sentence]
3. **[Core Insight 3]** - [One sentence]

**Quick Implementation Checklist**:
- [ ] [Action 1]
- [ ] [Action 2]

---

## References
1. **[Paper 1]**: [Authors], "[Title]", [Venue/Date], [URL]
2. **[Paper 2]**: [Authors], "[Title]", [Venue/Date], [URL]

---

**Related Topics**:
- [Link to previous topic]
- [Link to next topic]
- [Link to related topic]

**Layer Index**: [Layer N: Name](docs/AI_KNOWLEDGE_BASE_TOC.md#layer-n)
```

---

## Key Guidelines

### Code Usage Philosophy

**DO include code when**:
- Showing non-obvious implementation details
- Demonstrating critical error handling
- Revealing performance-critical patterns
- Clarifying complex abstractions

**DON'T include code for**:
- Simple API calls engineers already know
- Basic CRUD operations
- Standard framework patterns
- Obvious type definitions

**Maximum code length**: 20 lines per example
**Language**: TypeScript (unless otherwise specified)
**Approach**: Focus on the critical 2-3 lines that matter

### ASCII Diagram Guidelines

**Use ASCII exclusively** (not Mermaid):
- Keep diagrams under 15 lines
- Use Unicode box-drawing: ┌ ┐ └ ┘ ├ ┤ ─ │ ↓ →
- Align elements consistently
- Add brief labels inside boxes
- Test in monospace font

**Common patterns**:
```
Linear Flow:       Input → Process → Output
Branching:         Input ↓ Decision ├─ Option A
                                    └─ Option B
Loop:              ┌─── LOOP ───┐
                   ↓             │
                 Step → Continue?
                   └─────────────┘
Hierarchy/Tree:    Root
                    ├── Child A
                    │    ├── Grandchild 1
                    │    └── Grandchild 2
                    └── Child B
```

### Research Grounding (2024-2025)

**Required**: Minimum 5+ citations from 2024-2025 sources
**Preferred sources**:
- arXiv papers (cite with link)
- ACL/EMNLP/NeurIPS proceedings
- Conference papers
- Production system case studies
- Official documentation (for frameworks)

**Citation format**:
```
1. **[Title]**: [Authors], "[Full Title]", [Conference/Venue], [Year], [URL]
2. **[Abbreviated]**: [Author et al.], "[Short Title]", [Venue 2025], [doi or URL]
```

### Metrics & Quantification

**Include when available**:
- Performance improvements: "X% improvement" or "Y point gain"
- Cost savings: "$X/month at scale" or "X% token reduction"
- Capability effects: "192% performance variance", "+7.3 points"
- Timing: "2-3 days implementation", "4-6 weeks ROI"

**Avoid**:
- Vague claims ("significantly better")
- Unverified assertions
- Outdated benchmarks

---

## Example: Restructuring a Document

### Before Restructuring (Old Format)

```markdown
# 0.1.4 Sampling Parameters

**Layer**: 0 - Foundations
**Prerequisites**: [Link]
**Next**: [Link]

---

## Overview
[Paragraph without research dates]

## The Probability Distribution
[Section without 2024-2025 grounding]

## Sampling Methods
[List of methods without decision matrix]

## Common Pitfalls
[Section without template structure]
```

### After Restructuring (New Template)

```markdown
# 0.1.4 - Sampling Parameters: Temperature, Top-P, Top-K

## TL;DR
Control how LLMs select tokens by adjusting temperature, top-p, top-k—with 2024-2025 research
showing min-p sampling and multi-temperature scaling unlock 7-8% performance gains and 90%+
cost reductions for tool calling.

**Status**: ✅ Complete
**Last Updated**: 2025-11-21
**Versions**: AI SDK 6.0+, OpenAI API, Anthropic Claude (2024-2025)
**Prerequisites**: [0.1.1 LLM Intro](./0.1.1-llm-intro.md), [0.1.3 Context Windows](./0.1.3-context-windows.md)
**Grounded In**: Min-p Sampling (ICLR 2025), Monte Carlo Temperature (TrustNLP 2025),
Temperature Scaling for Test-Time (2025)

---

## Overview
[2-3 paragraphs explaining the topic]

**Key Research Finding** (2024-2025):
- **Min-p Sampling** (ICLR 2025): Dynamic, confidence-aware truncation outperforms top-p/top-k
- **Temperature Paradox Resolved**: Different temperatures solve different problem subsets
- **Multi-Temperature Scaling**: +7.3 point improvements on reasoning benchmarks

**Date Verified**: 2025-11-21

---

## The Problem: [Clear Title]
### The Classic Challenge
[Problem with code example if needed]
**Problems**:
- ❌ [Issue 1 with impact]
- ❌ [Issue 2 with impact]

### Why This Matters
[Business/technical impact with numbers]

---

## Core Concept: [Title]
### [Key concept explanation]
### Visual Representation
[ASCII diagrams here]
### Key Principles
1. **[Principle]**: [Explanation]
2. **[Principle]**: [Explanation]

---

## Implementation Patterns
[3-4 detailed patterns with pros/cons/use cases]

---

## Research & Benchmarks (2024-2025)
### Academic Research Breakthroughs
- Min-P Sampling (ICLR 2025)
- Monte Carlo Temperature (TrustNLP 2025)
- Temperature Scaling for Test-Time Compute (2025)

### Production Benchmarks
[Real-world performance data with cost analysis]

---

## Key Takeaways
1. **[Insight 1]** - [One sentence]
2. **[Insight 2]** - [One sentence]
3. **[Insight 3]** - [One sentence]

---

## References
1. **Min-P Sampling**: [Citation with link]
2. **Monte Carlo Temperature**: [Citation with link]
[... more citations ...]
```

---

## Practical Workflow

### Step-by-Step Execution

```bash
# 1. Create a branch for restructuring
git checkout -b docs/restructure-0.1.4-sampling-parameters

# 2. Read the template
# File: DOCUMENTATION_TEMPLATE.md (lines 1-1088)

# 3. Research latest 2024-2025 sources
# Use Perplexity/web search to ground content in current research

# 4. Restructure the document
# Edit: docs/kb/0-foundations/0.1.4-sampling-parameters.md

# 5. Update the TOC
# Edit: docs/AI_KNOWLEDGE_BASE_TOC.md
# Update the entry for 0.1.4 with new status/content

# 6. Quality check
# Review against template quality checklist

# 7. Commit with clear message
git add docs/kb/0-foundations/0.1.4-sampling-parameters.md docs/AI_KNOWLEDGE_BASE_TOC.md
git commit -m "docs: restructure 0.1.4 sampling parameters per DOCUMENTATION_TEMPLATE

- Added Min-P sampling (ICLR 2025) and multi-temperature research
- Restructured with new template: TL;DR, Overview, Problem, Core Concept, Patterns
- Added production benchmarks and capability-specific guidance
- 1050+ lines with comprehensive observability and token efficiency sections
- 10+ academic citations (2024-2025), real-world cost analysis
- Updated TOC with new status and content descriptors"

# 8. Push and create PR
git push origin docs/restructure-0.1.4-sampling-parameters
```

---

## Common Pitfalls & Solutions

| Pitfall | Issue | Solution |
|---------|-------|----------|
| **Missing 2024-2025 research** | Document feels outdated | Search for papers published in last 1-2 years; check conference proceedings (ICLR, ACL, EMNLP) |
| **Code-heavy documentation** | Treats doc as tutorial | Remember: code should teach something non-obvious; 20 lines max per example |
| **No decision framework** | Unclear when to use pattern | Add "When to Use" section with ✅/❌ decision matrix |
| **Vague metrics** | Unverifiable claims | Replace "significantly better" with "X% improvement" backed by citation |
| **Mermaid diagrams** | Non-compliant with template | Use ASCII art only; test in monospace font |
| **Outdated links** | References point to moved content | Verify all links work; use relative paths for internal docs |
| **Missing table of contents** | Hard to navigate long docs | Add TOC for documents >500 lines; many editors auto-generate |
| **Weak reference section** | Hard to trace sources | Include 5+ citations; use full author names and publication venues |

---

## Expected Effort & Timeline

| Phase | Task | Time | Difficulty |
|-------|------|------|-----------|
| Research | Read template + search 2024-2025 sources | 2-3 hrs | ⭐⭐ |
| Restructure | Reorganize content into template sections | 2-4 hrs | ⭐⭐⭐ |
| Polish | Add diagrams, code examples, references | 1-2 hrs | ⭐⭐ |
| Validate | Quality checklist + TOC update | 1 hr | ⭐ |
| **Total** | **Complete restructuring** | **6-10 hrs** | **Moderate** |

**ROI**: Well-structured docs save 5-10 hours in future maintenance; enable easier cross-referencing; establish consistent knowledge base structure.

---

## Troubleshooting

### "My document doesn't fit the template structure"

**Solution**: Use the template flexibly. Core sections are always:
- TL;DR (required)
- Overview (required)
- The Problem (required)
- Core Concept (required)
- Implementation Patterns (required)
- When to Use (required)
- Key Takeaways (required)
- References (required)

Optional sections can be added/skipped based on content type.

### "I can't find 2024-2025 research for this topic"

**Solution**:
1. Search arXiv.org for papers from past 12-18 months
2. Check ACL/EMNLP/NeurIPS 2024-2025 proceedings
3. Look for "2024" or "2025" in publication date
4. Use production case studies if academic papers unavailable
5. Note the date gap if research is sparse ("Limited recent research; grounded in 2023-2024 findings")

### "My ASCII diagram doesn't render correctly"

**Solution**:
1. Test in monospace font (markdown preview might not match)
2. Keep diagrams under 15 lines
3. Use consistent spacing/alignment
4. Avoid complex nested structures
5. If too complex, break into multiple simple diagrams

---

## Next Documents to Restructure

**Priority: High** (Foundational, heavily referenced):
- 0.1.2 Training vs Inference
- 0.1.3 Context Windows (partially done)
- 0.1.5 Model Selection Guide

**Priority: Medium** (Implementation-heavy):
- 3.1.1-agent-definition.md
- 3.2.1-react-loop.md
- 5.1.1-embedding-documents.md

**Priority: Low** (Specialized topics):
- 8.1.1-tool-catalog.md
- 10.1.1-orchestrator-pattern.md
- 12.1.1-self-improving-agents.md

---

## Questions?

Refer back to:
- **Template structure**: [DOCUMENTATION_TEMPLATE.md](./DOCUMENTATION_TEMPLATE.md) (line 1-1088)
- **Real example**: [0.1.4 Sampling Parameters](./kb/0-foundations/0.1.4-sampling-parameters.md) (restructured 2025-11-21)
- **TOC format**: [AI_KNOWLEDGE_BASE_TOC.md](./AI_KNOWLEDGE_BASE_TOC.md) (updates for completed docs)

---

**Created**: 2025-11-21
**Based on**: DOCUMENTATION_TEMPLATE.md
**Reference Example**: 0.1.4 Sampling Parameters (complete restructuring example)
