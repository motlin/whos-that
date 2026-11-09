// The slice of the D1 API the Worker uses, declared here so the Worker needs no global Workers types next to the DOM ones.
export interface D1Result<T>
{
	results: T[];
}
export interface D1PreparedStatement
{
	bind(...values: unknown[]): D1PreparedStatement;
	all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
	run(): Promise<unknown>;
}
export interface D1Database
{
	prepare(query: string): D1PreparedStatement;
	batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface Env
{
	DB: D1Database;
	ASSETS:
	{
		fetch(request: Request): Promise<Response>;
	};
}
