const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configurações
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'codebreakers_secret_key_2025';
const MAX_PLAYERS_PER_ROOM = 12;
const MIN_PLAYERS_TO_START = 4;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Base de dados simples
const DB_PATH = './database.json';
let database = { users: [], games: [] };

if (fs.existsSync(DB_PATH)) {
    try {
        database = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        console.log('Criando nova base de dados...');
    }
}

const saveDatabase = () => {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
};

// Estado global do jogo
const gameRooms = new Map();
const playerSockets = new Map();
const activePlayers = new Set();

class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.gameState = 'waiting'; // waiting, playing, voting, ended
        this.virusCount = 0;
        this.synapses = this.generateSynapses();
        this.dataBubbles = this.generateDataBubbles();
        this.networkHealth = 100;
        this.gameTime = 300; // 5 minutos
        this.gameTimer = null;
        this.lastUpdate = Date.now();
        this.votingPhase = false;
        this.votes = new Map();
        this.emergencyMeetings = 0;
        this.maxEmergencyMeetings = 3;
        this.deadPlayers = new Set();
        this.world = {
            width: 1400,
            height: 900,
            cells: this.generateNeuralCells()
        };
        this.updateLoop = null;
        this.startUpdateLoop();
    }

    startUpdateLoop() {
        this.updateLoop = setInterval(() => {
            this.updateGame();
        }, 50); // 20 FPS
    }

    updateGame() {
        const now = Date.now();
        const deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        // Atualizar bolhas de dados
        this.dataBubbles.forEach(bubble => {
            if (!bubble.collected) {
                bubble.x += bubble.drift.x;
                bubble.y += bubble.drift.y;
                bubble.pulsePhase += 0.1;
                
                // Manter dentro dos limites
                if (bubble.x < 0 || bubble.x > this.world.width) bubble.drift.x *= -1;
                if (bubble.y < 0 || bubble.y > this.world.height) bubble.drift.y *= -1;
            }
        });

        // Atualizar células neurais
        this.world.cells.forEach(cell => {
            cell.pulsePhase += 0.05;
        });

        // Atualizar sinapses
        this.synapses.forEach(synapse => {
            synapse.pulseAnimation += 0.08;
            
            if (synapse.health <= 0 && synapse.isActive) {
                synapse.isActive = false;
                this.networkHealth -= 5;
            }
        });

        // Verificar condições de vitória/derrota
        this.checkWinConditions();

        // Broadcast do estado atualizado
        if (this.gameState === 'playing') {
            io.to(this.id).emit('game-update', {
                dataBubbles: this.dataBubbles.filter(b => !b.collected),
                synapses: this.synapses,
                networkHealth: this.networkHealth,
                gameTime: this.gameTime,
                world: this.world
            });
        }
    }

    generateSynapses() {
        const synapses = [];
        const types = [
            { name: 'firewall', icon: '🛡️', color: '#ff4444' },
            { name: 'connection', icon: '🔗', color: '#44ff44' },
            { name: 'memory', icon: '💾', color: '#4444ff' },
            { name: 'processing', icon: '⚡', color: '#ffff44' },
            { name: 'repair', icon: '🔧', color: '#ff44ff' },
            { name: 'sync', icon: '🔄', color: '#44ffff' }
        ];
        
        for (let i = 0; i < 8; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            synapses.push({
                id: i,
                x: Math.random() * (this.world.width - 200) + 100,
                y: Math.random() * (this.world.height - 200) + 100,
                type: type.name,
                icon: type.icon,
                color: type.color,
                health: 100,
                maxHealth: 100,
                completed: false,
                progress: 0,
                workers: [],
                pulseAnimation: Math.random() * Math.PI * 2,
                size: 30,
                isActive: true,
                requiredPlayers: Math.floor(Math.random() * 3) + 1
            });
        }
        return synapses;
    }

    generateDataBubbles() {
        const bubbles = [];
        const types = [
            { name: 'protein', icon: '🧬', color: '#00ff88', value: 2 },
            { name: 'glucose', icon: '⚡', color: '#ffaa00', value: 1 },
            { name: 'oxygen', icon: '💨', color: '#00aaff', value: 1 },
            { name: 'neurotransmitter', icon: '✨', color: '#aa00ff', value: 3 }
        ];
        
        for (let i = 0; i < 35; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            bubbles.push({
                id: i,
                x: Math.random() * this.world.width,
                y: Math.random() * this.world.height,
                size: Math.random() * 8 + 4,
                value: type.value,
                collected: false,
                type: type.name,
                icon: type.icon,
                color: type.color,
                drift: { 
                    x: (Math.random() - 0.5) * 1.2, 
                    y: (Math.random() - 0.5) * 1.2 
                },
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
        return bubbles;
    }

    generateNeuralCells() {
        const cells = [];
        for (let i = 0; i < 15; i++) {
            cells.push({
                id: i,
                x: Math.random() * this.world.width,
                y: Math.random() * this.world.height,
                size: Math.random() * 80 + 40,
                pulsePhase: Math.random() * Math.PI * 2,
                connections: [],
                health: 100,
                isActive: true,
                neuronType: ['dendrite', 'axon', 'soma'][Math.floor(Math.random() * 3)]
            });
        }
        return cells;
    }

    addPlayer(socketId, userData) {
        if (this.players.size >= MAX_PLAYERS_PER_ROOM) return false;

        const colors = [
            '#00ff88', '#88ff00', '#ff8800', '#0088ff', 
            '#ff0088', '#8800ff', '#ff4444', '#44ff44',
            '#4444ff', '#ffff44', '#ff44ff', '#44ffff'
        ];
        
        const player = {
            id: socketId,
            username: userData.username,
            x: Math.random() * (this.world.width * 0.6) + this.world.width * 0.2,
            y: Math.random() * (this.world.height * 0.6) + this.world.height * 0.2,
            size: 20,
            maxSize: 20,
            speed: 4,
            isVirus: false,
            isAlive: true,
            energy: 100,
            maxEnergy: 100,
            experience: 0,
            level: 1,
            tasksCompleted: 0,
            dataCollected: 0,
            virusDetected: 0,
            suspicionLevel: 0,
            color: colors[this.players.size % colors.length],
            lastActivity: Date.now(),
            killCooldown: 0,
            isInVent: false,
            immuneUntil: Date.now() + 5000, // 5 segundos de imunidade inicial
            trail: []
        };

        this.players.set(socketId, player);
        activePlayers.add(socketId);
        return true;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        activePlayers.delete(socketId);
        
        if (this.updateLoop && this.players.size === 0) {
            clearInterval(this.updateLoop);
            gameRooms.delete(this.id);
        }
    }

    startGame() {
        if (this.players.size < MIN_PLAYERS_TO_START) return false;

        // Determinar vírus (25% dos jogadores, mínimo 1)
        const playerArray = Array.from(this.players.values());
        const virusCount = Math.max(1, Math.floor(playerArray.length * 0.25));
        
        // Selecionar vírus aleatórios
        const shuffled = [...playerArray].sort(() => 0.5 - Math.random());
        for (let i = 0; i < virusCount; i++) {
            const virus = this.players.get(shuffled[i].id);
            virus.isVirus = true;
            virus.killCooldown = 30000; // 30 segundos inicial
            virus.speed = 4.5; // Vírus são um pouco mais rápidos
            virus.color = '#ff0000'; // Vermelho para vírus (apenas para eles verem)
        }

        this.gameState = 'playing';
        this.virusCount = virusCount;
        
        // Timer principal do jogo
        this.gameTimer = setInterval(() => {
            this.gameTime--;
            if (this.gameTime <= 0) {
                this.endGame('neuronsWin'); // Neurônios ganham se o tempo acabar
            }
        }, 1000);

        return true;
    }

    completeTask(playerId, synapseId) {
        const player = this.players.get(playerId);
        const synapse = this.synapses.find(s => s.id === synapseId);
        
        if (!player || !synapse || !player.isAlive || player.isVirus) return false;
        if (synapse.completed || !synapse.isActive) return false;

        // Verificar distância
        const distance = Math.sqrt(
            Math.pow(player.x - synapse.x, 2) + 
            Math.pow(player.y - synapse.y, 2)
        );
        
        if (distance > 60) return false;

        // Adicionar jogador aos trabalhadores se não estiver
        if (!synapse.workers.includes(playerId)) {
            synapse.workers.push(playerId);
        }

        // Aumentar progresso
        synapse.progress += 2;
        player.tasksCompleted++;
        player.experience += 10;

        // Completar tarefa se atingir 100%
        if (synapse.progress >= 100) {
            synapse.completed = true;
            synapse.health = synapse.maxHealth;
            this.networkHealth = Math.min(100, this.networkHealth + 15);
            
            // Dar XP extra para quem completou
            synapse.workers.forEach(workerId => {
                const worker = this.players.get(workerId);
                if (worker) {
                    worker.experience += 25;
                    this.checkLevelUp(worker);
                }
            });
        }
        
        this.checkLevelUp(player);
        return true;
    }

    collectData(playerId, bubbleId) {
        const player = this.players.get(playerId);
        const bubble = this.dataBubbles.find(b => b.id === bubbleId);
        
        if (!player || !bubble || bubble.collected || !player.isAlive) return false;

        // Verificar distância
        const distance = Math.sqrt(
            Math.pow(player.x - bubble.x, 2) + 
            Math.pow(player.y - bubble.y, 2)
        );
        
        if (distance > player.size + bubble.size) return false;

        bubble.collected = true;
        player.size = Math.min(player.maxSize + player.level * 2, player.size + bubble.value);
        player.dataCollected += bubble.value;
        player.energy = Math.min(player.maxEnergy, player.energy + bubble.value * 5);
        player.experience += bubble.value * 2;

        if (player.isVirus) {
            // Vírus crescem mais e ganham mais energia
            player.size += bubble.value;
            player.energy += bubble.value * 3;
            this.networkHealth = Math.max(0, this.networkHealth - 1);
        }

        this.checkLevelUp(player);

        // Reposicionar bolha após 10 segundos
        setTimeout(() => {
            bubble.collected = false;
            bubble.x = Math.random() * this.world.width;
            bubble.y = Math.random() * this.world.height;
        }, 10000);

        return true;
    }

    checkLevelUp(player) {
        const requiredXP = player.level * 100;
        if (player.experience >= requiredXP) {
            player.level++;
            player.experience -= requiredXP;
            player.maxSize += 3;
            player.maxEnergy += 20;
            player.speed += 0.2;
            
            // Neurônios ganham habilidades especiais
            if (!player.isVirus && player.level === 3) {
                player.canDetectVirus = true;
            }
        }
    }

    killPlayer(virusId, victimId) {
        const virus = this.players.get(virusId);
        const victim = this.players.get(victimId);
        
        if (!virus || !victim || !virus.isVirus || !victim.isAlive || !virus.isAlive) return false;
        if (virus.killCooldown > Date.now()) return false;
        if (victim.immuneUntil > Date.now()) return false;

        // Verificar distância
        const distance = Math.sqrt(
            Math.pow(virus.x - victim.x, 2) + 
            Math.pow(virus.y - victim.y, 2)
        );
        
        if (distance > virus.size + victim.size + 10) return false;

        victim.isAlive = false;
        this.deadPlayers.add(victimId);
        virus.killCooldown = Date.now() + 25000; // 25 segundos de cooldown
        virus.size += 5;
        virus.experience += 50;
        
        this.networkHealth = Math.max(0, this.networkHealth - 10);
        
        return true;
    }

    callEmergencyMeeting(playerId) {
        if (this.votingPhase || this.emergencyMeetings >= this.maxEmergencyMeetings) return false;
        if (this.gameState !== 'playing') return false;

        const player = this.players.get(playerId);
        if (!player || !player.isAlive) return false;

        this.emergencyMeetings++;
        this.startVoting(playerId);
        return true;
    }

    startVoting(callerId) {
        this.votingPhase = true;
        this.votes.clear();
        
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        
        // Timer de votação (60 segundos)
        setTimeout(() => {
            this.endVoting();
        }, 60000);

        io.to(this.id).emit('voting-started', {
            caller: this.players.get(callerId)?.username,
            alivePlayers: alivePlayers.map(p => ({ id: p.id, username: p.username })),
            votingTime: 60
        });
    }

    vote(voterId, targetId) {
        if (!this.votingPhase) return false;
        
        const voter = this.players.get(voterId);
        if (!voter || !voter.isAlive) return false;

        this.votes.set(voterId, targetId);
        return true;
    }

    endVoting() {
        if (!this.votingPhase) return;
        
        this.votingPhase = false;
        
        // Contar votos
        const voteCount = new Map();
        this.votes.forEach(targetId => {
            voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1);
        });

        // Encontrar mais votado
        let mostVoted = null;
        let maxVotes = 0;
        
        voteCount.forEach((votes, playerId) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                mostVoted = playerId;
            }
        });

        // Ejetar jogador se houver maioria
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive).length;
        if (mostVoted && maxVotes > alivePlayers / 2) {
            const ejectedPlayer = this.players.get(mostVoted);
            if (ejectedPlayer) {
                ejectedPlayer.isAlive = false;
                this.deadPlayers.add(mostVoted);
                
                io.to(this.id).emit('player-ejected', {
                    player: ejectedPlayer,
                    wasVirus: ejectedPlayer.isVirus,
                    votes: maxVotes
                });
            }
        } else {
            io.to(this.id).emit('no-ejection', { reason: 'Sem maioria' });
        }

        this.checkWinConditions();
    }

    checkWinConditions() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const aliveViruses = alivePlayers.filter(p => p.isVirus).length;
        const aliveNeurons = alivePlayers.filter(p => !p.isVirus).length;

        // Vírus ganham se em número igual ou maior que neurônios
        if (aliveViruses >= aliveNeurons && aliveViruses > 0) {
            this.endGame('virusWin');
            return;
        }

        // Neurônios ganham se todos os vírus foram eliminados
        if (aliveViruses === 0 && this.virusCount > 0) {
            this.endGame('neuronsWin');
            return;
        }

        // Neurônios ganham se completaram todas as tarefas
        const completedTasks = this.synapses.filter(s => s.completed).length;
        if (completedTasks >= this.synapses.length * 0.8) {
            this.endGame('neuronsWin');
            return;
        }

        // Vírus ganham se a saúde da rede chegou a 0
        if (this.networkHealth <= 0) {
            this.endGame('virusWin');
            return;
        }
    }

    endGame(winner) {
        this.gameState = 'ended';
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        if (this.updateLoop) {
            clearInterval(this.updateLoop);
        }

        // Atualizar estatísticas dos jogadores
        this.players.forEach(player => {
            const user = database.users.find(u => u.username === player.username);
            if (user) {
                user.stats.gamesPlayed++;
                
                if (winner === 'neuronsWin' && !player.isVirus) {
                    user.stats.wins++;
                } else if (winner === 'virusWin' && player.isVirus) {
                    user.stats.virusWins++;
                }
                
                user.stats.tasksCompleted += player.tasksCompleted;
            }
        });
        
        saveDatabase();

        io.to(this.id).emit('game-ended', {
            winner,
            players: Array.from(this.players.values()),
            stats: this.getGameStats()
        });

        // Limpar sala após 30 segundos
        setTimeout(() => {
            this.players.forEach(player => {
                activePlayers.delete(player.id);
            });
            gameRooms.delete(this.id);
        }, 30000);
    }

    getGameStats() {
        return {
            networkHealth: this.networkHealth,
            completedTasks: this.synapses.filter(s => s.completed).length,
            totalTasks: this.synapses.length,
            playersAlive: Array.from(this.players.values()).filter(p => p.isAlive).length,
            totalPlayers: this.players.size,
            gameTime: 300 - this.gameTime
        };
    }

    getGameState() {
        return {
            id: this.id,
            players: Array.from(this.players.values()),
            gameState: this.gameState,
            synapses: this.synapses,
            dataBubbles: this.dataBubbles.filter(b => !b.collected),
            networkHealth: this.networkHealth,
            virusCount: this.virusCount,
            gameTime: this.gameTime,
            world: this.world,
            votingPhase: this.votingPhase
        };
    }
}

// API Routes
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username deve ter entre 3 e 20 caracteres' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const existingUser = database.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
        return res.status(400).json({ error: 'Username já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const newUser = {
        id: Date.now().toString(),
        username,
        email: email || '',
        password: hashedPassword,
        stats: {
            gamesPlayed: 0,
            wins: 0,
            tasksCompleted: 0,
            virusWins: 0,
            dataCollected: 0,
            timePlayed: 0
        },
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };

    database.users.push(newUser);
    saveDatabase();

    const token = jwt.sign(
        { userId: newUser.id, username }, 
        JWT_SECRET, 
        { expiresIn: '30d' }
    );
    
    res.json({
        success: true,
        token,
        user: {
            id: newUser.id,
            username: newUser.username,
            stats: newUser.stats
        }
    });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = database.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        return res.status(400).json({ error: 'Usuário não encontrado' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: 'Senha incorreta' });
    }

    user.lastLogin = new Date().toISOString();
    saveDatabase();

    const token = jwt.sign(
        { userId: user.id, username: user.username }, 
        JWT_SECRET, 
        { expiresIn: '30d' }
    );
    
    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            username: user.username,
            stats: user.stats
        }
    });
});

app.post('/api/verify-token', (req, res) => {
    const { token } = req.body;
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = database.users.find(u => u.id === decoded.userId);
        
        if (!user) {
            return res.status(400).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                stats: user.stats
            }
        });
    } catch (error) {
        res.status(400).json({ error: 'Token inválido' });
    }
});

app.get('/api/leaderboard', (req, res) => {
    const leaderboard = database.users
        .map(u => ({
            username: u.username,
            stats: u.stats
        }))
        .sort((a, b) => b.stats.wins - a.stats.wins)
        .slice(0, 50);
    
    res.json({ leaderboard });
});

app.get('/api/rooms', (req, res) => {
    const rooms = Array.from(gameRooms.values()).map(room => ({
        id: room.id,
        players: room.players.size,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        gameState: room.gameState
    }));
    
    res.json({ rooms });
});

// Socket.IO Events
io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);
    
    socket.on('join-game', (data) => {
        const { token, roomId } = data;
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = database.users.find(u => u.id === decoded.userId);
            
            if (!user) {
                socket.emit('error', 'Usuário não encontrado');
                return;
            }

            // Verificar se já está em uma sala
            if (activePlayers.has(socket.id)) {
                socket.emit('error', 'Você já está em uma partida');
                return;
            }

            let room = gameRooms.get(roomId);
            if (!room) {
                room = new GameRoom(roomId);
                gameRooms.set(roomId, room);
            }

            if (room.addPlayer(socket.id, user)) {
                socket.join(roomId);
                playerSockets.set(socket.id, { roomId, user });
                
                io.to(roomId).emit('game-state', room.getGameState());
                
                socket.emit('join-success', {
                    playerId: socket.id,
                    roomId,
                    isVirus: room.players.get(socket.id)?.isVirus || false
                });

                console.log(`${user.username} entrou na sala ${roomId}`);
            } else {
                socket.emit('error', 'Sala lotada');
            }
            
        } catch (error) {
            console.error('Erro no join-game:', error);
            socket.emit('error', 'Token inválido');
        }
    });

    socket.on('start-game', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.startGame()) {
            io.to(playerData.roomId).emit('game-started', room.getGameState());
            console.log(`Jogo iniciado na sala ${playerData.roomId}`);
        } else {
            socket.emit('error', 'Não é possível iniciar o jogo');
        }
    });

    socket.on('player-move', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (!room || room.gameState !== 'playing') return;
        
        const player = room.players.get(socket.id);
        if (player && player.isAlive) {
            // Validar movimento
            const maxSpeed = player.speed;
            const dx = data.x - player.x;
            const dy = data.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxSpeed + 5) { // +5 para tolerância de lag
                player.x = Math.max(0, Math.min(room.world.width, data.x));
                player.y = Math.max(0, Math.min(room.world.height, data.y));
                player.lastActivity = Date.now();
                
                // Adicionar à trilha
                player.trail.push({ x: player.x, y: player.y, time: Date.now() });
                if (player.trail.length > 10) {
                    player.trail.shift();
                }
                
                socket.to(playerData.roomId).emit('player-moved', {
                    playerId: socket.id,
                    x: player.x,
                    y: player.y
                });
            }
        }
    });

    socket.on('complete-task', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.completeTask(socket.id, data.synapseId)) {
            io.to(playerData.roomId).emit('task-completed', {
                synapseId: data.synapseId,
                playerId: socket.id,
                gameState: room.getGameState()
            });
        }
    });

    socket.on('collect-data', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.collectData(socket.id, data.bubbleId)) {
            io.to(playerData.roomId).emit('data-collected', {
                bubbleId: data.bubbleId,
                playerId: socket.id,
                gameState: room.getGameState()
            });
        }
    });

    socket.on('kill-player', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.killPlayer(socket.id, data.victimId)) {
            io.to(playerData.roomId).emit('player-killed', {
                virusId: socket.id,
                victimId: data.victimId,
                gameState: room.getGameState()
            });
        }
    });

    socket.on('call-emergency', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.callEmergencyMeeting(socket.id)) {
            console.log(`Reunião de emergência chamada na sala ${playerData.roomId}`);
        }
    });

    socket.on('vote', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.vote(socket.id, data.targetId)) {
            socket.emit('vote-registered', { targetId: data.targetId });
        }
    });

    socket.on('chat-message', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (!room) return;
        
        const player = room.players.get(socket.id);
        if (!player) return;

        // Filtros básicos de chat
        const message = data.message.slice(0, 200).trim();
        if (!message) return;

        const chatData = {
            playerId: socket.id,
            username: player.username,
            message: message,
            timestamp: Date.now(),
            isAlive: player.isAlive,
            isVirus: player.isVirus
        };

        // Mortos só podem falar com mortos
        if (!player.isAlive) {
            const deadPlayers = Array.from(room.players.values())
                .filter(p => !p.isAlive)
                .map(p => p.id);
            
            deadPlayers.forEach(deadPlayerId => {
                io.to(deadPlayerId).emit('chat-message', chatData);
            });
        } 
        // Vírus podem falar entre si em qualquer momento
        else if (player.isVirus && room.gameState === 'playing') {
            const virusPlayers = Array.from(room.players.values())
                .filter(p => p.isVirus && p.isAlive)
                .map(p => p.id);
            
            virusPlayers.forEach(virusPlayerId => {
                io.to(virusPlayerId).emit('virus-chat', chatData);
            });
        }
        // Chat geral durante reuniões
        else if (room.votingPhase || room.gameState !== 'playing') {
            io.to(playerData.roomId).emit('chat-message', chatData);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        
        const playerData = playerSockets.get(socket.id);
        if (playerData) {
            const room = gameRooms.get(playerData.roomId);
            if (room) {
                room.removePlayer(socket.id);
                io.to(playerData.roomId).emit('player-left', {
                    playerId: socket.id,
                    gameState: room.getGameState()
                });
                
                console.log(`${playerData.user.username} saiu da sala ${playerData.roomId}`);
            }
            playerSockets.delete(socket.id);
        }
        activePlayers.delete(socket.id);
    });

    // Heartbeat para manter conexão
    socket.on('ping', () => {
        socket.emit('pong');
    });
});

// Limpeza periódica de salas vazias
setInterval(() => {
    gameRooms.forEach((room, roomId) => {
        if (room.players.size === 0) {
            if (room.updateLoop) {
                clearInterval(room.updateLoop);
            }
            if (room.gameTimer) {
                clearInterval(room.gameTimer);
            }
            gameRooms.delete(roomId);
            console.log(`Sala ${roomId} removida (vazia)`);
        }
    });
}, 60000); // A cada minuto

// Limpeza de jogadores inativos
setInterval(() => {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutos
    
    gameRooms.forEach(room => {
        room.players.forEach((player, playerId) => {
            if (now - player.lastActivity > inactiveThreshold) {
                console.log(`Removendo jogador inativo: ${player.username}`);
                room.removePlayer(playerId);
                activePlayers.delete(playerId);
            }
        });
    });
}, 120000); // A cada 2 minutos

server.listen(PORT, () => {
    console.log(`🧠 CodeBreakers.io servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`🎮 Neurônios vs Vírus - A batalha pela rede neural!`);
    console.log(`📊 Estatísticas: ${database.users.length} usuários registrados`);
});