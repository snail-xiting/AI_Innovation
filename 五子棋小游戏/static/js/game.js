function checkAILoaded() {
    if (typeof GomokuAI === 'undefined') {
        console.error('AI模块未正确加载！');
        alert('游戏加载出错，请刷新页面重试。');
        return false;
    }
    return true;
}

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 30;
const BOARD_SIZE = 15;

// 游戏状态
let gameBoard = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
let currentPlayer = 1; // 1代表黑子，2代表白子
let gameOver = false;
let gameStarted = false;
let startTime = null;
let timerInterval = null;
let lastMoveTime = null;
let moveTimeout = null;
const MOVE_TIME_LIMIT = 60; // 60秒内必须落子
let isPaused = false;
let pauseStartTime = null;
let totalPausedTime = 0;
let gameMode = 'pvp'; // 'pvp' 或 'pve'
let aiDifficulty = 'medium';
let ai = null;
let lastMove = null; // 记录最后落子位置

// 获取DOM元素
const startButton = document.getElementById('start');
const restartButton = document.getElementById('restart');
const timeDisplay = document.getElementById('time');
const playerDisplay = document.getElementById('player');
const statusDisplay = document.getElementById('status');
const pauseButton = document.getElementById('pause');
const surrenderButton = document.getElementById('surrender');

// 获取模式选择按钮
const pvpButton = document.getElementById('pvp-mode');
const pveButton = document.getElementById('pve-mode');
const difficultySelect = document.querySelector('.difficulty-select');
const difficultyButtons = document.querySelectorAll('.diff-btn');

// 添加模式选择事件处理
pvpButton.addEventListener('click', () => {
    gameMode = 'pvp';
    pvpButton.classList.add('active');
    pveButton.classList.remove('active');
    difficultySelect.style.display = 'none';
});

pveButton.addEventListener('click', () => {
    if (!checkAILoaded()) return;
    gameMode = 'pve';
    pveButton.classList.add('active');
    pvpButton.classList.remove('active');
    difficultySelect.style.display = 'block';
});

difficultyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        aiDifficulty = btn.id;
    });
});

// 更新计时器显示
function updateTimer() {
    if (!startTime) return;
    const now = new Date();
    const diff = Math.floor((now - startTime - totalPausedTime) / 1000);
    const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    timeDisplay.textContent = `${minutes}:${seconds}`;
}

// 更新玩家显示
function updatePlayerDisplay() {
    const isFirstMove = gameBoard.every(row => row.every(cell => cell === 0));
    const firstMoveText = isFirstMove ? '(先手)' : '';
    playerDisplay.innerHTML = currentPlayer === 1 ? 
        `<span style="color: #000">黑子${firstMoveText}</span>` : 
        `<span style="color: #ff0000">白子${firstMoveText}</span>`;
}

// 开始新游戏
function startGame() {
    gameBoard = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    currentPlayer = 1;
    gameOver = false;
    gameStarted = true;
    isPaused = false;
    startTime = new Date();
    totalPausedTime = 0;
    
    // 启动计时器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    
    // 更新按钮状态
    startButton.disabled = true;
    restartButton.disabled = false;
    pauseButton.disabled = false;
    surrenderButton.disabled = false;
    pauseButton.textContent = '暂停游戏';
    
    // 更新显示
    updatePlayerDisplay();
    statusDisplay.textContent = '游戏进行中';
    
    lastMoveTime = new Date();
    if (moveTimeout) clearTimeout(moveTimeout);
    startMoveTimer();
    
    initBoard();
    
    if (gameMode === 'pve') {
        ai = new GomokuAI(aiDifficulty);
        // 如果AI是黑子（先手），则立即让AI落子
        if (currentPlayer === 2) {
            const aiMove = ai.findBestMove(gameBoard);
            if (aiMove) {
                setTimeout(() => {
                    makeMove(aiMove.x, aiMove.y);
                }, 500);
            }
        }
    }
    lastMove = null;
}

// 初始化棋盘
function initBoard() {
    // 绘制棋盘背景
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制棋盘线
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    // 绘制横线
    for (let i = 0; i < BOARD_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(GRID_SIZE, GRID_SIZE + i * GRID_SIZE);
        ctx.lineTo(GRID_SIZE * 14, GRID_SIZE + i * GRID_SIZE);
        ctx.stroke();
    }
    
    // 绘制竖线
    for (let i = 0; i < BOARD_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(GRID_SIZE + i * GRID_SIZE, GRID_SIZE);
        ctx.lineTo(GRID_SIZE + i * GRID_SIZE, GRID_SIZE * 14);
        ctx.stroke();
    }
}

// 绘制棋子
function drawPiece(x, y, player) {
    const xPos = GRID_SIZE + x * GRID_SIZE;
    const yPos = GRID_SIZE + y * GRID_SIZE;
    
    ctx.beginPath();
    ctx.arc(xPos, yPos, GRID_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = player === 1 ? '#000' : '#fff';
    ctx.fill();
    if (player === 2) {
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}

// 在棋盘中间显示文本
function drawCenterText(text, fontSize = 40) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, canvas.height/2 - 50, canvas.width, 100);
    ctx.fillStyle = 'white';
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    ctx.restore();
}

// 检查落子超时
function checkMoveTimeout() {
    if (!gameStarted || gameOver || isPaused) return;
    
    const now = new Date();
    const timeElapsed = Math.floor((now - lastMoveTime) / 1000);
    const timeLeft = MOVE_TIME_LIMIT - timeElapsed;
    
    if (timeLeft <= 0) {
        const currentPlayerText = currentPlayer === 1 ? '黑子' : '白子';
        const winnerText = currentPlayer === 1 ? '白子' : '黑子';
        drawCenterText(`${currentPlayerText}超时！${winnerText}获胜！`);
        statusDisplay.textContent = `游戏结束！${currentPlayerText}超时，${winnerText}获胜！`;
        gameOver = true;
        clearInterval(timerInterval);
        clearTimeout(moveTimeout);
        // 禁用按钮
        pauseButton.disabled = true;
        surrenderButton.disabled = true;
        return;
    } else if (timeLeft <= 10) {
        // 重绘棋盘和提示
        redrawBoard();
        // 显示倒计时提示
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, canvas.height/2 - 30, canvas.width, 60);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`请${currentPlayerText}落子！剩余${timeLeft}秒`, canvas.width/2, canvas.height/2);
        ctx.restore();
        
        statusDisplay.textContent = `请${currentPlayerText}落子！剩余${timeLeft}秒`;
    } else {
        redrawBoard();
    }
}

// 处理点击事件
canvas.addEventListener('click', function(event) {
    if (!gameStarted || gameOver || isPaused || (gameMode === 'pve' && currentPlayer === 2)) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const gridX = Math.round((x - GRID_SIZE) / GRID_SIZE);
    const gridY = Math.round((y - GRID_SIZE) / GRID_SIZE);
    
    if (gridX >= 0 && gridX < BOARD_SIZE && gridY >= 0 && gridY < BOARD_SIZE 
        && gameBoard[gridY][gridX] === 0) {
        makeMove(gridX, gridY);
    }
});

// 添加落子函数
function makeMove(x, y) {
    gameBoard[y][x] = currentPlayer;
    lastMove = {x, y}; // 记录最后落子位置
    
    redrawBoard();
    
    if (checkWin(x, y)) {
        const winner = currentPlayer === 1 ? '黑子' : '白子';
        drawCenterText(`${winner}获胜！`);
        statusDisplay.textContent = `游戏结束！${winner}获胜！`;
        gameOver = true;
        clearInterval(timerInterval);
        clearTimeout(moveTimeout);
        pauseButton.disabled = true;
        surrenderButton.disabled = true;
        return;
    }
    
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updatePlayerDisplay();
    
    // 重置落子时间
    lastMoveTime = new Date();
    statusDisplay.textContent = '游戏进行中';

    // 如果是人机模式且轮到AI落子
    if (gameMode === 'pve' && currentPlayer === 2 && !gameOver) {
        pauseButton.disabled = true;
        surrenderButton.disabled = true;
        statusDisplay.textContent = 'AI思考中...';
        
        setTimeout(() => {
            const aiMove = ai.findBestMove(gameBoard);
            if (aiMove) {
                makeMove(aiMove.x, aiMove.y);
            }
            pauseButton.disabled = false;
            surrenderButton.disabled = false;
        }, 500);
    }
}

// 检查是否获胜
function checkWin(x, y) {
    const directions = [
        [[0, 1], [0, -1]], // 垂直
        [[1, 0], [-1, 0]], // 水平
        [[1, 1], [-1, -1]], // 对角线
        [[1, -1], [-1, 1]] // 反对角线
    ];
    
    return directions.some(dir => {
        let count = 1;
        dir.forEach(([dx, dy]) => {
            let i = 1;
            while (true) {
                const newX = x + dx * i;
                const newY = y + dy * i;
                if (newX < 0 || newX >= BOARD_SIZE || newY < 0 || newY >= BOARD_SIZE
                    || gameBoard[newY][newX] !== currentPlayer) {
                    break;
                }
                count++;
                i++;
            }
        });
        return count >= 5;
    });
}

// 添加开始计时器的函数
function startMoveTimer() {
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setInterval(checkMoveTimeout, 1000);
}

// 添加暂停游戏函数
function togglePause() {
    if (!gameStarted || gameOver) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        // 暂停游戏
        pauseStartTime = new Date();
        clearInterval(timerInterval);
        clearInterval(moveTimeout);
        pauseButton.textContent = '继续游戏';
        surrenderButton.disabled = true;
        drawCenterText('游戏已暂停');
        statusDisplay.textContent = '游戏已暂停';
    } else {
        // 继续游戏
        totalPausedTime += new Date() - pauseStartTime;
        pauseStartTime = null;
        timerInterval = setInterval(updateTimer, 1000);
        startMoveTimer();
        pauseButton.textContent = '暂停游戏';
        surrenderButton.disabled = false;
        
        // 重绘棋盘
        redrawBoard();
        statusDisplay.textContent = '游戏进行中';
    }
}

// 修改重绘棋盘的函数，只标记最后一次落子
function redrawBoard() {
    initBoard();
    // 重绘所有棋子
    for(let i = 0; i < BOARD_SIZE; i++) {
        for(let j = 0; j < BOARD_SIZE; j++) {
            if(gameBoard[i][j] !== 0) {
                drawPiece(j, i, gameBoard[i][j]);
            }
        }
    }
    // 只为最后一次落子添加标记
    if (lastMove) {
        drawLastMoveMarker(lastMove.x, lastMove.y, gameBoard[lastMove.y][lastMove.x]);
    }
}

// 修改drawLastMoveMarker函数，为不同颜色的棋子使用不同颜色的标记
function drawLastMoveMarker(x, y, player) {
    const xPos = GRID_SIZE + x * GRID_SIZE;
    const yPos = GRID_SIZE + y * GRID_SIZE;
    
    ctx.save();
    // 黑子用红色标记，白子用蓝色标记，使标记更容易区分
    ctx.strokeStyle = player === 1 ? '#ff0000' : '#0000ff';
    ctx.lineWidth = 2;
    
    // 绘制四个角
    const markerLength = 6;
    const offset = GRID_SIZE * 0.4 + 2;
    
    // 左上角
    ctx.beginPath();
    ctx.moveTo(xPos - offset, yPos - offset + markerLength);
    ctx.lineTo(xPos - offset, yPos - offset);
    ctx.lineTo(xPos - offset + markerLength, yPos - offset);
    ctx.stroke();
    
    // 右上角
    ctx.beginPath();
    ctx.moveTo(xPos + offset - markerLength, yPos - offset);
    ctx.lineTo(xPos + offset, yPos - offset);
    ctx.lineTo(xPos + offset, yPos - offset + markerLength);
    ctx.stroke();
    
    // 左下角
    ctx.beginPath();
    ctx.moveTo(xPos - offset, yPos + offset - markerLength);
    ctx.lineTo(xPos - offset, yPos + offset);
    ctx.lineTo(xPos - offset + markerLength, yPos + offset);
    ctx.stroke();
    
    // 右下角
    ctx.beginPath();
    ctx.moveTo(xPos + offset - markerLength, yPos + offset);
    ctx.lineTo(xPos + offset, yPos + offset);
    ctx.lineTo(xPos + offset, yPos + offset - markerLength);
    ctx.stroke();
    
    ctx.restore();
}

// 事件监听器
startButton.addEventListener('click', startGame);

restartButton.addEventListener('click', function() {
    if (isPaused) {
        isPaused = false;
        pauseButton.textContent = '暂停游戏';
    }
    startGame();
});

// 添加暂停按钮事件监听
pauseButton.addEventListener('click', togglePause);

// 添加认输按钮事件监听
surrenderButton.addEventListener('click', function() {
    if (gameMode === 'pve' && currentPlayer === 2) {
        // 如果是AI的回合，不允许认输
        return;
    }
    
    // 添加确认对话框
    if (confirm('确定要认输吗？')) {
        surrender();
    }
});

// 初始化游戏界面
initBoard(); 