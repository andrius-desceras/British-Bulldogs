var serverAddress = 'http://localhost:8080';            
var socket = io(serverAddress);

var GameInProgress;
var MyPlayerID;

var Canvas = document.getElementById("canvas");
var ctx = Canvas.getContext("2d");

function Initialise() 
{
    GameInProgress = false;
    
    socket.emit('NewPlayer', {Name: "USERNAME"});
    
    //Initialise new game
    socket.on('NewGame', function(data)
    {
        GameInProgress = true;
        MyPlayerID = data.MyPlayerID;
    });
    
    socket.on('UpdateMovement', function(data)
    {
        UpdatePositions(data.PlayerPositions, data.ID);
    });
    
    //Adds listeners for when keys are pressed and released
    window.addEventListener("keydown", KeyDown);
    window.addEventListener("keyup", KeyUp);s
}
    
function KeyDown(e)
{
    if(getKeyID(e.keyCode) != 0 && GameInProgress)
        SendKeyPress(getKeyID(e.keyCode), true);
}

function KeyUp(e)
{
    if(getKeyID(e.keyCode) != 0 && GameInProgress)
        SendKeyPress(getKeyID(e.keyCode), false);
}

//Converts the javascript keycode to the ID that the server can understand
function getKeyID(code)
{
    switch(code)
    {
        case 37:
            return 1
            
        case 38:
            return 2;
            
        case 39:
            return 3;
            
        case 40:
            return 4;
            
        case 65:
            return 1;
            
        case 87:
            return 2;
            
        case 68:
            return 3;
            
        case 83:
            return 4;
            
        default:
            return 0;
    }
}

function SendKeyPress(KeyID, Moving)
{   
    socket.emit('KeyPress',
    {
        PlayerID: MyPlayerID,
        Key: KeyID,
        isMoving: Moving
    });
}

//Draw a new frame with updated positions
function UpdatePositions(PlayerPositions, ID)
{
    ctx.clearRect(0, 0, Canvas.width, Canvas.height);
    
    //Loop through all positions
    for(var i = 0; i < PlayerPositions.length; i++)
    {
        //Ensures that this client's player is not drawn
        if(i !== ID)
            switch(PlayerPositions[i].ObjectTypeID)
            {
                case 1:
                    DrawObject(PlayerPositions[i].Position, [12, 12], 'blue');
                    break;
                    
                case 2:
                    DrawObject(PlayerPositions[i].Position, PlayerPositions[i].Size, 'red');
                    break;
            }
    }
    
    //Draw this client's player
    DrawObject(PlayerPositions[ID].Position, [12, 12], 'green');
}

//Draws an object on the canvas
function DrawObject(Position, Size, Colour)
{
    ctx.fillStyle = Colour;
    ctx.fillRect(Math.floor(Position[0]), Math.floor(Position[1]), Size[0], Size[1]);
}