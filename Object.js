class Object
{
    constructor(ID_, Position_, Size_, Velocity_)
    {
        this.ID = ID_;
        this.Position = Position_;
        this.Size = Size_;
        this.Velocity = Velocity_;
    }
    
    //Converts the position and size to a set of coordinate boundaries
    getBounds()
    {
        return [this.Position, [this.Position[0] + this.Size[0], this.Position[1] + this.Size[1]]];
    }
}

if(typeof module !== 'undefined')
    module.exports = Object;