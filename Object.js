class Object
{
    constructor(ID_, Position_, Size_, Velocity_, ObjectCollision_)
    {
        this.ID = ID_;
        this.Position = Position_;
        this.Size = Size_;
        this.Velocity = Velocity_;
        this.ObjectCollision = ObjectCollision_;
        this.Colour = 'white';
    }
    
    //Converts the position and size to a set of coordinate boundaries
    getBounds()
    {
        return [this.Position, [this.Position[0] + this.Size[0], this.Position[1] + this.Size[1]]];
    }
    
    setTickFunction(Function)
    {
        this.TickFunction = Function;
    }
    
    setCollisionFunction(Function)
    {
        this.CollisionFunction = Function;
    }
}

if(typeof module !== 'undefined')
    module.exports = Object;