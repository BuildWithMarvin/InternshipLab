class SessionManager {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.authToken = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkInitialSession();
    }

    bindEvents() {
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        document.getElementById('getUserInfo').addEventListener('click', () => this.getUserInfo());
        document.getElementById('openAgent').addEventListener('click', () => this.openAgent());
        document.getElementById('checkSession').addEventListener('click', () => this.checkSession());
        document.getElementById('testProtectedRoute').addEventListener('click', () => this.testProtectedRoute());
    }

    async checkInitialSession() {
        try {
            const response = await this.makeRequest('/api/auth/me', 'GET');
            if (response.success) {
                this.showUserSection(response.user);
                this.showStatus('Already logged in!', 'success');
            } else {
                this.showLoginSection();
            }
        } catch (error) {
            this.showLoginSection();
            this.showStatus('Not logged in', 'info');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            this.showStatus('Logging in...', 'info');
            
            const response = await this.makeRequest('/api/auth/login', 'POST', {
                email,
                password
            });

            this.showResponseDetails(response);

            if (response.success) {
                this.authToken = response.token || response.session?.token;
                console.log('Stored auth token:', this.authToken ? this.authToken.substring(0, 10) + '...' : 'null');
                this.showStatus('Login successful!', 'success');
                this.showUserSection(response.user);
                document.getElementById('loginForm').reset();
            } else {
                this.showStatus(`Login failed: ${response.message}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Login error: ${error.message}`, 'error');
            this.showResponseDetails({ error: error.message });
        }
    }

    async handleLogout() {
        try {
            this.showStatus('Logging out...', 'info');
            
            const response = await this.makeRequest('/api/auth/logout', 'POST');
            this.showResponseDetails(response);

            if (response.success) {
                this.authToken = null;
                this.showStatus('Logout successful!', 'success');
                this.showLoginSection();
                this.clearUserInfo();
            } else {
                this.showStatus(`Logout failed: ${response.message}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Logout error: ${error.message}`, 'error');
            this.showResponseDetails({ error: error.message });
        }
    }

    async getUserInfo() {
        try {
            this.showStatus('Getting user info...', 'info');
            
            const response = await this.makeRequest('/api/auth/me', 'GET');
            this.showResponseDetails(response);

            if (response.success) {
                this.showStatus('User info retrieved successfully!', 'success');
                this.showUserInfo(response.user);
            } else {
                this.showStatus(`Failed to get user info: ${response.message}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Error getting user info: ${error.message}`, 'error');
            this.showResponseDetails({ error: error.message });
        }
    }

    async checkSession() {
        try {
            this.showStatus('Checking session status...', 'info');
            
            const response = await this.makeRequest('/api/auth/status', 'GET');
            this.showResponseDetails(response);

            if (response.success) {
                this.showStatus('Session check completed!', 'success');
            } else {
                this.showStatus(`Session check failed: ${response.message}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Session check error: ${error.message}`, 'error');
            this.showResponseDetails({ error: error.message });
        }
    }

    async testProtectedRoute() {
        try {
            this.showStatus('Testing protected route...', 'info');
            
            // Test the /api/auth/me endpoint as a protected route
            const response = await this.makeRequest('/api/auth/me', 'GET');
            this.showResponseDetails(response);

            if (response.success) {
                this.showStatus('Protected route accessible - session valid!', 'success');
            } else {
                this.showStatus('Protected route failed - session invalid!', 'error');
                this.showLoginSection();
            }
        } catch (error) {
            this.showStatus(`Protected route error: ${error.message}`, 'error');
            this.showResponseDetails({ error: error.message });
            this.showLoginSection();
        }
    }

    async makeRequest(endpoint, method, body = null) {
        const options = {
            method,
            credentials: 'include', // Important for cookies
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // Add Authorization header if we have a token
        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
            console.log('Sending request with token:', this.authToken.substring(0, 10) + '...');
        } else {
            console.log('No auth token available for request to:', endpoint);
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(this.baseUrl + endpoint, options);
        
        // Try to parse as JSON, but handle cases where response isn't JSON
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

    showUserSection(user) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('userSection').classList.remove('hidden');
        this.showUserInfo(user);
    }

    showLoginSection() {
        document.getElementById('userSection').classList.add('hidden');
        document.getElementById('loginSection').classList.remove('hidden');
    }

    showUserInfo(user) {
        const userInfoDiv = document.getElementById('userInfo');
        userInfoDiv.innerHTML = `
            <h4>User Information:</h4>
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Account Balance:</strong> ${user.account_balance || 'N/A'} ${user.currency || ''}</p>
            <p><strong>KYC Status:</strong> ${user.kyc_status || 'N/A'}</p>
            <p><strong>Created:</strong> ${user.created_at || 'N/A'}</p>
        `;
    }

    clearUserInfo() {
        document.getElementById('userInfo').innerHTML = '';
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    }

    showResponseDetails(response) {
        const detailsDiv = document.getElementById('responseDetails');
        detailsDiv.textContent = JSON.stringify(response, null, 2);
    }

    openAgent() {
        // Store token in sessionStorage for the agent page
        if (this.authToken) {
            sessionStorage.setItem('auth_token', this.authToken);
            console.log('Stored token in sessionStorage for agent page');
        }
        
        // Also check if cookie is accessible
        const cookieValue = document.cookie.split('; ').find(row => row.startsWith('auth_token='));
        console.log('Cookie available:', !!cookieValue);
        
        window.location.href = '/agent.html';
    }
}

// Initialize the session manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SessionManager();
});