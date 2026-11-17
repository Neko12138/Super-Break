const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const WALL_MARGIN = 80;

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        this.score = 0;
        this.lives = 3;
        this.started = false;
        this.finished = false;
        this.targetPaddleX = GAME_WIDTH / 2;

        this.createBounds();
        this.createBricks();
        this.createPaddle();
        this.createBall();
        this.createCollisions();
        this.createControls();
        this.resetBall();
    }

    createBounds() {
        const bounds = this.add.graphics();
        bounds.lineStyle(3, 0x00d9ff, 0.35);
        bounds.beginPath();
        bounds.moveTo(WALL_MARGIN, GAME_HEIGHT);
        bounds.lineTo(WALL_MARGIN, 90);
        bounds.lineTo(GAME_WIDTH - WALL_MARGIN, 90);
        bounds.lineTo(GAME_WIDTH - WALL_MARGIN, GAME_HEIGHT);
        bounds.strokePath();
    }

    createBricks() {
        this.bricks = this.physics.add.staticGroup();

        const columns = 8;
        const rows = 5;
        const brickWidth = 190;
        const targetHeight = 24;
        const gap = 16;
        const totalWidth = columns * brickWidth + (columns - 1) * gap;
        const startX = (GAME_WIDTH - totalWidth) / 2 + brickWidth / 2;
        const startY = 190;
        const colors = [0x00f0ff, 0x437bff, 0x9c4dff, 0xff3cac, 0xff8a2b];

        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const x = startX + column * (brickWidth + gap);
                const y = startY + row * 66;
                const color = colors[row];

                const glow = this.add.rectangle(x, y, brickWidth, 14, color, 0.16);
                const line = this.add.rectangle(x, y, brickWidth, 3, color, 1);
                const brick = this.add.rectangle(x, y, brickWidth, targetHeight, 0x000000, 0);
                brick.glow = glow;
                brick.line = line;

                this.bricks.add(brick);
                brick.body.updateFromGameObject();
            }
        }

        this.bricksRemaining = columns * rows;
    }

    createPaddle() {
        this.paddleGlow = this.add.rectangle(GAME_WIDTH / 2, 935, 250, 14, 0x00f0ff, 0.2);
        this.paddleLine = this.add.rectangle(GAME_WIDTH / 2, 935, 250, 3, 0x8affff, 1);
        this.paddle = this.add.rectangle(GAME_WIDTH / 2, 935, 250, 24, 0x000000, 0);
        this.physics.add.existing(this.paddle);
        this.paddle.body.setImmovable(true);
        this.paddle.body.setAllowGravity(false);
    }

    createBall() {
        this.ballTrail = [];
        this.trailGraphics = this.add.graphics();

        this.ballGlow = this.add.circle(GAME_WIDTH / 2, 890, 22, 0xff3cac, 0.2);
        this.ball = this.add.circle(GAME_WIDTH / 2, 890, 9, 0xffd4ee, 1);
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(10);
        this.ball.body.setBounce(1, 1);
        this.ball.body.setAllowGravity(false);
        this.ball.body.setCollideWorldBounds(true);
    }

    createCollisions() {
        this.physics.world.setBounds(
            WALL_MARGIN,
            90,
            GAME_WIDTH - WALL_MARGIN * 2,
            GAME_HEIGHT
        );
        this.physics.world.setBoundsCollision(true, true, true, false);

        this.physics.add.collider(
            this.ball,
            this.paddle,
            this.onPaddleHit,
            null,
            this
        );

        this.physics.add.collider(
            this.ball,
            this.bricks,
            this.onBrickHit,
            null,
            this
        );
    }

    createControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('A,D');

        this.input.keyboard.on('keydown-SPACE', () => this.handleAction());

        this.input.on('pointermove', (pointer) => {
            this.targetPaddleX = pointer.worldX;
        });

        this.input.on('pointerdown', (pointer) => {
            this.targetPaddleX = pointer.worldX;
            this.handleAction();
        });
    }

    handleAction() {
        if (this.finished) {
            this.scene.restart();
            return;
        }

        if (!this.started) {
            this.started = true;
            this.statusText.setVisible(false);
            this.ball.body.setVelocity(420, -620);
        }
    }

    onPaddleHit(ball, paddle) {
        if (ball.body.velocity.y < 0) {
            return;
        }

        const hitOffset = Phaser.Math.Clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1);
        ball.body.setVelocityX(hitOffset * 650);
        ball.body.setVelocityY(-Math.max(560, Math.abs(ball.body.velocity.y)));
    }

    onBrickHit(ball, brick) {
        if (!brick.active) {
            return;
        }

        brick.body.enable = false;
        brick.setActive(false);
        brick.setVisible(false);
        brick.glow.setVisible(false);
        brick.line.setVisible(false);

        this.bricksRemaining -= 1;
        this.score += 100;

        if (this.bricksRemaining === 0) {
            this.endGame('CLEAR');
        }
    }

    resetBall() {
        this.started = false;
        this.ball.body.stop();
        this.ball.setPosition(this.paddle.x, this.paddle.y - 42);
        this.ballTrail = [];
        this.trailGraphics.clear();

        if (!this.statusText) {
            this.statusText = this.add.text(
                GAME_WIDTH / 2,
                780,
                'CLICK / SPACE',
                {
                    fontFamily: 'monospace',
                    fontSize: '26px',
                    color: '#71858d'
                }
            ).setOrigin(0.5);
        } else {
            this.statusText.setText('CLICK / SPACE');
            this.statusText.setVisible(true);
        }
    }

    loseLife() {
        this.lives -= 1;

        if (this.lives <= 0) {
            this.endGame('GAME OVER');
        } else {
            this.resetBall();
        }
    }

    endGame(message) {
        this.finished = true;
        this.started = false;
        this.ball.body.stop();
        this.ballTrail = [];
        this.trailGraphics.clear();
        this.statusText.setText(`${message}\nCLICK / SPACE`);
        this.statusText.setAlign('center');
        this.statusText.setVisible(true);
    }

    updatePaddle(delta) {
        const direction =
            (this.cursors.left.isDown || this.keys.A.isDown ? -1 : 0) +
            (this.cursors.right.isDown || this.keys.D.isDown ? 1 : 0);

        if (direction !== 0) {
            this.targetPaddleX = this.paddle.x + direction * 900 * (delta / 1000);
        }

        const halfWidth = this.paddle.width / 2;
        this.targetPaddleX = Phaser.Math.Clamp(
            this.targetPaddleX,
            WALL_MARGIN + halfWidth,
            GAME_WIDTH - WALL_MARGIN - halfWidth
        );

        const nextX = Phaser.Math.Linear(this.paddle.x, this.targetPaddleX, 0.35);
        this.paddle.body.reset(nextX, this.paddle.y);
        this.paddleGlow.setPosition(this.paddle.x, this.paddle.y);
        this.paddleLine.setPosition(this.paddle.x, this.paddle.y);
    }

    updateBallTrail() {
        if (this.started) {
            this.ballTrail.unshift({ x: this.ball.x, y: this.ball.y });

            if (this.ballTrail.length > 22) {
                this.ballTrail.pop();
            }
        }

        this.trailGraphics.clear();

        for (let index = 0; index < this.ballTrail.length - 1; index += 1) {
            const from = this.ballTrail[index];
            const to = this.ballTrail[index + 1];
            const fade = 1 - index / (this.ballTrail.length - 1);

            this.trailGraphics.lineStyle(14, 0xff3cac, 0.08 * fade);
            this.trailGraphics.lineBetween(from.x, from.y, to.x, to.y);
            this.trailGraphics.lineStyle(3, 0xff91d2, 0.8 * fade);
            this.trailGraphics.lineBetween(from.x, from.y, to.x, to.y);
        }
    }

    update(time, delta) {
        this.updatePaddle(delta);

        if (!this.started && !this.finished) {
            this.ball.body.reset(this.paddle.x, this.paddle.y - 42);
        }

        this.ballGlow.setPosition(this.ball.x, this.ball.y);
        this.updateBallTrail();

        if (this.started && this.ball.y > GAME_HEIGHT + 30) {
            this.loseLife();
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    disableVisibilityChange: true,
    scene: GameScene,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    }
};

new Phaser.Game(config);
