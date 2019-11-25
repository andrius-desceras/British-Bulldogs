class Player
{   
    //Creates new default player
    constructor(ID, Name, SprintMultiplier, StaminaConsumptionRate)
    {
        this.ID = ID;
        this.Name = Name;
        this.Position = [0, 0];
        this.MaxStamina = 100;
        this.Stamina = this.MaxStamina;
        this.StaminaConsumptionRate = StaminaConsumptionRate;
        this.SprintMultiplier = SprintMultiplier;
        this.SpeedBuffMultipliers = [{Multipler: 1, Duration: -1}];
        this.KillTouchDuration = 0;
        
        this.CompletionTimes = [];
        
        this.Inputs = [false, false, false, false, false];
        this.Targeted = false;
        this.Safe = false;
        this.Eliminated = false;
        this.Active = true;
    }
    
    getVelocity()
    {
        var v = [0, 0];
        
        //Calculate the velocity from the current player input
        if(this.Inputs[0])
            v[0] += -1;
        
        if(this.Inputs[1])
            v[1] += -1;
        
        if(this.Inputs[2])
            v[0] += 1;
        
        if(this.Inputs[3])
            v[1] += 1;
        
        //If the player is using sprint and has stamina and is moving, increase velocity
        if(this.Inputs[4] && this.Stamina > 1 && (v[0] !== 0 || v[1] != 0))
        {
            this.SpeedBuffMultipliers[0] = {Multipler: 2, Duration: -1};
            this.Stamina-= this.StaminaConsumptionRate;
        }
        else
        {
            this.SpeedBuffMultipliers[0] = {Multipler: 1, Duration: -1};
            
            this.Inputs[4] = false;
        }
        
        var s = 1;
        
        //Calculate the total speed multiplier and process any decaying movement buffs
        for(var i = 0; i < this.SpeedBuffMultipliers.length; i++)
        {
            s*= this.SpeedBuffMultipliers[i].Multipler;
            
            if(this.SpeedBuffMultipliers[i].Duration !== -1)
                this.SpeedBuffMultipliers[i].Duration--;
            
            if(this.SpeedBuffMultipliers[i].Duration === 0)
                this.SpeedBuffMultipliers.splice(i, 1);
        }
        
        this.KillTouchDuration--;
        
        this.SpeedBuffMultiplier = s;
        
        return v;
    }
    
    //Updates the velocity of the player
    updateInputs(InputID, isMoving)
    {
        if(InputID !== 5 || this.Stamina > 20 || !isMoving)
            this.Inputs[InputID - 1] = isMoving;
    }
    
    //Gets the total time the player has been alive in consecutive rounds
    TotalTime()
    {
        return this.CompletionTimes.reduce((x, y) => x + y);
    }
}

if(typeof module !== 'undefined')
    module.exports = Player;