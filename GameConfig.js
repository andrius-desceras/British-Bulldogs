class GameConfig
{
    constructor()
    {
        //Game server configuration settings
        this.GlobalSpeed = 0.5;
        this.TickRate = 256;
        this.MinPlayers = 2;
        this.MaxPlayers = 100;
        this.MapSize = [1400, 700];
        this.PlayerSize = [12, 12];
        this.Collision = true;
        this.PlayerCollision = true;
        this.StaminaRegenerationRate = 0.1;
        this.StaminaConsumptionRate = 0.6;
        this.SprintMultiplier = 2;
        this.RedZone = true;
        this.RedZoneStartX = 200;
        this.RedZoneSpeed = 0.4;
        this.SafeZoneSize = 50;
        this.MovingObjectSize = [20, 50];
        this.MovingObjectZoneX = [200, 1200];
        this.MovingObjectSpacing = [20, 60];
        this.MovingObjectSpeed = [3, 6];
        this.PowerUpCount = [10, 30];
        this.PowerUpSize = [6, 6];
        this.PowerUpDropRange = [300, 1100];
        this.PowerUpSprintMultiplier = 2;
        this.GhostCount = [4, 8];
        this.GhostXRange = [300, 1100];
        this.GhostYRange = [300, 600];
        this.GhostSize = [10, 10];
        this.GhostSpeed = 0.5;
        this.GhostVisionRange = 200;
    }
}

if(typeof module !== 'undefined')
    module.exports = GameConfig;