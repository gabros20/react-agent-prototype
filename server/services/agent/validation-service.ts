/**
 * Advanced Validation Service
 * 
 * Provides comprehensive pre/post-mutation validation:
 * - Pre-mutation: Check resource existence, constraints, schema compatibility
 * - Post-mutation: Verify expected state after operation
 * - Validation reporting: Structured issues and suggestions
 * 
 * Integrated with agent tools for automatic validation
 */

import type { DrizzleDB } from '../../db/client.js'
import * as schema from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface ValidationIssue {
	type: 'error' | 'warning'
	category:
		| 'existence'
		| 'constraint'
		| 'schema'
		| 'reference'
		| 'permission'
		| 'data_integrity'
	message: string
	field?: string
	suggestion?: string
}

export interface ValidationResult {
	valid: boolean
	issues: ValidationIssue[]
	metadata?: Record<string, any>
}

export interface ValidationContext {
	logger: {
		info: (msg: string, meta?: any) => void
		warn: (msg: string, meta?: any) => void
		error: (msg: string, meta?: any) => void
	}
	traceId: string
}

export class ValidationService {
	constructor(
		private db: DrizzleDB,
		private context: ValidationContext
	) {}

	/**
	 * Validate page creation inputs
	 */
	async validatePageCreation(input: {
		slug: string
		name: string
		siteId: string
		environmentId: string
	}): Promise<ValidationResult> {
		const issues: ValidationIssue[] = []

		// 1. Check slug format
		if (!/^[a-z0-9-]{2,64}$/.test(input.slug)) {
			issues.push({
				type: 'error',
				category: 'constraint',
				field: 'slug',
				message: 'Slug must be lowercase alphanumeric with hyphens, 2-64 characters',
				suggestion: `Try: ${input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64)}`,
			})
		}

		// 2. Check slug uniqueness
		const existingPage = await this.db.query.pages.findFirst({
			where: and(
				eq(schema.pages.slug, input.slug),
				eq(schema.pages.siteId, input.siteId),
				eq(schema.pages.environmentId, input.environmentId)
			),
		})

		if (existingPage) {
			issues.push({
				type: 'error',
				category: 'constraint',
				field: 'slug',
				message: `Slug '${input.slug}' already exists in this site/environment`,
				suggestion: `Try: ${input.slug}-${Date.now().toString().slice(-4)} or ${input.slug}-new`,
			})
		}

		// 3. Check site and environment existence
		const site = await this.db.query.sites.findFirst({
			where: eq(schema.sites.id, input.siteId),
		})

		if (!site) {
			issues.push({
				type: 'error',
				category: 'existence',
				field: 'siteId',
				message: `Site '${input.siteId}' does not exist`,
				suggestion: 'Use default site ID from environment variables',
			})
		}

		const env = await this.db.query.environments.findFirst({
			where: eq(schema.environments.id, input.environmentId),
		})

		if (!env) {
			issues.push({
				type: 'error',
				category: 'existence',
				field: 'environmentId',
				message: `Environment '${input.environmentId}' does not exist`,
				suggestion: 'Use default environment ID from environment variables',
			})
		}

		// 4. Check name length
		if (input.name.length > 100) {
			issues.push({
				type: 'warning',
				category: 'constraint',
				field: 'name',
				message: 'Page name exceeds 100 characters',
				suggestion: 'Shorten page name for better UX',
			})
		}

		return {
			valid: issues.filter((i) => i.type === 'error').length === 0,
			issues,
		}
	}

	/**
	 * Validate page was created successfully
	 */
	async validatePageCreated(params: { pageId: string; expectedSlug: string }): Promise<ValidationResult> {
		const issues: ValidationIssue[] = []

		const page = await this.db.query.pages.findFirst({
			where: eq(schema.pages.id, params.pageId),
		})

		if (!page) {
			issues.push({
				type: 'error',
				category: 'existence',
				message: `Page '${params.pageId}' not found in database after creation`,
				suggestion: 'Database write may have failed - check transaction logs',
			})
		} else {
			// Verify slug matches
			if (page.slug !== params.expectedSlug) {
				issues.push({
					type: 'error',
					category: 'data_integrity',
					field: 'slug',
					message: `Page slug mismatch: expected '${params.expectedSlug}', got '${page.slug}'`,
					suggestion: 'Check if slug was modified during creation',
				})
			}
		}

		return {
			valid: issues.length === 0,
			issues,
			metadata: page ? { page } : undefined,
		}
	}

	/**
	 * Validate section definition creation
	 */
	async validateSectionDefCreation(input: {
		key: string
		name: string
		elementsStructure: any
	}): Promise<ValidationResult> {
		const issues: ValidationIssue[] = []

		// 1. Check key format
		if (!/^[a-z0-9-]{2,64}$/.test(input.key)) {
			issues.push({
				type: 'error',
				category: 'constraint',
				field: 'key',
				message: 'Section key must be lowercase alphanumeric with hyphens, 2-64 characters',
				suggestion: `Try: ${input.key.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64)}`,
			})
		}

		// 2. Check key uniqueness
		const existing = await this.db.query.sectionDefinitions.findFirst({
			where: eq(schema.sectionDefinitions.key, input.key),
		})

		if (existing) {
			issues.push({
				type: 'error',
				category: 'constraint',
				field: 'key',
				message: `Section key '${input.key}' already exists`,
				suggestion: `Try: ${input.key}-v2 or ${input.key}-${Date.now().toString().slice(-4)}`,
			})
		}

		// 3. Validate elements structure schema
		try {
			const structure = typeof input.elementsStructure === 'string'
				? JSON.parse(input.elementsStructure)
				: input.elementsStructure

			if (!structure.version || !structure.rows || !Array.isArray(structure.rows)) {
				issues.push({
					type: 'error',
					category: 'schema',
					field: 'elementsStructure',
					message: 'Invalid elements structure: missing version or rows',
					suggestion: 'Ensure structure has { version: 1, rows: [...] }',
				})
			}

			// Validate slots
			for (const row of structure.rows || []) {
				if (!row.slots || !Array.isArray(row.slots)) {
					issues.push({
						type: 'error',
						category: 'schema',
						field: 'elementsStructure',
						message: `Row ${row.id} missing slots array`,
						suggestion: 'Each row must have slots: [{ key, type, label }]',
					})
				}

				for (const slot of row.slots || []) {
					if (!slot.key || !slot.type) {
						issues.push({
							type: 'error',
							category: 'schema',
							field: 'elementsStructure',
							message: `Slot missing required fields: key or type`,
							suggestion: 'Each slot must have { key, type, label? }',
						})
					}

					// Validate element type
					const validTypes = [
						'text',
						'richText',
						'image',
						'media',
						'link',
						'option',
						'collectionRef',
					]
					if (!validTypes.includes(slot.type)) {
						issues.push({
							type: 'error',
							category: 'schema',
							field: 'elementsStructure',
							message: `Invalid element type '${slot.type}' for slot '${slot.key}'`,
							suggestion: `Valid types: ${validTypes.join(', ')}`,
						})
					}
				}
			}
		} catch (error: any) {
			issues.push({
				type: 'error',
				category: 'schema',
				field: 'elementsStructure',
				message: `Invalid JSON in elements structure: ${error.message}`,
				suggestion: 'Ensure elements structure is valid JSON',
			})
		}

		return {
			valid: issues.filter((i) => i.type === 'error').length === 0,
			issues,
		}
	}

	/**
	 * Validate content matches section definition schema
	 */
	async validateSectionContent(params: {
		sectionDefId: string
		content: Record<string, any>
	}): Promise<ValidationResult> {
		const issues: ValidationIssue[] = []

		// 1. Get section definition
		const sectionDef = await this.db.query.sectionDefinitions.findFirst({
			where: eq(schema.sectionDefinitions.id, params.sectionDefId),
		})

		if (!sectionDef) {
			issues.push({
				type: 'error',
				category: 'existence',
				message: `Section definition '${params.sectionDefId}' not found`,
				suggestion: 'Create section definition first',
			})
			return { valid: false, issues }
		}

		// 2. Parse elements structure
		const structure = typeof sectionDef.elementsStructure === 'string'
			? JSON.parse(sectionDef.elementsStructure)
			: sectionDef.elementsStructure

		// 3. Extract all slot keys
		const slotKeys = new Set<string>()
		const requiredKeys = new Set<string>()

		for (const row of structure.rows || []) {
			for (const slot of row.slots || []) {
				slotKeys.add(slot.key)
				if (slot.dataRules?.required) {
					requiredKeys.add(slot.key)
				}
			}
		}

		// 4. Check required fields
		for (const key of requiredKeys) {
			if (!(key in params.content) || params.content[key] === null || params.content[key] === '') {
				issues.push({
					type: 'error',
					category: 'schema',
					field: key,
					message: `Required field '${key}' is missing or empty`,
					suggestion: 'Provide a value for this required field',
				})
			}
		}

		// 5. Warn about extra keys (orphaned content)
		for (const key of Object.keys(params.content)) {
			if (!slotKeys.has(key)) {
				issues.push({
					type: 'warning',
					category: 'schema',
					field: key,
					message: `Field '${key}' not defined in section schema`,
					suggestion: 'Remove this field or add it to section definition',
				})
			}
		}

		return {
			valid: issues.filter((i) => i.type === 'error').length === 0,
			issues,
		}
	}

	/**
	 * Validate collection entry content
	 */
	async validateEntryContent(params: {
		collectionId: string
		content: Record<string, any>
	}): Promise<ValidationResult> {
		const issues: ValidationIssue[] = []

		// 1. Get collection definition
		const collection = await this.db.query.collectionDefinitions.findFirst({
			where: eq(schema.collectionDefinitions.id, params.collectionId),
		})

		if (!collection) {
			issues.push({
				type: 'error',
				category: 'existence',
				message: `Collection '${params.collectionId}' not found`,
				suggestion: 'Create collection definition first',
			})
			return { valid: false, issues }
		}

		// 2. Parse elements structure
		const structure = typeof collection.elementsStructure === 'string'
			? JSON.parse(collection.elementsStructure)
			: collection.elementsStructure

		// 3. Extract all slot keys and required fields
		const slotKeys = new Set<string>()
		const requiredKeys = new Set<string>()

		for (const row of structure.rows || []) {
			for (const slot of row.slots || []) {
				slotKeys.add(slot.key)
				if (slot.dataRules?.required) {
					requiredKeys.add(slot.key)
				}
			}
		}

		// 4. Check required fields
		for (const key of requiredKeys) {
			if (!(key in params.content) || params.content[key] === null || params.content[key] === '') {
				issues.push({
					type: 'error',
					category: 'schema',
					field: key,
					message: `Required field '${key}' is missing or empty`,
					suggestion: 'Provide a value for this required field',
				})
			}
		}

		// 5. Warn about extra keys
		for (const key of Object.keys(params.content)) {
			if (!slotKeys.has(key)) {
				issues.push({
					type: 'warning',
					category: 'schema',
					field: key,
					message: `Field '${key}' not defined in collection schema`,
					suggestion: 'Remove this field or add it to collection definition',
				})
			}
		}

		return {
			valid: issues.filter((i) => i.type === 'error').length === 0,
			issues,
		}
	}

	/**
	 * Validate page section addition
	 */
	async validateAddSection(params: {
		pageId: string
		sectionDefId: string
		sortOrder?: number
	}): Promise<ValidationResult> {
		const issues: ValidationIssue[] = []

		// 1. Check page exists
		const page = await this.db.query.pages.findFirst({
			where: eq(schema.pages.id, params.pageId),
		})

		if (!page) {
			issues.push({
				type: 'error',
				category: 'existence',
				field: 'pageId',
				message: `Page '${params.pageId}' not found`,
				suggestion: 'Create page first or verify page ID',
			})
		}

		// 2. Check section definition exists
		const sectionDef = await this.db.query.sectionDefinitions.findFirst({
			where: eq(schema.sectionDefinitions.id, params.sectionDefId),
		})

		if (!sectionDef) {
			issues.push({
				type: 'error',
				category: 'existence',
				field: 'sectionDefId',
				message: `Section definition '${params.sectionDefId}' not found`,
				suggestion: 'Create section definition first or verify ID',
			})
		}

		return {
			valid: issues.length === 0,
			issues,
		}
	}

	/**
	 * Format validation result as agent observation
	 */
	formatValidationResult(result: ValidationResult, operation: string): string {
		if (result.valid) {
			return `✅ Validation passed for ${operation}`
		}

		let observation = `❌ Validation failed for ${operation}\n\n`
		observation += `**Issues:**\n`

		result.issues.forEach((issue, i) => {
			const icon = issue.type === 'error' ? '🔴' : '⚠️'
			observation += `${i + 1}. ${icon} **${issue.category}**`
			if (issue.field) observation += ` (${issue.field})`
			observation += `: ${issue.message}\n`
			if (issue.suggestion) {
				observation += `   💡 **Suggestion:** ${issue.suggestion}\n`
			}
		})

		return observation
	}
}
