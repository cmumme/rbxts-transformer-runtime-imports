import ts, { EmitHint, EntityName, ExpressionStatement, NamedImports, NewLineKind, NodeFlags, Statement, SyntaxKind, factory } from "typescript"

/**
 * This is the transformer's configuration, the values are passed from the tsconfig.
 */
export interface TransformerConfig {
	_: void;
}

/**
 * This is a utility object to pass around your dependencies.
 *
 * You can also use this object to store state, e.g prereqs.
 */
export class TransformContext {
	public factory: ts.NodeFactory;

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory
	}

	/**
	 * Transforms the children of the specified node.
	 */
	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(node, (node) => visitNode(this, node), this.context)
	}
}

function cleanImportPath(importPath: string) {
	importPath = `_${importPath}_import_data`
	importPath = importPath.replace(/\//gi, "_")
	importPath = importPath.replace(/[^a-z_$]/gi, "")

	return importPath
}

function runServiceCall(methodName: string) {
	return factory.createCallExpression(
		factory.createPropertyAccessExpression(
			factory.createCallExpression(
				factory.createPropertyAccessExpression(
					factory.createIdentifier("game"),
					"GetService"
				),
				undefined,
				[factory.createStringLiteral("RunService")]
			),
			methodName
		),
		undefined,
		[]
	)
}

function assignROIExpression(importPath: string) {
	return factory.createExpressionStatement(
		factory.createCallExpression(
			factory.createParenthesizedExpression(
				factory.createArrowFunction(
					[
						factory.createModifier(SyntaxKind.AsyncKeyword)
					],
					undefined,
					[ ],
					undefined,
					undefined,
					factory.createBlock([
						factory.createExpressionStatement(
							factory.createBinaryExpression(
								factory.createIdentifier(cleanImportPath(importPath)),
								factory.createToken(SyntaxKind.EqualsToken),
								factory.createAwaitExpression(
									factory.createCallExpression(
										factory.createIdentifier("import"), // how do i put a SyntaxKind.ImportKeyword token in here
										undefined,
										[
											factory.createStringLiteral(importPath)
										]
									)
								)
							)
						)
					])
				)
			),
			undefined,
			undefined
		)
	)
}

function waitForROILoop(importPath: string) {
	return factory.createWhileStatement(
		factory.createBinaryExpression(
			factory.createIdentifier(cleanImportPath(importPath)),
			factory.createToken(SyntaxKind.EqualsEqualsEqualsToken),
			factory.createIdentifier("undefined")
		),
		factory.createBlock([
			factory.createExpressionStatement(
				factory.createCallExpression(
					factory.createPropertyAccessExpression(
						factory.createIdentifier("task"),
						"wait"
					),
					undefined,
					undefined
				)
			)
		])
	)
}

function assignDefaultExport(importPath: string, name: string) {
	return factory.createExpressionStatement(
		factory.createBinaryExpression(
			factory.createIdentifier(name),
			factory.createToken(SyntaxKind.EqualsToken),
			factory.createAsExpression(
				factory.createAsExpression(
					factory.createPropertyAccessExpression(factory.createIdentifier(cleanImportPath(importPath)), "default"),
					factory.createTypeReferenceNode("unknown")
				),
				getImportType(importPath)
			)
		)
	)
}

function assignNamedBindings(namedBindings: NamedImports, importPath: string): ExpressionStatement[] {
	return namedBindings.elements.map((importSpecifier) => {
		return factory.createExpressionStatement(
			factory.createBinaryExpression(
				factory.createIdentifier(importSpecifier.name.text),
				factory.createToken(SyntaxKind.EqualsToken),
				factory.createPropertyAccessExpression(factory.createIdentifier(cleanImportPath(importPath)), importSpecifier.propertyName ?? importSpecifier.name.text)
			)
		)
	})
}

function runtimeImportBody(importPath: string, namedBindings?: NamedImports, name?: string) {
	return factory.createBlock([
		assignROIExpression(importPath),
		waitForROILoop(importPath),
		name ? assignDefaultExport(importPath, name) : undefined,
		...(namedBindings ? assignNamedBindings(namedBindings, importPath) : [])
	].filter(e => e !== undefined) as Statement[])
}

function getImportType(importPath: string, qualifier?: EntityName, isTypeOf = true) {
	const importTypeNode = factory.createImportTypeNode( // The overload that's recommended literally doesn't work
		factory.createLiteralTypeNode(factory.createStringLiteral(importPath)),
		undefined,
		qualifier,
		undefined,
		isTypeOf
	)

	return importTypeNode
}

function visitImportDeclaration(context: TransformContext, node: ts.ImportDeclaration) {
	const { factory } = context
	const sourceFile = node.getSourceFile()

	const path = node.moduleSpecifier
	const clause = node.importClause
	if (!clause) return node
	if (!ts.isStringLiteral(path)) return node

	const namedBindings = clause.namedBindings
	if (namedBindings && !ts.isNamedImports(namedBindings)) return node

	const leadingTriviaRange = (ts.getLeadingCommentRanges(sourceFile.getFullText(), node.getFullStart()) ?? [])[0]
	if(!leadingTriviaRange) return node
	const leadingTriviaText = sourceFile.getFullText().slice(leadingTriviaRange.pos, leadingTriviaRange.end).toLowerCase()
	if(!leadingTriviaText.startsWith("//@runtime")) return node

	const leadingTriviaSections = leadingTriviaText.split(" ")
	const leadingTriviaRuntimeArg = leadingTriviaSections[1]
	if(leadingTriviaRuntimeArg !== "server" && leadingTriviaRuntimeArg !== "client") return node

	return [
		factory.createVariableStatement(undefined, factory.createVariableDeclarationList([
			factory.createVariableDeclaration(cleanImportPath(path.text), factory.createToken(SyntaxKind.ExclamationToken), getImportType(path.text)),
		], NodeFlags.Let)),
		clause.name ? 
			factory.createVariableStatement(undefined, factory.createVariableDeclarationList([
				factory.createVariableDeclaration(
					clause.name,
					factory.createToken(SyntaxKind.ExclamationToken),
					getImportType(path.text)
				),
			], NodeFlags.Let)) : undefined,
		...(namedBindings ?
			namedBindings.elements.map((importSpecifier) => {
				return factory.createVariableStatement(undefined, factory.createVariableDeclarationList([
					factory.createVariableDeclaration(importSpecifier.name.text, factory.createToken(SyntaxKind.ExclamationToken), getImportType(path.text, factory.createIdentifier(importSpecifier.propertyName?.text ?? importSpecifier.name.text))),
				], NodeFlags.Let))
			}) : []),
		factory.createIfStatement(
			runServiceCall(leadingTriviaRuntimeArg == "server" ? "IsServer" : "IsClient"),
			runtimeImportBody(path.text, namedBindings, clause.name?.text)
		)
	].filter(e => e !== undefined) as Statement[]
}

function visitStatement(context: TransformContext, node: ts.Statement): ts.Statement | ts.Statement[] {
	// This is used to transform statements.
	// TypeScript allows you to return multiple statements here.

	if (ts.isImportDeclaration(node)) {
		// We have encountered an import declaration,
		// so we should transform it using a separate function.

		return visitImportDeclaration(context, node)
	}

	return context.transform(node)
}

function visitNode(context: TransformContext, node: ts.Node): ts.Node | ts.Node[] {
	if (ts.isStatement(node)) {
		return visitStatement(context, node)
	}

	// We encountered a node that we don't handle above,
	// but we should keep iterating the AST in case we find something we want to transform.
	return context.transform(node)
}
