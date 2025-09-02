const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configurações
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'codebreakers_secret_key_2025';
const MAX_PLAYERS_PER_ROOM = 15;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Base de dados simples (arquivo JSON)
const DB_PATH = './database.json';
let database = {
    users: [],
    games: []
};

// Carregar base de dados
if (fs.existsSync(DB_PATH)) {
    try {
        database = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        console.log('Criando nova base de dados...');
    }
}

// Salvar base de dados
const saveDatabase = () => {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
};

// Estado do jogo
const gameRooms = new Map();
const playerSockets = new Map();

class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.gameState = 'waiting'; // waiting, playing, voting, ended
        this.virusCount = 0;
        this.taskStations = this.generateTaskStations();
        this.dataPackets = this.generateDataPackets();
        this.networkHealth = 100;
        this.round = 1;
        this.votingTime = 30;
        this.gameTimer = null;
    }

    generateTaskStations() {
        return [
            { id: 1, x: 200, y: 200, type: 'firewall', completed: false, completedBy: [] },
            { id: 2, x: 600, y: 300, type: 'connection', completed: false, completedBy: [] },
            { id: 3, x: 350, y: 450, type: 'analysis', completed: false, completedBy: [] },
            { id: 4, x: 150, y: 100, type: 'sync', completed: false, completedBy: [] },
            { id: 5, x: 700, y: 150, type: 'repair', completed: false, completedBy: [] },
            { id: 6, x: 500, y: 500, type: 'firewall', completed: false, completedBy: [] }
        ];
    }

    generateDataPackets() {
        const packets = [];
        for (let i = 0; i < 20; i++) {
            packets.push({
                id: i,
                x: Math.random() * 750 + 50,
                y: Math.random() * 550 + 50,
                collected: false,
                value: Math.floor(Math.random() * 5) + 1
            });
        }
        return packets;
    }

    addPlayer(socketId, userData) {
        if (this.players.size >= MAX_PLAYERS_PER_ROOM) return false;

        const player = {
            id: socketId,
            username: userData.username,
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50,
            size: 20,
            isVirus: false,
            isAlive: true,
            suspicious: 0,
            tasksCompleted: 0,
            dataCollected: 0,
            color: this.getRandomColor(),
            lastActivity: Date.now()
        };

        this.players.set(socketId, player);
        return true;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        if (this.players.size === 0) {
            gameRooms.delete(this.id);
        }
    }

    startGame() {
        if (this.players.size < 4) return false;

        // Determinar vírus (20-30% dos jogadores)
        const playerArray = Array.from(this.players.values());
        const virusCount = Math.max(1, Math.floor(playerArray.length * 0.25));
        
        for (let i = 0; i < virusCount; i++) {
            const randomIndex = Math.floor(Math.random() * playerArray.length);
            playerArray[randomIndex].isVirus = true;
        }

        this.gameState = 'playing';
        this.virusCount = virusCount;
        
        // Timer do jogo
        this.gameTimer = setTimeout(() => {
            this.endGame('timeout');
        }, 300000); // 5 minutos

        return true;
    }

    completeTask(playerId, taskId) {
        const player = this.players.get(playerId);
        const task = this.taskStations.find(t => t.id === taskId);
        
        if (!player || !task || player.isVirus) return false;

        if (!task.completedBy.includes(playerId)) {
            task.completedBy.push(playerId);
            player.tasksCompleted++;
            
            if (task.completedBy.length >= 3) {
                task.completed = true;
                this.networkHealth += 10;
            }
        }
        
        return true;
    }

    collectData(playerId, packetId) {
        const player = this.players.get(playerId);
        const packet = this.dataPackets.find(p => p.id === packetId);
        
        if (!player || !packet || packet.collected) return false;

        packet.collected = true;
        player.size += packet.value;
        player.dataCollected += packet.value;

        if (player.isVirus) {
            player.size += packet.value; // Vírus crescem mais rápido
            this.networkHealth -= 2;
        }

        return true;
    }

    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getGameState() {
        return {
            id: this.id,
            players: Array.from(this.players.values()),
            gameState: this.gameState,
            taskStations: this.taskStations,
            dataPackets: this.dataPackets.filter(p => !p.collected),
            networkHealth: this.networkHealth,
            virusCount: this.virusCount,
            round: this.round
        };
    }
}

// Rotas da API
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    // Verificar se usuário já existe
    const existingUser = database.users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ error: 'Username já existe' });
    }

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
        id: Date.now().toString(),
        username,
        email: email || '',
        password: hashedPassword,
        stats: {
            gamesPlayed: 0,
            wins: 0,
            tasksCompleted: 0,
            virusWins: 0
        },
        createdAt: new Date().toISOString()
    };

    database.users.push(newUser);
    saveDatabase();

    const token = jwt.sign({ userId: newUser.id, username }, JWT_SECRET, { expiresIn: '7d' });
    
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
    
    const user = database.users.find(u => u.username === username);
    if (!user) {
        return res.status(400).json({ error: 'Usuário não encontrado' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
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

// Socket.io eventos
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

            // Encontrar ou criar sala
            let room = gameRooms.get(roomId) || new GameRoom(roomId);
            if (!gameRooms.has(roomId)) {
                gameRooms.set(roomId, room);
            }

            // Adicionar jogador
            if (room.addPlayer(socket.id, user)) {
                socket.join(roomId);
                playerSockets.set(socket.id, { roomId, user });
                
                // Enviar estado do jogo para todos na sala
                io.to(roomId).emit('game-state', room.getGameState());
                
                socket.emit('join-success', {
                    playerId: socket.id,
                    roomId,
                    isVirus: room.players.get(socket.id).isVirus
                });
            } else {
                socket.emit('error', 'Sala lotada');
            }
            
        } catch (error) {
            socket.emit('error', 'Token inválido');
        }
    });

    socket.on('start-game', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.startGame()) {
            io.to(playerData.roomId).emit('game-started', room.getGameState());
        }
    });

    socket.on('player-move', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (!room) return;
        
        const player = room.players.get(socket.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.lastActivity = Date.now();
            
            // Broadcast posição para outros jogadores
            socket.to(playerData.roomId).emit('player-moved', {
                playerId: socket.id,
                x: data.x,
                y: data.y
            });
        }
    });

    socket.on('complete-task', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.completeTask(socket.id, data.taskId)) {
            io.to(playerData.roomId).emit('task-completed', {
                taskId: data.taskId,
                playerId: socket.id,
                gameState: room.getGameState()
            });
        }
    });

    socket.on('collect-data', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = gameRooms.get(playerData.roomId);
        if (room && room.collectData(socket.id, data.packetId)) {
            io.to(playerData.roomId).emit('data-collected', {
                packetId: data.packetId,
                playerId: socket.id,
                gameState: room.getGameState()
            });
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
            }
            playerSockets.delete(socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 CodeBreakers.io servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
});