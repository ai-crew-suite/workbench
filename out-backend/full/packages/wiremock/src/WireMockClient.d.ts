export declare class WireMockClient {
    private readonly adminUrl;
    private readonly timeoutMs;
    constructor(baseUrl?: string, options?: {
        timeoutMs?: number;
    });
    /**
     * Helper utility to handle fetch requests safely with a strict request timeout window
     */
    private safeFetch;
    registerStub(stub: Record<string, any>): Promise<string>;
    clearDynamicMocks(): Promise<void>;
    verifyRequestEmitted(method: string, urlPattern: string): Promise<boolean>;
    /**
     * Reads a folder containing WireMock JSON mappings and pushes them directly into the API plane
     */
    uploadDirectory(directoryPath: string): Promise<void>;
}
//# sourceMappingURL=WireMockClient.d.ts.map