// ===== LÓGICA ESPECÍFICA DO JOGO =====

class GameEngine {
    constructor() {
        this.gameStarted = false;
        this.gameTime = 0;
        this.maxGameTime = 300000; // 5 minutos
        this.players = new Map();
        this.tasks = [];
        this.dataPackets = [];
        this.networkHealth = 100;
        this.virusesFound = 0;
        this.votingInProgress = false;
        this.gameTimer = null;
    }

    // Inicializar jogo
    init(gameData) {
        this.gameStarted = true;
        this.players = new Map(gameData.players.map(p => [p.id, p]));
        this.tasks = gameData.taskStations;
        this.dataPackets = gameData.dataPackets;
        this.networkHealth = gameData.networkHealth;
        
        console.log('🎮 Game Engine iniciado:', gameData);
        this.startGameTimer();
    }

    // Timer do jogo
    startGameTimer() {
        const startTime = Date.now();
        
        this.gameTimer = setInterval(() => {
            this.gameTime = Date.now() - startTime;
            
            // Verificar fim de jogo por tempo
            if (this.gameTime >= this.maxGameTime) {
                clearInterval(this.gameTimer);
                this.endGame('timeout');
            }
            
            // Atualizar HUD com tempo restante
            this.updateGameTimer();
            
            // Verificar condições de vitória a cada segundo
            this.checkWinConditions();
            
        }, 1000);
    }

    updateGameTimer() {
        const remainingTime = Math.max(0, this.maxGameTime - this.gameTime);
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);
        
        // Criar elemento do timer se não existir
        let timerElement = document.getElementById('game-timer');
        if (!timerElement) {
            timerElement = document.createElement('div');
            timerElement.id = 'game-timer';
            timerElement.style.cssText = `
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 18px;
                font-weight: bold;
                background: rgba(0,0,0,0.7);
                padding: 8px 16px;
                border-radius: 20px;
                z-index: 101;
            `;
            document.querySelector('.game-ui').appendChild(timerElement);
        }
        
        timerElement.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Mudar cor quando restam menos de 60 segundos
        if (remainingTime < 60000) {
            timerElement.style.color = '#ff6b6b';
            timerElement.style.animation = 'blink 1s infinite';
        }
    }

    // Verificar condições de vitória
    checkWinConditions() {
        if (!this.gameStarted) return false;
        
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const aliveNeurons = alivePlayers.filter(p => !p.isVirus);
        const aliveViruses = alivePlayers.filter(p => p.isVirus);
        
        // Vitória dos vírus - maioria
        if (aliveViruses.length >= aliveNeurons.length && aliveViruses.length > 0) {
            this.endGame('virus_majority');
            return true;
        }
        
        // Vitória dos neurônios - todos os vírus eliminados
        if (aliveViruses.length === 0) {
            this.endGame('neuron_elimination');
            return true;
        }
        
        // Vitória dos neurônios - tarefas completas
        const completedTasks = this.tasks.filter(t => t.completed).length;
        if (completedTasks >= Math.ceil(this.tasks.length * 0.8)) { // 80% das tarefas
            this.endGame('neuron_tasks');
            return true;
        }
        
        // Vitória dos vírus - rede destruída
        if (this.networkHealth <= 0) {
            this.endGame('virus_sabotage');
            return true;
        }
        
        return false;
    }

    // Fim de jogo
    endGame(reason) {
        this.gameStarted = false;
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        console.log('🏁 Jogo finalizado:', reason);
        
        // Mostrar tela de resultado
        setTimeout(() => {
            this.showGameResults(reason);
        }, 1000);
    }

    showGameResults(reason) {
        const resultsScreen = document.createElement('div');
        resultsScreen.className = 'game-results-overlay';
        resultsScreen.innerHTML = this.getResultsHTML(reason);
        
        resultsScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.5s ease-out;
        `;
        
        document.body.appendChild(resultsScreen);
        
        // Remover após 10 segundos ou ao clicar
        setTimeout(() => {
            resultsScreen.remove();
            this.returnToMenu();
        }, 10000);
        
        resultsScreen.addEventListener('click', () => {
            resultsScreen.remove();
            this.returnToMenu();
        });
    }

    getResultsHTML(reason) {
        const resultMessages = {
            'virus_majority': {
                title: '🦠 VÍRUS VENCERAM!',
                message: 'Os vírus tomaram controle da rede!',
                color: '#ff6b6b'
            },
            'virus_sabotage': {
                title: '🦠 VÍRUS VENCERAM!',
                message: 'A rede neural foi completamente corrompida!',
                color: '#ff6b6b'
            },
            'neuron_elimination': {
                title: '🧠 NEURÔNIOS VENCERAM!',
                message: 'Todos os vírus foram eliminados!',
                color: '#00ff88'
            },
            'neuron_tasks': {
                title: '🧠 NEURÔNIOS VENCERAM!',
                message: 'A rede foi completamente restaurada!',
                color: '#00ff88'
            },
            'timeout': {
                title: '⏰ TEMPO ESGOTADO!',
                message: 'A rede entrou em modo de segurança',
                color: '#ffa500'
            }
        };
        
        const result = resultMessages[reason] || resultMessages['timeout'];
        
        return `
            <div style="text-align: center; background: rgba(15,15,35,0.95); padding: 3rem; border-radius: 20px; border: 2px solid ${result.color}; max-width: 500px;">
                <h1 style="font-size: 2.5rem; color: ${result.color}; margin-bottom: 1rem;">${result.title}</h1>
                <p style="font-size: 1.3rem; color: white; margin-bottom: 2rem;">${result.message}</p>
                
                <div style="margin: 2rem 0;">
                    <h3 style="color: #4ecdc4; margin-bottom: 1rem;">📊 Estatísticas da Partida:</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
                        <div>⏱️ Tempo: ${Math.floor(this.gameTime / 60000)}:${Math.floor((this.gameTime % 60000) / 1000).toString().padStart(2, '0')}</div>
                        <div>🛡️ Saúde da Rede: ${this.networkHealth}%</div>
                        <div>✅ Tarefas: ${this.tasks.filter(t => t.completed).length}/${this.tasks.length}</div>
                        <div>👥 Jogadores: ${this.players.size}</div>
                    </div>
                </div>
                
                <div style="margin-top: 2rem;">
                    <h4 style="color: #aaa; margin-bottom: 1rem;">🏆 Placar Final:</h4>
                    <div id="final-scores"></div>
                </div>
                
                <p style="color: #aaa; margin-top: 2rem; font-size: 0.9rem;">Clique para retornar ao menu principal</p>
            </div>
        `;
    }

    returnToMenu() {
        // Limpar estado do jogo
        isInGame = false;
        gameState = null;
        currentRoom = null;
        
        // Voltar ao menu do jogo
        showScreen(screens.GAME_MENU);
        
        // Reconectar socket se necessário
        if (!socket.connected) {
            socket.connect();
        }
    }

    // Atualizar estado do jogo
    updateState(newGameState) {
        if (!this.gameStarted) return;
        
        this.players = new Map(newGameState.players.map(p => [p.id, p]));
        this.tasks = newGameState.taskStations;
        this.dataPackets = newGameState.dataPackets;
        this.networkHealth = newGameState.networkHealth;
        
        // Verificar se precisa atualizar elementos específicos
        this.updateNetworkHealthBar();
    }

    updateNetworkHealthBar() {
        const healthFill = document.getElementById('network-health-fill');
        const healthText = document.getElementById('network-health-text');
        
        if (healthFill && healthText) {
            healthFill.style.width = `${this.networkHealth}%`;
            healthText.textContent = `${this.networkHealth}%`;
            
            // Mudar cor baseada na saúde
            if (this.networkHealth > 70) {
                healthFill.style.background = 'linear-gradient(90deg, #00ff88, #4ecdc4)';
            } else if (this.networkHealth > 30) {
                healthFill.style.background = 'linear-gradient(90deg, #ffa500, #ffdd00)';
            } else {
                healthFill.style.background = 'linear-gradient(90deg, #ff6b6b, #ff4757)';
            }
        }
    }
}

// ===== SISTEMA DE TAREFAS =====
class TaskSystem {
    constructor() {
        this.activeTasks = new Map();
        this.taskTemplates = {
            firewall: this.createFirewallTask,
            connection: this.createConnectionTask,
            analysis: this.createAnalysisTask,
            sync: this.createSyncTask,
            repair: this.createRepairTask
        };
    }

    createFirewallTask(station) {
        const sequences = ['1337', '8080', '443', '22', '3389'];
        const correctSequence = sequences[Math.floor(Math.random() * sequences.length)];
        
        return {
            type: 'input',
            title: '🛡️ Configurar Firewall',
            description: 'Digite a porta de segurança correta:',
            correctAnswer: correctSequence,
            hints: {
                '1337': 'Ano do leet speak',
                '8080': 'Porta alternativa HTTP',
                '443': 'Porta padrão HTTPS',
                '22': 'Porta padrão SSH',
                '3389': 'Porta Remote Desktop'
            }[correctSequence]
        };
    }

    createConnectionTask(station) {
        const sequence = [1, 3, 2, 4]; // Ordem correta dos cabos
        
        return {
            type: 'sequence',
            title: '⚡ Reparar Conexão',
            description: 'Conecte os cabos na ordem correta:',
            correctSequence: sequence,
            currentSequence: []
        };
    }

    createAnalysisTask(station) {
        const symbols = ['●', '▲', '■', '◆', '★', '♦', '♣', '♠'];
        const correctSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        const options = [];
        
        // Adicionar símbolos aleatórios e um correto em posição aleatória
        for (let i = 0; i < 8; i++) {
            if (i === 3) { // Posição do símbolo correto
                options.push(correctSymbol);
            } else {
                options.push(symbols[Math.floor(Math.random() * symbols.length)]);
            }
        }
        
        return {
            type: 'selection',
            title: '🧠 Análise de Padrões',
            description: 'Encontre o padrão único:',
            options: options,
            correctIndex: 3
        };
    }

    createSyncTask(station) {
        return {
            type: 'timing',
            title: '🔄 Sincronização',
            description: 'Clique quando as ondas se alinharem:',
            targetTime: Math.random() * 3000 + 1000, // 1-4 segundos
            tolerance: 200 // ±200ms
        };
    }

    createRepairTask(station) {
        const pattern = this.generateRepairPattern();
        
        return {
            type: 'pattern',
            title: '🔧 Reparar Sistema',
            description: 'Reproduza o padrão mostrado:',
            pattern: pattern,
            userPattern: []
        };
    }

    generateRepairPattern() {
        const length = Math.floor(Math.random() * 3) + 3; // 3-5 elementos
        const pattern = [];
        
        for (let i = 0; i < length; i++) {
            pattern.push(Math.floor(Math.random() * 4) + 1);
        }
        
        return pattern;
    }

    // Verificar se a tarefa foi completada corretamente
    validateTask(taskData, userInput) {
        switch (taskData.type) {
            case 'input':
                return userInput.toLowerCase() === taskData.correctAnswer.toLowerCase();
                
            case 'sequence':
                return JSON.stringify(userInput) === JSON.stringify(taskData.correctSequence);
                
            case 'selection':
                return userInput === taskData.correctIndex;
                
            case 'timing':
                const timeDiff = Math.abs(userInput - taskData.targetTime);
                return timeDiff <= taskData.tolerance;
                
            case 'pattern':
                return JSON.stringify(userInput) === JSON.stringify(taskData.pattern);
                
            default:
                return false;
        }
    }
}

// ===== SISTEMA DE EFEITOS VISUAIS =====
class VisualEffects {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.effects = [];
    }

    // Adicionar efeito de partícula
    addParticle(x, y, color, type = 'default') {
        const particle = {
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            color: color,
            alpha: 1,
            life: 60, // frames
            maxLife: 60,
            size: Math.random() * 3 + 1,
            type: type
        };
        
        this.particles.push(particle);
    }

    // Efeito de coleta de dados
    dataCollectEffect(x, y) {
        for (let i = 0; i < 5; i++) {
            this.addParticle(x, y, '#4ecdc4', 'data');
        }
    }

    // Efeito de tarefa completada
    taskCompleteEffect(x, y) {
        for (let i = 0; i < 10; i++) {
            this.addParticle(x, y, '#00ff88', 'success');
        }
    }

    // Efeito de dano na rede
    networkDamageEffect() {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        
        for (let i = 0; i < 3; i++) {
            this.addParticle(x, y, '#ff6b6b', 'damage');
        }
    }

    // Atualizar e desenhar partículas
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Atualizar posição
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Atualizar vida e alpha
            particle.life--;
            particle.alpha = particle.life / particle.maxLife;
            
            // Remover partículas mortas
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            // Desenhar partícula
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    // Efeito de scan da rede
    networkScanEffect() {
        const scanLine = {
            y: 0,
            speed: 5,
            alpha: 0.7
        };
        
        const animate = () => {
            this.ctx.save();
            this.ctx.globalAlpha = scanLine.alpha;
            this.ctx.fillStyle = '#00ff88';
            this.ctx.fillRect(0, scanLine.y, this.canvas.width, 2);
            this.ctx.restore();
            
            scanLine.y += scanLine.speed;
            scanLine.alpha -= 0.01;
            
            if (scanLine.y < this.canvas.height && scanLine.alpha > 0) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
}

// ===== SISTEMA DE AUDIO =====
class AudioSystem {
    constructor() {
        this.sounds = {};
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.volume = 0.7;
        
        this.initializeSounds();
    }

    initializeSounds() {
        // Criar sons usando Web Audio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Sons do jogo
        this.sounds = {
            dataCollect: this.createBeepSound(800, 0.1),
            taskComplete: this.createBeepSound(1200, 0.2),
            networkDamage: this.createBeepSound(200, 0.3),
            playerJoin: this.createBeepSound(600, 0.15),
            gameStart: this.createBeepSound(1000, 0.5),
            gameEnd: this.createBeepSound(500, 1)
        };
    }

    createBeepSound(frequency, duration) {
        return () => {
            if (!this.sfxEnabled) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }

    playSound(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        return this.musicEnabled;
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

// ===== INICIALIZAÇÃO DOS SISTEMAS =====
let gameEngine;
let taskSystem;
let visualEffects;
let audioSystem;

// Inicializar sistemas quando o jogo começar
document.addEventListener('DOMContentLoaded', () => {
    gameEngine = new GameEngine();
    taskSystem = new TaskSystem();
    audioSystem = new AudioSystem();
    
    // Inicializar efeitos visuais quando o canvas estiver pronto
    if (typeof initializeGameCanvas === 'function') {
        const originalInitCanvas = initializeGameCanvas;
        window.initializeGameCanvas = function() {
            originalInitCanvas();
            visualEffects = new VisualEffects(canvas, ctx);
        };
    }
});

// Exportar para uso global
window.gameEngine = gameEngine;
window.taskSystem = taskSystem;
window.audioSystem = audioSystem;