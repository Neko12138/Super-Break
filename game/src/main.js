const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        this.title = this.add.text(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            '这里是游戏',
            {
                fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
                fontSize: '96px',
                fontStyle: 'bold',
                color: '#ff0000',
                align: 'center'
            }
        );

        this.title.setOrigin(0.5);
    }

    update(time) {
        const hue = (time * 0.06) % 360;
        this.title.setColor(`hsl(${hue}, 100%, 50%)`);
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    scene: GameScene,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false
    }
};

new Phaser.Game(config);
