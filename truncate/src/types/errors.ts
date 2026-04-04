export interface TruncateError {
    code: string;
    message: string;
    hint: string | null;
}

export type ErrorCode = 
    | "CLI_NOT_FOUND" 
    | "OLLAMA_NOT_RUNNING" 
    | "OLLAMA_NOT_INSTALLED" 
    | "DATABASE_CONNECTION_FAILED" 
    | "QUERY_SAFETY_VIOLATION" 
    | "INTERNAL_ERROR";
