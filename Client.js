var serverAddress = 'http://localhost:8080';            
var socket = io(serverAddress);

var GameInProgress;
var MyPlayerID;
var PlayerState;
var StartTime;
var CurrentTime;
var BigTextDuration;
var WinnerData;

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
        PlayerState = 'alive';
        StartTime = new Date();
    });
    
    socket.on('UpdateMovement', function(data)
    {
        UpdatePositions(data.PlayerPositions, data.ID, data.Stamina);
    });
    
    socket.on('Eliminated', function(data)
    {
        Eliminate(data);
    });
    
    socket.on('Safe', function()
    {
        Safe();
    });
    
    socket.on('EndGame', function(data)
    {
        EndGame(data);
    });
    
    //Adds listeners for when keys are pressed and released
    window.addEventListener("keydown", KeyDown);
    window.addEventListener("keyup", KeyUp);
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
        case 32:
            return 5;
            
        case 16:
            return 5;
            
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
function UpdatePositions(PlayerPositions, ID, Stamina)
{
    //ctx.clearRect(0, 0, Canvas.width, Canvas.height);
    DrawObject([0, 0], [Canvas.width, Canvas.height], 'black');
    //Loop through all positions
    for(var i = 0; i < PlayerPositions.length; i++)
    {
        //Ensures that this client's player is not drawn
        if(PlayerPositions[i].Alive && i !== ID)
            switch(PlayerPositions[i].ObjectTypeID)
            {
                case 1:
                    DrawObject(PlayerPositions[i].Position, [12, 12], 'blue');
                    break;
                    
                case 2:
                    DrawObject(PlayerPositions[i].Position, PlayerPositions[i].Size, PlayerPositions[i].Colour, PlayerPositions[i].BorderColour);
                    break;
            }
    }
    
    //Draw this client's player if they are alive
    if(PlayerPositions[ID].Alive)
        DrawObject(PlayerPositions[ID].Position, [12, 12], 'green');
    
    DrawUI(Stamina);
}

function DrawUI(Stamina)
{
    DrawObject([18, Canvas.height - 37], [54, 19], 'green');
    DrawObject([20, Canvas.height - 35], [Stamina / 2, 15], 'rgba(255, 255, 255, 0.5)');
    DrawObject([30, Canvas.height - 35], [1, 15], 'white');
    
    
    if(BigTextDuration > 0)
    {
        ctx.font = "bold 30px Arial";

        BigTextDuration--;
    }
    else
        ctx.font = "bold 15px Arial";
    
    switch(PlayerState)
    {
        case 'alive':
            CurrentTime = new Date() - StartTime;
            break;
            
        case 'eliminated':
            ctx.fillText("ELIMINATED", (Canvas.width / 2) - (ctx.measureText('ELIMINATED').width / 2), BigTextDuration > 0 ? 60 : 30);
            break;
            
        case 'safe':
            ctx.fillText("SAFE", (Canvas.width / 2) - (ctx.measureText('SAFE').width / 2), BigTextDuration > 0 ? 60 : 30);
            break;
            
        case 'end':
            if(WinnerData === undefined || WinnerData === null)
                var Text = 'NOBODY WINS';
            else
                var Text = WinnerData.Username + ' WINS: ' + (WinnerData.CompletionTime / 1000).toFixed(2) + 'S';
            
            ctx.fillText(Text, (Canvas.width / 2) - (ctx.measureText(Text).width / 2), BigTextDuration > 0 ? 60 : 30);
            break;
            
        default:
            
            break;
    }
    
    ctx.font = "15px Arial";
    ctx.fillStyle = 'white';
    ctx.fillText((CurrentTime / 1000).toFixed(2) + 's', 10, 20);
}

//Draws an object on the canvas
function DrawObject(Position, Size, Colour, BorderColour)
{
    if(BorderColour !== undefined && Colour !== BorderColour)
    {
        ctx.fillStyle = BorderColour;
        ctx.fillRect(Position[0], Position[1], Size[0], Size[1]);
        
        ctx.fillStyle = Colour;
        ctx.fillRect(Position[0] + 2, Position[1] + 2, Size[0] - 4, Size[1] - 4);
    }
    else
    {
        ctx.fillStyle = Colour;
        ctx.fillRect(Position[0], Position[1], Size[0], Size[1]);
    }
    
}

function Eliminate(data)
{
    BigTextDuration = 512;
    
    PlayerState = 'eliminated';
}

function Safe()
{
    BigTextDuration = 512;
    
    PlayerState = 'safe';
}

function EndGame(Data)
{
    BigTextDuration = 512;
    
    PlayerState = 'end';
    
    WinnerData = Data;
}