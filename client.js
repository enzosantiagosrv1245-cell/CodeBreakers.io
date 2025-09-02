// ===== VARIÁVEIS GLOBAIS =====
let socket;
let currentUser = null;
let gameState = null;
let currentRoom = null;
let canvas, ctx;
let isInGame = false;

// Estados das telas
const screens = {
    MAIN_MENU: 'main-menu',
    GAME_MENU: 'game-menu', 
    WAITING_ROOM: 'waiting-room',
    GAME_SCREEN: 'game-screen'
};

let currentScreen = screens.MAIN_MENU;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🧠 CodeBreakers.io iniciando...');
    
    initializeSocket();
    initializeAuth();
    initializeGameMenus();
    checkAutoLogin();
});

// ===== SOCKET.IO =====
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ Conectado ao servidor!');
        updateConnectionStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Desconectado do servidor');
        updateConnectionStatus(false);
    });
    
    // Eventos do jogo
    socket.on('join-success', (data) => {
        console.log('🎮 Entrou na sala:', data);
        currentRoom = data;
        showScreen(screens.WAITING_ROOM);
        updateWaitingRoom(data);
    });
    
    socket.on('game-state', (data) => {
        gameState = data;
        updateGameState(data);
    });
    
    socket.on('game-started', (data) => {
        console.log('🚀 Jogo iniciado!');
        gameState = data;
        showScreen(screens.GAME_SCREEN);
        initializeGameCanvas();
        isInGame = true;
    });
    
    socket.on('player-moved', (data) => {
        if (gameState && gameState.players) {
            const player = gameState.players.find(p => p.id === data.playerId);
            if (player) {
                player.x = data.x;
                player.y = data.y;
            }
        }
    });
    
    socket.on('error', (error) => {
        console.error('❌ Erro:', error);
        showNotification(error, 'error');
    });
}

// ===== AUTENTICAÇÃO =====
function initializeAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    // Botões de alternar formulários
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
    });
    
    // Formulário de login
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Formulário de registro
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    document.getElementById('register-confirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showNotification('Preencha todos os campos!', 'error');
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
            localStorage.setItem('codebreakers_token', data.token);
            currentUser = data.user;
            showGameMenu();
            showNotification(`Bem-vindo, ${username}!`, 'success');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Erro de conexão com o servidor', 'error');
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    
    if (!username || !password) {
        showNotification('Username e senha são obrigatórios!', 'error');
        return;
    }
    
    if (password !== confirm) {
        showNotification('Senhas não coincidem!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Senha deve ter pelo menos 6 caracteres!', 'error');
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
            localStorage.setItem('codebreakers_token', data.token);
            currentUser = data.user;
            showGameMenu();
            showNotification(`Conta criada! Bem-vindo, ${username}!`, 'success');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Erro de conexão com o servidor', 'error');
    }
}

async function checkAutoLogin() {
    const token = localStorage.getItem('codebreakers_token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showGameMenu();
        } else {
            localStorage.removeItem('codebreakers_token');
        }
    } catch (error) {
        localStorage.removeItem('codebreakers_token');
    }
}

// ===== MENUS DO JOGO =====
function initializeGameMenus() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('codebreakers_token');
        currentUser = null;
        showScreen(screens.MAIN_MENU);
        showNotification('Logout realizado!', 'info');
    });
    
    // Jogo rápido
    document.getElementById('quick-play-btn').addEventListener('click', () => {
        const roomId = 'quick_' + Math.random().toString(36).substr(2, 9);
        joinGame(roomId);
    });
    
    // Criar sala
    document.getElementById('create-room-btn').addEventListener('click', () => {
        const roomName = document.getElementById('room-name').value.trim() || 'Sala Nova';
        const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
        joinGame(roomId, roomName);
    });
    
    // Entrar em sala
    document.getElementById('join-room-btn').addEventListener('click', () => {
        const roomCode = document.getElementById('room-code').value.trim();
        if (!roomCode) {
            showNotification('Digite o código da sala!', 'error');
            return;
        }
        joinGame(roomCode);
    });
    
    // Controles da sala de espera
    document.getElementById('start-game-btn').addEventListener('click', () => {
        socket.emit('start-game');
    });
    
    document.getElementById('leave-room-btn').addEventListener('click', () => {
        socket.disconnect();
        socket.connect();
        showScreen(screens.GAME_MENU);
        currentRoom = null;
    });
}

function showGameMenu() {
    showScreen(screens.GAME_MENU);
    
    // Atualizar informações do usuário
    document.getElementById('username-display').textContent = currentUser.username;
    document.getElementById('games-played').textContent = currentUser.stats.gamesPlayed;
    document.getElementById('wins').textContent = currentUser.stats.wins;
    document.getElementById('tasks-completed').textContent = currentUser.stats.tasksCompleted;
    document.getElementById('virus-wins').textContent = currentUser.stats.virusWins;
}

function joinGame(roomId, roomName = null) {
    const token = localStorage.getItem('codebreakers_token');
    if (!token) {
        showNotification('Faça login primeiro!', 'error');
        return;
    }
    
    socket.emit('join-game', { token, roomId, roomName });
}

// ===== CONTROLE DE TELAS =====
function showScreen(screenId) {
    // Esconder todas as telas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar tela específica
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
}

// ===== SALA DE ESPERA =====
function updateWaitingRoom(roomData) {
    if (roomData.roomId) {
        document.getElementById('room-name-display').textContent = roomData.roomName || roomData.roomId;
        document.getElementById('room-code-display').textContent = roomData.roomId;
    }
}

function updateGameState(data) {
    if (currentScreen === screens.WAITING_ROOM) {
        updatePlayersList(data.players);
        updateStartButton(data.players.length);
    } else if (currentScreen === screens.GAME_SCREEN && isInGame) {
        updateGameCanvas(data);
        updateGameHUD(data);
    }
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');
    
    playerCount.textContent = players.length;
    
    playersList.innerHTML = '';
    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
            <div style="width: 30px; height: 30px; background: ${player.color}; border-radius: 50%; margin: 0 auto 0.5rem;"></div>
            <strong>${player.username}</strong>
            <div style="color: #aaa; font-size: 0.8rem;">Tamanho: ${player.size}</div>
        `;
        playersList.appendChild(playerCard);
    });
}

function updateStartButton(playerCount) {
    const startBtn = document.getElementById('start-game-btn');
    const status = document.querySelector('.waiting-status p');
    
    if (playerCount >= 4) {
        startBtn.disabled = false;
        status.textContent = 'Pronto para começar!';
    } else {
        startBtn.disabled = true;
        status.textContent = `Aguardando mais jogadores... (${playerCount}/4 mínimo)`;
    }
}

// ===== CANVAS DO JOGO =====
function initializeGameCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Eventos do mouse
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleCanvasClick);
    
    // Iniciar loop de renderização
    gameLoop();
}

function handleMouseMove(e) {
    if (!isInGame || !currentRoom) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Enviar movimento para o servidor
    socket.emit('player-move', { x, y });
}

function handleCanvasClick(e) {
    if (!isInGame || !gameState) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Verificar clique em estações de tarefa
    gameState.taskStations.forEach(station => {
        const distance = Math.sqrt((x - station.x) ** 2 + (y - station.y) ** 2);
        if (distance < 30) {
            openTaskPanel(station);
        }
    });
    
    // Verificar clique em pacotes de dados
    gameState.dataPackets.forEach(packet => {
        const distance = Math.sqrt((x - packet.x) ** 2 + (y - packet.y) ** 2);
        if (distance < 15) {
            socket.emit('collect-data', { packetId: packet.id });
        }
    });
}

function gameLoop() {
    if (isInGame && gameState) {
        drawGame();
    }
    requestAnimationFrame(gameLoop);
}

function drawGame() {
    // Limpar canvas
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar fundo da rede neural
    drawNeuralBackground();
    
    // Desenhar pacotes de dados
    drawDataPackets();
    
    // Desenhar estações de tarefa
    drawTaskStations();
    
    // Desenhar jogadores
    drawPlayers();
    
    // Desenhar minimapa
    drawMinimap();
}

function drawNeuralBackground() {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.lineWidth = 1;
    
    // Linhas de grid
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawDataPackets() {
    if (!gameState.dataPackets) return;
    
    gameState.dataPackets.forEach(packet => {
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(packet.x, packet.y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Valor do pacote
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(packet.value.toString(), packet.x, packet.y + 3);
    });
}

function drawTaskStations() {
    if (!gameState.taskStations) return;
    
    gameState.taskStations.forEach(station => {
        // Cor baseada no status
        let color = station.completed ? '#00ff88' : '#ff6b6b';
        
        // Desenhar base da estação
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(station.x, station.y, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // Borda
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Ícone baseado no tipo
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        
        const icons = {
            'firewall': '🛡️',
            'connection': '⚡',
            'analysis': '🧠',
            'sync': '🔄',
            'repair': '🔧'
        };
        
        ctx.fillText(icons[station.type] || '⚙️', station.x, station.y + 5);
    });
}

function drawPlayers() {
    if (!gameState.players) return;
    
    gameState.players.forEach(player => {
        if (!player.isAlive) return;
        
        // Desenhar jogador
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Borda para jogador atual
        if (player.id === currentRoom.playerId) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Nome do jogador
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, player.x, player.y - player.size - 10);
    });
}

function drawMinimap() {
    const miniMapX = canvas.width - 120;
    const miniMapY = 10;
    const miniMapSize = 100;
    
    // Fundo do minimapa
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(miniMapX, miniMapY, miniMapSize, miniMapSize);
    
    // Escala
    const scaleX = miniMapSize / canvas.width;
    const scaleY = miniMapSize / canvas.height;
    
    // Desenhar jogadores no minimapa
    if (gameState.players) {
        gameState.players.forEach(player => {
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.arc(
                miniMapX + player.x * scaleX,
                miniMapY + player.y * scaleY,
                3, 0, Math.PI * 2
            );
            ctx.fill();
        });
    }
}

// ===== HUD DO JOGO =====
function updateGameHUD(data) {
    // Atualizar saúde da rede
    const healthFill = document.getElementById('network-health-fill');
    const healthText = document.getElementById('network-health-text');
    healthFill.style.width = `${data.networkHealth}%`;
    healthText.textContent = `${data.networkHealth}%`;
    
    // Encontrar jogador atual
    const currentPlayer = data.players.find(p => p.id === currentRoom.playerId);
    if (currentPlayer) {
        document.getElementById('player-size').textContent = currentPlayer.size;
        document.getElementById('data-collected').textContent = currentPlayer.dataCollected || 0;
        document.getElementById('tasks-done').textContent = currentPlayer.tasksCompleted || 0;
        
        // Atualizar indicador de papel
        const roleIndicator = document.getElementById('role-indicator');
        const roleText = document.getElementById('role-text');
        if (currentPlayer.isVirus) {
            roleIndicator.classList.add('virus');
            roleText.textContent = '🦠 Vírus';
        } else {
            roleIndicator.classList.remove('virus');
            roleText.textContent = '🧠 Neurônio';
        }
    }
}

// ===== PAINEL DE TAREFAS =====
function openTaskPanel(station) {
    const taskPanel = document.getElementById('task-panel');
    const taskTitle = document.getElementById('task-title');
    const taskContent = document.getElementById('task-content');
    
    taskTitle.textContent = `Tarefa: ${station.type.toUpperCase()}`;
    
    // Gerar conteúdo da tarefa baseado no tipo
    switch (station.type) {
        case 'firewall':
            taskContent.innerHTML = createFirewallTask(station);
            break;
        case 'connection':
            taskContent.innerHTML = createConnectionTask(station);
            break;
        case 'analysis':
            taskContent.innerHTML = createAnalysisTask(station);
            break;
        default:
            taskContent.innerHTML = '<p>Clique no botão para completar a tarefa!</p><button onclick="completeTask(' + station.id + ')" class="btn btn-primary">Executar</button>';
    }
    
    taskPanel.classList.remove('hidden');
    
    // Fechar painel
    document.getElementById('close-task-btn').onclick = () => {
        taskPanel.classList.add('hidden');
    };
}

function createFirewallTask(station) {
    return `
        <p>🛡️ Configurar Firewall</p>
        <p>Digite a sequência correta:</p>
        <div style="display: flex; gap: 10px; margin: 10px 0;">
            <input type="text" id="firewall-input" placeholder="1337" maxlength="4">
            <button onclick="checkFirewall(${station.id})" class="btn btn-small">Aplicar</button>
        </div>
        <small>Dica: Ano do leet speak</small>
    `;
}

function createConnectionTask(station) {
    return `
        <p>⚡ Reparar Conexão</p>
        <p>Clique nos cabos na ordem correta:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
            <button onclick="selectCable(1, ${station.id})" class="cable-btn" id="cable-1">Cabo A</button>
            <button onclick="selectCable(2, ${station.id})" class="cable-btn" id="cable-2">Cabo B</button>
            <button onclick="selectCable(3, ${station.id})" class="cable-btn" id="cable-3">Cabo C</button>
            <button onclick="selectCable(4, ${station.id})" class="cable-btn" id="cable-4">Cabo D</button>
        </div>
        <div id="cable-sequence"></div>
    `;
}

function createAnalysisTask(station) {
    const symbols = ['●', '▲', '■', '◆', '★'];
    const correct = symbols[Math.floor(Math.random() * symbols.length)];
    const options = [];
    
    for (let i = 0; i < 8; i++) {
        options.push(i === 3 ? correct : symbols[Math.floor(Math.random() * symbols.length)]);
    }
    
    return `
        <p>🧠 Análise de Padrões</p>
        <p>Encontre o símbolo diferente:</p>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0;">
            ${options.map((symbol, i) => 
                `<button onclick="selectSymbol(${i}, ${station.id})" class="symbol-btn">${symbol}</button>`
            ).join('')}
        </div>
    `;
}

// Funções das tarefas
window.checkFirewall = (stationId) => {
    const input = document.getElementById('firewall-input').value;
    if (input === '1337') {
        completeTask(stationId);
    } else {
        showNotification('Sequência incorreta!', 'error');
    }
};

window.selectCable = (cableNum, stationId) => {
    // Implementar lógica de sequência de cabos
    completeTask(stationId);
};

window.selectSymbol = (symbolIndex, stationId) => {
    if (symbolIndex === 3) {
        completeTask(stationId);
    } else {
        showNotification('Símbolo incorreto!', 'error');
    }
};

function completeTask(stationId) {
    socket.emit('complete-task', { taskId: stationId });
    document.getElementById('task-panel').classList.add('hidden');
    showNotification('Tarefa completada!', 'success');
}

// ===== UTILITÁRIOS =====
function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.connection-status span');
    
    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Conectado à rede';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Desconectado';
    }
}

function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Cores baseadas no tipo
    const colors = {
        success: '#00ff88',
        error: '#ff6b6b',
        info: '#4ecdc4',
        warning: '#ffa500'
    };
    
    notification.style.background = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.remove();
    }, 3000);
}