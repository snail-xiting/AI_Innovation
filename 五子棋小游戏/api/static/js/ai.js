class GomokuAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
    }

    // 评估某个位置的分数
    evaluatePosition(board, x, y, player) {
        const directions = [
            [[0, 1], [0, -1]], // 垂直
            [[1, 0], [-1, 0]], // 水平
            [[1, 1], [-1, -1]], // 对角线
            [[1, -1], [-1, 1]] // 反对角线
        ];
        
        let score = 0;
        
        directions.forEach(dir => {
            let count = 1;
            let blocked = 0;
            
            dir.forEach(([dx, dy]) => {
                let i = 1;
                while (true) {
                    const newX = x + dx * i;
                    const newY = y + dy * i;
                    if (newX < 0 || newX >= 15 || newY < 0 || newY >= 15) {
                        blocked++;
                        break;
                    }
                    if (board[newY][newX] !== player) {
                        if (board[newY][newX] !== 0) blocked++;
                        break;
                    }
                    count++;
                    i++;
                }
            });
            
            // 计算这个方向的分数
            score += this.getDirectionScore(count, blocked);
        });
        
        return score;
    }

    // 根据连子数和被封堵数计算分数
    getDirectionScore(count, blocked) {
        if (blocked === 2) return 0;
        
        switch (count) {
            case 5: return 100000;
            case 4: return blocked === 0 ? 10000 : 1000;
            case 3: return blocked === 0 ? 1000 : 100;
            case 2: return blocked === 0 ? 100 : 10;
            default: return blocked === 0 ? 10 : 1;
        }
    }

    // 获取所有可能的落子位置
    getValidMoves(board) {
        const moves = [];
        const range = 2; // 只考虑已有棋子周围的位置
        
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                if (board[y][x] !== 0) continue;
                
                // 检查周围是否有棋子
                let hasNeighbor = false;
                for (let dy = -range; dy <= range; dy++) {
                    for (let dx = -range; dx <= range; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny < 0 || ny >= 15 || nx < 0 || nx >= 15) continue;
                        if (board[ny][nx] !== 0) {
                            hasNeighbor = true;
                            break;
                        }
                    }
                    if (hasNeighbor) break;
                }
                
                if (hasNeighbor) {
                    moves.push({x, y});
                }
            }
        }
        
        return moves.length > 0 ? moves : [{x: 7, y: 7}]; // 如果没有合适的位置，就下在中心
    }

    // 选择最佳落子位置
    findBestMove(board) {
        const moves = this.getValidMoves(board);
        let bestScore = -Infinity;
        let bestMove = null;
        
        // 根据难度调整搜索深度
        const depthMap = {
            'easy': 1,
            'medium': 2,
            'hard': 3
        };
        
        moves.forEach(move => {
            const score = this.evaluatePosition(board, move.x, move.y, 2);
            // 考虑防守
            const defenseScore = this.evaluatePosition(board, move.x, move.y, 1);
            
            let finalScore = score;
            
            // 根据难度调整AI的策略
            switch (this.difficulty) {
                case 'easy':
                    finalScore = score * 0.7 + defenseScore * 0.3;
                    break;
                case 'medium':
                    finalScore = score + defenseScore;
                    break;
                case 'hard':
                    finalScore = score * 1.2 + defenseScore;
                    break;
            }
            
            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestMove = move;
            }
        });
        
        return bestMove;
    }
} 