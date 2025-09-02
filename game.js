class CodeBreakersGame {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.gameState = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupBackgroundCanvas();
        this.checkSavedLogin();
    }
    
    setupEventListeners() {
        // Main Menu
        document.getElementById('play-btn').addEventListener('click', () => this.showPlay());
        document.getElementById('login-btn').addEventListener('click', () => this.showScreen('login-screen'));
        document.getElementById('register-btn').addEventListener('click', () => this.showScreen('register-screen'));
        
        // Back buttons
        document.getElementById('back-btn').addEventListener('click', () => this.showScreen('main-menu'));
        document.getElementById('back-btn-register').addEventListener('click', () => this.showScreen('main-menu'));
        
        // Forms
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        
        // Lobby
        document.getElementById('logout').addEventListener('click', () => this.handleLogout());
        document.getElementById('create-room').addEventListener('click', () => this.createRoom());
        document.getElementById('refresh-rooms').addEventListener('click', () => this.loadRooms());
        
        // Game
        document.getElementById('emergency-btn').addEventListener('click', () => this.callEmergency());
    }
    
    setupBackgroundCanvas() {
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Neural network animation
        const nodes = [];
        const connections = [];
        
        // Create nodes
        for (let i = 0; i < 50; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3 + 1
            });
        }
        
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Update and draw nodes
            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;
                
                if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.showScreen('main-menu');
        this.showNotification('Logged out successfully', 'success');
    }
    
    setupGameCanvas() {
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Game rendering loop
        const gameLoop = () => {
            if (!this.gameState) {
                requestAnimationFrame(gameLoop);
                return;
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw neural network background
            this.drawNeuralBackground(ctx);
            
            // Draw game objects
            this.drawGameObjects(ctx);
            
            requestAnimationFrame(gameLoop);
        };
        
        gameLoop();
        
        // Handle player movement
        let keys = {};
        
        window.addEventListener('keydown', (e) => {
            keys[e.key] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            keys[e.key] = false;
        });
        
        // Movement update
        const updateMovement = () => {
            if (!this.gameState || !this.socket) return;
            
            const player = this.gameState.players.find(p => p.id === this.socket.id);
            if (!player || !player.isAlive) return;
            
            let dx = 0, dy = 0;
            
            if (keys['w'] || keys['W'] || keys['ArrowUp']) dy = -player.speed;
            if (keys['s'] || keys['S'] || keys['ArrowDown']) dy = player.speed;
            if (keys['a'] || keys['A'] || keys['ArrowLeft']) dx = -player.speed;
            if (keys['d'] || keys['D'] || keys['ArrowRight']) dx = player.speed;
            
            if (dx !== 0 || dy !== 0) {
                const newX = Math.max(0, Math.min(canvas.width, player.x + dx));
                const newY = Math.max(0, Math.min(canvas.height, player.y + dy));
                
                this.socket.emit('player-move', { x: newX, y: newY });
            }
        };
        
        setInterval(updateMovement, 50); // 20 FPS movement updates
    }
    
    drawNeuralBackground(ctx) {
        // Draw neural cells
        if (this.gameState.world && this.gameState.world.cells) {
            this.gameState.world.cells.forEach(cell => {
                const pulse = Math.sin(Date.now() * 0.001 + cell.pulsePhase) * 0.3 + 0.7;
                
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.size * pulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 100, 200, ${0.1 * pulse})`;
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.size * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 200, 255, ${0.5 * pulse})`;
                ctx.fill();
            });
        }
    }
    
    drawGameObjects(ctx) {
        if (!this.gameState) return;
        
        // Draw synapses (tasks)
        if (this.gameState.synapses) {
            this.gameState.synapses.forEach(synapse => {
                if (!synapse.isActive) return;
                
                const pulse = Math.sin(Date.now() * 0.003 + synapse.pulseAnimation) * 0.2 + 0.8;
                
                // Task background
                ctx.beginPath();
                ctx.arc(synapse.x, synapse.y, synapse.size * pulse, 0, Math.PI * 2);
                ctx.fillStyle = synapse.completed ? 'rgba(0, 255, 136, 0.3)' : 'rgba(68, 221, 255, 0.3)';
                ctx.fill();
                
                // Task border
                ctx.beginPath();
                ctx.arc(synapse.x, synapse.y, synapse.size, 0, Math.PI * 2);
                ctx.strokeStyle = synapse.color;
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Progress bar
                if (!synapse.completed) {
                    const barWidth = synapse.size * 1.5;
                    const barHeight = 8;
                    const barX = synapse.x - barWidth / 2;
                    const barY = synapse.y + synapse.size + 15;
                    
                    // Progress background
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                    
                    // Progress fill
                    ctx.fillStyle = synapse.color;
                    ctx.fillRect(barX, barY, (barWidth * synapse.progress) / 100, barHeight);
                    
                    // Progress text
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Orbitron';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${Math.floor(synapse.progress)}%`, synapse.x, barY + barHeight + 15);
                }
                
                // Task icon
                ctx.fillStyle = '#fff';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(synapse.icon, synapse.x, synapse.y + 5);
            });
        }
        
        // Draw data bubbles
        if (this.gameState.dataBubbles) {
            this.gameState.dataBubbles.forEach(bubble => {
                const pulse = Math.sin(Date.now() * 0.002 + bubble.pulsePhase) * 0.3 + 0.7;
                
                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.size * pulse, 0, Math.PI * 2);
                ctx.fillStyle = bubble.color + '80';
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.size * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = bubble.color;
                ctx.fill();
                
                // Bubble icon
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(bubble.icon, bubble.x, bubble.y + 3);
            });
        }
        
        // Draw players
        if (this.gameState.players) {
            this.gameState.players.forEach(player => {
                if (!player.isAlive) return;
                
                // Player body
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
                ctx.fillStyle = player.color;
                ctx.fill();
                
                // Player glow
                ctx.shadowBlur = 15;
                ctx.shadowColor = player.color;
                ctx.fill();
                ctx.shadowBlur = 0;
                
                // Player name
                ctx.fillStyle = '#fff';
                ctx.font = '14px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText(player.username, player.x, player.y - player.size - 10);
                
                // Energy bar
                if (player.energy < player.maxEnergy) {
                    const barWidth = player.size * 2;
                    const barHeight = 4;
                    const barX = player.x - barWidth / 2;
                    const barY = player.y + player.size + 5;
                    
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                    
                    ctx.fillStyle = '#00ff88';
                    ctx.fillRect(barX, barY, (barWidth * player.energy) / player.maxEnergy, barHeight);
                }
            });
        }
    }
    
    updateGameUI() {
        if (!this.gameState) return;
        
        // Update health bar
        const healthFill = document.getElementById('health-fill');
        const healthText = document.getElementById('health-text');
        if (healthFill && healthText) {
            const healthPercent = this.gameState.networkHealth || 0;
            healthFill.style.width = healthPercent + '%';
            healthText.textContent = healthPercent + '%';
        }
        
        // Update timer
        const timer = document.getElementById('timer');
        if (timer && this.gameState.gameTime) {
            const minutes = Math.floor(this.gameState.gameTime / 60);
            const seconds = this.gameState.gameTime % 60;
            timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update players list
        const playersList = document.getElementById('players-list');
        if (playersList && this.gameState.players) {
            playersList.innerHTML = '<h4>Players</h4>';
            this.gameState.players.forEach(player => {
                const playerElement = document.createElement('div');
                playerElement.className = 'player-item';
                playerElement.innerHTML = `
                    <div class="player-status ${player.isAlive ? '' : 'dead'}"></div>
                    <div class="player-name">${player.username}</div>
                `;
                playersList.appendChild(playerElement);
            });
        }
    }
    
    callEmergency() {
        if (!this.socket) return;
        this.socket.emit('call-emergency');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('notifications');
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CodeBreakersGame();
});node.x < 0 || node.x > canvas.width) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                ctx.fillStyle = '#00ffff';
                ctx.fill();
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ffff';
                ctx.fill();
                ctx.shadowBlur = 0;
            });
            
            // Draw connections
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dist = Math.sqrt(
                        Math.pow(nodes[i].x - nodes[j].x, 2) +
                        Math.pow(nodes[i].y - nodes[j].y, 2)
                    );
                    
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
        
        // Resize handler
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    showPlay() {
        if (this.currentUser) {
            this.showScreen('lobby-screen');
            this.loadRooms();
        } else {
            this.showScreen('login-screen');
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showNotification('Please fill all fields', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('gameToken', data.token);
                this.showNotification('Login successful!', 'success');
                this.showLobby();
            } else {
                this.showNotification(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Connection error', 'error');
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        
        if (!username || !password) {
            this.showNotification('Username and password required', 'error');
            return;
        }
        
        if (username.length < 3) {
            this.showNotification('Username must be at least 3 characters', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('gameToken', data.token);
                this.showNotification('Account created successfully!', 'success');
                this.showLobby();
            } else {
                this.showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Connection error', 'error');
        }
    }
    
    async checkSavedLogin() {
        const token = localStorage.getItem('gameToken');
        if (!token) return;
        
        try {
            const response = await fetch('/api/verify-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
            } else {
                localStorage.removeItem('gameToken');
            }
        } catch (error) {
            localStorage.removeItem('gameToken');
        }
    }
    
    showLobby() {
        this.showScreen('lobby-screen');
        document.getElementById('user-name').textContent = this.currentUser.username;
        this.connectSocket();
        this.loadRooms();
    }
    
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        this.socket.on('error', (error) => {
            this.showNotification(error, 'error');
        });
        
        this.socket.on('game-state', (gameState) => {
            this.gameState = gameState;
            this.updateGameUI();
        });
        
        this.socket.on('join-success', (data) => {
            this.currentRoom = data.roomId;
            this.showNotification('Joined room successfully!', 'success');
            this.showScreen('game-screen');
            this.setupGameCanvas();
        });
        
        this.socket.on('game-started', (gameState) => {
            this.gameState = gameState;
            this.showNotification('Game started!', 'success');
        });
        
        this.socket.on('player-moved', (data) => {
            if (this.gameState && this.gameState.players) {
                const player = this.gameState.players.find(p => p.id === data.playerId);
                if (player) {
                    player.x = data.x;
                    player.y = data.y;
                }
            }
        });
    }
    
    async loadRooms() {
        try {
            const response = await fetch('/api/rooms');
            const data = await response.json();
            
            const roomsList = document.getElementById('rooms-list');
            roomsList.innerHTML = '';
            
            if (data.rooms.length === 0) {
                roomsList.innerHTML = '<div style="text-align: center; color: #888; padding: 2rem;">No rooms available</div>';
                return;
            }
            
            data.rooms.forEach(room => {
                const roomElement = document.createElement('div');
                roomElement.className = 'room-item';
                roomElement.innerHTML = `
                    <div class="room-info">
                        <div class="room-id">${room.id}</div>
                        <div class="room-players">${room.players}/${room.maxPlayers} players</div>
                    </div>
                    <div class="room-status ${room.gameState}">${room.gameState}</div>
                `;
                
                if (room.gameState === 'waiting' && room.players < room.maxPlayers) {
                    roomElement.addEventListener('click', () => this.joinRoom(room.id));
                } else {
                    roomElement.style.opacity = '0.5';
                    roomElement.style.cursor = 'not-allowed';
                }
                
                roomsList.appendChild(roomElement);
            });
        } catch (error) {
            console.error('Failed to load rooms:', error);
        }
    }
    
    createRoom() {
        const roomId = document.getElementById('room-id').value.trim();
        
        if (!roomId) {
            this.showNotification('Please enter a room ID', 'error');
            return;
        }
        
        if (roomId.length < 3 || roomId.length > 20) {
            this.showNotification('Room ID must be 3-20 characters', 'error');
            return;
        }
        
        this.joinRoom(roomId);
    }
    
    joinRoom(roomId) {
        if (!this.socket) {
            this.showNotification('Not connected to server', 'error');
            return;
        }
        
        const token = localStorage.getItem('gameToken');
        this.socket.emit('join-game', { token, roomId });
    }
    
    handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('gameToken');
        
        if (