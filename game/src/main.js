const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const WALL_MARGIN = 80;
const FIELD_TOP = 90;
const PADDLE_Y = 935;
const PADDLE_WIDTH = 290;
const BALL_RADIUS = 10;
const BALL_SPEED = 850;
const MIDDLE_LAYER = 1;

// Physics runs in the same X/Y space on every layer. Only drawing uses this projection.
const LAYERS = [
    { name: 'NEAR', scale: 0.98, top: 262, color: 0xffa86e, speed: 0.85, speedLabel: 'SLOW' },
    { name: 'MID', scale: 0.83, top: 193, color: 0x60efdc, speed: 1, speedLabel: 'MEDIUM' },
    { name: 'FAR', scale: 0.68, top: 124, color: 0xba9bff, speed: 1.25, speedLabel: 'FAST' }
];

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        this.layer = MIDDLE_LAYER;
        this.lives = 3;
        this.started = false;
        this.finished = false;
        this.pointerX = null;

        this.physics.world.setBounds(WALL_MARGIN, FIELD_TOP, GAME_WIDTH - 2 * WALL_MARGIN, GAME_HEIGHT);
        this.physics.world.setBoundsCollision(true, true, true, false);

        this.playfield = this.add.graphics();
        this.paddle = this.add.rectangle(GAME_WIDTH / 2, PADDLE_Y, PADDLE_WIDTH, 24).setVisible(false);
        this.physics.add.existing(this.paddle);
        this.paddle.body.setImmovable(true);

        this.ball = this.add.circle(GAME_WIDTH / 2, PADDLE_Y - 42, BALL_RADIUS).setVisible(false);
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(BALL_RADIUS).setBounce(1).setCollideWorldBounds(true);

        this.bricks = this.physics.add.staticGroup();
        this.createBricks();

        this.physics.add.collider(this.ball, this.paddle, this.onPaddleHit,
            (ball) => this.started && ball.body.velocity.y > 0, this);
        this.physics.add.collider(this.ball, this.bricks, this.onBrickHit,
            (ball, brick) => this.started && brick.layer === this.layer, this);

        this.hud = this.add.text(48, 30, '', { fontFamily: 'monospace', fontSize: '28px' });
        this.add.text(48, 1024, 'MOUSE / A D / ARROWS TO MOVE     CLICK / SPACE TO SERVE',
            { fontFamily: 'monospace', fontSize: '25px', color: '#9eabc4' });
        this.status = this.add.text(GAME_WIDTH / 2, 540, '', {
            fontFamily: 'monospace', fontSize: '34px', backgroundColor: '#101523',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5);
        this.zoneLabels = ['FARTHER', 'STAY', 'NEARER'].map((label) =>
            this.add.text(0, 0, label, {
                fontFamily: 'monospace', fontSize: '21px', color: '#e3ebff'
            }).setOrigin(0.5, 0));

        this.createControls();
        this.drawPlayfield();
    }

    createBricks() {
        const positions = [
            [[540, 310], [960, 375]],
            [[960, 375], [1380, 310]],
            [[960, 375], [1320, 235]]
        ];
        LAYERS.forEach((_, layer) => {
            for (const [x, y] of positions[layer]) {
                const brick = this.add.rectangle(x, y, 220, 48).setVisible(false);
                brick.layer = layer;
                this.bricks.add(brick);
            }
        });
    }

    createControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('A,D');
        this.input.keyboard.on('keydown-SPACE', this.handleAction, this);
        this.input.on('pointermove', (pointer) => { this.pointerX = pointer.worldX; });
        this.input.on('pointerdown', (pointer) => {
            this.pointerX = pointer.worldX;
            this.handleAction();
        });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard.off('keydown-SPACE', this.handleAction, this);
        });
    }

    handleAction() {
        if (this.finished) {
            this.scene.restart();
        } else if (!this.started) {
            this.updatePaddle(0);
            this.ball.body.reset(this.paddle.x, PADDLE_Y - 42);
            this.started = true;
            this.ball.body.setVelocity(0, -BALL_SPEED * LAYERS[this.layer].speed);
        }
    }

    onPaddleHit(ball, paddle) {
        const offset = Phaser.Math.Clamp(
            (ball.body.center.x - paddle.body.center.x) / (PADDLE_WIDTH / 2), -1, 1
        );
        const layerStep = offset < -1 / 3 ? 1 : offset > 1 / 3 ? -1 : 0;
        this.layer = Phaser.Math.Clamp(this.layer + layerStep, 0, LAYERS.length - 1);

        const angle = offset * Math.PI / 3;
        const speed = BALL_SPEED * LAYERS[this.layer].speed;
        ball.body.setVelocity(Math.sin(angle) * speed, -Math.cos(angle) * speed);
    }

    onBrickHit(ball, brick) {
        brick.destroy();
        if (this.bricks.getLength() === 0) {
            this.endGame('ALL LAYERS CLEARED');
        }
    }

    endGame(message) {
        this.finished = true;
        this.started = false;
        this.ball.body.stop();
        this.status.setText(`${message}  /  CLICK OR SPACE TO RESTART`);
    }

    updatePaddle(delta) {
        const left = this.cursors.left.isDown || this.keys.A.isDown;
        const right = this.cursors.right.isDown || this.keys.D.isDown;
        const direction = Number(right) - Number(left);
        const scale = LAYERS[this.layer].scale;
        let x = this.paddle.x;
        if (direction !== 0) {
            this.pointerX = null;
            x += direction * 1200 * delta / 1000;
        } else if (this.pointerX !== null) {
            x = GAME_WIDTH / 2 + (this.pointerX - GAME_WIDTH / 2) / scale;
        }
        const halfWidth = PADDLE_WIDTH / 2;
        this.paddle.body.reset(
            Phaser.Math.Clamp(x, WALL_MARGIN + halfWidth, GAME_WIDTH - WALL_MARGIN - halfWidth),
            PADDLE_Y
        );
    }

    project(x, y, layer) {
        const { scale, top } = LAYERS[layer];
        return {
            x: GAME_WIDTH / 2 + (x - GAME_WIDTH / 2) * scale,
            y: top + (y - FIELD_TOP) * scale * 0.76
        };
    }

    drawPlayfield() {
        const g = this.playfield;
        g.clear();

        const rightWall = GAME_WIDTH - WALL_MARGIN;
        const corners = [[WALL_MARGIN, FIELD_TOP], [rightWall, FIELD_TOP],
            [WALL_MARGIN, PADDLE_Y], [rightWall, PADDLE_Y]];
        g.lineStyle(2, 0x8093be, 0.35);
        for (const [x, y] of corners) {
            const near = this.project(x, y, 0);
            const far = this.project(x, y, 2);
            g.lineBetween(near.x, near.y, far.x, far.y);
        }

        for (let layer = LAYERS.length - 1; layer >= 0; layer -= 1) {
            const { color, scale } = LAYERS[layer];
            const active = layer === this.layer;
            const topLeft = this.project(WALL_MARGIN, FIELD_TOP, layer);
            const bottomRight = this.project(rightWall, PADDLE_Y, layer);
            g.lineStyle(active ? 4 : 2, color, active ? 0.7 : 0.28);
            g.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

            for (const brick of this.bricks.getChildren()) {
                if (brick.layer !== layer) {
                    continue;
                }
                const point = this.project(brick.x - brick.width / 2, brick.y - brick.height / 2, layer);
                const width = brick.width * scale;
                const height = brick.height * scale * 0.76;
                g.fillStyle(color, active ? 0.32 : 0.09);
                g.fillRect(point.x, point.y, width, height);
                g.lineStyle(active ? 3 : 2, color, active ? 1 : 0.43);
                g.strokeRect(point.x, point.y, width, height);
            }
        }

        const { name, color, scale, speedLabel } = LAYERS[this.layer];
        const zoneWidth = PADDLE_WIDTH / 3;
        const zoneColors = [LAYERS[2].color, color, LAYERS[0].color];
        this.zoneLabels.forEach((label, zone) => {
            const left = this.paddle.x - PADDLE_WIDTH / 2 + zone * zoneWidth;
            const point = this.project(left, PADDLE_Y, this.layer);
            const atLimit = (zone === 0 && this.layer === 2) || (zone === 2 && this.layer === 0);
            g.fillStyle(zoneColors[zone], atLimit ? 0.25 : 0.95);
            g.fillRect(point.x + 2, point.y - 6, zoneWidth * scale - 4, 12);
            label.setPosition(point.x + zoneWidth * scale / 2, point.y + 12).setAlpha(atLimit ? 0.4 : 1);
        });

        const ball = this.project(this.ball.x, this.ball.y, this.layer);
        g.fillStyle(color, 0.25);
        g.fillCircle(ball.x, ball.y, BALL_RADIUS * scale * 2);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(ball.x, ball.y, BALL_RADIUS * scale);

        this.hud.setText(`DEPTH ${name}    SPEED ${speedLabel}    BRICKS ${this.bricks.getLength()}    LIVES ${this.lives}`);
        this.hud.setTint(color);
        this.status.setVisible(!this.started);
        if (!this.started && !this.finished) {
            this.status.setText('CLICK / SPACE TO SERVE');
        }
    }

    update(time, delta) {
        if (!this.finished) {
            this.updatePaddle(delta);
            if (this.started && this.ball.y > GAME_HEIGHT) {
                this.lives -= 1;
                this.ball.body.stop();
                if (this.lives === 0) {
                    this.endGame('GAME OVER');
                } else {
                    this.layer = MIDDLE_LAYER;
                    this.started = false;
                }
            }
            if (!this.started && !this.finished) {
                this.ball.body.reset(this.paddle.x, PADDLE_Y - 42);
            }
        }
        this.drawPlayfield();
    }
}

new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#090d18',
    scene: GameScene,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
});
