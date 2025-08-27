class AIFinancialAgent {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.authToken = null;
        this.apiKey = localStorage.getItem('google_ai_api_key');
        this.user = null;
        this.isTyping = false;
        this.mcpRequestId = 0;  // Proper MCP request ID counter
        
        this.init();
    }

    async init() {
        try {
            await this.checkAuthentication();
            this.bindEvents();
            this.setupInterface();
            await this.loadUserData();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.redirectToLogin();
        }
    }

    async checkAuthentication() {
        try {
            console.log('Checking authentication...');
            
            // Try to get auth token from sessionStorage first, then cookie
            const sessionToken = sessionStorage.getItem('auth_token');
            const cookieToken = this.getCookie('auth_token');
            
            if (sessionToken) {
                console.log('Found auth token in sessionStorage:', sessionToken.substring(0, 10) + '...');
                this.authToken = sessionToken;
            } else if (cookieToken) {
                console.log('Found auth token in cookie:', cookieToken.substring(0, 10) + '...');
                this.authToken = cookieToken;
            } else {
                console.log('No auth token found in sessionStorage or cookie');
            }
            
            const response = await this.makeRequest('/api/auth/me', 'GET');
            console.log('Auth response:', response);
            
            if (!response.success) {
                console.log('Authentication failed:', response.error || response.message);
                throw new Error('Not authenticated');
            }
            
            this.user = response.user;
            // Update token if we got one in the response
            if (response.session?.token) {
                this.authToken = response.session.token;
            }
            
            console.log('Authentication successful:', this.user.email);
            
            // Display user info
            document.getElementById('userName').textContent = response.profile.username || 'User';
            document.getElementById('userEmail').textContent = this.user.email;
            document.getElementById('userAvatar').textContent = (response.profile.username || this.user.email)[0].toUpperCase();
            
        } catch (error) {
            console.error('Authentication check failed:', error);
            throw error;
        }
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    bindEvents() {
        // API Key setup
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('apiKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });

        // Chat interface
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                document.getElementById('messageInput').value = prompt;
                this.sendMessage();
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Reset API Key
        document.getElementById('resetApiKey').addEventListener('click', () => this.resetApiKey());
    }

    setupInterface() {
        if (this.apiKey) {
            document.getElementById('apiKeySetup').classList.add('hidden');
            document.getElementById('chatInterface').classList.remove('hidden');
            document.getElementById('messageInput').disabled = false;
            document.getElementById('sendBtn').disabled = false;
        } else {
            document.getElementById('chatInterface').classList.add('hidden');
            document.getElementById('apiKeySetup').classList.remove('hidden');
        }
    }

    saveApiKey() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        if (!apiKey) {
            this.showStatus('Please enter a valid API key', 'error');
            return;
        }

        console.log('Saving new API key:', apiKey.substring(0, 10) + '...');
        localStorage.setItem('google_ai_api_key', apiKey);
        this.apiKey = apiKey;
        this.setupInterface();
        this.showStatus('API key saved successfully!', 'success');
        document.getElementById('apiKeyInput').value = '';
        
        // Verify it's saved correctly
        const savedKey = localStorage.getItem('google_ai_api_key');
        console.log('Verified saved key:', savedKey ? savedKey.substring(0, 10) + '...' : 'null');
    }

    async loadUserData() {
        try {
            // Load financial data using MCP tools
            const balanceData = await this.callMCPTool('get_account_balance', {});
            const kycData = await this.callMCPTool('get_kyc_status', {});

            if (balanceData.success) {
                document.getElementById('accountBalance').textContent = 
                    `${balanceData.data.account_balance} ${balanceData.data.currency}`;
                document.getElementById('accountCurrency').textContent = balanceData.data.currency;
            }

            if (kycData.success) {
                document.getElementById('kycStatus').textContent = kycData.data.kyc_status;
            }

        } catch (error) {
            console.error('Failed to load user data:', error);
            this.showStatus('Failed to load account data', 'error');
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || this.isTyping) return;
        
        // Add user message
        this.addMessage(message, 'user');
        input.value = '';
        
        // Show typing indicator
        this.showTyping();
        
        try {
            // Get AI response with access to MCP tools
            const response = await this.getAIResponse(message);
            this.hideTyping();
            this.addMessage(response, 'assistant');
            
        } catch (error) {
            this.hideTyping();
            console.error('AI response failed:', error);
            this.addMessage(`Sorry, I encountered an error: ${error.message}. Please check the console for details.`, 'assistant');
            this.showStatus('AI request failed', 'error');
        }
    }

    async getAIResponse(userMessage) {
        try {
            // First, gather current user context
            const context = await this.gatherUserContext();
            
            // Prepare system prompt with MCP capabilities
            const systemPrompt = `You are a helpful financial AI assistant. You have access to the user's financial data through secure MCP tools.

Current user context:
${JSON.stringify(context, null, 2)}

Available MCP tools you can call:
- get_account_balance: Get current account balance and currency
- update_account_balance: Update account balance (requires new_balance parameter)  
- get_kyc_status: Get KYC verification status
- update_kyc_status: Update KYC status (requires new_status parameter: pending, in_review, verified, rejected)

IMPORTANT SECURITY RULES:
- You can ONLY access data for the currently authenticated user
- All MCP tool calls are automatically scoped to this user's account
- Never request or display data from other users
- Be helpful with financial advice but remind users you're not a licensed financial advisor

When you need to call MCP tools, use this exact format:
[MCP_CALL: tool_name({"param": "value"})]

Be conversational and helpful. Explain your actions when calling tools.`;

            // Call Google AI
            console.log('Calling Google AI API...');
            console.log('API Key present:', !!this.apiKey);
            console.log('API Key value:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'null');
            console.log('API Key from localStorage:', localStorage.getItem('google_ai_api_key') ? localStorage.getItem('google_ai_api_key').substring(0, 10) + '...' : 'null');
            console.log('User message:', userMessage);
            
            const requestBody = {
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\nUser: ${userMessage}`
                    }]
                }]
            };
            
            console.log('Request body:', requestBody);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('AI API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('AI API error response:', errorText);
                throw new Error(`AI API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            let aiResponse = data.candidates[0]?.content?.parts[0]?.text || 'No response generated.';

            // Process MCP tool calls in the response
            aiResponse = await this.processMCPCalls(aiResponse);

            return aiResponse;

        } catch (error) {
            console.error('AI response error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            throw error;
        }
    }

    async processMCPCalls(text) {
        const mcpCallRegex = /\[MCP_CALL:\s*(\w+)\((.*?)\)\]/g;
        let processedText = text;
        let match;

        while ((match = mcpCallRegex.exec(text)) !== null) {
            const toolName = match[1];
            const paramsStr = match[2];
            
            try {
                const params = JSON.parse(paramsStr);
                const result = await this.callMCPTool(toolName, params);
                
                const replacement = result.success 
                    ? `✅ ${toolName} result: ${JSON.stringify(result.data, null, 2)}`
                    : `❌ ${toolName} failed: ${result.error}`;
                
                processedText = processedText.replace(match[0], replacement);
                
            } catch (error) {
                console.error(`MCP call failed for ${toolName}:`, error);
                processedText = processedText.replace(match[0], `❌ ${toolName} failed: ${error.message}`);
            }
        }

        return processedText;
    }

    async gatherUserContext() {
        try {
            const [balanceResult, kycResult] = await Promise.all([
                this.callMCPTool('get_account_balance', {}),
                this.callMCPTool('get_kyc_status', {})
            ]);

            return {
                user: {
                    email: this.user.email,
                    id: this.user.id
                },
                account: balanceResult.success ? balanceResult.data : null,
                kyc: kycResult.success ? kycResult.data : null,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to gather user context:', error);
            return {
                user: { email: this.user.email, id: this.user.id },
                account: null,
                kyc: null,
                error: 'Failed to load current financial data'
            };
        }
    }

    async callMCPTool(toolName, parameters) {
        try {
            console.log(`🔧 Calling MCP tool: ${toolName}`, parameters);
            
            const response = await this.makeRequest('/api/mcp-simple', 'POST', {
                jsonrpc: '2.0',
                id: ++this.mcpRequestId,  // Use proper sequential ID
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: parameters
                }
            });

            console.log(`🔧 MCP tool response for ${toolName}:`, response);
            console.log(`🔧 Full response structure:`, JSON.stringify(response, null, 2));
            
            // Handle MCP JSON-RPC response format
            if (response.result && response.result.content && response.result.content[0]) {
                const content = response.result.content[0];
                console.log(`🔧 Content text:`, content.text);
                
                if (content.type === 'text') {
                    // Parse the text content to extract structured data
                    const parsedData = this.parseToolResponse(toolName, content.text);
                    return {
                        success: true,
                        data: parsedData,
                        raw_text: content.text
                    };
                }
            } else if (response.error) {
                return {
                    success: false,
                    error: response.error.message || 'MCP tool error'
                };
            }
            
            return {
                success: false,
                error: 'Unexpected response format',
                raw_response: response
            };
        } catch (error) {
            console.error(`MCP tool call failed: ${toolName}`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    parseToolResponse(toolName, text) {
        try {
            console.log(`🔧 Parsing ${toolName} response:`, text);
            
            if (toolName === 'get_account_balance') {
                // Parse account balance information from text
                const balanceMatch = text.match(/Balance:\s*([0-9.]+)\s*([A-Z]+)/);
                const emailMatch = text.match(/\(([^)]+@[^)]+)\)/);
                const usernameMatch = text.match(/User:\s*([^(]+)/);
                const kycMatch = text.match(/KYC Status:\s*(\w+)/);
                
                const parsed = {
                    account_balance: balanceMatch ? balanceMatch[1] : '0.00',
                    currency: balanceMatch ? balanceMatch[2] : 'USD',
                    email: emailMatch ? emailMatch[1] : '',
                    username: usernameMatch ? usernameMatch[1].trim() : '',
                    kyc_status: kycMatch ? kycMatch[1] : 'unknown'
                };
                
                console.log(`🔧 Parsed balance data:`, parsed);
                return parsed;
                
            } else if (toolName === 'get_kyc_status') {
                const kycMatch = text.match(/KYC Status:\s*(\w+)/);
                const emailMatch = text.match(/\(([^)]+@[^)]+)\)/);
                const usernameMatch = text.match(/User:\s*([^(]+)/);
                
                const parsed = {
                    kyc_status: kycMatch ? kycMatch[1] : 'unknown',
                    email: emailMatch ? emailMatch[1] : '',
                    username: usernameMatch ? usernameMatch[1].trim() : ''
                };
                
                console.log(`🔧 Parsed KYC data:`, parsed);
                return parsed;
            }
            
            return { raw_text: text };
        } catch (error) {
            console.error('Failed to parse tool response:', error);
            return { raw_text: text };
        }
    }

    addMessage(text, type) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = this.formatMessage(text);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatMessage(text) {
        // Convert line breaks and format JSON
        return text
            .replace(/\n/g, '<br>')
            .replace(/```json\n(.*?)\n```/gs, '<pre>$1</pre>')
            .replace(/```(.*?)```/gs, '<code>$1</code>');
    }

    showTyping() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTyping() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('agentStatus');
        statusDiv.className = `status ${type}`;
        statusDiv.innerHTML = `<strong>Agent Status:</strong> ${message}`;
        
        setTimeout(() => {
            statusDiv.className = 'status info';
            statusDiv.innerHTML = '<strong>Agent Status:</strong> Ready to assist';
        }, 5000);
    }

    async makeRequest(endpoint, method, body = null) {
        const options = {
            method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // Add Authorization header if we have a token
        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(this.baseUrl + endpoint, options);
        
        let data;
        try {
            data = await response.json();
        } catch (error) {
            data = { 
                success: false, 
                message: 'Invalid JSON response',
                status: response.status,
                statusText: response.statusText
            };
        }

        if (!response.ok && !data.message) {
            data.message = `HTTP ${response.status}: ${response.statusText}`;
        }

        return data;
    }

    async logout() {
        try {
            await this.makeRequest('/api/auth/logout', 'POST');
        } catch (error) {
            console.error('Logout error:', error);
        }
        this.redirectToLogin();
    }

    resetApiKey() {
        localStorage.removeItem('google_ai_api_key');
        this.apiKey = null;
        this.setupInterface();
        this.showStatus('API key cleared. Please enter a new one.', 'info');
    }

    redirectToLogin() {
        window.location.href = '/';
    }
}

// Initialize the AI agent when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AIFinancialAgent();
});