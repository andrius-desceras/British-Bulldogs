var serverAddress = 'http://localhost:8080';            
var socket = io(serverAddress);

var GameInProgress;
var MyPlayerID;
var PlayerState;
var StartTime;
var CurrentTime;
var WaitTime;
var TickTime;
var BigTextDuration;
var WinnerData;
var ConnectionCheckers = [];

var Canvas = document.getElementById("canvas");
var ctx = Canvas.getContext("2d");
var TextBox = document.getElementById("textInput");
var Form = document.getElementById("form");
var JoinButton = document.getElementById("join");
var Heading = document.getElementById("heading");

function Initialise() 
{   
    GameInProgress = false;
    
    //Initialise new game
    socket.on('NewGame', function(data)
    {
        GameInProgress = true;
        MyPlayerID = data.MyPlayerID;
        PlayerState = 'alive';
        StartTime = new Date();
        
        if(MyPlayerID === -1)
            PlayerState = 'spectator';
        
        ConnectionCheckers.push(setInterval(function()
        {
            if(new Date() - TickTime > 100)
            {
                if(PlayerState === 'spectator')
                {
                    ClearConnectionCheckers();
                    
                    GameInProgress = false;
                    
                    DrawObject([0, 0], [Canvas.width, Canvas.height], 'black');
        
                    JoinButton.style.display = 'block';
                    Heading.style.display = 'block';
                    Canvas.style.display = 'none';
                }
                else
                {
                    ShowError('ERROR: Connection dropped');
                        
                    ClearConnectionCheckers();
                }
            }
        }, 50));
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
    
    socket.on('Full', function()
    {
        ShowError('Lobby is full');
    });
    
    socket.on('SetStartTimer', function(data)
    {
        WaitTime = data.Time;
        
        var Text = 'Game Starting: ' + Math.floor(WaitTime / 1000);
        
        ctx.font = "45px Arial";
        ctx.fillStyle = 'white';
        ctx.fillText(Text, (Canvas.width / 2) - (ctx.measureText(Text).width / 2), 80);
        
        StartTimer = setInterval(function()
        {
            WaitTime-= 1000;
            
            if(!GameInProgress)
            {
                var Text = 'Game Starting: ' + Math.floor(WaitTime / 1000);

                DrawObject([0, 0], [Canvas.width, Canvas.height], 'black');

                ctx.font = "45px Arial";
                ctx.fillStyle = 'white';
                ctx.fillText(Text, (Canvas.width / 2) - (ctx.measureText(Text).width / 2), 80);
            }
            
            if(WaitTime < 0)
            {
                TickTime = new Date();
                
                ConnectionCheckers.push(setInterval(function()
                {
                    if(new Date() - TickTime > 100)
                    {
                        ShowError('ERROR: Connection dropped');
                        
                        ClearConnectionCheckers();
                    }
                }, 50));
                
                WaitTime = 0;
            
                clearInterval(StartTimer);
            }
        }, 1000);
    });
    
    socket.on('LeaderboardData', function(data)
    {
        if(data.LB === [])
        {
            var Table = '<p>ERROR: Cannot retrieve Leaderboard data</p>';
        }
        else    
        {
            var Table = '<table><tr><th>Username</th><th>Consecutive Rounds</th><th>Total Time</th></tr>'
            
            for(var i = 0; i < data.LB.length; i++)
                Table+= '<tr><td>' + data.LB[i].Name + '</td><td>' + data.LB[i].Rounds + '</td><td>' + data.LB[i].Time / 1000 + 's</td></tr>';
            
            Table+= '</table>';
        }

        document.getElementById('table').innerHTML = Table;
    });
    
    //Adds listeners for when keys are pressed and released
    window.addEventListener("keydown", KeyDown);
    window.addEventListener("keyup", KeyUp);
}
   
function Join()
{
    if(TextBox.value !== '')
    {
        socket.emit('NewPlayer', {Name: TextBox.value});

        Form.style.display = 'none';
        JoinButton.style.display = 'none';
        Heading.style.display = 'none';
        Canvas.style.display = 'block';
    }
}

function LoadLeaderboard()
{
    socket.emit('RequestLeaderboard');
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
    TickTime = new Date();
    
    DrawObject([0, 0], [Canvas.width, Canvas.height], 'black');
    
    //Loop through all positions
    for(var i = 0; i < PlayerPositions.length; i++)
    {
        //Ensures that this client's player is not drawn
        if(PlayerPositions[i].Alive && i !== ID)
            switch(PlayerPositions[i].ObjectTypeID)
            {
                case 1:
                    DrawObject(PlayerPositions[i].Position, [12, 12], 'blue', PlayerPositions[i].BorderColour);
                    break;
                    
                case 2:
                    DrawObject(PlayerPositions[i].Position, PlayerPositions[i].Size, PlayerPositions[i].Colour, PlayerPositions[i].BorderColour);
                    break;
            }
    }
    
    //Draw this client's player if they are alive
    if(PlayerPositions[ID].Alive)
        DrawObject(PlayerPositions[ID].Position, [12, 12], 'green', PlayerPositions[ID].BorderColour);
    
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
                var Text = WinnerData.Username + ' WINS: ' + (WinnerData.CompletionTime / 1000).toFixed(2) + 's';
            
            ctx.fillText(Text, (Canvas.width / 2) - (ctx.measureText(Text).width / 2), BigTextDuration > 0 ? 60 : 30);
            break;
            
        case 'spectator':
            ctx.fillText("SPECTATOR", (Canvas.width / 2) - (ctx.measureText('SPECTATOR').width / 2), BigTextDuration > 0 ? 60 : 30);
            break;
            
        default:
            
            break;
    }
    
    if(PlayerState !== 'spectator' && CurrentTime !== undefined)
    {
        ctx.font = "15px Arial";
        ctx.fillStyle = 'white';
        ctx.fillText((CurrentTime / 1000).toFixed(2) + 's', 10, 20);
    }
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
    BigTextDuration = 128;
    
    PlayerState = 'eliminated';
}

function Safe()
{
    BigTextDuration = 128;
    
    PlayerState = 'safe';
}

function EndGame(Data)
{
    ClearConnectionCheckers();
    
    BigTextDuration = 512;
    
    PlayerState = 'end';
    
    WinnerData = Data;
    
    GameInProgress = false;
    
    setTimeout(function()
    {
        DrawObject([0, 0], [Canvas.width, Canvas.height], 'black');
        
        JoinButton.style.display = 'block';
        Heading.style.display = 'none';
        Canvas.style.display = 'none';
    }, 4000);
}

function ShowError(msg)
{
    DrawObject([0, 0], [Canvas.width, Canvas.height], 'black');
    
    ctx.font = "50px Arial";
    ctx.fillStyle = 'white';
    ctx.fillText(msg, (Canvas.width / 2) - (ctx.measureText(msg).width / 2), 60);
}

function ClearConnectionCheckers()
{
    for(var i = 0; i < ConnectionCheckers.length; i++)
        clearInterval(ConnectionCheckers[i]);
    
    ConnectionCheckers = [];
}