const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const FACE_COUNT = 6;
const TAU = Math.PI * 2;
const CENTER = { x: GAME_WIDTH / 2, y: 520 };
const OUTER_RADIUS = 485;
const INNER_RADIUS = 168;
const BALL_RADIUS = 13;
const BALL_SPEED = 0.00034;
const PADDLE_SPEED = 0.00072;
const PADDLE_WIDTH = 0.31;
const PADDLE_DEPTH = 0.89;
const BRICK_ROWS = 3;
const BRICK_COLUMNS = 5;
const FACE_COLORS = [0xff315a, 0xff8a25, 0xffee33, 0x20f080, 0x22d9ff, 0xc64dff];

// Each face owns a local (u, v) plane. Drawing projects the same coordinates
// into six differently angled quadrilaterals, while one ball moves across all of them.
class HexBreakoutScene extends Phaser.Scene {
    constructor() {
        super('HexBreakoutScene');
    }

    create() {
        this.graphics = this.add.graphics();
        this.keys = this.input.keyboard.addKeys('A,D');
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.on('keydown-SPACE', this.launchBall, this);
        this.heldDirection = 0;
        this.directionOrientation = 1;

        this.add.text(42, 32, 'SUPER BREAK // VECTOR TUBE', {
            fontFamily: 'monospace', fontSize: '27px', color: '#ffffff'
        });
        this.hud = this.add.text(42, 72, '', {
            fontFamily: 'monospace', fontSize: '20px', color: '#46eaff', lineSpacing: 7
        });
        this.add.text(GAME_WIDTH / 2, 1038,
            'A / D OR LEFT / RIGHT: MOVE AROUND THE SIX FACES     SPACE: LAUNCH / RESTART', {
                fontFamily: 'monospace', fontSize: '20px', color: '#6d7fa0'
            }).setOrigin(0.5);
        this.message = this.add.text(GAME_WIDTH / 2, 520, '', {
            fontFamily: 'monospace', fontSize: '27px', color: '#ffffff',
            backgroundColor: '#000000dd', padding: { x: 20, y: 13 }, align: 'center'
        }).setOrigin(0.5).setDepth(5);

        this.resetGame();
    }

    resetGame() {
        this.lives = 3;
        this.score = 0;
        this.started = false;
        this.finished = false;
        this.paddleS = 2.5;
        this.ballS = this.paddleS;
        this.ballV = PADDLE_DEPTH - 0.055;
        this.ballVelocityS = 0.00011;
        this.ballVelocityV = -BALL_SPEED;
        this.bricks = [];

        for (let face = 0; face < FACE_COUNT; face += 1) {
            for (let row = 0; row < BRICK_ROWS; row += 1) {
                for (let column = 0; column < BRICK_COLUMNS; column += 1) {
                    this.bricks.push({ face, row, column, alive: true });
                }
            }
        }
    }

    launchBall() {
        if (this.finished) {
            this.resetGame();
            return;
        }
        if (this.started) return;

        this.started = true;
        const offset = Phaser.Math.Clamp(this.shortestSurfaceDelta(this.ballS, this.paddleS), -0.5, 0.5);
        this.ballVelocityS = offset * 0.00042 + 0.00010;
        this.ballVelocityV = -Math.sqrt(Math.max(BALL_SPEED ** 2 - this.ballVelocityS ** 2, 0.00000001));
    }

    shortestSurfaceDelta(a, b) {
        let delta = a - b;
        if (delta > FACE_COUNT / 2) delta -= FACE_COUNT;
        if (delta < -FACE_COUNT / 2) delta += FACE_COUNT;
        return delta;
    }

    wrapSurface(value) {
        return Phaser.Math.Wrap(value, 0, FACE_COUNT);
    }

    faceOf(surfacePosition) {
        return Math.floor(this.wrapSurface(surfacePosition));
    }

    localU(surfacePosition) {
        const wrapped = this.wrapSurface(surfacePosition);
        return wrapped - Math.floor(wrapped);
    }

    polygonPoint(radius, vertex) {
        const angle = -Math.PI / 2 + vertex * TAU / FACE_COUNT;
        return {
            x: CENTER.x + Math.cos(angle) * radius,
            y: CENTER.y + Math.sin(angle) * radius
        };
    }

    project(face, u, v) {
        const outerA = this.polygonPoint(OUTER_RADIUS, face);
        const outerB = this.polygonPoint(OUTER_RADIUS, face + 1);
        const innerA = this.polygonPoint(INNER_RADIUS, face);
        const innerB = this.polygonPoint(INNER_RADIUS, face + 1);
        const outer = {
            x: Phaser.Math.Linear(outerA.x, outerB.x, u),
            y: Phaser.Math.Linear(outerA.y, outerB.y, u)
        };
        const inner = {
            x: Phaser.Math.Linear(innerA.x, innerB.x, u),
            y: Phaser.Math.Linear(innerA.y, innerB.y, u)
        };
        return {
            x: Phaser.Math.Linear(inner.x, outer.x, v),
            y: Phaser.Math.Linear(inner.y, outer.y, v)
        };
    }

    surfaceScale(v) {
        return Phaser.Math.Linear(INNER_RADIUS / OUTER_RADIUS, 1, v);
    }

    movePaddle(delta) {
        const left = this.keys.A.isDown || this.cursors.left.isDown;
        const right = this.keys.D.isDown || this.cursors.right.isDown;
        const rawDirection = Number(right) - Number(left);

        if (rawDirection === 0) {
            this.heldDirection = 0;
        } else if (rawDirection !== this.heldDirection) {
            // A fresh press updates the visual left/right mapping on the two top
            // or two bottom faces. The vertical side faces inherit the previous
            // mapping, avoiding an ambiguous reversal while travelling around a corner.
            const face = this.faceOf(this.paddleS);
            if (face === 0 || face === 5) {
                this.directionOrientation = 1;
            } else if (face === 2 || face === 3) {
                this.directionOrientation = -1;
            }
            this.heldDirection = rawDirection;
        }

        const direction = rawDirection * this.directionOrientation;
        this.paddleS = this.wrapSurface(this.paddleS + direction * PADDLE_SPEED * delta);

        if (!this.started) {
            this.ballS = this.paddleS;
            this.ballV = PADDLE_DEPTH - 0.055;
        }
    }

    updateBall(delta) {
        if (!this.started || this.finished) return;

        const previousV = this.ballV;
        this.ballS = this.wrapSurface(this.ballS + this.ballVelocityS * delta);
        this.ballV += this.ballVelocityV * delta;
        this.hitBricks(previousV);

        if (this.ballV < 0.055) {
            this.ballV = 0.055;
            this.ballVelocityV = Math.abs(this.ballVelocityV);
        }

        if (previousV < PADDLE_DEPTH && this.ballV >= PADDLE_DEPTH && this.ballVelocityV > 0) {
            const paddleDelta = this.shortestSurfaceDelta(this.ballS, this.paddleS);
            if (Math.abs(paddleDelta) <= PADDLE_WIDTH / 2) {
                this.ballV = PADDLE_DEPTH;
                const aim = Phaser.Math.Clamp(paddleDelta / (PADDLE_WIDTH / 2), -1, 1);
                this.ballVelocityS = Phaser.Math.Clamp(
                    this.ballVelocityS + aim * 0.00018, -0.00028, 0.00028
                );
                this.ballVelocityV = -Math.sqrt(
                    Math.max(BALL_SPEED ** 2 - this.ballVelocityS ** 2, 0.00000001)
                );
            }
        }

        if (this.ballV > 1.08) this.loseBall();
    }

    hitBricks(previousV) {
        const face = this.faceOf(this.ballS);
        const u = this.localU(this.ballS);
        const brickWidth = 0.158;
        const brickHeight = 0.082;

        for (const brick of this.bricks) {
            if (!brick.alive || brick.face !== face) continue;
            const left = 0.105 + brick.column * 0.177;
            const top = 0.145 + brick.row * 0.105;
            if (u >= left && u <= left + brickWidth &&
                this.ballV >= top && this.ballV <= top + brickHeight) {
                brick.alive = false;
                this.score += 100;
                const crossedVertically = previousV < top || previousV > top + brickHeight;
                if (crossedVertically) this.ballVelocityV *= -1;
                else this.ballVelocityS *= -1;

                if (!this.bricks.some((candidate) => candidate.alive)) {
                    this.finished = true;
                    this.started = false;
                }
                return;
            }
        }
    }

    loseBall() {
        this.lives -= 1;
        this.started = false;
        if (this.lives <= 0) {
            this.finished = true;
            return;
        }
        this.ballS = this.paddleS;
        this.ballV = PADDLE_DEPTH - 0.055;
        this.ballVelocityS = 0.0001;
        this.ballVelocityV = -BALL_SPEED;
    }

    drawFace(g, face) {
        const color = FACE_COLORS[face];
        const active = face === this.faceOf(this.ballS) || face === this.faceOf(this.paddleS);
        const corners = [
            this.project(face, 0, 0), this.project(face, 1, 0),
            this.project(face, 1, 1), this.project(face, 0, 1)
        ];

        g.fillStyle(color, active ? 0.025 : 0.008);
        g.fillPoints(corners, true);
        g.lineStyle(active ? 4 : 2, color, active ? 1 : 0.55);
        g.strokePoints(corners, true);

        for (let line = 1; line < 5; line += 1) {
            const u = line / 5;
            const start = this.project(face, u, 0);
            const end = this.project(face, u, 1);
            g.lineStyle(1, color, active ? 0.26 : 0.14);
            g.lineBetween(start.x, start.y, end.x, end.y);
        }
        for (const v of [0.2, 0.4, 0.6, 0.8]) {
            const start = this.project(face, 0, v);
            const end = this.project(face, 1, v);
            g.lineStyle(v === 0.8 ? 2 : 1, color, active ? 0.32 : 0.16);
            g.lineBetween(start.x, start.y, end.x, end.y);
        }

        const railLeft = this.project(face, 0.03, 0.02);
        const railLeftEnd = this.project(face, 0.03, 0.98);
        const railRight = this.project(face, 0.97, 0.02);
        const railRightEnd = this.project(face, 0.97, 0.98);
        g.lineStyle(2, 0xffffff, active ? 0.35 : 0.1);
        g.lineBetween(railLeft.x, railLeft.y, railLeftEnd.x, railLeftEnd.y);
        g.lineBetween(railRight.x, railRight.y, railRightEnd.x, railRightEnd.y);
    }

    drawBricks(g) {
        const brickWidth = 0.158;
        const brickHeight = 0.082;
        for (const brick of this.bricks) {
            if (!brick.alive) continue;
            const u = 0.105 + brick.column * 0.177;
            const v = 0.145 + brick.row * 0.105;
            const points = [
                this.project(brick.face, u, v),
                this.project(brick.face, u + brickWidth, v),
                this.project(brick.face, u + brickWidth, v + brickHeight),
                this.project(brick.face, u, v + brickHeight)
            ];
            const color = FACE_COLORS[brick.face];
            g.fillStyle(color, 0.025);
            g.fillPoints(points, true);
            g.lineStyle(2, color, 1);
            g.strokePoints(points, true);
            g.lineStyle(1, 0xffffff, 0.22);
            g.lineBetween(points[0].x, points[0].y, points[2].x, points[2].y);
        }
    }

    splitAcrossFaces(surfaceCenter, width) {
        const pieces = [];
        let start = surfaceCenter - width / 2;
        const end = surfaceCenter + width / 2;
        while (start < end) {
            const face = Math.floor(start);
            const pieceEnd = Math.min(end, face + 1);
            pieces.push({
                face: Phaser.Math.Wrap(face, 0, FACE_COUNT),
                u0: start - face,
                u1: pieceEnd - face
            });
            start = pieceEnd;
        }
        return pieces;
    }

    drawPaddle(g) {
        for (const piece of this.splitAcrossFaces(this.paddleS, PADDLE_WIDTH)) {
            const color = FACE_COLORS[piece.face];
            const centerA = this.project(piece.face, piece.u0, PADDLE_DEPTH);
            const centerB = this.project(piece.face, piece.u1, PADDLE_DEPTH);
            g.lineStyle(7, color, 0.32);
            g.lineBetween(centerA.x, centerA.y, centerB.x, centerB.y);
            g.lineStyle(3, 0xffffff, 0.88);
            g.lineBetween(centerA.x, centerA.y, centerB.x, centerB.y);
        }
    }

    drawBall(g) {
        const face = this.faceOf(this.ballS);
        const u = this.localU(this.ballS);
        const point = this.project(face, u, this.ballV);
        const radius = BALL_RADIUS * this.surfaceScale(this.ballV);
        const color = FACE_COLORS[face];
        const ahead = this.project(
            face,
            Phaser.Math.Clamp(u + this.ballVelocityS * 170, 0, 1),
            Phaser.Math.Clamp(this.ballV + this.ballVelocityV * 170, 0, 1)
        );

        g.lineStyle(2, color, 0.72);
        g.lineBetween(point.x, point.y, ahead.x, ahead.y);
        g.lineStyle(2, color, 0.45);
        g.strokeCircle(point.x, point.y, radius * 1.45);
        g.fillStyle(0xffffff, 0.92);
        g.fillCircle(point.x, point.y, radius * 0.48);
    }

    draw() {
        const g = this.graphics;
        g.clear();
        for (let face = 0; face < FACE_COUNT; face += 1) this.drawFace(g, face);
        this.drawBricks(g);
        this.drawPaddle(g);
        this.drawBall(g);

        const remaining = this.bricks.filter((brick) => brick.alive).length;
        this.hud.setText(
            `BALL FACE ${this.faceOf(this.ballS) + 1}    PADDLE FACE ${this.faceOf(this.paddleS) + 1}\n` +
            `BRICKS ${remaining}/${FACE_COUNT * BRICK_ROWS * BRICK_COLUMNS}    ` +
            `SCORE ${this.score}    LIVES ${this.lives}`
        );

        if (this.finished) {
            const result = this.lives > 0 ? 'ALL SIX FACES CLEARED' : 'PROTOTYPE OVER';
            this.message.setText(`${result}\nSPACE TO RESTART`).setVisible(true);
        } else if (!this.started) {
            this.message.setText('ONE BALL // SIX CONNECTED PLANES\nSPACE TO LAUNCH').setVisible(true);
        } else {
            this.message.setVisible(false);
        }
    }

    update(time, delta) {
        const safeDelta = Math.min(delta, 34);
        this.movePaddle(safeDelta);
        this.updateBall(safeDelta);
        this.draw();
    }
}

new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000005',
    scene: HexBreakoutScene,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
});
