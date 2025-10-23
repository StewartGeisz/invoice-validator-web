// Amplify API Client for LLM-enhanced invoice validation

interface AmplifyUploadResponse {
  success: boolean;
  uploadUrl?: string;
  id?: string;
  error?: string;
}

interface AmplifyFileInfo {
  id: string;
  name: string;
  createdAt: string;
  type: string;
}

interface AmplifyQueryResponse {
  data?: {
    items: AmplifyFileInfo[];
  };
}

interface AmplifyMessage {
  role: 'system' | 'user';
  content: string;
}

interface AmplifyChatResponse {
  data?: string;
  success?: boolean;
  error?: string;
}

class AmplifyClient {
  private apiKey: string;
  private baseUrl = 'https://prod-api.vanderbilt.ai';

  constructor() {
    this.apiKey = process.env.AMPLIFY_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('AMPLIFY_API_KEY not found in environment variables');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<AmplifyUploadResponse> {
    try {
      // Step 1: Get presigned URL
      const uploadUrl = `${this.baseUrl}/files/upload`;
      const payload = {
        data: {
          type: mimeType,
          name: fileName,
          knowledgeBase: 'invoice_validation',
          tags: ['invoice', 'validation', 'pdf'],
          data: {},
          actions: [
            { name: 'saveAsData' },
            { name: 'createChunks' },
            { name: 'ingestRag' },
            { name: 'makeDownloadable' },
            { name: 'extractText' },
          ],
          ragOn: true,
        },
      };

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Upload request failed: ${response.status} ${response.statusText}`);
      }

      const uploadResponse: AmplifyUploadResponse = await response.json();

      if (!uploadResponse.success || !uploadResponse.uploadUrl) {
        throw new Error(`Upload failed: ${uploadResponse.error || 'No upload URL received'}`);
      }

      // Step 2: Upload file to S3
      const s3Response = await fetch(uploadResponse.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: fileBuffer,
      });

      if (!s3Response.ok) {
        throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
      }

      console.log(`✅ File uploaded successfully: ${fileName}`);
      return uploadResponse;

    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  async queryFiles(fileName?: string): Promise<AmplifyFileInfo[]> {
    try {
      const queryUrl = `${this.baseUrl}/files/query`;
      const payload = {
        data: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          pageSize: 50,
          pageIndex: 0,
          forwardScan: true,
          sortIndex: 'createdAt',
          types: ['application/pdf', 'text/plain'],
          tags: [],
        },
      };

      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.status} ${response.statusText}`);
      }

      const queryResponse: AmplifyQueryResponse = await response.json();
      const files = queryResponse.data?.items || [];

      if (fileName) {
        return files.filter(file => file.name === fileName);
      }

      return files;
    } catch (error) {
      console.error('Query error:', error);
      return [];
    }
  }

  async waitForFileProcessing(fileName: string, maxAttempts: number = 30, waitSeconds: number = 10): Promise<string | null> {
    console.log(`Waiting for file '${fileName}' to be processed...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt}/${maxAttempts} - Checking if file is available...`);

      const files = await this.queryFiles(fileName);
      const file = files.find(f => f.name === fileName);

      if (file?.id) {
        console.log(`✅ File is now available for use! File ID: ${file.id}`);
        return file.id;
      }

      if (attempt < maxAttempts) {
        console.log(`File not ready yet. Waiting ${waitSeconds} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      }
    }

    console.log('❌ File did not become available within the expected time');
    return null;
  }

  async chatWithAmplify(
    message: string,
    systemMessage?: string,
    dataSourceId?: string,
    model: string = 'gpt-4o',
    temperature: number = 0.3,
    maxTokens: number = 1000
  ): Promise<AmplifyChatResponse> {
    try {
      const chatUrl = `${this.baseUrl}/chat`;

      const messages: AmplifyMessage[] = [];
      if (systemMessage) {
        messages.push({ role: 'system', content: systemMessage });
      }
      messages.push({ role: 'user', content: message });

      const payload = {
        data: {
          temperature,
          max_tokens: maxTokens,
          messages,
          dataSources: dataSourceId ? [dataSourceId] : [],
          options: {
            ragOnly: false,
            skipRag: false,
            model: { id: model },
            prompt: message,
          },
        },
      };

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Helper function to extract JSON from LLM responses
  extractJsonFromResponse(response: string): any {
    try {
      // Remove markdown code blocks if present
      let jsonContent = response;
      if (response.includes('```json')) {
        const startMarker = '```json';
        const endMarker = '```';
        const startIdx = response.indexOf(startMarker) + startMarker.length;
        const endIdx = response.indexOf(endMarker, startIdx);
        if (endIdx !== -1) {
          jsonContent = response.substring(startIdx, endIdx).trim();
        }
      }

      // Try to parse JSON
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to parse JSON from LLM response:', error);
      console.error('Raw response:', response);
      return null;
    }
  }
}

export default AmplifyClient;