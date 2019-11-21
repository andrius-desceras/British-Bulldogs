class Player
{   
    //Creates new default player
    constructor(ID_, Name_, Position_, Velocity_)
    {
        this.ID = ID_;
        this.Name = Name_;
        
        if(Position_ === null)
            this.Position = [10, 10];
        else
            this.Position = Position_;
        
        if(Velocity_ === null)
            this.Velocity = [0, 0];
        else
            this.Velocity = Velocity_;
        
        this.SpeedBuffMultiplier = 1;
        
        this.Inputs = [false, false, false, false];
    }
    
    setSocketID(SocketID_)
    {
        this.SocketID = SocketID_;
    }
    
    setPosition(Position_)
    {
        this.Position = Position_;
    }
    
    getVelocity()
    {
        var v = [0, 0];
        
        if(this.Inputs[0])
            v[0] += -1;
        
        if(this.Inputs[1])
            v[1] += -1;
        
        if(this.Inputs[2])
            v[0] += 1;
        
        if(this.Inputs[3])
            v[1] += 1;

        return v;
    }
    
    //Updates the velocity of the player
    updateInputs(InputID, isMoving)
    {
        this.Inputs[InputID - 1] = isMoving;
    }
}

if(typeof module !== 'undefined')
    module.exports = Player;