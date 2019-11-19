class GameConfig
{
    constructor()
    {
        //Game server configuration settings
        this.GlobalSpeed = 1;
        this.TickRate = 64;
        this.MinPlayers = 2;
        this.MaxPlayers = 100;
        this.MapSize = [1400, 700];
        this.PlayerSize = [12, 12];
        this.Collision = true;
        this.PlayerCollision = true;
    }
}

if(typeof module !== 'undefined')
    module.exports = GameConfig;